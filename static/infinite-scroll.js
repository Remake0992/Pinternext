(() => {
  const imageContainer = document.querySelector(".img-container");
  let pagination = document.querySelector(".next-page");

  if (!imageContainer || !pagination || !("IntersectionObserver" in window)) {
    return;
  }

  let isLoading = false;
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadNextPage();
    }
  }, { rootMargin: "900px 0px" });

  const updateFooterCount = () => {
    const footerCount = document.querySelector(".footer-count");

    if (footerCount) {
      const totalImages = document.querySelectorAll(".img-container .img-result").length;
      footerCount.textContent = `${totalImages} images loaded`;
    }
  };

  const setPaginationText = (text) => {
    const link = pagination?.querySelector("a");

    if (link) {
      link.textContent = text;
    }
  };

  const loadNextPage = async () => {
    const link = pagination?.querySelector("a");

    if (isLoading || !link) {
      return;
    }

    isLoading = true;
    pagination.classList.add("is-loading");
    setPaginationText("Loading more ideas…");

    try {
      const response = await fetch(link.href, {
        headers: {
          "X-Requested-With": "fetch"
        }
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const newImages = doc.querySelectorAll(".img-container .img-result");
      const nextLink = doc.querySelector(".next-page a");

      newImages.forEach((image) => {
        imageContainer.appendChild(document.importNode(image, true));
      });

      updateFooterCount();

      if (nextLink) {
        link.href = nextLink.href;
        setPaginationText("Loading more ideas…");
      } else {
        pagination.remove();
        pagination = null;
        observer.disconnect();
      }
    } catch (error) {
      console.error("Unable to load more images", error);
      observer.disconnect();
      pagination.classList.add("has-error");
      setPaginationText("Couldn’t load more. Click to try again.");
    } finally {
      isLoading = false;

      if (pagination) {
        pagination.classList.remove("is-loading");
      }
    }
  };

  pagination.classList.add("auto-load");
  setPaginationText("Loading more ideas…");
  observer.observe(pagination);
})();
