/**
 * MasonryFeed.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pinterest-style masonry grid that:
 *   • Reserves tile space via `aspect-ratio` — a pure CSS layout primitive that
 *     works correctly inside fluid columns without needing pixel dimensions.
 *   • Lazy-loads images with IntersectionObserver (~2 viewport-heights ahead).
 *   • Decodes each downloaded image off the main thread with Image.decode()
 *     before writing it to the DOM, keeping the main UI thread free.
 *   • Fades loaded images in with a CSS opacity transition.
 *   • Uses a JS column-splitter layout (not CSS multi-column) to prevent
 *     tile shuffling: pins are assigned to fixed columns at mount time and
 *     never redistributed. Each column is an independent DOM subtree, so a
 *     tile loading in column 2 cannot cause any reflow in columns 1, 3, or 4.
 *
 * WHY IMPERATIVE DOM WRITES FOR LOAD STATE?
 *   Any React setState call re-renders MasonryFeed, which re-runs the
 *   columnGroups.map() and touches every column's props — giving React reason
 *   to reconcile all column subtrees simultaneously and producing the visible
 *   shuffle. The fix is to bypass the React reconciler entirely for per-tile
 *   load state: image reveal writes directly to the DOM via refs (src + class),
 *   so React never sees the update and no re-render occurs.
 *
 * WHY SYNCHRONOUS INITIAL COLUMN COUNT?
 *   useColumnCount previously initialised to a hardcoded fallback (4) then
 *   fired setCount() after mount with the real CSS value. That state change
 *   recomputed columnGroups via useMemo, reassigning every pin to a different
 *   column — itself a visible shuffle. The fix is to derive the initial column
 *   count synchronously from window.innerWidth during the first useMemo call,
 *   so the column layout is stable from the very first paint.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type JSX,
} from "react";
import styles from "./masonry.module.css";

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Distributes pins across `columnCount` columns using a shortest-column-first
 * (greedy) strategy based on cumulative aspect-ratio height.
 *
 * This runs once when `pins` or `columnCount` changes and never again during
 * image loading, so it is the ONLY moment at which column assignment shifts.
 * All subsequent state changes (loading, loaded, error) are isolated to the
 * tile's own DOM node and cannot affect sibling columns.
 */
function distributeToColumns(pins: Pin[], columnCount: number): Pin[][] {
  const columns: Pin[][] = Array.from({ length: columnCount }, () => []);
  // Track the cumulative "height" of each column as a unitless ratio sum.
  const heights = new Array<number>(columnCount).fill(0);

  for (const pin of pins) {
    // Find the shortest column to keep the grid visually balanced.
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].push(pin);
    heights[shortest] += pin.height / pin.width; // aspect ratio contribution
  }

  return columns;
}

/**
 * Returns the current column count by reading the CSS custom property that
 * the grid container exposes.
 */
function getColumnCount(el: HTMLElement | null): number {
  if (!el) return guessColumnCount();
  const raw = getComputedStyle(el).getPropertyValue("--masonry-columns").trim();
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : guessColumnCount();
}

/**
 * Synchronous column-count estimate from window.innerWidth, mirroring the
 * CSS media-query breakpoints. Used only for the very first render so that
 * distributeToColumns() never has to run a second time due to a post-mount
 * state update changing the count from a wrong initial value.
 */
