(() => {
  const storageKey = "pinternext-theme";
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)");

  const getSystemTheme = () => (prefersLight.matches ? "light" : "dark");

  const getStoredTheme = () => {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  };

  const setStoredTheme = (theme) => {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      // Ignore storage errors so the toggle still works for this page load.
    }
  };

  const applyTheme = (theme) => {
    const resolvedTheme = theme === "light" || theme === "dark" ? theme : getSystemTheme();

    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;

    if (themeColor) {
      themeColor.setAttribute("content", resolvedTheme === "light" ? "#fff8fa" : "#111111");
    }

    if (toggle) {
      const nextTheme = resolvedTheme === "light" ? "dark" : "light";
      toggle.textContent = nextTheme === "dark" ? "☾" : "☀";
      toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
      toggle.setAttribute("title", `Switch to ${nextTheme} mode`);
      toggle.setAttribute("aria-pressed", resolvedTheme === "dark" ? "true" : "false");
    }
  };

  applyTheme(getStoredTheme());

  toggle?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    setStoredTheme(nextTheme);
    applyTheme(nextTheme);
  });

  const handleSystemThemeChange = () => {
    if (!getStoredTheme()) {
      applyTheme(null);
    }
  };

  if (typeof prefersLight.addEventListener === "function") {
    prefersLight.addEventListener("change", handleSystemThemeChange);
  } else if (typeof prefersLight.addListener === "function") {
    prefersLight.addListener(handleSystemThemeChange);
  }
})();
