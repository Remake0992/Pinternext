(() => {
  const feedKey = "pinternext-feed-keywords";
  const boardsKey = "pinternext-boards";

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (error) {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Unable to save Pinternext data", error);
    }
  };

  const normalizePhrase = (phrase) => phrase.trim().replace(/\s+/g, " ").slice(0, 64);

  const getFeed = () => readJson(feedKey, []);
  const saveFeed = (feed) => writeJson(feedKey, feed);
  const getBoards = () => readJson(boardsKey, []);
  const saveBoards = (boards) => writeJson(boardsKey, boards);
  const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

  const addFeedPhrase = (phrase) => {
    const normalized = normalizePhrase(phrase);

    if (!normalized) {
      return false;
    }

    const feed = getFeed();
    const exists = feed.some((item) => item.toLowerCase() === normalized.toLowerCase());

    if (!exists) {
      feed.unshift(normalized);
      saveFeed(feed);
    }

    renderFeed();
    return true;
  };

  const removeFeedPhrase = (phrase) => {
    saveFeed(getFeed().filter((item) => item !== phrase));
    renderFeed();
  };

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

  const renderFeed = () => {
    document.querySelectorAll("[data-feed-list]").forEach((container) => {
      const feed = getFeed();
      const requestId = createId();
      container.dataset.feedRequest = requestId;
      container.replaceChildren();

      if (feed.length === 0) {
        container.appendChild(createElement("p", {
          className: "empty-inline",
          text: "No saved images yet. Search a phrase, then save it as a feed."
        }));
        return;
      }

      const manager = createElement("div", { className: "feed-manager" });
      const managerLabel = createElement("p", { text: "Saved feeds" });
      const managerChips = createElement("div", { className: "feed-manager-chips" });
      const imageGrid = createElement("div", { className: "feed-image-grid" });
      const status = createElement("p", {
        className: "feed-load-status",
        text: "Loading saved images…"
      });
      const sentinel = createElement("div", {
        className: "feed-sentinel",
        attributes: { hidden: "" }
      });

      feed.forEach((phrase) => {
        const chip = createElement("span", { className: "feed-manager-chip" });
        const link = createElement("a", {
          text: phrase,
          attributes: { href: `search.php?q=${encodeURIComponent(phrase)}` }
        });
        const remove = createElement("button", {
          className: "feed-remove-button",
          text: "×",
          attributes: {
            type: "button",
            "aria-label": `Remove ${phrase} from saved feeds`
          }
        });

        remove.addEventListener("click", () => removeFeedPhrase(phrase));
        chip.append(link, remove);
        managerChips.appendChild(chip);
      });

      manager.append(managerLabel, managerChips);
      imageGrid.appendChild(createElement("p", {
        className: "empty-inline",
        text: "Loading saved images…"
      }));
      container.append(manager, imageGrid, status, sentinel);

      const seen = new Set();
      const phraseState = new Map();
      feed.slice(0, 6).forEach((phrase) => {
        phraseState.set(phrase, { bookmark: null, exhausted: false, seen: new Set() });
      });

      let isLoadingMore = false;
      let allExhausted = false;

      const setStatus = (text) => {
        status.textContent = text;
      };

      const appendImages = (images) => {
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
          imageGrid.appendChild(clone);
        });
      };

      const clearPlaceholder = () => {
        const placeholder = imageGrid.querySelector(".empty-inline");
        if (placeholder) {
          placeholder.remove();
        }
      };

      const showEnd = () => {
        sentinel.remove();
        setStatus("You've reached the end of your saved feeds.");
      };

      const showErrorStatus = () => {
        setStatus("Couldn't load more. Scroll again to retry.");
      };

      const maybeShowSentinel = () => {
        if (allExhausted) {
          return;
        }
        sentinel.hidden = false;
        setStatus("Scroll to load more ideas…");
      };

      const loadPage = async () => {
        if (isLoadingMore || allExhausted) {
          return;
        }

        const phrases = feed.slice(0, 6).filter((phrase) => {
          const state = phraseState.get(phrase);
          return state && !state.exhausted;
        });

        if (phrases.length === 0) {
          allExhausted = true;
          showEnd();
          return;
        }

        isLoadingMore = true;
        sentinel.hidden = true;
        setStatus("Loading more ideas…");

        const results = await Promise.all(phrases.map((phrase) => {
          const state = phraseState.get(phrase);
          return fetchFeedImages(phrase, state.bookmark).then((result) => ({ phrase, result })).catch(() => ({ phrase, result: null }));
        }));

        if (container.dataset.feedRequest !== requestId) {
          return;
        }

        let anyNewImages = false;
        let errored = false;

        results.forEach(({ phrase, result }) => {
          const state = phraseState.get(phrase);
          if (!state) {
            return;
          }

          if (!result) {
            errored = true;
            return;
          }

          const freshImages = result.images.filter((image) => {
            const url = image.dataset.imageUrl;
            if (url && state.seen.has(url)) {
              return false;
            }
            if (url) {
              state.seen.add(url);
            }
            return true;
          });

          if (freshImages.length > 0) {
            anyNewImages = true;
            clearPlaceholder();
            appendImages(freshImages);
          }

          if (result.nextBookmark) {
            state.bookmark = result.nextBookmark;
          } else {
            state.exhausted = true;
          }
        });

        if (imageGrid.children.length === 0 && !anyNewImages) {
          imageGrid.appendChild(createElement("p", {
            className: "empty-inline",
            text: "No feed images could be loaded yet. Try saving another search."
          }));
        }

        isLoadingMore = false;

        const remaining = feed.slice(0, 6).some((phrase) => {
          const state = phraseState.get(phrase);
          return state && !state.exhausted;
        });

        if (!remaining) {
          allExhausted = true;
          showEnd();
        } else if (errored && !anyNewImages) {
          showErrorStatus();
          sentinel.hidden = false;
        } else {
          maybeShowSentinel();
        }
      };

      if (!("IntersectionObserver" in window)) {
        loadPage();
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadPage();
        }
      }, { rootMargin: "900px 0px" });

      observer.observe(sentinel);
      loadPage();
    });
  };

  const initFeedControls = () => {
    document.querySelectorAll("[data-save-feed]").forEach((button) => {
      const form = button.closest("form");
      const input = form?.querySelector("[data-feed-input], input[name='q']");
      const updateVisibility = () => {
        button.hidden = !normalizePhrase(input?.value || "");
      };

      input?.addEventListener("input", updateVisibility);
      updateVisibility();

      button.addEventListener("click", () => {
        if (input && addFeedPhrase(input.value)) {
          button.textContent = "Saved";
          window.setTimeout(() => {
            button.textContent = "Save feed";
          }, 1400);
        }
      });
    });

    document.querySelectorAll("[data-save-query]").forEach((button) => {
      const form = button.closest("form");
      const input = form?.querySelector("[data-feed-input], input[name='q']");
      const getValue = () => input?.value || button.dataset.saveQuery || "";
      const updateVisibility = () => {
        button.hidden = !normalizePhrase(getValue());
      };

      input?.addEventListener("input", updateVisibility);
      updateVisibility();

      button.addEventListener("click", () => {
        if (addFeedPhrase(getValue())) {
          button.textContent = "Saved";
          window.setTimeout(() => {
            button.textContent = "Save feed";
          }, 1400);
        }
      });
    });
  };

  const createBoard = (name) => {
    const normalized = name.trim().replace(/\s+/g, " ").slice(0, 48);

    if (!normalized) {
      return null;
    }

    const boards = getBoards();
    const existing = boards.find((board) => board.name.toLowerCase() === normalized.toLowerCase());

    if (existing) {
      return existing;
    }

    const board = {
      id: createId(),
      name: normalized,
      pins: [],
      createdAt: new Date().toISOString()
    };

    boards.unshift(board);
    saveBoards(boards);
    renderBoardsPage();
    return board;
  };

  const savePinToBoard = (boardId, pin) => {
    const boards = getBoards();
    const board = boards.find((item) => item.id === boardId);

    if (!board) {
      return false;
    }

    board.pins = board.pins || [];

    if (!board.pins.some((item) => item.url === pin.url)) {
      board.pins.unshift({
        url: pin.url,
        proxyUrl: pin.proxyUrl,
        title: pin.title || "Saved pin",
        savedAt: new Date().toISOString()
      });
      saveBoards(boards);
    }

    renderBoardsPage();
    return true;
  };

  const removePinFromBoard = (boardId, pinUrl) => {
    const boards = getBoards().map((board) => {
      if (board.id === boardId) {
        return {
          ...board,
          pins: (board.pins || []).filter((pin) => pin.url !== pinUrl)
        };
      }

      return board;
    });

    saveBoards(boards);
    renderBoardsPage();
  };

  const deleteBoard = (boardId) => {
    saveBoards(getBoards().filter((board) => board.id !== boardId));
    renderBoardsPage();
  };

  const renameBoard = (boardId, name) => {
    const normalized = name.trim().replace(/\s+/g, " ").slice(0, 48);

    if (!normalized) {
      return false;
    }

    const boards = getBoards();
    const board = boards.find((item) => item.id === boardId);

    if (!board) {
      return false;
    }

    board.name = normalized;
    saveBoards(boards);
    renderBoardsPage();
    return true;
  };

  const setBoardCover = (boardId, pin) => {
    const boards = getBoards();
    const board = boards.find((item) => item.id === boardId);

    if (!board) {
      return;
    }

    board.coverUrl = pin.url;
    board.coverProxyUrl = pin.proxyUrl;
    saveBoards(boards);
    renderBoardsPage();
  };

  const getBoardCover = (board) => {
    const pins = board.pins || [];
    const selectedPin = board.coverUrl ? pins.find((pin) => pin.url === board.coverUrl) : null;
    return selectedPin || pins[0] || null;
  };

  const moveItem = (items, fromIndex, toIndex) => {
    const next = [...items];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
  };

  const reorderBoards = (draggedBoardId, targetBoardId) => {
    if (draggedBoardId === targetBoardId) {
      return;
    }

    const boards = getBoards();
    const fromIndex = boards.findIndex((board) => board.id === draggedBoardId);
    const toIndex = boards.findIndex((board) => board.id === targetBoardId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    saveBoards(moveItem(boards, fromIndex, toIndex));
    renderBoardsPage();
  };

  const reorderPins = (boardId, draggedPinUrl, targetPinUrl) => {
    if (draggedPinUrl === targetPinUrl) {
      return;
    }

    const boards = getBoards();
    const board = boards.find((item) => item.id === boardId);

    if (!board) {
      return;
    }

    const pins = board.pins || [];
    const fromIndex = pins.findIndex((pin) => pin.url === draggedPinUrl);
    const toIndex = pins.findIndex((pin) => pin.url === targetPinUrl);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    board.pins = moveItem(pins, fromIndex, toIndex);
    saveBoards(boards);
    renderBoardsPage();
  };

  const renderBoardsPage = () => {
    const container = document.querySelector("[data-boards-list]");

    if (!container) {
      return;
    }

    const boards = getBoards();
    container.replaceChildren();

    if (boards.length === 0) {
      const empty = createElement("article", { className: "empty-state" });
      empty.append(
        createElement("h2", { text: "No boards yet" }),
        createElement("p", { text: "Create a board above, or pin an image from search results to start collecting ideas." })
      );
      container.appendChild(empty);
      return;
    }

    boards.forEach((board) => {
      const card = createElement("article", {
        className: "board-card",
        attributes: { "data-board-id": board.id }
      });
      const coverPin = getBoardCover(board);
      const cover = createElement("button", {
        className: coverPin ? "board-cover" : "board-cover board-cover-empty",
        attributes: { type: "button" }
      });

      if (coverPin) {
        cover.style.backgroundImage = `url("${coverPin.proxyUrl}")`;
        cover.textContent = "Open cover";
        cover.addEventListener("click", () => openPreview(coverPin));
      } else {
        cover.textContent = "No cover yet";
        cover.disabled = true;
      }

      const header = createElement("div", { className: "board-card-header" });
      const title = createElement("div", { className: "board-title" });
      title.append(
        createElement("h2", { text: board.name }),
        createElement("p", { text: `${(board.pins || []).length} pins` })
      );

      const actions = createElement("div", { className: "board-actions" });
      const dragHandle = createElement("button", {
        className: "secondary-button compact-button drag-handle",
        text: "Drag",
        attributes: {
          type: "button",
          draggable: "true",
          "aria-label": `Drag ${board.name} board`,
          "data-board-drag-handle": board.id
        }
      });
      const renameButton = createElement("button", {
        className: "secondary-button compact-button",
        text: "Rename",
        attributes: { type: "button" }
      });
      const deleteButton = createElement("button", {
        className: "secondary-button compact-button",
        text: "Delete",
        attributes: { type: "button" }
      });
      const renameForm = createElement("form", { className: "board-rename-form", attributes: { hidden: "" } });
      const renameInput = createElement("input", {
        attributes: {
          type: "text",
          value: board.name,
          maxlength: "48",
          "aria-label": `Rename ${board.name}`
        }
      });
      const renameSubmit = createElement("button", { text: "Save", attributes: { type: "submit" } });

      dragHandle.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "move";
        setDragPayload(event, { type: "board", boardId: board.id });
        card.classList.add("is-dragging");
      });
      dragHandle.addEventListener("dragend", () => card.classList.remove("is-dragging"));
      card.addEventListener("dragover", (event) => event.preventDefault());
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        const payload = readDragPayload(event);

        if (payload?.type === "board") {
          reorderBoards(payload.boardId, board.id);
        }
      });

      renameButton.addEventListener("click", () => {
        renameForm.hidden = !renameForm.hidden;
        if (!renameForm.hidden) {
          renameInput.focus();
          renameInput.select();
        }
      });
      renameForm.addEventListener("submit", (event) => {
        event.preventDefault();
        renameBoard(board.id, renameInput.value);
      });
      deleteButton.addEventListener("click", () => deleteBoard(board.id));
      renameForm.append(renameInput, renameSubmit);
      actions.append(dragHandle, renameButton, deleteButton);
      header.append(title, actions);

      const pinGrid = createElement("div", { className: "board-pin-grid" });

      if ((board.pins || []).length === 0) {
        pinGrid.appendChild(createElement("p", {
          className: "empty-inline",
          text: "This board is empty. Search for ideas and hit Pin."
        }));
      }

      (board.pins || []).forEach((pin) => {
        const item = createElement("div", {
          className: "board-pin",
          attributes: {
            "data-image-url": pin.url,
            "data-proxy-url": pin.proxyUrl,
            "data-pin-title": pin.title || "Saved pin",
            "data-board-id": board.id,
            "data-pin-url": pin.url
          }
        });
        const link = createElement("a", {
          className: "pin-open-link",
          attributes: {
            href: pin.proxyUrl,
            rel: "noopener noreferrer"
          }
        });
        const image = createElement("img", {
          attributes: {
            src: pin.proxyUrl,
            alt: pin.title || "Saved pin",
            loading: "lazy"
          }
        });
        const pinActions = createElement("div", { className: "board-pin-actions" });
        const pinDragHandle = createElement("button", {
          className: "secondary-button compact-button drag-handle",
          text: "Drag",
          attributes: {
            type: "button",
            draggable: "true",
            "aria-label": `Drag ${pin.title || "saved pin"}`
          }
        });
        const setCover = createElement("button", {
          className: "secondary-button compact-button",
          text: board.coverUrl === pin.url ? "Cover" : "Set cover",
          attributes: { type: "button" }
        });
        const remove = createElement("button", {
          className: "secondary-button compact-button",
          text: "Remove",
          attributes: { type: "button" }
        });

        pinDragHandle.addEventListener("dragstart", (event) => {
          event.dataTransfer.effectAllowed = "move";
          setDragPayload(event, { type: "pin", boardId: board.id, pinUrl: pin.url });
          item.classList.add("is-dragging");
        });
        pinDragHandle.addEventListener("dragend", () => item.classList.remove("is-dragging"));
        item.addEventListener("dragover", (event) => event.preventDefault());
        item.addEventListener("drop", (event) => {
          event.preventDefault();
          const payload = readDragPayload(event);

          if (payload?.type === "pin" && payload.boardId === board.id) {
            reorderPins(board.id, payload.pinUrl, pin.url);
          }
        });
        setCover.addEventListener("click", () => setBoardCover(board.id, pin));
        remove.addEventListener("click", () => removePinFromBoard(board.id, pin.url));
        link.appendChild(image);
        pinActions.append(pinDragHandle, setCover, remove);
        item.append(link, pinActions);
        pinGrid.appendChild(item);
      });

      card.append(cover, header, renameForm, pinGrid);
      container.appendChild(card);
    });
  };

  const setDragPayload = (event, payload) => {
    const value = JSON.stringify(payload);
    event.dataTransfer.setData("application/x-pinternext-drag", value);
    event.dataTransfer.setData("text/plain", value);
  };

  const readDragPayload = (event) => {
    try {
      const value = event.dataTransfer.getData("application/x-pinternext-drag") || event.dataTransfer.getData("text/plain");
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  };

  const initBoardsPage = () => {
    const form = document.querySelector("[data-board-create-form]");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("[data-board-name-input]");

      if (input && createBoard(input.value)) {
        input.value = "";
      }
    });

    renderBoardsPage();
  };

  const getPinFromElement = (element) => {
    const card = element.closest("[data-image-url]");

    if (!card) {
      return null;
    }

    return {
      url: card.dataset.imageUrl,
      proxyUrl: card.dataset.proxyUrl,
      title: card.dataset.pinTitle || "Saved pin"
    };
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

  const openPreview = (pin) => {
    if (!pin?.proxyUrl) {
      return;
    }

    previewDialog = previewDialog || createPreviewDialog();
    const image = previewDialog.querySelector("[data-preview-image]");

    image.src = pin.proxyUrl;
    image.alt = pin.title || "Image preview";
    previewDialog.hidden = false;
  };

  const initPreviewViewer = () => {
    document.addEventListener("click", (event) => {
      const link = event.target.closest(".pin-open-link");

      if (!link) {
        return;
      }

      const pin = getPinFromElement(link);

      if (!pin) {
        return;
      }

      event.preventDefault();
      openPreview(pin);
    });
  };

  const createPinDialog = () => {
    const backdrop = createElement("div", {
      className: "pin-dialog-backdrop",
      attributes: { hidden: "" }
    });
    const dialog = createElement("section", {
      className: "pin-dialog",
      attributes: {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "pin-dialog-title"
      }
    });
    const header = createElement("div", { className: "pin-dialog-header" });
    const title = createElement("h2", { text: "Save to board", attributes: { id: "pin-dialog-title" } });
    const close = createElement("button", { text: "Close", attributes: { type: "button" } });
    const list = createElement("div", { className: "pin-board-list", attributes: { "data-pin-board-list": "" } });
    const form = createElement("form", { className: "board-create-form", attributes: { "data-pin-create-board-form": "" } });
    const input = createElement("input", {
      attributes: {
        type: "text",
        name: "boardName",
        placeholder: "New board name",
        maxlength: "48",
        required: ""
      }
    });
    const submit = createElement("button", { text: "Create & pin", attributes: { type: "submit" } });
    const status = createElement("p", { className: "pin-dialog-status", attributes: { "data-pin-status": "" } });
    const boardsLink = createElement("a", { text: "Manage boards", attributes: { href: "boards.php" } });

    close.addEventListener("click", () => {
      backdrop.hidden = true;
    });

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        backdrop.hidden = true;
      }
    });

    header.append(title, close);
    form.append(input, submit);
    dialog.append(header, list, form, status, boardsLink);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    return backdrop;
  };

  const initPinButtons = () => {
    const dialog = createPinDialog();
    const boardList = dialog.querySelector("[data-pin-board-list]");
    const form = dialog.querySelector("[data-pin-create-board-form]");
    const input = form.querySelector("input");
    const status = dialog.querySelector("[data-pin-status]");
    const closeButton = dialog.querySelector("button");
    let activePin = null;

    const setStatus = (message) => {
      status.textContent = message;
    };

    const hideDialog = () => {
      dialog.hidden = true;
      activePin = null;
      input.value = "";
      setStatus("");
    };

    closeButton?.addEventListener("click", hideDialog);

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        hideDialog();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !dialog.hidden) {
        hideDialog();
      }
    });

    const renderBoardChoices = () => {
      const boards = getBoards();
      boardList.replaceChildren();

      if (boards.length === 0) {
        boardList.appendChild(createElement("p", {
          className: "empty-inline",
          text: "No boards yet. Create one below to save this pin."
        }));
        return;
      }

      boards.forEach((board) => {
        const button = createElement("button", {
          className: "board-choice",
          text: `${board.name} (${(board.pins || []).length})`,
          attributes: { type: "button" }
        });
        button.addEventListener("click", () => {
          if (activePin && savePinToBoard(board.id, activePin)) {
            setStatus(`Saved to ${board.name}.`);
          }
        });
        boardList.appendChild(button);
      });
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const board = createBoard(input.value);

      if (board && activePin && savePinToBoard(board.id, activePin)) {
        input.value = "";
        renderBoardChoices();
        setStatus(`Saved to ${board.name}.`);
      }
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pin-button]");

      if (!button) {
        return;
      }

      activePin = getPinFromElement(button);

      if (!activePin) {
        return;
      }

      setStatus("");
      renderBoardChoices();
      dialog.hidden = false;
      input.focus();
    });
  };

  renderFeed();
  initFeedControls();
  initBoardsPage();
  initPreviewViewer();
  initPinButtons();
})();