function guessColumnCount(): number {
  if (typeof window === "undefined") return 4; // SSR guard
  const w = window.innerWidth;
  if (w < 480)  return 2;
  if (w < 768)  return 2;
  if (w < 1024) return 3;
  if (w < 1440) return 4;
  return 5;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Passed through dataset so the IntersectionObserver callback can look up the pin. */
type PinId = string | number;

export interface Pin {
  id: string | number;
  url: string;
  /** Intrinsic width of the source image (used to derive aspect-ratio). */
  width: number;
  /** Intrinsic height of the source image (used to derive aspect-ratio). */
  height: number;
  alt?: string;
}



// ─── Hook: useMasonryLoader ───────────────────────────────────────────────────

/**
 * Handles the IntersectionObserver watch loop and the
 * fetch → Image.decode() → DOM-write reveal pipeline.
 *
 * CRITICAL DESIGN DECISION — imperative DOM writes instead of React state:
 *   Every React setState call schedules a re-render of the component that owns
 *   the state. Because tileStates used to live in MasonryFeed, every patchTile()
 *   call re-rendered MasonryFeed, re-ran columnGroups.map(), and passed new
 *   props to every column div — giving React a reason to reconcile all column
 *   subtrees at once. Even though each tile's DOM was ultimately unchanged,
 *   the reconciliation pass itself was enough to make the browser re-evaluate
 *   layout for the whole grid.
 *
 *   The fix: state for each tile lives only in that tile's own refs. Reveal
 *   is performed by writing directly to the img.src and toggling a CSS class
 *   on the <article> element. React never sees these writes. No re-render,
 *   no reconciliation, no layout recalculation in any other tile.
 *
 * @param pins       - Array of Pin descriptors.
 * @param rootMargin - IntersectionObserver rootMargin for prefetch distance.
 */
function useMasonryLoader(
  pins: Pin[],
  rootMargin = "0px 0px 200% 0px"
): {
  /** Call with the tile's <article> element on mount, null on unmount. */
  registerTile: (id: Pin["id"], el: HTMLElement | null) => void;
} {
  // pin.id → { article, img } DOM refs for direct imperative writes.
  const domMap = useRef(new Map<Pin["id"], { article: HTMLElement; img: HTMLImageElement }>());

  // Tracks which pins are already loading/loaded so the observer doesn't
  // re-trigger. A Set of ids is sufficient — no React state needed.
  const loadingSet = useRef(new Set<Pin["id"]>());

  // pin.id → url, stable across renders as long as pins array is stable.
  const pinUrlMap = useMemo(
    () => new Map(pins.map((p) => [p.id, p.url])),
    [pins]
  );

  const observerRef = useRef<IntersectionObserver | null>(null);

  /**
   * Core pipeline. Everything here is imperative — zero React state updates.
   *
   *  1. Mark as loading in the Set (prevents double-trigger).
   *  2. Fetch via new Image() + set src.
   *  3. Await img.decode() off the main thread.
   *  4. Write resolved src directly to the mounted <img> DOM node.
   *  5. Toggle CSS class on the <article> to trigger the opacity transition.
   *  6. On error: add an error class so CSS can style the placeholder.
   */
  const loadImage = useCallback(async (id: Pin["id"], url: string) => {
    loadingSet.current.add(id);

    const offscreen = new Image();
    offscreen.src = url;
    offscreen.crossOrigin = "anonymous";

    try {
      await offscreen.decode();

      const nodes = domMap.current.get(id);
      if (nodes) {
        // Set src while img is still display:none — no layout pass occurs.
        nodes.img.src = url;
        // Unhide the img and trigger the fade in one synchronous class toggle.
        // classList operations are batched by the browser into a single style
        // recalc, so there is never a frame where src is set but display:none
        // is already removed (which would show a flash of the old empty state).
        nodes.img.classList.remove(styles.imageHidden);
        nodes.article.classList.add(styles.tileLoaded);
      }
    } catch {
      const nodes = domMap.current.get(id);
      if (nodes) {
        nodes.article.classList.add(styles.tileError);
      }
    }
  }, [pinUrlMap]); // pinUrlMap in deps satisfies the linter; it's stable in practice

  // Build/rebuild observer when rootMargin changes (rare).
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const id = (entry.target as HTMLElement).dataset.pinId!;
          if (loadingSet.current.has(id)) continue;

          const url = pinUrlMap.get(id);
          if (!url) continue;

          observerRef.current!.unobserve(entry.target);
          loadImage(id, url);
        }
      },
      { rootMargin, threshold: 0 }
    );

    // Re-observe any tiles already mounted but not yet loading.
    for (const [id, { article }] of domMap.current) {
      if (!loadingSet.current.has(id)) {
        observerRef.current.observe(article);
      }
    }

    return () => observerRef.current?.disconnect();
  }, [rootMargin, pinUrlMap, loadImage]);

  /**
   * Callback ref handed to each MasonryTile.
   * On mount  : stores the article + img refs and begins observing.
   * On unmount: cleans up the observer and the domMap entry.
   */
  const registerTile = useCallback(
    (id: Pin["id"], el: HTMLElement | null) => {
      if (el) {
        const img = el.querySelector("img") as HTMLImageElement;
        el.dataset.pinId = String(id);
        domMap.current.set(id, { article: el, img });

        if (!loadingSet.current.has(id) && observerRef.current) {
          observerRef.current.observe(el);
        }
      } else {
        const nodes = domMap.current.get(id);
        if (nodes && observerRef.current) {
          observerRef.current.unobserve(nodes.article);
        }
        domMap.current.delete(id);
        // Leave loadingSet entry — prevents re-fetch if the tile remounts.
      }
    },
    [] // stable: domMap, loadingSet, observerRef are all refs
  );

  return { registerTile };
}

// ─── Hook: useColumnCount ─────────────────────────────────────────────────────

/**
 * Returns a stable column count for the lifetime of a given (pins, columnsProp)
 * pair. The initial value is derived synchronously from window.innerWidth so
 * distributeToColumns() is called exactly once with the correct count and the
 * column layout never shifts due to a post-mount state update.
 *
 * On viewport resize the count does update — but a genuine breakpoint crossing
 * necessarily reshuffles columns regardless of this component, so that is
 * acceptable and expected behavior.
 */
