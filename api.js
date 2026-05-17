// api.js
const BASE_URL = 'https://your-api.example.com/api/v1';

// ─── Storage Keys ────────────────────────────────────────────────────────────
const STORAGE_KEY_NOTES       = 'stickyappy_notes';
const STORAGE_KEY_CONNECTIONS = 'stickyappy_connections';

// ─── Private Helpers ─────────────────────────────────────────────────────────
function _loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_NOTES) || '[]');
  } catch {
    return [];
  }
}

function _saveNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
  } catch (e) {
    console.warn('StickyAppy: localStorage write failed for notes', e);
  }
}

function _loadConnections() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_CONNECTIONS) || '[]');
  } catch {
    return [];
  }
}

function _saveConnections(connections) {
  try {
    localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections));
  } catch (e) {
    console.warn('StickyAppy: localStorage write failed for connections', e);
  }
}

// ─── Notes API ───────────────────────────────────────────────────────────────
export async function fetchNotes() {
  return _loadNotes();
}

export async function createNote(note) {
  const notes = _loadNotes();
  note.id        = crypto.randomUUID();
  note.createdAt = new Date().toISOString();
  note.updatedAt = note.createdAt;
  notes.push(note);
  _saveNotes(notes);
  return note;
}

export async function updateNote(id, changes) {
  const notes = _loadNotes();
  const index = notes.findIndex(n => n.id === id);
  if (index !== -1) {
    notes[index] = { ...notes[index], ...changes, updatedAt: new Date().toISOString() };
    _saveNotes(notes);
    return notes[index];
  }
  throw new Error(`Note not found: ${id}`);
}

export async function deleteNote(id) {
  const notes = _loadNotes().filter(n => n.id !== id);
  _saveNotes(notes);
  return true;
}

// ─── Connections API ─────────────────────────────────────────────────────────
export async function fetchConnections() {
  return _loadConnections();
}

export async function createConnection(sourceId, targetId, cpOffsetX, cpOffsetY) {
  const connections = _loadConnections();
  // Duplikat-Schutz
  const exists = connections.some(c =>
    (c.sourceId === sourceId && c.targetId === targetId) ||
    (c.sourceId === targetId && c.targetId === sourceId)
  );
  if (exists) return null;
  const conn = {
    id: crypto.randomUUID(),
    sourceId,
    targetId,
    cpOffsetX: cpOffsetX ?? (Math.random() * 80 - 40),
    cpOffsetY: cpOffsetY ?? (Math.random() * 80 - 40)
  };
  connections.push(conn);
  _saveConnections(connections);
  return conn;
}

export async function deleteConnection(connectionId) {
  const connections = _loadConnections().filter(c => c.id !== connectionId);
  _saveConnections(connections);
  return true;
}

// ─── Sync & Status ───────────────────────────────────────────────────────────
export function startSync(onUpdate) {
  function updateSyncStatus() {
    const dot  = document.getElementById('sync-indicator');
    const text = document.getElementById('sync-text');
    if (!dot || !text) return;
    if (navigator.onLine) {
      dot.className    = 'sync-dot online';
      text.textContent = 'Online';
    } else {
      dot.className    = 'sync-dot offline';
      text.textContent = 'Offline';
    }
  }
  updateSyncStatus();
  window.addEventListener('online',  updateSyncStatus);
  window.addEventListener('offline', updateSyncStatus);

  setInterval(() => {
    // Polling-Logik für echte API – hier Platzhalter
  }, 30000);
}

// ─── Toast ───────────────────────────────────────────────────────────────────
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '⚠️', sync: '🔄', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}
