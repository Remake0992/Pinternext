/**
 * MasonryFeed.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pinterest-style masonry grid that:
 *   • Reserves tile space via `aspect-ratio` (chosen over explicit width/height
 *     attributes because aspect-ratio is a pure CSS layout primitive — it works
 *     regardless of how the container is sized and doesn't require the consumer
 *     to know the rendered pixel dimensions upfront).
 *   • Lazy-loads images with IntersectionObserver (root margin pre-fetches
 *     tiles that are ~2 viewport-heights below the fold).
 *   • Decodes each downloaded image off the main thread with Image.decode()
 *     before writing it to the DOM, preventing jank on paint.
 *   • Fades images in with a CSS opacity transition once decoding is complete.
 *   • Uses pure CSS multi-column layout for the masonry arrangement — no libs.
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
  const isError = state.loadState === "error";

  return (
    /*
     * The wrapper div establishes the tile's dimensions BEFORE the image loads.
     * `aspect-ratio` is set as an inline style derived from the pin's intrinsic
     * width/height, preventing any layout shift when the image appears.
     *
     * Why aspect-ratio over explicit width/height attributes?
     * — `aspect-ratio` is resolved in the CSS layout phase, so it works
     *   correctly inside a fluid column (CSS multi-column, Grid, Flex).
     * — Explicit pixel attributes would fight with the fluid 100% column width
     *   and require JS to recalculate on every resize.
     */
    <article
      ref={ref}
      className={styles.tile}
      style={{ aspectRatio: `${pin.width} / ${pin.height}` }}
      aria-label={pin.alt ?? `Pin ${pin.id}`}
    >
      {/* Low-quality placeholder shown before the image loads */}
      <div
        className={styles.placeholder}
        aria-hidden="true"
      />

      {/* Error state */}
      {isError && (
        <div className={styles.errorState} role="img" aria-label="Failed to load image">
          <span className={styles.errorIcon}>⚠</span>
        </div>
      )}

      {/*
       * The real image is only rendered once `resolvedSrc` is available
       * (i.e. after Image.decode() has finished). The `loaded` class
       * triggers the CSS opacity transition for a smooth fade-in.
       */}
      {state.resolvedSrc && (
        <img
          src={state.resolvedSrc}
          alt={pin.alt ?? `Pin ${pin.id}`}
          className={`${styles.image} ${isLoaded ? styles.imageLoaded : ""}`}
          // Dimensions are purely presentational here; layout is driven by
          // the wrapper's aspect-ratio. They are still useful for SEO / AT.
          width={pin.width}
          height={pin.height}
          // Never lazy-load via the browser — we manage loading ourselves.
          loading="eager"
          decoding="sync"
        />
      )}
    </article>
  );
};

// ─── MasonryFeed (public API) ─────────────────────────────────────────────────

export interface MasonryFeedProps {
  pins: Pin[];
  /**
   * Number of CSS columns at different breakpoints.
   * Defaults to a responsive value set in the CSS module.
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
  const { tileStates, registerTile } = useLazyImageLoader(pins, prefetchMargin);

  return (
    <section
      className={`${styles.grid} ${className}`}
      style={
        {
          "--masonry-gap": `${gap}px`,
          // Allow consumer to override the column count at runtime.
          ...(columns != null ? { "--masonry-columns": columns } : {}),
        } as React.CSSProperties
      }
      aria-label="Masonry image feed"
    >
      {pins.map((pin) => {
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
    </section>
  );
};

export default MasonryFeed;
