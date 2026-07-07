(() => {
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

  const svgIcon = (path, label) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    svg.appendChild(p);
    const btn = createElement("button", {
      className: "board-icon-btn",
      attributes: { type: "button", "aria-label": label }
    });
    btn.appendChild(svg);
    return btn;
  };

  const ICON_RENAME = "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z";
  const ICON_DELETE = "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6";
  const ICON_DRAG   = "M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01";
  const ICON_COVER  = "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7";
  const ICON_REMOVE = "M18 6L6 18M6 6l12 12";
  const ICON_CHEVRON_DOWN = "M6 9l6 6 6-6";

  /* Boards are collapsed by default — expanded state is tracked only in memory
     for the current page session, so they always start collapsed on (re)load. */
  const expandedBoards = new Set();

  const renderBoardsPage = () => {
    const container = document.querySelector("[data-boards-list]");

    if (!container) {
      return;
    }

    const boards = getBoards();
    const expanded = expandedBoards;
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
      const isExpanded = expanded.has(board.id);
      const card = createElement("article", {
        className: "board-card" + (isExpanded ? " is-expanded" : ""),
        attributes: { "data-board-id": board.id }
      });

      /* ── square cover tile ── */
      const pins = board.pins || [];
      const coverPin = getBoardCover(board);

      const coverWrap = createElement("div", { className: "board-cover" });

      if (!coverPin) {
        const ph = createElement("div", { className: "board-cover-empty" });
        ph.textContent = "No pins yet";
        coverWrap.appendChild(ph);
      } else {
        const coverImg = createElement("img", {
          attributes: { src: coverPin.proxyUrl, alt: coverPin.title || "Board cover", loading: "lazy" }
        });
        coverWrap.appendChild(coverImg);
      }

      /* Name + count label overlaid on the cover (hidden when expanded) */
      const coverLabel = createElement("div", { className: "board-cover-label" });
      const coverLabelName = createElement("span", { className: "board-cover-name", text: board.name });
      const coverLabelCount = createElement("span", {
        className: "board-cover-count",
        text: `${pins.length} pin${pins.length !== 1 ? "s" : ""}`
      });
      coverLabel.append(coverLabelName, coverLabelCount);
      coverWrap.appendChild(coverLabel);

      /* clicking the cover (or anywhere on the card header) toggles expand */
      const toggleExpand = () => {
        if (expandedBoards.has(board.id)) {
          expandedBoards.delete(board.id);
          card.classList.remove("is-expanded");
        } else {
          expandedBoards.add(board.id);
          card.classList.add("is-expanded");
        }
        const body = card.querySelector(".board-body");
        if (body) body.hidden = !card.classList.contains("is-expanded");
        const chevron = card.querySelector(".board-chevron");
        if (chevron) chevron.classList.toggle("is-open", card.classList.contains("is-expanded"));
      };

      /* Cover click bubbles up to .board-card-header which handles the toggle */

      /* ── collapsed header row ── */
      const meta = createElement("div", { className: "board-meta" });
      const metaLeft = createElement("div", { className: "board-meta-left" });
      const nameEl = createElement("span", { className: "board-name", text: board.name });
      const countEl = createElement("span", { className: "board-count", text: `${pins.length} pin${pins.length !== 1 ? "s" : ""}` });
      metaLeft.append(nameEl, countEl);

      const metaRight = createElement("div", { className: "board-meta-right" });

      const dragHandle = createElement("button", {
        className: "board-icon-btn drag-handle",
        attributes: {
          type: "button",
          draggable: "true",
          "aria-label": `Drag ${board.name} board`,
          "data-board-drag-handle": board.id
        }
      });
      const dragSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      dragSvg.setAttribute("viewBox", "0 0 24 24"); dragSvg.setAttribute("fill", "none");
      dragSvg.setAttribute("stroke", "currentColor"); dragSvg.setAttribute("stroke-width", "2");
      dragSvg.setAttribute("stroke-linecap", "round"); dragSvg.setAttribute("stroke-linejoin", "round");
      dragSvg.setAttribute("aria-hidden", "true"); dragSvg.setAttribute("width", "16"); dragSvg.setAttribute("height", "16");
      [ICON_DRAG].forEach((d) => { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); dragSvg.appendChild(p); });
      dragHandle.appendChild(dragSvg);

      const renameButton = svgIcon(ICON_RENAME, `Rename ${board.name}`);
      renameButton.classList.add("board-icon-btn");
      const deleteButton = svgIcon(ICON_DELETE, `Delete ${board.name}`);
      deleteButton.classList.add("board-icon-btn", "board-icon-btn--danger");

      const chevronBtn = createElement("button", {
        className: "board-icon-btn board-chevron" + (isExpanded ? " is-open" : ""),
        attributes: { type: "button", "aria-label": isExpanded ? "Collapse board" : "Expand board" }
      });
      const chevSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      chevSvg.setAttribute("viewBox", "0 0 24 24"); chevSvg.setAttribute("fill", "none");
      chevSvg.setAttribute("stroke", "currentColor"); chevSvg.setAttribute("stroke-width", "2.5");
      chevSvg.setAttribute("stroke-linecap", "round"); chevSvg.setAttribute("stroke-linejoin", "round");
      chevSvg.setAttribute("aria-hidden", "true"); chevSvg.setAttribute("width", "16"); chevSvg.setAttribute("height", "16");
      const chevPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      chevPath.setAttribute("d", ICON_CHEVRON_DOWN); chevSvg.appendChild(chevPath);
      chevronBtn.appendChild(chevSvg);
      chevronBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExpand();
      });

      metaRight.append(dragHandle, renameButton, deleteButton, chevronBtn);
      meta.append(metaLeft, metaRight);

      /* ── rename form ── */
      const renameForm = createElement("form", { className: "board-rename-form", attributes: { hidden: "" } });
      const renameInput = createElement("input", {
        attributes: { type: "text", value: board.name, maxlength: "48", "aria-label": `Rename ${board.name}` }
      });
      const renameSubmit = createElement("button", { text: "Save", attributes: { type: "submit" } });

      /* ── drag / drop for board reorder ── */
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
        if (payload?.type === "board") { reorderBoards(payload.boardId, board.id); }
      });

      renameButton.addEventListener("click", (e) => {
        e.stopPropagation();
        renameForm.hidden = !renameForm.hidden;
        if (!renameForm.hidden) { renameInput.focus(); renameInput.select(); }
      });
      renameForm.addEventListener("submit", (event) => {
        event.preventDefault();
        renameBoard(board.id, renameInput.value);
      });
      deleteButton.addEventListener("click", (e) => { e.stopPropagation(); deleteBoard(board.id); });
      renameForm.append(renameInput, renameSubmit);

      /* ── expandable pin grid body ── */
      const body = createElement("div", { className: "board-body", attributes: isExpanded ? {} : { hidden: "" } });
      const pinGrid = createElement("div", { className: "board-pin-grid" });

      if (pins.length === 0) {
        pinGrid.appendChild(createElement("p", {
          className: "empty-inline",
          text: "This board is empty. Search for ideas and hit Pin."
        }));
      }

      pins.forEach((pin) => {
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
          attributes: { href: pin.proxyUrl, rel: "noopener noreferrer" }
        });
        const image = createElement("img", {
          attributes: { src: pin.proxyUrl, alt: pin.title || "Saved pin", loading: "lazy" }
        });

        /* overlay action buttons */
        const overlay = createElement("div", { className: "board-pin-overlay" });
        const pinDragHandle = createElement("button", {
          className: "board-icon-btn drag-handle",
          attributes: { type: "button", draggable: "true", "aria-label": `Drag ${pin.title || "saved pin"}` }
        });
        const dSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        dSvg.setAttribute("viewBox", "0 0 24 24"); dSvg.setAttribute("fill", "none");
        dSvg.setAttribute("stroke", "currentColor"); dSvg.setAttribute("stroke-width", "2");
        dSvg.setAttribute("stroke-linecap", "round"); dSvg.setAttribute("stroke-linejoin", "round");
        dSvg.setAttribute("aria-hidden", "true"); dSvg.setAttribute("width", "14"); dSvg.setAttribute("height", "14");
        const dp = document.createElementNS("http://www.w3.org/2000/svg", "path"); dp.setAttribute("d", ICON_DRAG); dSvg.appendChild(dp);
        pinDragHandle.appendChild(dSvg);

        const setCover = svgIcon(ICON_COVER, board.coverUrl === pin.url ? "Current cover" : "Set as cover");
        if (board.coverUrl === pin.url) setCover.classList.add("board-icon-btn--active");
        const remove = svgIcon(ICON_REMOVE, "Remove pin");
        remove.classList.add("board-icon-btn--danger");

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
        setCover.addEventListener("click", (e) => { e.preventDefault(); setBoardCover(board.id, pin); });
        remove.addEventListener("click", (e) => { e.preventDefault(); removePinFromBoard(board.id, pin.url); });
        link.appendChild(image);
        overlay.append(pinDragHandle, setCover, remove);
        item.append(link, overlay);
        pinGrid.appendChild(item);
      });

      body.appendChild(pinGrid);

      /* Wrap cover + meta in a header div so they sit side-by-side when expanded */
      const cardHeader = createElement("div", { className: "board-card-header" });
      cardHeader.addEventListener("click", (e) => {
        /* Only toggle if the click wasn't on an action button inside meta */
        if (!e.target.closest(".board-meta-right")) {
          toggleExpand();
        }
      });
      cardHeader.append(coverWrap, meta);

      card.append(cardHeader, renameForm, body);
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

  initBoardsPage();
  initPreviewViewer();
  initPinButtons();
})();
