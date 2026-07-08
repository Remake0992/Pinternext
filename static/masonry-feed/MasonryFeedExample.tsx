/**
 * MasonryFeedExample.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal usage example.  Drop this into any React app that imports
 * MasonryFeed and masonry.module.css.
 *
 * Each pin requires:
 *   id     – unique key (string or number)
 *   url    – full-resolution image URL
 *   width  – intrinsic pixel width  of the source image
 *   height – intrinsic pixel height of the source image
 *   alt    – (optional) accessible description
 */

import React from "react";
import { MasonryFeed, type Pin } from "./MasonryFeed";

// ---------------------------------------------------------------------------
// Sample dataset — replace with real API data in production.
// Widths and heights are the *intrinsic* dimensions of each image so that
// aspect-ratio can be applied correctly before the image bytes arrive.
// ---------------------------------------------------------------------------
const SAMPLE_PINS: Pin[] = [
  { id: 1,  url: "https://picsum.photos/seed/pin1/600/900",  width: 600, height: 900,  alt: "Tall forest path"        },
  { id: 2,  url: "https://picsum.photos/seed/pin2/600/400",  width: 600, height: 400,  alt: "Wide ocean horizon"      },
  { id: 3,  url: "https://picsum.photos/seed/pin3/600/750",  width: 600, height: 750,  alt: "Mountain lake reflection" },
  { id: 4,  url: "https://picsum.photos/seed/pin4/600/600",  width: 600, height: 600,  alt: "Square city street"      },
  { id: 5,  url: "https://picsum.photos/seed/pin5/600/1000", width: 600, height: 1000, alt: "Portrait waterfall"      },
  { id: 6,  url: "https://picsum.photos/seed/pin6/600/450",  width: 600, height: 450,  alt: "Desert dunes"            },
  { id: 7,  url: "https://picsum.photos/seed/pin7/600/800",  width: 600, height: 800,  alt: "Autumn trees"            },
  { id: 8,  url: "https://picsum.photos/seed/pin8/600/500",  width: 600, height: 500,  alt: "Snowy cabin"             },
  { id: 9,  url: "https://picsum.photos/seed/pin9/600/700",  width: 600, height: 700,  alt: "Misty valley"            },
  { id: 10, url: "https://picsum.photos/seed/pin10/600/350", width: 600, height: 350,  alt: "Golden wheat field"      },
  { id: 11, url: "https://picsum.photos/seed/pin11/600/850", width: 600, height: 850,  alt: "Rocky coastline"         },
  { id: 12, url: "https://picsum.photos/seed/pin12/600/650", width: 600, height: 650,  alt: "Cherry blossom garden"   },
  { id: 13, url: "https://picsum.photos/seed/pin13/600/420", width: 600, height: 420,  alt: "Urban rooftop view"      },
  { id: 14, url: "https://picsum.photos/seed/pin14/600/950", width: 600, height: 950,  alt: "Deep canyon walls"       },
  { id: 15, url: "https://picsum.photos/seed/pin15/600/550", width: 600, height: 550,  alt: "Wooden dock at sunset"   },
  { id: 16, url: "https://picsum.photos/seed/pin16/600/780", width: 600, height: 780,  alt: "Northern lights"         },
];

// ---------------------------------------------------------------------------
// Example app shell
// ---------------------------------------------------------------------------
export default function App(): React.JSX.Element {
  return (
    <main style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontFamily: "system-ui, sans-serif", marginBottom: 24 }}>
        Masonry Feed Demo
      </h1>

      {/*
        MasonryFeed props:
          pins           – required array of Pin objects
          gap            – pixel gap between tiles (default 16)
          columns        – override responsive column count (optional)
          prefetchMargin – IntersectionObserver rootMargin (default "0px 0px 200% 0px")
          className      – extra class on the <section> wrapper
      */}
      <MasonryFeed
        pins={SAMPLE_PINS}
        gap={16}
        prefetchMargin="0px 0px 200% 0px"
      />
    </main>
  );
}
