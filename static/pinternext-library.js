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
      attributes: { hidden: "" }
    });
    const dialog = createElement("section", {
      className: "preview-dialog",
      attributes: {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Image preview"
      }
    });
    const close = createElement("button", {
      className: "preview-close",
      text: "Close",
      attributes: { type: "button" }
    });
    const media = createElement("div", { className: "preview-media" });
    const image = createElement("img", { attributes: { alt: "Image preview", "data-preview-image": "" } });

    close.addEventListener("click", () => {
      backdrop.hidden = true;
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        backdrop.hidden = true;
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !backdrop.hidden) {
        backdrop.hidden = true;
      }
    });

    media.appendChild(image);
    dialog.append(close, media);
    backdrop.appendChild(dialog);
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

    if (!link) {
      return;
    }

    event.preventDefault();
    const img = link.querySelector("img");
    openPreview(link.href, img?.alt || "");
  });
})();
