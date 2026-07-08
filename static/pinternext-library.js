(() => {
  const createElement = (tag, options = {}) => {
    const element = document.createElement(tag);

    if (options.className) {
      element.className = options.className;
    }

    if (options.text) {
      element.textContent = options.text;
    }

    if (options.attributes) {
      Object.entries(options.attributes).forEach(([name, value]) => element.setAttribute(name, value));
    }

    return element;
  };

  let previewDialog = null;

  const createPreviewDialog = () => {
    const backdrop = createElement("div", {
      className: "preview-dialog-backdrop",
      attributes: { hidden: "", role: "dialog", "aria-modal": "true", "aria-label": "Image preview" }
    });

    const close = createElement("button", {
      className: "preview-close",
      attributes: { type: "button", "aria-label": "Close preview" }
    });
    // SVG ✕ icon
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2.5");
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
    [["M18 6L6 18"], ["M6 6L18 18"]].forEach(([d]) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });
    close.appendChild(svg);

    const image = createElement("img", {
      className: "preview-image",
      attributes: { alt: "Image preview", "data-preview-image": "" }
    });

    const hideDialog = () => { backdrop.hidden = true; };
    close.addEventListener("click", hideDialog);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) hideDialog();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !backdrop.hidden) hideDialog();
    });

    backdrop.append(close, image);
    document.body.appendChild(backdrop);
    return backdrop;
  };

  const openPreview = (proxyUrl, altText) => {
    previewDialog = previewDialog || createPreviewDialog();
    const image = previewDialog.querySelector("[data-preview-image]");
    image.src = proxyUrl;
    image.alt = altText || "Image preview";
    previewDialog.hidden = false;
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest(".pin-open-link");
    if (!link) return;
    event.preventDefault();
    const img = link.querySelector("img");
    openPreview(link.href, img?.alt || "");
  });
})();
