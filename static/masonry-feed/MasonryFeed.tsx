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
 * WHY NOT CSS MULTI-COLUMN?
 *   CSS multi-column's column balancer re-runs whenever *any* descendant
 *   changes height or a new node is inserted — even when the changed element
 *   is `position: absolute` inside a fixed-aspect-ratio wrapper. Every
 *   `patchTile` state update (idle → loading → loaded) was enough to trigger
 *   a full re-balance, causing the visible shuffle. Explicit column divs are
 *   immune: a React re-render inside one column's subtree cannot affect the
 *   layout of a sibling column div.
 */

import {
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
 * the grid container exposes. Falls back to a simple window-width heuristic
 * when called before the first paint (SSR / test environments).
 */
function getColumnCount(el: HTMLElement | null): number {
  if (!el) return 4;
  const raw = getComputedStyle(el).getPropertyValue("--masonry-columns").trim();
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
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

type LoadState = "idle" | "loading" | "loaded" | "error";

interface TileState {
  loadState: LoadState;
  /** Object-URL or original URL handed to <img> once decode() resolves. */
  resolvedSrc: string | null;
}

// ─── Hook: useLazyImageLoader ─────────────────────────────────────────────────

/**
 * Manages per-tile IntersectionObserver entries and the async
 * download → decode → reveal pipeline.
 *
 * Importantly, each tile's load-state update is scoped to a single entry in
 * the Map — React re-renders MasonryTile in isolation via the stable key prop,
 * so a loading transition in one tile does NOT cause sibling tiles to re-render
 * or trigger any layout recalculation in other columns.
 *
 * @param pins        - Array of Pin descriptors to manage.
 * @param rootMargin  - IntersectionObserver rootMargin string; controls
 *                      how far ahead of the viewport images are prefetched.
 */
function useLazyImageLoader(
  pins: Pin[],
  rootMargin = "0px 0px 200% 0px"
): {
  tileStates: Map<Pin["id"], TileState>;
  registerTile: (id: Pin["id"], el: HTMLElement | null) => void;
} {
  // Keyed by pin.id for O(1) lookups during observer callbacks.
  const [tileStates, setTileStates] = useState<Map<Pin["id"], TileState>>(
    () => new Map(pins.map((p) => [p.id, { loadState: "idle", resolvedSrc: null }]))
  );

  // Stable ref so the IntersectionObserver callback closes over the latest map.
  const tileStatesRef = useRef(tileStates);
  tileStatesRef.current = tileStates;

  // pin.id → source URL lookup so the observer callback needs no closure over pins.
  const pinUrlMap = useMemo(
    () => new Map(pins.map((p) => [p.id, p.url])),
    [pins]
  );

  // pin.id → DOM element map so we can unobserve after loading starts.
  const elementMap = useRef(new Map<Pin["id"], HTMLElement>());

  // Single shared observer for all tiles — cheaper than one per tile.
  const observerRef = useRef<IntersectionObserver | null>(null);

  /** Patches a single tile's state immutably. */
  const patchTile = useCallback((id: Pin["id"], patch: Partial<TileState>) => {
    setTileStates((prev) => {
      const next = new Map(prev);
      next.set(id, { ...prev.get(id)!, ...patch });
      return next;
    });
  }, []);

  /**
   * Core loading pipeline:
   *  1. Mark tile as "loading" immediately (stops re-triggering).
   *  2. Create a new HTMLImageElement and set its src (network fetch).
   *  3. Await Image.decode() — runs on a compositor/worker thread.
   *  4. On success, hand the src to React state so the visible <img> can use it.
   *  5. On failure, mark as "error" so the placeholder remains visible.
   */
  const loadImage = useCallback(
    async (id: Pin["id"], url: string) => {
      patchTile(id, { loadState: "loading" });

      const img = new Image();
      img.src = url;
      // `crossOrigin` may be needed if your CDN requires it for decode().
      img.crossOrigin = "anonymous";

      try {
        // Image.decode() resolves when the image is fully parsed and GPU-ready.
        // It rejects if the resource fails to load, so no separate onerror needed.
        await img.decode();
        patchTile(id, { loadState: "loaded", resolvedSrc: url });
      } catch {
        patchTile(id, { loadState: "error" });
      }
    },
    [patchTile]
  );

  // (Re)create observer whenever rootMargin or the load callback changes.
  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          // dataset.pinId is set in registerTile below.
          const id = (entry.target as HTMLElement).dataset.pinId!;
          const current = tileStatesRef.current.get(id);

          // Skip tiles already loading or loaded.
          if (!current || current.loadState !== "idle") continue;

          const url = pinUrlMap.get(id);
          if (!url) continue;

          // Unobserve immediately — we only need one trigger per tile.
          observerRef.current!.unobserve(entry.target);
          elementMap.current.delete(id);

          loadImage(id, url);
        }
      },
      {
        // Prefetch ~2 viewport-heights below the fold; no horizontal margin.
        rootMargin,
        threshold: 0,
      }
    );

    // Re-observe any tiles that are still idle (e.g. after a config change).
    for (const [id, el] of elementMap.current) {
      const state = tileStatesRef.current.get(id);
      if (state?.loadState === "idle") {
        observerRef.current.observe(el);
      }
    }

    return () => observerRef.current?.disconnect();
  }, [rootMargin, pinUrlMap, loadImage]);

  /**
   * Called by each <MasonryTile> via a callback ref.
   * Registers (or unregisters) the tile's wrapper element with the observer.
   */
  const registerTile = useCallback(
    (id: Pin["id"], el: HTMLElement | null) => {
      const observer = observerRef.current;

      if (el) {
        el.dataset.pinId = String(id);
        elementMap.current.set(id, el);

        const state = tileStatesRef.current.get(id);
        if (state?.loadState === "idle" && observer) {
          observer.observe(el);
        }
      } else {
        // Ref is being detached (tile unmounted).
        const existing = elementMap.current.get(id);
        if (existing && observer) observer.unobserve(existing);
        elementMap.current.delete(id);
      }
    },
    [] // stable — elementMap and observerRef are refs, not state
  );

  return { tileStates, registerTile };
}

