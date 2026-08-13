(() => {
  const container = document.querySelector(".img-container");

  if (!container) {
    return;
  }

  const tiles = Array.from(container.querySelectorAll(".img-result"));

  /**
   * Mirrors the intended masonry breakpoints: tiles are assigned to a fixed
   * number of column elements and never rebalanced when images decode or when
   * infinite-scroll appends more pins.
   */
  const columnCountFor = (width) => {
    if (width < 768) return 2;
    if (width < 1024) return 3;
    if (width < 1440) return 4;
    return 5;
  };

  const tileWeight = (tile) => {
    const width = Number(tile.dataset.pinWidth);
    const height = Number(tile.dataset.pinHeight);

    if (width > 0 && height > 0) {
      return height / width;
    }

    return 1.5;
  };

  let columns = [];
  let heights = [];
  let columnCount = 0;

  const buildColumns = (count) => {
    columnCount = count;
    columns = [];
    heights = new Array(count).fill(0);

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      const column = document.createElement("div");
      column.className = "masonry-column";
      columns.push(column);
      fragment.appendChild(column);
    }

    return fragment;
  };

  const placeTile = (tile) => {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].appendChild(tile);
    heights[shortest] += tileWeight(tile);
  };

  const layout = (items) => {
    const nextCount = columnCountFor(window.innerWidth);
    const fragment = buildColumns(nextCount);

    items.forEach(placeTile);
    container.replaceChildren(fragment);
    container.style.setProperty("--masonry-columns", String(nextCount));
    container.classList.add("masonry-ready");
  };

  if (tiles.length > 0) {
    layout(tiles);
  } else {
    container.classList.add("masonry-ready");
  }

  window.addEventListener("resize", () => {
    const nextCount = columnCountFor(window.innerWidth);

    if (nextCount === columnCount || columns.length === 0) {
      return;
    }

    layout(Array.from(container.querySelectorAll(".img-result")));
  });

  window.PinternextMasonry = {
    appendTiles(nodes) {
      if (columns.length === 0) {
        layout(Array.from(nodes));
        return;
      }

      nodes.forEach(placeTile);
    }
  };
})();