function useColumnCount(
  containerRef: React.RefObject<HTMLElement | null>,
  columnsProp?: number
): number {
  // Initialise synchronously from window.innerWidth so the first useMemo
  // call in MasonryFeed gets the right count and never needs to re-run.
  const [count, setCount] = useState<number>(() => columnsProp ?? guessColumnCount());

  useEffect(() => {
    if (columnsProp != null) {
      setCount(columnsProp);
      return;
    }

    // Re-read from computed style now that CSS has been applied.
    // In most cases this will equal guessColumnCount() and trigger no re-render.
    const precise = getColumnCount(containerRef.current);
    setCount(precise);

    // Watch for breakpoint crossings on resize.
    const ro = new ResizeObserver(() => {
      setCount(getColumnCount(containerRef.current));
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef, columnsProp]);

  return count;
}

// ─── MasonryTile ─────────────────────────────────────────────────────────────

interface MasonryTileProps {
  pin: Pin;
  onRegister: (id: PinId, el: HTMLElement | null) => void;
}

/**
 * A single tile. Deliberately has NO load-state props — all load-state
 * changes happen via direct DOM writes in useMasonryLoader, so this component
 * never re-renders after its initial mount. React.memo enforces that contract.
 */
const MasonryTile: FC<MasonryTileProps> = ({ pin, onRegister }) => {
  const ref = useCallback(
    (el: HTMLElement | null) => onRegister(pin.id, el),
    [pin.id, onRegister]
  );

  return (
    /*
     * aspect-ratio reserves the tile's exact height before any image data
     * arrives. The <img> is position:absolute so it contributes zero intrinsic
     * size — the article's height is fixed from the moment it mounts.
     */
    <article
      ref={ref}
      className={styles.tile}
      style={{ aspectRatio: `${pin.width} / ${pin.height}` }}
      aria-label={pin.alt ?? `Pin ${pin.id}`}
    >
      {/* Shimmer skeleton — hidden by CSS (.tileLoaded .placeholder) on reveal */}
      <div className={styles.placeholder} aria-hidden="true" />

      {/* Error indicator — shown by CSS when .tileError is added to <article> */}
      <div className={styles.errorState} aria-hidden="true">
        <span className={styles.errorIcon}>⚠</span>
      </div>

      {/*
       * No src attribute at all on initial render — an empty src="" causes the
       * browser to fetch the current page URL and then fire a load/error event
       * that invalidates the img's intrinsic size, producing a layout
       * recalculation on every still-pending tile (the remaining shuffle).
       *
       * Instead the img starts with display:none (via the .imageHidden class)
       * so it participates in zero layout calculations. useMasonryLoader writes
       * src and removes .imageHidden atomically once decode() resolves.
       */}
      <img
        alt={pin.alt ?? `Pin ${pin.id}`}
        className={`${styles.image} ${styles.imageHidden}`}
        width={pin.width}
        height={pin.height}
        loading="eager"
        decoding="sync"
        aria-hidden="true"
      />
    </article>
  );
};

const MemoMasonryTile = /*#__PURE__*/ React.memo(MasonryTile);

// ─── MasonryFeed (public API) ─────────────────────────────────────────────────

export interface MasonryFeedProps {
  pins: Pin[];
  /**
   * Number of CSS columns. When omitted the count is read from the CSS
   * custom property `--masonry-columns` that the stylesheet drives via
   * media queries, so the layout stays in sync with CSS breakpoints.
   */
  columns?: number;
  /**
   * Gap between tiles in pixels.
   * @default 16
   */
  gap?: number;
  /**
   * IntersectionObserver root margin. Increase to prefetch more aggressively.
   * @default "0px 0px 200% 0px"
   */
  prefetchMargin?: string;
  className?: string;
}

export const MasonryFeed: FC<MasonryFeedProps> = ({
  pins,
  columns,
  gap = 16,
  prefetchMargin = "0px 0px 200% 0px",
  className = "",
}): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount  = useColumnCount(containerRef, columns);

  // registerTile writes directly to the DOM — MasonryFeed never re-renders
  // in response to an individual tile loading.
  const { registerTile } = useMasonryLoader(pins, prefetchMargin);

  /*
   * Column assignment is computed once per (pins, columnCount) pair.
   * Because columnCount is initialised synchronously from window.innerWidth,
   * this memo runs with the correct value on the very first render and will
   * not re-run until a genuine breakpoint crossing or a props change.
   */
  const columnGroups = useMemo(
    () => distributeToColumns(pins, columnCount),
    [pins, columnCount]
  );

  return (
    <div
      ref={containerRef}
      className={`${styles.grid} ${className}`}
      style={
        {
          "--masonry-gap": `${gap}px`,
          ...(columns != null ? { "--masonry-columns": columns } : {}),
        } as React.CSSProperties
      }
      role="feed"
      aria-label="Masonry image feed"
    >
      {columnGroups.map((colPins, colIndex) => (
        <div key={colIndex} className={styles.column}>
          {colPins.map((pin) => (
            /*
             * MemoMasonryTile has no load-state props, so React.memo's shallow
             * comparison will always bail out after the first render — each tile
             * renders exactly once for its lifetime.
             */
            <MemoMasonryTile
              key={pin.id}
              pin={pin}
              onRegister={registerTile}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default MasonryFeed;
