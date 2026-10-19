(() => {
  // Selected values consume the normal budget, but are never hidden themselves.
  const overflowIndices = (options, limit = 8) => {
    let remaining = Math.max(0, limit - options.filter((option) => option.selected).length);
    return options.flatMap((option, index) => {
      if (option.selected) return [];
      if (remaining > 0) { remaining -= 1; return []; }
      return [index];
    });
  };
  window.bulgaritamFacetOverflowIndices = overflowIndices;
  window.bulgaritamUpdateFacetOverflow = (panel, optionSelector, buttonClass) => {
    const allOptions = Array.from(panel.querySelectorAll(optionSelector));
    allOptions.forEach((option) => option.classList.remove("is-overflow-option"));
    const options = allOptions.filter((option) => !option.hidden);
    const overflow = new Set(overflowIndices(options.map((option) => ({ selected: Boolean(option.querySelector("input")?.checked) }))));
    let button = panel.parentElement?.querySelector(`:scope > .${buttonClass}`);
    if (!overflow.size) { button?.remove(); return; }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = buttonClass;
      panel.insertAdjacentElement("afterend", button);
    }
    const expanded = panel.dataset.optionsExpanded === "true";
    options.forEach((option, index) => option.classList.toggle("is-overflow-option", !expanded && overflow.has(index)));
    button.textContent = expanded ? "Покажи по-малко" : `Покажи още (${overflow.size})`;
    button.setAttribute("aria-expanded", String(expanded));
    button.onclick = () => {
      panel.dataset.optionsExpanded = String(!expanded);
      window.bulgaritamUpdateFacetOverflow(panel, optionSelector, buttonClass);
    };
  };
})();
