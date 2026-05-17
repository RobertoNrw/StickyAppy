// script.js
import {
  fetchNotes, createNote, updateNote, deleteNote,
  fetchConnections, createConnection,
  showToast, startSync
} from './api.js';
import { ConnectionsManager } from './connections.js';

let notes = [];
let currentZoom = 1;

const canvas         = document.getElementById('paper-canvas');
const container      = document.getElementById('canvas-container');
const notesContainer = document.getElementById('notes-container');
const contextMenu    = document.getElementById('context-menu');
const connectionsSvg = document.getElementById('connections-svg');

const connManager = new ConnectionsManager(
  connectionsSvg,
  (id) => document.querySelector(`.note[data-id="${id}"]`)
);

// ─── Size helpers ───────────────────────────────────────────────────────────
const SIZE_MAP = {
  s:  { w: 150, h: 150 },
  m:  { w: 200, h: 200 },
  l:  { w: 300, h: 300 },
  xl: { w: 400, h: 200 }
};
function snapToSize(width) {
  return Object.entries(SIZE_MAP).reduce((best, [key, dim]) =>
    Math.abs(dim.w - width) < Math.abs(SIZE_MAP[best].w - width) ? key : best
  , 'm');
}

// ─── Phase 4a: Touch-Koordinaten-Helper ───────────────────────────────────────
// Gibt einheitlich {clientX, clientY} für Mouse- und Touch-Events zurück
function getCoords(e) {
  if (e.touches && e.touches.length > 0)        return e.touches[0];
  if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0];
  return e;
}

// Abstand zwischen zwei Touch-Punkten (für Pinch-Zoom)
function getTouchDistance(e) {
  const [t1, t2] = [e.touches[0], e.touches[1]];
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

// ─── Fokussierte Note (Phase 4b vorbereiten) ──────────────────────────────────
let focusedNote    = null;
let focusedElement = null;

function setFocus(noteData, noteEl) {
  if (focusedElement) focusedElement.classList.remove('focused');
  focusedNote    = noteData;
  focusedElement = noteEl;
  if (noteEl) noteEl.classList.add('focused');
}

function clearFocus() {
  if (focusedElement) focusedElement.classList.remove('focused');
  focusedNote    = null;
  focusedElement = null;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  generateInkOverlays();
  setupToolbar();
  setupCanvasInteraction();
  setupContextMenu();
  setupKeyboardShortcuts(); // Phase 4b

  showToast('Lade Board...', 'sync');

  notes = await fetchNotes();
  const savedConnections = await fetchConnections();

  if (notes.length === 0) {
    await handleCreateNote({
      content_front: 'Willkommen beim Leonardo Board!\nEin Canvas für kreative Gedanken.',
      content_back:  'Die Rückseite für mehr Details.',
      color:    '#f9e9c8',
      size:     'm',
      gridCol:  2,
      gridRow:  2,
      rotation: (Math.random() * 5) - 2.5,
      isFlipped: false
    });
  } else {
    notes.forEach(renderNote);
  }

  if (savedConnections.length > 0) {
    connManager.loadSaved(savedConnections);
  }

  startSync(() => {});
}

// ─── Ink Overlays ─────────────────────────────────────────────────────────────
function generateInkOverlays() {
  const layer2 = document.querySelector('.layer2.ink-splatters');
  const layer3 = document.querySelector('.layer3.ink-scratches');
  for (let i = 0; i < 45; i++) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx',      `${Math.random() * 100}%`);
    c.setAttribute('cy',      `${Math.random() * 100}%`);
    c.setAttribute('r',       (Math.random() * 1.5 + 0.5).toString());
    c.setAttribute('fill',    '#5a3c1e');
    c.setAttribute('opacity', (Math.random() * 0.05 + 0.04).toString());
    layer2.appendChild(c);
  }
  for (let i = 0; i < 3; i++) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const sx = Math.random() * 100, sy = Math.random() * 100;
    p.setAttribute('d',            `M ${sx}% ${sy}% Q ${sx+10}% ${sy+5}% ${sx+30}% ${sy+10}%`);
    p.setAttribute('fill',         'none');
    p.setAttribute('stroke',       '#5a3c1e');
    p.setAttribute('stroke-width', '0.5');
    p.setAttribute('opacity',      '0.03');
    layer3.appendChild(p);
  }
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────
function setupToolbar() {
  document.getElementById('btn-new-note').addEventListener('click', () => {
    handleCreateNote({
      content_front: 'Neue Notiz',
      color:    '#f9e060',
      size:     'm',
      gridCol:  Math.floor(Math.random() * 3) + 1,
      gridRow:  Math.floor(Math.random() * 3) + 1,
      rotation: (Math.random() * 5) - 2.5
    });
  });
  document.getElementById('btn-zoom-in') .addEventListener('click', () => setZoom(currentZoom + 0.1));
  document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(currentZoom - 0.1));
}

