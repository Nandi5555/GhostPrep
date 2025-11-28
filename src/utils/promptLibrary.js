// Lightweight prompt library stored in localStorage.
// Provides helpers to create, update, list, and set an active prompt.
// ESM exports for components, and attaches to window for direct access.

const STORAGE_KEY = 'customPrompts';
const ACTIVE_KEY = 'activePromptId';
const LEGACY_KEY = 'customPrompt';

function safeParse(json, fallback) {
  try {
    return JSON.parse(json ?? '');
  } catch (_) {
    return fallback;
  }
}

function nowTs() {
  return Date.now();
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p_${nowTs()}_${Math.floor(Math.random() * 1e6)}`;
}

function getPrompts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const arr = safeParse(raw, []);
  if (!Array.isArray(arr)) return [];
  return arr;
}

function savePrompts(list) {
  if (!Array.isArray(list)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function getActivePromptId() {
  return localStorage.getItem(ACTIVE_KEY) || '';
}

function setActivePrompt(id) {
  localStorage.setItem(ACTIVE_KEY, id || '');
}

function getActivePrompt() {
  const id = getActivePromptId();
  if (!id) return null;
  const prompts = getPrompts();
  return prompts.find(p => p.id === id) || null;
}

function addPrompt({ name = 'New Cluely', content = '' } = {}) {
  const prompts = getPrompts();
  const p = {
    id: genId(),
    name: String(name || 'New Cluely').trim(),
    content: String(content || ''),
    createdAt: nowTs(),
    updatedAt: nowTs(),
  };
  prompts.push(p);
  savePrompts(prompts);
  return p;
}

function updatePrompt(id, { name, content } = {}) {
  const prompts = getPrompts();
  const idx = prompts.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const prev = prompts[idx];
  const next = {
    ...prev,
    name: name !== undefined ? String(name) : prev.name,
    content: content !== undefined ? String(content) : prev.content,
    updatedAt: nowTs(),
  };
  prompts[idx] = next;
  savePrompts(prompts);
  return next;
}

function deletePrompt(id) {
  const prompts = getPrompts();
  const filtered = prompts.filter(p => p.id !== id);
  savePrompts(filtered);
  // If we deleted the active prompt, clear active id
  if (getActivePromptId() === id) {
    setActivePrompt('');
  }
}

function migrateFromLegacyKey() {
  const prompts = getPrompts();
  if (Array.isArray(prompts) && prompts.length > 0) return false;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy || String(legacy).trim().length === 0) return false;
  const created = addPrompt({ name: 'New Cluely', content: legacy });
  setActivePrompt(created.id);
  return true;
}

function getActivePromptContentOrLegacy() {
  const active = getActivePrompt();
  if (active && typeof active.content === 'string') return active.content;
  return localStorage.getItem(LEGACY_KEY) || '';
}

export {
  getPrompts,
  savePrompts,
  addPrompt,
  updatePrompt,
  deletePrompt,
  getActivePrompt,
  setActivePrompt,
  migrateFromLegacyKey,
  getActivePromptContentOrLegacy,
};

// Attach to window for convenience in views without import
if (typeof window !== 'undefined') {
  window.promptLibrary = {
    getPrompts,
    savePrompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    getActivePrompt,
    setActivePrompt,
    migrateFromLegacyKey,
    getActivePromptContentOrLegacy,
  };
}