// api.js
const BASE_URL = 'https://your-api.example.com/api/v1';

let mockNotes = [];
let mockConnections = [];

export async function fetchNotes() {
  return new Promise(resolve => setTimeout(() => resolve(mockNotes), 200));
}

export async function createNote(note) {
  note.id = crypto.randomUUID();
  note.createdAt = new Date().toISOString();
  note.updatedAt = note.createdAt;
  mockNotes.push(note);
  return note;
}

export async function updateNote(id, changes) {
  const index = mockNotes.findIndex(n => n.id === id);
  if (index !== -1) {
    mockNotes[index] = { ...mockNotes[index], ...changes, updatedAt: new Date().toISOString() };
    return mockNotes[index];
  }
  throw new Error('Note not found');
}

export async function deleteNote(id) {
  mockNotes = mockNotes.filter(n => n.id !== id);
  return true;
}

export async function createConnection(sourceId, targetId) {
  const conn = { id: crypto.randomUUID(), sourceId, targetId };
  mockConnections.push(conn);
  return conn;
}

export async function deleteConnection(connectionId) {
  mockConnections = mockConnections.filter(c => c.id !== connectionId);
  return true;
}

export function startSync(onUpdate) {
  setInterval(() => {
    // Polling Logik für echte API
  }, 30000);
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if(type === 'success') icon = '✅';
  if(type === 'error') icon = '⚠️';
  if(type === 'sync') icon = '🔄';
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}