function setZoom(level) {
  currentZoom = Math.max(0.6, Math.min(level, 1.5));
  document.getElementById('zoom-level').textContent = `${Math.round(currentZoom * 100)}%`;
  // Phase 2: Zoom-Faktor für Grid als CSS-Variable setzen
  canvas.style.setProperty('--zoom-factor', currentZoom.toString());
  canvas.style.transform = `scale(${currentZoom}) rotate(-0.3deg)`;
  connManager.updateLines();
}

// ─── Canvas Interaction (Mouse Wheel + Phase 4a: Pinch-Zoom) ─────────────────────
function setupCanvasInteraction() {
  canvas.addEventListener('mouseenter', () => canvas.classList.add('grid-active'));
  canvas.addEventListener('mouseleave', () => {
    if (!document.querySelector('.note.dragging')) canvas.classList.remove('grid-active');
  });

  // Mouse Wheel Zoom
  container.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(currentZoom + (e.deltaY > 0 ? -0.05 : 0.05));
    }
  }, { passive: false });

  // Phase 4a: Pinch-to-Zoom
  let pinchStartDist = null;
  let pinchStartZoom = 1;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchStartDist = getTouchDistance(e);
      pinchStartZoom = currentZoom;
      e.preventDefault();
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStartDist !== null) {
      const newDist = getTouchDistance(e);
      const scale   = newDist / pinchStartDist;
      setZoom(pinchStartZoom * scale);
      e.preventDefault();
    }
  }, { passive: false });

  container.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinchStartDist = null;
  });

  // Canvas-Klick → Fokus aufheben
  canvas.addEventListener('click', (e) => {
    if (!e.target.closest('.note') && !e.target.closest('#context-menu')) {
      clearFocus();
    }
  });
}

// ─── Create Note ──────────────────────────────────────────────────────────────
async function handleCreateNote(data) {
  try {
    const note = await createNote(data);
    notes.push(note);
    renderNote(note);
    showToast('Note erstellt ✨', 'success');
  } catch (e) {
    console.error(e);
    showToast('Fehler beim Erstellen', 'error');
  }
}

