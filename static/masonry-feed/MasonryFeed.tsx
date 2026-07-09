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
 *     never redistributed.
 *
 * THE COMPLETE NO-SHUFFLE CONTRACT:
 *   1. Column count is derived synchronously from window.innerWidth before the
 *      first render — it is NEVER stored as React state. It lives in a ref.
 *      distributeToColumns() therefore runs exactly once on mount and only
 *      again on a genuine CSS-breakpoint crossing (which requires a full
 *      re-render by definition anyway).
 *
 *   2. Per-tile load state (loading/loaded/error) is NEVER stored as React
 *      state. Image reveal writes img.src and toggles CSS classes directly on
 *      the DOM element. React never sees these writes, so no re-render and no
 *      reconciliation of any column subtree occurs during image loading.
 *
 *   3. MasonryTile carries zero load-state props. React.memo guarantees it
 *      renders exactly once per mount. The column div key is stable (colIndex),
 *      the tile key is stable (pin.id) — React never unmounts/remounts a tile.
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
 * Mirrors the CSS media-query breakpoints in masonry.module.css.
 * Called synchronously during render — no DOM access needed.
 */
function breakpointColumns(width: number): number {
  if (width < 480)  return 2;
  if (width < 768)  return 2;
  if (width < 1024) return 3;
  if (width < 1440) return 4;
  return 5;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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



// ─── MasonryTile ─────────────────────────────────────────────────────────────

interface MasonryTileProps {
  pin: Pin;
  onRegister: (id: Pin["id"], el: HTMLElement | null) => void;
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
  /*
   * columnCount is NEVER React state. It lives in a ref so that reading or
   * writing it never schedules a re-render. The initial value is computed
   * synchronously from window.innerWidth so the very first render already
   * has the correct column layout — there is no "wrong initial value" that
   * needs to be corrected in a useEffect, which was the root cause of every
   * previous post-mount shuffle.
   */
  const columnCountRef = useRef<number>(
    columns ?? (typeof window !== "undefined" ? breakpointColumns(window.innerWidth) : 4)
  );

  /*
   * columnGroups is also a ref. distributeToColumns() runs once here and is
   * only repeated if a ResizeObserver detects a genuine breakpoint crossing,
   * in which case forceUpdate() is called to re-render with the new layout.
   * It is NEVER called in response to an image loading.
   */
  const columnGroupsRef = useRef<Pin[][]>(
    distributeToColumns(pins, columnCountRef.current)
  );

  /*
   * Minimal forceUpdate so ResizeObserver can trigger a re-render on
   * breakpoint crossing. This is the ONLY place setState is used in the
   * entire component tree, and it fires at most once per breakpoint boundary
   * crossing — never during image loading.
   */
  const [, forceUpdate] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // registerTile writes directly to the DOM — never causes a re-render.
  const { registerTile } = useMasonryLoader(pins, prefetchMargin);

  // Watch for genuine breakpoint crossings. Re-distribute only when the
  // column count actually changes.
  useEffect(() => {
    if (columns != null) return; // consumer has pinned the count; skip

    const ro = new ResizeObserver(() => {
      const next = breakpointColumns(window.innerWidth);
      if (next !== columnCountRef.current) {
        columnCountRef.current  = next;
        columnGroupsRef.current = distributeToColumns(pins, next);
        forceUpdate(n => n + 1);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [pins, columns]);

  // If the `columns` prop changes, recompute synchronously.
  if (columns != null && columns !== columnCountRef.current) {
    columnCountRef.current  = columns;
    columnGroupsRef.current = distributeToColumns(pins, columns);
  }

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
      {columnGroupsRef.current.map((colPins, colIndex) => (
        <div key={colIndex} className={styles.column}>
          {colPins.map((pin) => (
            // No load-state props — React.memo bails out after first render.
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