// ─── Hook: useColumnCount ─────────────────────────────────────────────────────

/**
 * Reads the active column count from the CSS custom property on the grid
 * container and updates it on resize. This is the single source of truth for
 * how many columns to render — the CSS media queries in masonry.module.css
 * drive the value; JS only reads it.
 */
function useColumnCount(
  containerRef: React.RefObject<HTMLElement | null>,
  columnsProp?: number
): number {
  const [count, setCount] = useState<number>(columnsProp ?? 4);

  useEffect(() => {
    // If the consumer pinned a column count via props, skip auto-detection.
    if (columnsProp != null) {
      setCount(columnsProp);
      return;
    }

    const update = () => setCount(getColumnCount(containerRef.current));

    // Read immediately after mount (CSS has been applied by now).
    update();

    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef, columnsProp]);

  return count;
}

// ─── MasonryTile ─────────────────────────────────────────────────────────────

interface MasonryTileProps {
  pin: Pin;
  state: TileState;
  onRegister: (id: Pin["id"], el: HTMLElement | null) => void;
}

const MasonryTile: FC<MasonryTileProps> = ({ pin, state, onRegister }) => {
  // Callback ref pattern: fires on mount (el = HTMLElement) and unmount (el = null).
  const ref = useCallback(
    (el: HTMLElement | null) => onRegister(pin.id, el),
    [pin.id, onRegister]
  );

  const isLoaded = state.loadState === "loaded";
  const isError  = state.loadState === "error";

  return (
    /*
     * aspect-ratio on the wrapper reserves the exact vertical space this tile
     * will occupy before a single image byte has arrived, preventing CLS.
     *
     * The <img> is position:absolute so it never contributes to the wrapper's
     * intrinsic size — the wrapper's height is determined solely by its own
     * width × (height/width) aspect-ratio, which is set once and never changes.
     */
    <article
      ref={ref}
      className={styles.tile}
      style={{ aspectRatio: `${pin.width} / ${pin.height}` }}
      aria-label={pin.alt ?? `Pin ${pin.id}`}
    >
      {/* Shimmer skeleton — always present, hidden by CSS once image loads */}
      <div className={styles.placeholder} aria-hidden="true" />

      {isError && (
        <div className={styles.errorState} role="img" aria-label="Failed to load image">
          <span className={styles.errorIcon}>⚠</span>
        </div>
      )}

      {/*
       * Critically: the <img> is rendered immediately (not conditionally) but
       * starts with opacity 0. Its `src` is empty until Image.decode() resolves,
       * so the browser never paints a half-decoded frame. Setting src on an
       * already-mounted <img> does NOT change the element's layout contribution
       * (it is position:absolute), so there is zero reflow at reveal time.
       */}
      <img
        src={state.resolvedSrc ?? undefined}
        alt={pin.alt ?? `Pin ${pin.id}`}
        className={`${styles.image} ${isLoaded ? styles.imageLoaded : ""}`}
        width={pin.width}
        height={pin.height}
        loading="eager"
        decoding="sync"
        aria-hidden={!isLoaded}
      />
    </article>
  );
};

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

  const { tileStates, registerTile } = useLazyImageLoader(pins, prefetchMargin);

  /*
   * Column assignment is computed once per (pins, columnCount) pair.
   * It does NOT change when individual tiles load — that is the entire point.
   * distributeToColumns uses a greedy shortest-column algorithm so the initial
   * visual balance is good even before any images appear.
   */
  const columnGroups = useMemo(
    () => distributeToColumns(pins, columnCount),
    [pins, columnCount]
  );

  return (
    /*
     * The outer div is the ResizeObserver target; its --masonry-columns CSS
     * custom property is what useColumnCount reads to stay in sync with the
     * stylesheet breakpoints.
     */
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
        /*
         * Each column is its own independent flex container.
         * React reconciles each column subtree separately, so a setState call
         * for a tile in column 2 never causes column 1 or 3 to re-layout.
         * This is the structural guarantee that eliminates tile shuffling.
         */
        <div key={colIndex} className={styles.column}>
          {colPins.map((pin) => {
            const state = tileStates.get(pin.id) ?? {
              loadState: "idle" as LoadState,
              resolvedSrc: null,
            };
            return (
              <MasonryTile
                key={pin.id}
                pin={pin}
                state={state}
                onRegister={registerTile}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MasonryFeed;