// ─── Render Note ──────────────────────────────────────────────────────────────
function renderNote(noteData) {
  const noteEl = document.createElement('div');
  noteEl.className  = `note size-${noteData.size || 'm'} ${noteData.isFlipped ? 'is-flipped' : ''}`;
  noteEl.dataset.id = noteData.id;

  const step = 224;
  noteEl.style.left            = `${(noteData.gridCol - 1) * step}px`;
  noteEl.style.top             = `${(noteData.gridRow - 1) * step}px`;
  noteEl.style.transform       = `rotate(${noteData.rotation || 0}deg)`;
  noteEl.style.backgroundColor = noteData.color;

  if (['#2c3e50', '#1a2639', '#5d7a61'].includes(noteData.color)) {
    noteEl.classList.add('dark-mode');
  }

  const pinSvg = noteData.pinned
    ? `<svg class="note-pin" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><path d="M12 2L12 10M12 22L12 14M16 6H8M18 14H6M9 22L15 22"/></svg>`
    : '';

  noteEl.innerHTML = `
    <div class="note-inner">
      <div class="note-front">
        <div class="note-tape"></div>
        ${pinSvg}
        ${noteData.label ? `<div class="note-tag">${noteData.label}</div>` : ''}
        <div class="note-content front-content" contenteditable="true" spellcheck="false">${noteData.content_front || ''}</div>
        <div class="note-date">${new Date(noteData.createdAt || Date.now()).toLocaleDateString('de-DE')}</div>
        <div class="note-resize-handle"><svg viewBox="0 0 10 10" width="10" height="10"><path d="M2 8 L8 2 M5 8 L8 5" stroke="rgba(0,0,0,0.25)" stroke-width="1.2" stroke-linecap="round"/></svg></div>
      </div>
      <div class="note-back">
        <div class="note-tape"></div>
        <div class="note-content back-content" contenteditable="true" spellcheck="false">${noteData.content_back || ''}</div>
      </div>
    </div>
  `;

  notesContainer.appendChild(noteEl);
  setupNoteInteractions(noteEl, noteData);
  setupResizeInteraction(noteEl, noteData);
}

