(() => {
  document.documentElement.classList.add("js");
  const btn = document.querySelector(".nav-toggle");
  const overlay = document.getElementById("mobile-overlay");
  const closeEls = overlay ? overlay.querySelectorAll("[data-close]") : [];
  const links = overlay ? overlay.querySelectorAll("a") : [];

  const setOpen = (open) => {
    if (!btn || !overlay) return;
    if (open) {
      overlay.removeAttribute("hidden");
      overlay.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      document.documentElement.classList.add("no-scroll");
    } else {
      overlay.setAttribute("hidden", "");
      overlay.setAttribute("aria-hidden", "true");
      btn.setAttribute("aria-expanded", "false");
      document.documentElement.classList.remove("no-scroll");
    }
  };

  if (btn && overlay) {
    btn.addEventListener("click", () => setOpen(true));
    closeEls.forEach((el) => el.addEventListener("click", () => setOpen(false)));
    links.forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hasAttribute("hidden")) setOpen(false);
    });
  }

  const searchToggle = document.querySelector(".header-search-toggle");
  const searchPanel = document.getElementById("header-search-panel");
  const searchInput = document.getElementById("header-product-search");
  const searchForm = searchPanel?.querySelector("form");
  const explicitSearchMarker = "bulgaritam_explicit_search_scroll_v1";

  window.bulgaritamScrollToResults = () => {
    const target = document.getElementById("productResultsStart") || document.getElementById("products");
    if (!target) return;
    const stickyHeader = document.querySelector(".site-header");
    const offset = (stickyHeader?.getBoundingClientRect().height || 0) + 20;
    const scroller = document.body.scrollHeight > document.documentElement.scrollHeight
      ? document.body
      : (document.scrollingElement || document.documentElement);
    const currentTop = scroller === document.body ? document.body.scrollTop : window.scrollY;
    const top = Math.max(0, target.getBoundingClientRect().top + currentTop - offset);
    scroller.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  window.bulgaritamConsumeExplicitSearchScroll = () => {
    try {
      const marked = sessionStorage.getItem(explicitSearchMarker) === "1";
      if (marked) sessionStorage.removeItem(explicitSearchMarker);
      return marked;
    } catch {
      return false;
    }
  };

  searchForm?.addEventListener("submit", () => {
    if (!String(searchInput?.value || "").trim()) return;
    try { sessionStorage.setItem(explicitSearchMarker, "1"); } catch {}
  });

  const setSearchOpen = (open) => {
    if (!searchToggle || !searchPanel) return;
    searchPanel.toggleAttribute("hidden", !open);
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) window.setTimeout(() => searchInput?.focus(), 0);
  };
  searchToggle?.addEventListener("click", () => setSearchOpen(searchPanel?.hasAttribute("hidden")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSearchOpen(false);
  });
})();
