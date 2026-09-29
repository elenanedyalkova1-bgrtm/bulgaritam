// Presentation only: saved state and analytics remain owned by BaseLayout.
(() => {
  const HINT_KEY = "bulgaritam_save_hint_seen_v1";
  const SAVED_KEY = "bulgaritam_saved_boards_v1";
  const touch = window.matchMedia("(hover: none) and (pointer: coarse)");
  const cardButtons = ".save-btn--card[data-save-id], .save-btn--related[data-save-id], .save-btn--brand[data-save-id]";
  const visible = new Set();
  let hintButton = null;
  let hintTimer;
  let hintDone = false;

  const canTeachSaving = () => {
    try {
      if (localStorage.getItem(HINT_KEY)) return false;
      const state = JSON.parse(localStorage.getItem(SAVED_KEY) || "null");
      return !Object.values(state?.items || {}).some(items => Array.isArray(items) && items.length);
    } catch {
      // Without persistent storage, a once-per-browser hint cannot be guaranteed.
      return false;
    }
  };

  const dismissHint = () => {
    clearTimeout(hintTimer);
    hintButton?.removeAttribute("data-save-hint");
    hintButton = null;
  };

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio === 1) visible.add(entry.target);
          else {
            visible.delete(entry.target);
            if (entry.target === hintButton) dismissHint();
          }
        }
        maybeShowHint();
      }, { threshold: [0, 1] })
    : null;

  function maybeShowHint() {
    if (hintDone || !touch.matches || document.visibilityState !== "visible") return;
    if (!canTeachSaving()) {
      hintDone = true;
      observer?.disconnect();
      return;
    }
    if (document.querySelector('#save-modal[aria-hidden="false"], .newsletter-modal:not([hidden]), .mobile-overlay:not([hidden])')) return;
    const headerBottom = document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0;
    const cookie = document.querySelector(".cookie:not([hidden])");
    const visibleBottom = cookie ? Math.min(innerHeight, cookie.getBoundingClientRect().top) : innerHeight;
    const candidate = [...visible].filter(button => {
      const rect = button.getBoundingClientRect();
      return button.isConnected && button.getAttribute("aria-pressed") !== "true"
        && rect.width > 0 && rect.top >= headerBottom && rect.bottom + 65 < visibleBottom;
    }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (!candidate) return;
    try { localStorage.setItem(HINT_KEY, "1"); } catch { return; }
    hintDone = true;
    hintButton = candidate;
    candidate.setAttribute("data-save-hint", "");
    hintTimer = window.setTimeout(dismissHint, 5500);
  }

  const enhanceButtons = () => {
    document.querySelectorAll(cardButtons).forEach(button => {
      if (button.classList.contains("save-discoverable")) return;
      button.classList.add("save-discoverable");
      button.dataset.saveLabel = button.getAttribute("aria-pressed") === "true" ? "Запазено" : "Запази";
      if (!hintDone && touch.matches) observer?.observe(button);
    });
  };

  enhanceButtons();
  window.addEventListener("bulgaritam:products-appended", enhanceButtons);
  touch.addEventListener("change", () => {
    dismissHint();
    if (touch.matches && !hintDone) document.querySelectorAll(cardButtons).forEach(button => observer?.observe(button));
  });
  // A cookie/dialog dismissal can uncover a button without changing intersection.
  document.addEventListener("click", () => requestAnimationFrame(maybeShowHint));
  document.addEventListener("scroll", maybeShowHint, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") dismissHint();
    else maybeShowHint();
  });
  window.addEventListener("storage", event => {
    if (event.key === HINT_KEY || event.key === SAVED_KEY) {
      if (!canTeachSaving()) { hintDone = true; dismissHint(); observer?.disconnect(); }
    }
  });

  const feedback = document.getElementById("save-feedback");
  let feedbackTimer;
  const hideFeedback = () => {
    clearTimeout(feedbackTimer);
    if (feedback) feedback.hidden = true;
  };
  const scheduleFeedbackDismissal = () => {
    clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(hideFeedback, 8000);
  };
  feedback?.querySelector("[data-save-feedback-close]")?.addEventListener("click", hideFeedback);
  feedback?.addEventListener("pointerenter", () => clearTimeout(feedbackTimer));
  feedback?.addEventListener("pointerleave", () => {
    if (!feedback.matches(":focus-within")) scheduleFeedbackDismissal();
  });
  feedback?.addEventListener("focusin", () => clearTimeout(feedbackTimer));
  feedback?.addEventListener("focusout", event => {
    if (!feedback.contains(event.relatedTarget)) scheduleFeedbackDismissal();
  });
  window.addEventListener("bulgaritam:save-confirmed", () => {
    hintDone = true;
    dismissHint();
    observer?.disconnect();
    try { localStorage.setItem(HINT_KEY, "1"); } catch {}
    if (feedback) {
      feedback.hidden = false;
      scheduleFeedbackDismissal();
    }
  });
})();
