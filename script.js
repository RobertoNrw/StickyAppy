// script.js
import { fetchNotes, createNote, updateNote, deleteNote, showToast, startSync } from './api.js';
import { ConnectionsManager } from './connections.js';

let notes = [];
let currentZoom = 1;

const canvas = document.getElementById('paper-canvas');
const container = document.getElementById('canvas-container');
const notesContainer = document.getElementById('notes-container');
const contextMenu = document.getElementById('context-menu');
const connectionsSvg = document.getElementById('connections-svg');

const connManager = new ConnectionsManager(connectionsSvg, (id) => document.querySelector(`.note[data-id="${id}"]`));

async function init() {
  generateInkOverlays();
  setupToolbar();
  setupCanvasInteraction();
  setupContextMenu();
  
  showToast('Synchronisiere Notes...', 'sync');
  notes = await fetchNotes();
  
  if (notes.length === 0) {
    await handleCreateNote({
      content_front: "Willkommen beim Leonardo Board!\nEin Canvas für kreative Gedanken.",
      content_back: "Die Rückseite für mehr Details.",
      color: "#f9e9c8",
      size: "medium",
      gridCol: 2,
      gridRow: 2,
      rotation: (Math.random() * 5) - 2.5,
      isFlipped: false
    });
  } else {
    notes.forEach(renderNote);
  }
  
  startSync((updatedNotes) => { /* Sync Handler */ });
}

function generateInkOverlays() {
  const layer2 = document.querySelector('.layer2.ink-splatters');
  const layer3 = document.querySelector('.layer3.ink-scratches');
  
  for(let i=0; i<45; i++) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', `${Math.random() * 100}%`);
    circle.setAttribute('cy', `${Math.random() * 100}%`);
    circle.setAttribute('r', (Math.random() * 1.5 + 0.5).toString());
    circle.setAttribute('fill', '#5a3c1e');
    circle.setAttribute('opacity', (Math.random() * 0.05 + 0.04).toString());
    layer2.appendChild(circle);
  }
  
  for(let i=0; i<3; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const startX = Math.random() * 100;
    const startY = Math.random() * 100;
    path.setAttribute('d', `M ${startX}% ${startY}% Q ${startX+10}% ${startY+5}% ${startX+30}% ${startY+10}%`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#5a3c1e');
    path.setAttribute('stroke-width', '0.5');
    path.setAttribute('opacity', '0.03');
    layer3.appendChild(path);
  }
}

function setupToolbar() {
  document.getElementById('btn-new-note').addEventListener('click', () => {
    handleCreateNote({
      content_front: "Neue Notiz",
      color: "#f9e060",
      size: "medium",
      gridCol: Math.floor(Math.random() * 3) + 1,
      gridRow: Math.floor(Math.random() * 3) + 1,
      rotation: (Math.random() * 5) - 2.5
    });
  });
  
  document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(currentZoom + 0.1));
  document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(currentZoom - 0.1));
}

function setZoom(level) {
  currentZoom = Math.max(0.6, Math.min(level, 1.5));
  document.getElementById('zoom-level').textContent = `${Math.round(currentZoom * 100)}%`;
  canvas.style.transform = `scale(${currentZoom}) rotate(-0.3deg)`;
  connManager.updateLines();
}

function setupCanvasInteraction() {
  canvas.addEventListener('mouseenter', () => canvas.classList.add('grid-active'));
  canvas.addEventListener('mouseleave', () => {
    if(!document.querySelector('.note.dragging')) canvas.classList.remove('grid-active');
  });

  container.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(currentZoom + (e.deltaY > 0 ? -0.05 : 0.05));
    }
  }, { passive: false });
}

async function handleCreateNote(data) {
  try {
    const note = await createNote(data);
    notes.push(note);
    renderNote(note);
    showToast('Note erstellt', 'success');
  } catch (error) {
    showToast('Fehler beim Erstellen', 'error');
  }
}

