(() => {
  const feedKey = "pinternext-feed-keywords";
  
  // DOM Elements
  const heroSection = document.querySelector("#heroSection");
  const feedSection = document.querySelector("#feedSection");
  const savedFeedsPanel = document.querySelector("#savedFeedsPanel");
  const toggleHeroButton = document.querySelector("#toggleHeroButton");
  const feedImageGrid = document.querySelector("#feedImageGrid");
  const feedLoadStatus = document.querySelector("#feedLoadStatus");
  const feedSentinel = document.querySelector("#feedSentinel");
  const feedManagerChips = document.querySelector("#feedManagerChips");
  const feedManager = document.querySelector("#feedManager");

  // State
  let isLoading = false;
  let allExhausted = false;
  const seen = new Set();
  const phraseState = new Map();

  // Signature of the phrases currently driving the feed. Used to detect when the
  // saved feed list actually changed (vs. an unrelated storage write).
  let trackedSignature = null;

  const computeSignature = (feeds) => feeds.slice(0, 6).join("\u0000");

  // Utility: Read saved feeds from localStorage
  const getFeed = () => {
    try {
      const value = JSON.parse(localStorage.getItem(feedKey));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  };

  // Utility: Render feed manager chips
  const renderFeedManagerChips = () => {
    const feeds = getFeed();
    feedManagerChips.replaceChildren();

    if (feeds.length === 0) {
      feedManager.hidden = true;
      return;
    }

    feedManager.hidden = false;
    feeds.forEach((phrase) => {
      const chip = document.createElement("span");
      chip.className = "feed-manager-chip";
      
      const link = document.createElement("a");
      link.href = `search.php?q=${encodeURIComponent(phrase)}`;
      link.textContent = phrase;
      
      const remove = document.createElement("button");
      remove.className = "feed-remove-button";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${phrase} from saved feeds`);
      remove.addEventListener("click", () => {
        // Remove from localStorage, then let updateView reconcile the feed. This
        // keeps the removal logic in one place and mirrors the behaviour of the
        // shared library (which also dispatches pinternext:feed-updated).
        const filtered = getFeed().filter((item) => item !== phrase);
        try {
          localStorage.setItem(feedKey, JSON.stringify(filtered));
        } catch (error) {
          console.error("Unable to save Pinternext data", error);
        }
        document.dispatchEvent(new CustomEvent("pinternext:feed-updated"));
      });

      chip.appendChild(link);
      chip.appendChild(remove);
      feedManagerChips.appendChild(chip);
    });
  };

  // Utility: Initialize phrase state for tracking bookmarks
  const initializePhraseState = () => {
    const feeds = getFeed();
    phraseState.clear();
    feeds.slice(0, 6).forEach((phrase) => {
      phraseState.set(phrase, { bookmark: null, exhausted: false });
    });
  };

  // Utility: Rebuild the feed from scratch for the current saved phrases.
  const rebuildFeed = () => {
    initializePhraseState();
    trackedSignature = computeSignature(getFeed());
    feedImageGrid.replaceChildren();
    seen.clear();
    allExhausted = false;
    isLoading = false;
    feedSentinel.hidden = false;
    setStatus("Loading your feed...");
    loadPage();
  };

  // Utility: Set status message
  const setStatus = (text) => {
    feedLoadStatus.textContent = text;
  };

  // Utility: Fetch images from a single feed
  const fetchFeedImages = async (phrase, bookmark = null) => {
    const params = new URLSearchParams({ q: phrase });
    if (bookmark) {
      params.set("bookmark", bookmark);
    }

    const response = await fetch(`search.php?${params.toString()}`, {
      headers: {
        "X-Requested-With": "fetch"
      }
    });

    if (!response.ok) {
      throw new Error(`Feed request failed with status ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const images = Array.from(doc.querySelectorAll(".img-container .img-result"));
    const nextLink = doc.querySelector(".next-page a");
    let nextBookmark = null;

    if (nextLink) {
      try {
        const nextUrl = new URL(nextLink.href, window.location.href);
        nextBookmark = nextUrl.searchParams.get("bookmark");
      } catch (error) {
        nextBookmark = null;
      }
    }

    return { images, nextBookmark };
  };

  // Utility: Show an empty-state message inside the grid (only when no images)
  const showEmptyState = (message) => {
    if (feedImageGrid.children.length > 0) {
      return;
    }

    const notice = document.createElement("p");
    notice.className = "empty-inline";
    notice.textContent = message;
    feedImageGrid.appendChild(notice);
  };

  // Utility: Append images to grid (deduplicating by image URL)
  const appendImages = (images) => {
    const fragment = document.createDocumentFragment();
    let appendedCount = 0;

    images.forEach((image) => {
      const imageUrl = image.dataset.imageUrl;

      if (imageUrl && seen.has(imageUrl)) {
        return;
      }

      if (imageUrl) {
        seen.add(imageUrl);
      }

      const clone = document.importNode(image, true);
      clone.classList.add("feed-image");
      fragment.appendChild(clone);
      appendedCount += 1;
    });

    if (appendedCount > 0) {
      feedImageGrid.appendChild(fragment);
    }

    return appendedCount;
  };

  // Main: Load next page of combined feed
  const loadPage = async () => {
    if (isLoading || allExhausted) {
      return;
    }

    const activePhrases = Array.from(phraseState.entries())
      .filter(([_, state]) => !state.exhausted)
      .map(([phrase, _]) => phrase);

    if (activePhrases.length === 0) {
      allExhausted = true;
      feedSentinel.hidden = true;
      showEmptyState("No saved feeds yet. Search and save feeds to combine them here.");
      setStatus("You've reached the end of your combined feed.");
      return;
    }

    isLoading = true;
    feedSentinel.hidden = true;
    setStatus("Loading more ideas…");

    const results = await Promise.all(activePhrases.map((phrase) => {
      const state = phraseState.get(phrase);
      return fetchFeedImages(phrase, state.bookmark)
        .then((result) => ({ phrase, ok: true, result }))
        .catch(() => ({ phrase, ok: false, result: null }));
    }));

    let addedAny = false;
    let anyError = false;

    results.forEach(({ phrase, ok, result }) => {
      const state = phraseState.get(phrase);
      if (!state) {
        return;
      }

      if (!ok) {
        anyError = true;
        return;
      }

      if (result.images.length > 0) {
        const appendedCount = appendImages(result.images);
        if (appendedCount > 0) {
          addedAny = true;
        }
      }

      if (result.nextBookmark) {
        state.bookmark = result.nextBookmark;
      } else {
        state.exhausted = true;
      }
    });

    isLoading = false;

    const stillRemaining = Array.from(phraseState.values()).some((state) => !state.exhausted);

    if (!stillRemaining) {
      allExhausted = true;
      feedSentinel.hidden = true;
      showEmptyState("No feed images could be loaded yet. Try saving another search.");
      setStatus("You've reached the end of your combined feed.");
      return;
    }

    if (anyError && !addedAny) {
      setStatus("Couldn't load more. Scroll to retry.");
    } else {
      setStatus("Scroll to load more ideas…");
    }

    feedSentinel.hidden = false;
  };

  // Utility: Show feed or hero based on state
  const updateView = () => {
    const feeds = getFeed();
    
    if (feeds.length === 0) {
      heroSection.classList.remove("hidden");
      feedSection.hidden = true;
      savedFeedsPanel.hidden = false;
      trackedSignature = null;
      phraseState.clear();
      return;
    }

    heroSection.classList.add("hidden");
    feedSection.hidden = false;
    savedFeedsPanel.hidden = true;
    renderFeedManagerChips();

    // Rebuild the combined feed whenever the set of saved phrases changes. This
    // covers first load, adding a feed while browsing, and removing a feed.
    const signature = computeSignature(feeds);
    if (signature !== trackedSignature) {
      rebuildFeed();
    }
  };

  // Event: Toggle hero/feed view
  toggleHeroButton.addEventListener("click", () => {
    heroSection.classList.remove("hidden");
    feedSection.hidden = true;
    window.scrollTo(0, 0);
  });

  // Event: Setup Intersection Observer for infinite scroll
  const setupIntersectionObserver = () => {
    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadPage();
      }
    }, { rootMargin: "900px 0px" });

    observer.observe(feedSentinel);
  };

  // Event: Listen for feed updates from pinternext-library.js
  const handleFeedUpdate = () => {
    updateView();
  };

  // Hook into storage events to detect feed changes
  window.addEventListener("storage", (event) => {
    if (event.key === feedKey) {
      handleFeedUpdate();
    }
  });

  // Listen for the custom event dispatched by pinternext-library.js when the
  // feed is added to / removed from within the same tab.
  document.addEventListener("pinternext:feed-updated", handleFeedUpdate);

  // Initialize on page load
  updateView();
  setupIntersectionObserver();

  // Listen for scroll to show/hide hero
  let scrollTimeout;
  document.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      // Auto-show feed view after scrolling on hero
      const feeds = getFeed();
      if (feeds.length > 0 && feedSection.hidden && window.scrollY > 100) {
        heroSection.classList.add("hidden");
        feedSection.hidden = false;
      }
    }, 200);
  });
})();