// ─── Note Drag + Auto-Save (Mouse + Phase 4a: Touch) ────────────────────────────
function setupNoteInteractions(noteEl, noteData) {
  // ─ Auto-Save Inhalt ────────────────────────────────────────────────────
  let saveTimeout;
  const saveContent = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      updateNote(noteData.id, {
        content_front: noteEl.querySelector('.front-content').innerText,
        content_back:  noteEl.querySelector('.back-content').innerText
      });
    }, 800);
  };
  noteEl.querySelector('.front-content').addEventListener('input', saveContent);
  noteEl.querySelector('.back-content') .addEventListener('input', saveContent);

  // ─ Gemeinsame Drag-Logik (für Mouse + Touch) ──────────────────────────
  let isDragging  = false;
  let startX, startY, initialLeft, initialTop;
  // Phase 4a: Long-Press für Context Menu
  let longPressTimer = null;
  
  // RequestAnimationFrame ID für Cleanup
  let rafId = null;
  
  // Event-Listener Referenzen für Cleanup
  let mouseMoveHandler = null;
  let mouseUpHandler = null;
  let touchMoveHandler = null;
  let touchEndHandler = null;

  function dragStart(clientX, clientY) {
    isDragging = true;
    noteEl.classList.add('dragging');
    canvas.classList.add('grid-active');
    noteEl.style.zIndex     = 100;
    startX      = clientX;
    startY      = clientY;
    initialLeft = parseFloat(noteEl.style.left) || 0;
    initialTop  = parseFloat(noteEl.style.top)  || 0;
    noteEl.style.transition = 'none';
    setFocus(noteData, noteEl);
    
    // Listener registrieren mit Referenz für späteres Cleanup
    mouseMoveHandler = (e) => {
      e.preventDefault();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => dragMove(e.clientX, e.clientY));
    };
    mouseUpHandler = () => {
      dragEnd();
      cleanupDragListeners();
    };
    window.addEventListener('mousemove', mouseMoveHandler, { passive: false });
    window.addEventListener('mouseup', mouseUpHandler, { passive: false });
  }
  
  function cleanupDragListeners() {
    if (mouseMoveHandler) window.removeEventListener('mousemove', mouseMoveHandler);
    if (mouseUpHandler) window.removeEventListener('mouseup', mouseUpHandler);
    if (rafId) cancelAnimationFrame(rafId);
    mouseMoveHandler = null;
    mouseUpHandler = null;
    rafId = null;
  }

  // Throttle für Connection-Updates (alle 16ms ≈ 60fps)
  let lastConnUpdate = 0;
  function dragMove(clientX, clientY) {
    if (!isDragging) return;
    // Zoom-Korrektur: Bewegung direkt anwenden, dann durch Zoom teilen für korrekte Skalierung
    const deltaX = (clientX - startX);
    const deltaY = (clientY - startY);
    noteEl.style.left = `${initialLeft + (deltaX / currentZoom)}px`;
    noteEl.style.top  = `${initialTop  + (deltaY / currentZoom)}px`;
    
    // Connection-Updates throttlen für bessere Performance
    const now = performance.now();
    if (now - lastConnUpdate > 16) {
      connManager.updateLines();
      lastConnUpdate = now;
    }
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    noteEl.classList.remove('dragging');
    canvas.classList.remove('grid-active');
    noteEl.style.transition = 'transform 400ms var(--ease-in-out), left 180ms var(--spring), top 180ms var(--spring)';
    
    // Grid-Snapping: Korrekte Berechnung basierend auf der aktuellen Position
    const step   = 224;
    const currentLeft = parseFloat(noteEl.style.left) || 0;
    const currentTop  = parseFloat(noteEl.style.top)  || 0;
    const newCol = Math.max(1, Math.round(currentLeft / step) + 1);
    const newRow = Math.max(1, Math.round(currentTop  / step) + 1);
    
    noteEl.style.left      = `${(newCol - 1) * step}px`;
    noteEl.style.top       = `${(newRow - 1) * step}px`;
    noteEl.style.zIndex    = '';
    noteEl.style.transform = `rotate(${noteData.rotation}deg)`;
    noteData.gridCol = newCol;
    noteData.gridRow = newRow;
    updateNote(noteData.id, { gridCol: newCol, gridRow: newRow });
    setTimeout(() => connManager.updateLines(), 180);
  }

  // ─ Mouse Events ─────────────────────────────────────────────────────────
  noteEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('[contenteditable]') ||
        e.target.closest('.note-resize-handle') ||
        e.button !== 0 || noteData.pinned) return;
    dragStart(e.clientX, e.clientY);
    e.preventDefault();
  });
  // Die Listener werden jetzt in dragStart() registriert und in cleanupDragListeners() entfernt

  noteEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, noteData, noteEl);
  });

  // ─ Phase 4a: Touch Events ───────────────────────────────────────────────
  noteEl.addEventListener('touchstart', (e) => {
    // Nur 1 Finger = Drag oder Long-Press; 2 Finger = Pinch (wird im Container behandelt)
    if (e.touches.length !== 1) return;
    if (e.target.closest('[contenteditable]') ||
        e.target.closest('.note-resize-handle') ||
        noteData.pinned) return;

    const touch = getCoords(e);
    setFocus(noteData, noteEl);

    // Long-Press-Timer: 500ms ohne Bewegung → Context Menu
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (!isDragging) {
        showContextMenu(touch.clientX, touch.clientY, noteData, noteEl);
      }
    }, 500);

    dragStart(touch.clientX, touch.clientY);
    e.preventDefault();
  }, { passive: false });

  noteEl.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    // Sobald Finger sich bewegt: Long-Press-Timer abbrechen
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    const touch = getCoords(e);
    dragMove(touch.clientX, touch.clientY);
    e.preventDefault();
  }, { passive: false });

  noteEl.addEventListener('touchend', (e) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    dragEnd();
    e.preventDefault();
  }, { passive: false });
}