function renderNote(noteData) {
  const noteEl = document.createElement('div');
  noteEl.className = `note size-${noteData.size || 'm'} ${noteData.isFlipped ? 'is-flipped' : ''}`;
  noteEl.dataset.id = noteData.id;
  
  const cellSize = 200, gap = 24;
  noteEl.style.left = `${(noteData.gridCol - 1) * (cellSize + gap)}px`;
  noteEl.style.top = `${(noteData.gridRow - 1) * (cellSize + gap)}px`;
  noteEl.style.transform = `rotate(${noteData.rotation || 0}deg)`;
  noteEl.style.backgroundColor = noteData.color;
  
  if(['#2c3e50', '#1a2639', '#5d7a61'].includes(noteData.color)) noteEl.classList.add('dark-mode');

  noteEl.innerHTML = `
    <div class="note-inner">
      <div class="note-front">
        <div class="note-tape"></div>
        ${noteData.pinned ? '<svg class="note-pin" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><path d="M12 2L12 10M12 22L12 14M16 6H8M18 14H6M9 22L15 22"/></svg>' : ''}
        ${noteData.label ? `<div class="note-tag">${noteData.label}</div>` : ''}
        <div class="note-content front-content" contenteditable="true" spellcheck="false">${noteData.content_front || ''}</div>
        <div class="note-date">${new Date(noteData.createdAt || Date.now()).toLocaleDateString()}</div>
        <div class="note-resize-handle"></div>
      </div>
      <div class="note-back">
        <div class="note-tape"></div>
        <div class="note-content back-content" contenteditable="true" spellcheck="false">${noteData.content_back || ''}</div>
      </div>
    </div>
  `;
  
  notesContainer.appendChild(noteEl);
  setupNoteInteractions(noteEl, noteData);
}

function setupNoteInteractions(noteEl, noteData) {
  let timeout;
  const saveContent = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      updateNote(noteData.id, {
        content_front: noteEl.querySelector('.front-content').innerText,
        content_back: noteEl.querySelector('.back-content').innerText
      });
    }, 800);
  };
  
  noteEl.querySelector('.front-content').addEventListener('input', saveContent);
  noteEl.querySelector('.back-content').addEventListener('input', saveContent);

  let isDragging = false, startX, startY, initialLeft, initialTop;

  noteEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('[contenteditable="true"]') || e.target.closest('.note-resize-handle') || e.button !== 0 || noteData.pinned) return;
    isDragging = true;
    noteEl.classList.add('dragging');
    canvas.classList.add('grid-active');
    noteEl.style.zIndex = 100;
    startX = e.clientX; startY = e.clientY;
    initialLeft = parseFloat(noteEl.style.left) || 0;
    initialTop = parseFloat(noteEl.style.top) || 0;
    noteEl.style.transition = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    noteEl.style.left = `${initialLeft + (e.clientX - startX) / currentZoom}px`;
    noteEl.style.top = `${initialTop + (e.clientY - startY) / currentZoom}px`;
    connManager.updateLines();
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    noteEl.classList.remove('dragging');
    canvas.classList.remove('grid-active');
    
    noteEl.style.transition = 'transform 400ms var(--ease-in-out), left 180ms var(--spring), top 180ms var(--spring)';
    
    const step = 224; // 200px cell + 24px gap
    let newCol = Math.max(1, Math.round(parseFloat(noteEl.style.left) / step) + 1);
    let newRow = Math.max(1, Math.round(parseFloat(noteEl.style.top) / step) + 1);
    
    noteEl.style.left = `${(newCol - 1) * step}px`;
    noteEl.style.top = `${(newRow - 1) * step}px`;
    noteEl.style.zIndex = '';
    noteEl.style.transform = `rotate(${noteData.rotation}deg)`;
    
    updateNote(noteData.id, { gridCol: newCol, gridRow: newRow });
    setTimeout(() => connManager.updateLines(), 180);
  });
  
  noteEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, noteData, noteEl);
  });
}

let activeContextNote = null, activeContextElement = null;

function setupContextMenu() {
  document.addEventListener('click', (e) => {
    if(!e.target.closest('#context-menu')) contextMenu.classList.add('hidden');
  });

  contextMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if(btn && activeContextNote) {
      handleContextAction(btn.dataset.action);
      contextMenu.classList.add('hidden');
    }
  });
}

function showContextMenu(x, y, noteData, noteEl) {
  activeContextNote = noteData;
  activeContextElement = noteEl;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove('hidden');
  
  const pinBtn = contextMenu.querySelector('[data-action="pin"]');
  if(pinBtn) pinBtn.innerHTML = noteData.pinned ? '📌 Lösen' : '📌 Anheften';
}

function handleContextAction(action) {
  const data = activeContextNote, el = activeContextElement;
  switch(action) {
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
        showToast('Notiz gelöscht');
        connManager.updateLines(); 
      }, 180);
      break;
    case 'duplicate':
      const copy = { ...data, gridCol: data.gridCol + 1, rotation: (Math.random() * 5) - 2.5 };
      delete copy.id;
      handleCreateNote(copy);
      break;
    case 'pin':
      data.pinned = !data.pinned;
      updateNote(data.id, { pinned: data.pinned });
      break;
  }
}

document.addEventListener('DOMContentLoaded', init);
