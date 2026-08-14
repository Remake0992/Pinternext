(() => {
  const storageKey = "pinternext-hide-ai-modified";
  const toggle = document.querySelector("[data-ai-filter-toggle]");
  const isSearchPage = window.location.pathname.endsWith("/search.php");

  const getStoredPreference = () => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch (error) {
      return false;
    }
  };

  const setStoredPreference = (enabled) => {
    try {
      localStorage.setItem(storageKey, String(enabled));
    } catch (error) {
      // The control remains usable for this page load when storage is unavailable.
    }
  };

  const setToggleState = (enabled) => {
    if (!toggle) return;

    toggle.classList.toggle("is-active", enabled);
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.setAttribute("aria-label", enabled ? "Show Pinterest-labeled AI-modified Pins" : "Hide Pinterest-labeled AI-modified Pins");
    toggle.setAttribute("title", enabled ? "Showing AI-modified Pins" : "Hide AI-modified Pins");
  };

  const updateSearchUrl = (enabled) => {
    const url = new URL(window.location.href);
    if (enabled) {
      url.searchParams.set("hide_ai_modified", "1");
    } else {
      url.searchParams.delete("hide_ai_modified");
    }
    window.location.assign(url);
  };

  const urlPreference = new URLSearchParams(window.location.search).get("hide_ai_modified") === "1";
  let enabled = getStoredPreference();

  // A filtered pagination URL is authoritative and restores the preference.
  if (isSearchPage && urlPreference) {
    enabled = true;
    setStoredPreference(true);
  }

  setToggleState(enabled);

  // Apply a saved preference to manually entered or bookmarked searches.
  if (isSearchPage && enabled && !urlPreference) {
    updateSearchUrl(true);
    return;
  }

  toggle?.addEventListener("click", () => {
    enabled = !enabled;
    setStoredPreference(enabled);
    setToggleState(enabled);

    if (isSearchPage) {
      updateSearchUrl(enabled);
    }
  });
})();