// ─── Resize-Handle (Mouse + Phase 4a: Touch) ──────────────────────────────────
function setupResizeInteraction(noteEl, noteData) {
  const handle = noteEl.querySelector('.note-resize-handle');
  if (!handle) return;

  let isResizing = false;
  let startX, startY, startW, startH;
  
  // RequestAnimationFrame ID für Cleanup
  let resizeRafId = null;
  
  // Event-Listener Referenzen für Cleanup
  let resizeMouseMoveHandler = null;
  let resizeMouseUpHandler = null;

  function resizeStart(clientX, clientY) {
    isResizing = true;
    startX = clientX; startY = clientY;
    startW = noteEl.offsetWidth;
    startH = noteEl.offsetHeight;
    noteEl.style.transition = 'none';
    noteEl.style.zIndex     = 100;
    ['size-s','size-m','size-l','size-xl'].forEach(c => noteEl.classList.remove(c));
    
    // Listener registrieren mit Referenz für späteres Cleanup
    resizeMouseMoveHandler = (e) => {
      e.preventDefault();
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => resizeMove(e.clientX, e.clientY));
    };
    resizeMouseUpHandler = () => {
      resizeEnd();
      cleanupResizeListeners();
    };
    window.addEventListener('mousemove', resizeMouseMoveHandler, { passive: false });
    window.addEventListener('mouseup', resizeMouseUpHandler, { passive: false });
  }
  
  function cleanupResizeListeners() {
    if (resizeMouseMoveHandler) window.removeEventListener('mousemove', resizeMouseMoveHandler);
    if (resizeMouseUpHandler) window.removeEventListener('mouseup', resizeMouseUpHandler);
    if (resizeRafId) cancelAnimationFrame(resizeRafId);
    resizeMouseMoveHandler = null;
    resizeMouseUpHandler = null;
    resizeRafId = null;
  }

  // Throttle für Connection-Updates (alle 16ms ≈ 60fps)
  let resizeLastConnUpdate = 0;
  function resizeMove(clientX, clientY) {
    if (!isResizing) return;
    const dx   = (clientX - startX) / currentZoom;
    const dy   = (clientY - startY) / currentZoom;
    noteEl.style.width  = `${Math.max(120, startW + dx)}px`;
    noteEl.style.height = `${Math.max(120, startH + dy)}px`;
    
    // Connection-Updates throttlen für bessere Performance
    const now = performance.now();
    if (now - resizeLastConnUpdate > 16) {
      connManager.updateLines();
      resizeLastConnUpdate = now;
    }
  }

  function resizeEnd() {
    if (!isResizing) return;
    isResizing = false;
    noteEl.style.zIndex     = '';
    noteEl.style.transition = 'transform 400ms var(--ease-in-out)';
    const snapped = snapToSize(noteEl.offsetWidth);
    noteEl.style.width  = '';
    noteEl.style.height = '';
    noteEl.classList.add(`size-${snapped}`);
    noteData.size = snapped;
    updateNote(noteData.id, { size: snapped });
    showToast(`Größe: ${snapped.toUpperCase()}`, 'info');
    setTimeout(() => connManager.updateLines(), 50);
  }

  // Mouse
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    resizeStart(e.clientX, e.clientY);
    e.preventDefault();
    e.stopPropagation();
  });
  // Die Listener werden jetzt in resizeStart() registriert und in cleanupResizeListeners() entfernt

  // Phase 4a: Touch
  handle.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = getCoords(e);
    resizeStart(t.clientX, t.clientY);
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });

  handle.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const t = getCoords(e);
    resizeMove(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });

  handle.addEventListener('touchend', (e) => {
    resizeEnd();
    e.preventDefault();
  }, { passive: false });
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
let activeContextNote = null, activeContextElement = null;

function setupContextMenu() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) contextMenu.classList.add('hidden');
  });
  // Phase 4a: Context Menu auch bei Touch-Tap außerhalb schließen
  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('#context-menu') && !contextMenu.classList.contains('hidden')) {
      contextMenu.classList.add('hidden');
    }
  }, { passive: true });

  contextMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (btn && activeContextNote) {
      handleContextAction(btn.dataset.action, btn.dataset.color);
      contextMenu.classList.add('hidden');
    }
  });
}

function showContextMenu(x, y, noteData, noteEl) {
  activeContextNote    = noteData;
  activeContextElement = noteEl;

  // Sicherstellen dass das Menu nicht außerhalb des Viewports landet
  const menuW = 200, menuH = 320;
  const safeX = Math.min(x, window.innerWidth  - menuW - 8);
  const safeY = Math.min(y, window.innerHeight - menuH - 8);

  contextMenu.style.left = `${safeX}px`;
  contextMenu.style.top  = `${safeY}px`;
  contextMenu.classList.remove('hidden');

  contextMenu.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === noteData.color);
  });
  const pinBtn = contextMenu.querySelector('[data-action="pin"]');
  if (pinBtn) pinBtn.innerHTML = noteData.pinned ? '📌 Lösen' : '📌 Anheften';
}

