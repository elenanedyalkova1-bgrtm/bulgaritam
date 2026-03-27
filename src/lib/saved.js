// src/lib/saved.js

export const STORAGE_KEY = "bulgaritam_saved";
export const EVENT_NAME = "bulgaritam:saved";

export function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeSaved(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  // ✅ notify same-tab listeners (header count etc.)
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: items }));

  // ✅ also notify document-level listeners if you prefer that
  document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: items }));
}

export function isSaved(id) {
  return readSaved().some((x) => x && x.id === id);
}

export function syncOneButton(button) {
  const id = button?.dataset?.id;
  const active = !!id && isSaved(id);

  button.classList.toggle("is-saved", active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
}

export function syncAllSaveButtons(root = document) {
  root.querySelectorAll("[data-save-btn]").forEach(syncOneButton);
}

export function toggleSavedFromButton(button) {
  const id = button?.dataset?.id;
  if (!id) return;

  const item = {
    id,
    url: button.dataset.url || "",
    title: button.dataset.title || "",
    brand: button.dataset.brand || "",
    price: button.dataset.price || "",
    image: button.dataset.image || "",
    savedAt: Date.now(),
  };

  const items = readSaved();
  const idx = items.findIndex((x) => x && x.id === id);

  if (idx >= 0) items.splice(idx, 1);
  else items.unshift(item);

  writeSaved(items);

  // ✅ THIS is the key: update UI immediately on this page
  syncOneButton(button);
}

export function initSaveSystem(root = document) {
  // ✅ ensure initial state is correct
  syncAllSaveButtons(root);

  // ✅ click delegation for all save buttons
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-save-btn]");
    if (!btn) return;

    // prevent any accidental link navigation/overlay click
    e.preventDefault();

    toggleSavedFromButton(btn);
  });

  // ✅ keep in sync across tabs/windows
  window.addEventListener("storage", () => syncAllSaveButtons(root));
}