function handleContextAction(action, colorValue) {
  const data = activeContextNote, el = activeContextElement;
  switch (action) {
    case 'flip':
      data.isFlipped = !data.isFlipped;
      el.classList.toggle('is-flipped');
      updateNote(data.id, { isFlipped: data.isFlipped });
      break;

    case 'delete':
      el.classList.add('deleting');
      setTimeout(async () => {
        el.remove();
        await deleteNote(data.id);
        if (focusedNote?.id === data.id) clearFocus();
        showToast('Notiz gelöscht');
        connManager.updateLines();
      }, 180);
      break;

    case 'duplicate': {
      const copy = {
        ...data,
        content_back: data.content_back || '',
        gridCol:  data.gridCol + 1,
        rotation: (Math.random() * 5) - 2.5
      };
      delete copy.id;
      handleCreateNote(copy);
      break;
    }

    case 'pin': {
      data.pinned = !data.pinned;
      updateNote(data.id, { pinned: data.pinned });
      const front = el.querySelector('.note-front');
      const existingPin = front.querySelector('.note-pin');
      if (data.pinned && !existingPin) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class',        'note-pin');
        svg.setAttribute('viewBox',      '0 0 24 24');
        svg.setAttribute('fill',         'none');
        svg.setAttribute('stroke',       '#e74c3c');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = '<path d="M12 2L12 10M12 22L12 14M16 6H8M18 14H6M9 22L15 22"/>';
        front.appendChild(svg);
      } else if (!data.pinned && existingPin) {
        existingPin.remove();
      }
      showToast(data.pinned ? 'Notiz angeheftet 📌' : 'Notiz gelöst', 'success');
      break;
    }

    case 'color': {
      if (!colorValue) break;
      data.color = colorValue;
      el.style.backgroundColor = colorValue;
      el.classList.toggle('dark-mode', ['#2c3e50','#1a2639','#5d7a61'].includes(colorValue));
      updateNote(data.id, { color: colorValue });
      showToast('Farbe geändert 🎨', 'success');
      break;
    }
  }
}

// ─── Phase 4b: Keyboard Shortcuts ────────────────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Niemals Shortcuts feuern wenn Nutzer gerade in contenteditable tippt
    const inEditor = !!document.activeElement?.closest('[contenteditable]');

    // Esc: immer – Context Menu schließen + Fokus aufheben
    if (e.key === 'Escape') {
      contextMenu.classList.add('hidden');
      clearFocus();
      return;
    }

    if (inEditor) return; // alle weiteren Shortcuts nur außerhalb von Editoren

    switch (e.key) {

      // N – Neue Notiz
      case 'n':
      case 'N':
        e.preventDefault();
        handleCreateNote({
          content_front: 'Neue Notiz',
          color:    '#f9e060',
          size:     'm',
          gridCol:  Math.floor(Math.random() * 3) + 1,
          gridRow:  Math.floor(Math.random() * 3) + 1,
          rotation: (Math.random() * 5) - 2.5
        });
        break;

      // Delete / Backspace – Fokussierte Note löschen
      case 'Delete':
      case 'Backspace':
        if (focusedNote && focusedElement) {
          e.preventDefault();
          activeContextNote    = focusedNote;
          activeContextElement = focusedElement;
          handleContextAction('delete');
        }
        break;

      // F – Fokussierte Note umdrehen
      case 'f':
      case 'F':
        if (focusedNote && focusedElement) {
          e.preventDefault();
          activeContextNote    = focusedNote;
          activeContextElement = focusedElement;
          handleContextAction('flip');
        }
        break;

      // + / = – Zoom In
      case '+':
      case '=':
        e.preventDefault();
        setZoom(currentZoom + 0.1);
        break;

      // - – Zoom Out
      case '-':
        e.preventDefault();
        setZoom(currentZoom - 0.1);
        break;

      // 0 – Zoom zurücksetzen
      case '0':
        e.preventDefault();
        setZoom(1);
        showToast('Zoom zurückgesetzt', 'info');
        break;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
