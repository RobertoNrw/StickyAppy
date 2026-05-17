/**
 * Leonardo Board - Main Application Script
 * Version 4.0 - Complete Rewrite with Best Practices
 */

(function() {
    'use strict';
    
    // ==================== CONSTANTS ====================
    const CONFIG = {
        NOTE_WIDTH: 220,
        NOTE_HEIGHT: 220,
        MIN_ZOOM: 0.1,
        MAX_ZOOM: 3,
        ZOOM_STEP: 0.1,
        GRID_CELL_SIZE: 200,
        SNAP_THRESHOLD: 30,
        DRAG_THRESHOLD: 5,
        LONG_PRESS_DELAY: 500,
        AUTO_SAVE_DELAY: 5000,
        // Warme, natürliche Papierfarben im Da Vinci-Stil
        COLORS: [
            '#fef9e7',  // Warmes Cremegelb
            '#f5f0e6',  // Naturweiß
            '#e8f4f8',  // Helles Himmelblau
            '#f0f7ee',  // Sanftes Salbeigrün
            '#fdf2f5',  // Zartes Rosenpapier
            '#f5f3ff',  // Lavendel
            '#fffef5',  // Elfenbein
            '#f9f5f0'   // Altweiß
        ]
    };
    
    // ==================== STATE ====================
    let state = {
        notes: [],
        connections: [],
        zoom: 1,
        gridEnabled: true,
        panX: 0,
        panY: 0,
        selectedNoteId: null,
        connectionMode: false,
        connectionSourceId: null
    };
    
    // DOM Elements Cache
    let elements = {};
    
    // Managers
    let connManager = null;
    
    // Drag/Resize State
    let dragState = {
        isDragging: false,
        isResizing: false,
        isPanning: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        startWidth: 0,
        startHeight: 0,
        currentNoteId: null,
        resizeHandle: null,
        rafId: null
    };
    
    // Undo/Redo Stacks
    let undoStack = [];
    let redoStack = [];
    const MAX_HISTORY = 50;
    
    // ==================== INITIALIZATION ====================
    function init() {
        console.log('[App] Initializing Leonardo Board v4.0');
        
        cacheElements();
        initializeManagers();
        bindEvents();
        loadFromStorage();
        render();
        updateUndoRedoButtons();
        
        // Toast Event Listener
        window.addEventListener('toast', (e) => {
            showToast(e.detail.message, e.detail.type);
        });
        
        console.log('[App] Initialization complete');
    }
    
    function cacheElements() {
        elements = {
            canvasContainer: document.getElementById('canvas-container'),
            paperCanvas: document.getElementById('paper-canvas'),
            notesContainer: document.getElementById('notes-container'),
            gridOverlay: document.getElementById('grid-overlay'),
            connectionsLayer: document.getElementById('connections-layer'),
            contextMenu: document.getElementById('context-menu'),
            connectionModeIndicator: document.getElementById('connection-mode-indicator'),
            toastContainer: document.getElementById('toast-container'),
            zoomIndicator: document.getElementById('zoom-indicator'),
            btnAddNote: document.getElementById('btn-add-note'),
            btnGridToggle: document.getElementById('btn-grid-toggle'),
            btnZoomIn: document.getElementById('btn-zoom-in'),
            btnZoomOut: document.getElementById('btn-zoom-out'),
            btnZoomReset: document.getElementById('btn-zoom-reset'),
            btnUndo: document.getElementById('btn-undo'),
            btnRedo: document.getElementById('btn-redo'),
            btnSave: document.getElementById('btn-save'),
            btnCancelConnect: document.getElementById('btn-cancel-connect'),
            fileImport: document.getElementById('file-import')
        };
    }
    
    function initializeManagers() {
        if (window.stateManager && window.ConnectionsManager) {
            connManager = new window.ConnectionsManager(
                elements.connectionsLayer,
                window.stateManager
            );
            connManager.init();
            
            // Subscribe to state changes
            window.stateManager.onChange((newState, silent) => {
                if (!silent) {
                    syncLocalState(newState);
                    render();
                }
            });
            
            window.stateManager.onUndoRedoState((canUndo, canRedo) => {
                updateUndoRedoButtons();
            });
        }
    }
    
    function syncLocalState(newState) {
        state.notes = newState.notes || [];
        state.connections = newState.connections || [];
        state.zoom = newState.zoom || 1;
        state.gridEnabled = newState.gridEnabled !== false;
        state.panX = newState.panX || 0;
        state.panY = newState.panY || 0;
    }
    
    // ==================== EVENT BINDING ====================
    function bindEvents() {
        // Toolbar Buttons
        elements.btnAddNote?.addEventListener('click', () => createNote());
        elements.btnGridToggle?.addEventListener('click', toggleGrid);
        elements.btnZoomIn?.addEventListener('click', () => zoomIn());
        elements.btnZoomOut?.addEventListener('click', () => zoomOut());
        elements.btnZoomReset?.addEventListener('click', resetZoom);
        elements.btnUndo?.addEventListener('click', undo);
        elements.btnRedo?.addEventListener('click', redo);
        elements.btnSave?.addEventListener('click', saveToStorage);
        elements.btnCancelConnect?.addEventListener('click', cancelConnectionMode);
        
        // File Import
        elements.fileImport?.addEventListener('change', handleFileImport);
        
        // Canvas Events
        elements.paperCanvas?.addEventListener('mousedown', handleCanvasMouseDown);
        elements.paperCanvas?.addEventListener('wheel', handleWheel, { passive: false });
        elements.paperCanvas?.addEventListener('contextmenu', handleContextMenu);
        
        // Touch Events für Mobile
        elements.paperCanvas?.addEventListener('touchstart', handleTouchStart, { passive: false });
        elements.paperCanvas?.addEventListener('touchmove', handleTouchMove, { passive: false });
        elements.paperCanvas?.addEventListener('touchend', handleTouchEnd);
        
        // Global Events
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('click', handleGlobalClick);
        
        // Context Menu
        elements.contextMenu?.addEventListener('click', handleContextMenuAction);
        
        // Window Resize
        window.addEventListener('resize', debounce(handleWindowResize, 250));
    }
    
    // ==================== NOTE OPERATIONS ====================
    function createNote(options = {}) {
        const id = generateId();
        const note = {
            id,
            content: options.content || '',
            left: options.left ?? (Math.random() * 400 + 100),
            top: options.top ?? (Math.random() * 400 + 100),
            width: CONFIG.NOTE_WIDTH,
            height: CONFIG.NOTE_HEIGHT,
            color: options.color || CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)],
            rotation: 0,
            zIndex: getNextZIndex(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        if (window.stateManager) {
            window.stateManager.addNote(note);
        } else {
            state.notes.push(note);
            render();
            saveToStorageDebounced();
        }
        
        return note;
    }
    
    function updateNote(id, updates) {
        if (window.stateManager) {
            window.stateManager.updateNote(id, updates);
        } else {
            const note = state.notes.find(n => n.id === id);
            if (note) {
                Object.assign(note, updates, { updatedAt: Date.now() });
                render();
                saveToStorageDebounced();
            }
        }
    }
    
    function deleteNote(id) {
        if (window.stateManager) {
            window.stateManager.deleteNote(id);
        } else {
            state.notes = state.notes.filter(n => n.id !== id);
            state.connections = state.connections.filter(c => c.from !== id && c.to !== id);
            render();
            saveToStorageDebounced();
        }
    }
    
    function duplicateNote(id) {
        const note = state.notes.find(n => n.id === id);
        if (!note) return;
        
        const newNote = {
            ...note,
            id: generateId(),
            left: note.left + 30,
            top: note.top + 30,
            zIndex: getNextZIndex(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        if (window.stateManager) {
            window.stateManager.addNote(newNote);
        } else {
            state.notes.push(newNote);
            render();
            saveToStorageDebounced();
        }
    }
    
    function getNextZIndex() {
        const maxZ = state.notes.reduce((max, note) => Math.max(max, note.zIndex || 0), 0);
        return maxZ + 1;
    }
    
    // ==================== RENDERING ====================
    function render() {
        renderNotes();
        updateConnections();
        updateZoomIndicator();
        applyPanTransform();
    }
    
    function renderNotes() {
        const notes = state.notes || [];
        const container = elements.notesContainer;
        
        if (!container) return;
        
        // Create document fragment for batch DOM operations
        const fragment = document.createDocumentFragment();
        const existingNotes = new Set();
        
        // Update or create notes
        notes.forEach(note => {
            let noteEl = container.querySelector(`[data-note-id="${note.id}"]`);
            
            if (noteEl) {
                // Update existing
                updateNoteElement(noteEl, note);
                existingNotes.add(note.id);
            } else {
                // Create new
                noteEl = createNoteElement(note);
                fragment.appendChild(noteEl);
            }
        });
        
        // Remove deleted notes
        Array.from(container.children).forEach(el => {
            const id = el.getAttribute('data-note-id');
            if (id && !existingNotes.has(id)) {
                el.remove();
            }
        });
        
        // Add new notes
        if (fragment.children.length > 0) {
            container.appendChild(fragment);
        }
    }
    
    function createNoteElement(note) {
        const el = document.createElement('div');
        el.className = 'note';
        el.setAttribute('data-note-id', note.id);
        el.style.cssText = `
            left: ${note.left}px;
            top: ${note.top}px;
            width: ${note.width}px;
            height: ${note.height}px;
            background-color: ${note.color};
            z-index: ${note.zIndex || 1};
            --rotation: ${note.rotation || 0};
        `;

        // Leichte zufällige Rotation für natürlichen Look (-2 bis +2 Grad)
        if ((note.rotation === 0 || note.rotation === undefined) && !note.content) {
            const randomRotation = (Math.random() - 0.5) * 4;
            note.rotation = randomRotation;
            el.style.setProperty('--rotation', randomRotation);
        }
        
        el.innerHTML = `
            <div class="note-resize-handle" title="Größe ändern"></div>
            <textarea class="note-content" placeholder="Schreibe etwas..." spellcheck="false">${escapeHtml(note.content || '')}</textarea>
        `;
        
        // Event Listeners
        const textarea = el.querySelector('.note-content');
        textarea.addEventListener('input', debounce((e) => {
            updateNote(note.id, { content: e.target.value });
        }, 300));
        
        textarea.addEventListener('focus', () => selectNote(note.id));
        
        const resizeHandle = el.querySelector('.note-resize-handle');
        resizeHandle.addEventListener('mousedown', (e) => startResize(e, note.id));
        
        // Drag Start
        el.addEventListener('mousedown', (e) => {
            if (e.target !== resizeHandle && e.target !== textarea) {
                startDrag(e, note.id);
            }
        });
        
        // Context Menu
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, note.id);
        });
        
        return el;
    }
    
    function updateNoteElement(el, note) {
        const textarea = el.querySelector('.note-content');
        if (textarea && document.activeElement !== textarea) {
            textarea.value = note.content || '';
        }
        
        // Only update if changed to avoid reflows
        if (el.style.left !== `${note.left}px`) el.style.left = `${note.left}px`;
        if (el.style.top !== `${note.top}px`) el.style.top = `${note.top}px`;
        if (el.style.width !== `${note.width}px`) el.style.width = `${note.width}px`;
        if (el.style.height !== `${note.height}px`) el.style.height = `${note.height}px`;
        if (el.style.backgroundColor !== note.color) el.style.backgroundColor = note.color;
        if (el.style.zIndex !== String(note.zIndex || 1)) el.style.zIndex = note.zIndex || 1;
        
        // Selection state
        el.classList.toggle('selected', state.selectedNoteId === note.id);
    }
    
    function updateConnections() {
        if (connManager) {
            connManager.queueUpdate();
        }
    }
    
    // ==================== DRAG & RESIZE ====================
    function startDrag(e, noteId) {
        if (e.button !== 0) return; // Nur linke Maustaste
        
        const note = state.notes.find(n => n.id === noteId);
        if (!note) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Bring to front
        updateNote(noteId, { zIndex: getNextZIndex() });
        
        dragState = {
            isDragging: true,
            isResizing: false,
            isPanning: false,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: note.left,
            startTop: note.top,
            currentNoteId: noteId,
            rafId: null
        };
        
        // Add dragging class
        const noteEl = elements.notesContainer?.querySelector(`[data-note-id="${noteId}"]`);
        if (noteEl) {
            noteEl.classList.add('dragging');
        }
        
        // Show snap indicator if grid enabled
        if (state.gridEnabled) {
            noteEl?.classList.add('snap-preview');
        }
    }
    
    function startResize(e, noteId) {
        if (e.button !== 0) return;
        
        const note = state.notes.find(n => n.id === noteId);
        if (!note) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        dragState = {
            isDragging: false,
            isResizing: true,
            isPanning: false,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: note.width,
            startHeight: note.height,
            currentNoteId: noteId,
            rafId: null
        };
        
        const noteEl = elements.notesContainer?.querySelector(`[data-note-id="${noteId}"]`);
        if (noteEl) {
            noteEl.classList.add('resizing');
        }
    }
    
    function handleMouseMove(e) {
        if (!dragState.isDragging && !dragState.isResizing && !dragState.isPanning) return;
        
        if (dragState.isDragging) {
            handleDragMove(e);
        } else if (dragState.isResizing) {
            handleResizeMove(e);
        } else if (dragState.isPanning) {
            handlePanMove(e);
        }
    }
    
    function handleDragMove(e) {
        if (!dragState.rafId) {
            dragState.rafId = requestAnimationFrame(() => {
                const dx = (e.clientX - dragState.startX) / state.zoom;
                const dy = (e.clientY - dragState.startY) / state.zoom;
                
                let newLeft = dragState.startLeft + dx;
                let newTop = dragState.startTop + dy;
                
                // Snap to grid if enabled
                if (state.gridEnabled) {
                    const snapped = snapToGrid(newLeft, newTop);
                    newLeft = snapped.x;
                    newTop = snapped.y;
                }
                
                const note = state.notes.find(n => n.id === dragState.currentNoteId);
                if (note) {
                    note.left = newLeft;
                    note.top = newTop;
                    
                    const noteEl = elements.notesContainer?.querySelector(`[data-note-id="${note.id}"]`);
                    if (noteEl) {
                        noteEl.style.left = `${newLeft}px`;
                        noteEl.style.top = `${newTop}px`;
                    }
                    
                    // Update connections in real-time
                    if (connManager) {
                        connManager.updateConnectionsForNote(note.id);
                    }
                }
                
                dragState.rafId = null;
            });
        }
    }
    
    function handleResizeMove(e) {
        if (!dragState.rafId) {
            dragState.rafId = requestAnimationFrame(() => {
                const dx = (e.clientX - dragState.startX) / state.zoom;
                const dy = (e.clientY - dragState.startY) / state.zoom;
                
                const newWidth = Math.max(100, dragState.startWidth + dx);
                const newHeight = Math.max(100, dragState.startHeight + dy);
                
                const note = state.notes.find(n => n.id === dragState.currentNoteId);
                if (note) {
                    note.width = newWidth;
                    note.height = newHeight;
                    
                    const noteEl = elements.notesContainer?.querySelector(`[data-note-id="${note.id}"]`);
                    if (noteEl) {
                        noteEl.style.width = `${newWidth}px`;
                        noteEl.style.height = `${newHeight}px`;
                    }
                }
                
                dragState.rafId = null;
            });
        }
    }
    
    function handleMouseUp(e) {
        if (dragState.isDragging || dragState.isResizing) {
            // Commit changes to state manager
            if (dragState.currentNoteId) {
                const note = state.notes.find(n => n.id === dragState.currentNoteId);
                if (note && window.stateManager) {
                    // State already updated during drag, just notify
                    window.stateManager.notifyChange();
                }
            }
        }
        
        // Cleanup
        if (dragState.rafId) {
            cancelAnimationFrame(dragState.rafId);
            dragState.rafId = null;
        }
        
        const noteEl = elements.notesContainer?.querySelector('.dragging, .resizing');
        if (noteEl) {
            noteEl.classList.remove('dragging', 'resizing', 'snap-preview');
        }
        
        dragState = {
            isDragging: false,
            isResizing: false,
            isPanning: false,
            startX: 0,
            startY: 0,
            startLeft: 0,
            startTop: 0,
            currentNoteId: null,
            rafId: null
        };
    }
    
    // ==================== PANNING ====================
    function handleCanvasMouseDown(e) {
        if (e.target !== elements.paperCanvas && e.target !== elements.gridOverlay) {
            return;
        }
        
        // Middle click or Shift+Click for panning
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            e.preventDefault();
            startPan(e);
        } else if (e.button === 0) {
            // Deselect on canvas click
            deselectAll();
        }
    }
    
    function startPan(e) {
        dragState = {
            isPanning: true,
            startX: e.clientX,
            startY: e.clientY,
            startPanX: state.panX,
            startPanY: state.panY
        };
        
        elements.paperCanvas?.classList.add('panning');
        elements.panIndicator?.removeAttribute('hidden');
    }
    
    function handlePanMove(e) {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        
        state.panX = dragState.startPanX + dx;
        state.panY = dragState.startPanY + dy;
        
        applyPanTransform();
    }
    
    function applyPanTransform() {
        if (elements.paperCanvas) {
            elements.paperCanvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
            elements.paperCanvas.style.transformOrigin = '0 0';
        }
    }
    
    // ==================== ZOOM ====================
    function zoomIn() {
        setZoom(Math.min(CONFIG.MAX_ZOOM, state.zoom + CONFIG.ZOOM_STEP));
    }
    
    function zoomOut() {
        setZoom(Math.max(CONFIG.MIN_ZOOM, state.zoom - CONFIG.ZOOM_STEP));
    }
    
    function resetZoom() {
        setZoom(1);
    }
    
    function setZoom(newZoom) {
        const oldZoom = state.zoom;
        state.zoom = newZoom;
        
        if (window.stateManager) {
            window.stateManager.setZoom(newZoom);
        }
        
        applyPanTransform();
        updateZoomIndicator();
        updateGridScale();
    }
    
    function handleWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const delta = e.deltaY > 0 ? -CONFIG.ZOOM_STEP : CONFIG.ZOOM_STEP;
            setZoom(Math.min(CONFIG.MAX_ZOOM, Math.max(CONFIG.MIN_ZOOM, state.zoom + delta)));
        } else {
            // Pan
            state.panX -= e.deltaX;
            state.panY -= e.deltaY;
            applyPanTransform();
        }
    }
    
    function updateZoomIndicator() {
        if (elements.zoomIndicator) {
            elements.zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
        }
    }
    
    function updateGridScale() {
        if (elements.gridOverlay) {
            const cellSize = CONFIG.GRID_CELL_SIZE * state.zoom;
            elements.gridOverlay.style.setProperty('--grid-cell', `${cellSize}px`);
        }
    }
    
    // ==================== GRID ====================
    function toggleGrid() {
        state.gridEnabled = !state.gridEnabled;
        
        if (window.stateManager) {
            window.stateManager.toggleGrid();
        }
        
        elements.gridOverlay?.classList.toggle('grid-active', state.gridEnabled);
    }
    
    function snapToGrid(x, y) {
        const cellSize = CONFIG.GRID_CELL_SIZE;
        const snappedX = Math.round(x / cellSize) * cellSize;
        const snappedY = Math.round(y / cellSize) * cellSize;
        return { x: snappedX, y: snappedY };
    }
    
    // ==================== CONNECTIONS ====================
    function startConnectionMode(noteId) {
        state.connectionMode = true;
        state.connectionSourceId = noteId;
        
        elements.connectionModeIndicator?.removeAttribute('hidden');
        hideContextMenu();
        
        const note = state.notes.find(n => n.id === noteId);
        if (note) {
            const noteEl = elements.notesContainer?.querySelector(`[data-note-id="${noteId}"]`);
            if (noteEl) {
                noteEl.classList.add('connection-source');
            }
        }
    }
    
    function cancelConnectionMode() {
        if (state.connectionSourceId) {
            const noteEl = elements.notesContainer?.querySelector(`[data-note-id="${state.connectionSourceId}"]`);
            if (noteEl) {
                noteEl.classList.remove('connection-source');
            }
        }
        
        state.connectionMode = false;
        state.connectionSourceId = null;
        elements.connectionModeIndicator?.setAttribute('hidden', '');
    }
    
    function createConnection(fromId, toId) {
        if (fromId === toId) {
            showToast('Kann keine Note mit sich selbst verbinden', 'warning');
            return;
        }
        
        const connection = {
            id: generateId(),
            from: fromId,
            to: toId,
            createdAt: Date.now()
        };
        
        if (window.stateManager) {
            window.stateManager.addConnection(connection);
        } else {
            state.connections.push(connection);
            render();
            saveToStorageDebounced();
        }
        
        cancelConnectionMode();
        showToast('Verbindung erstellt', 'success');
    }
    
    // ==================== CONTEXT MENU ====================
    function showContextMenu(x, y, noteId) {
        if (!elements.contextMenu) return;
        
        state.selectedNoteId = noteId;
        
        elements.contextMenu.style.left = `${x}px`;
        elements.contextMenu.style.top = `${y}px`;
        elements.contextMenu.removeAttribute('hidden');
        elements.contextMenu.setAttribute('aria-hidden', 'false');
    }
    
    function hideContextMenu() {
        if (elements.contextMenu) {
            elements.contextMenu.setAttribute('hidden', '');
            elements.contextMenu.setAttribute('aria-hidden', 'true');
        }
    }
    
    function handleContextMenu(e) {
        e.preventDefault();
        
        const noteEl = e.target.closest('.note');
        if (noteEl) {
            const noteId = noteEl.getAttribute('data-note-id');
            showContextMenu(e.clientX, e.clientY, noteId);
        }
    }
    
    function handleContextMenuAction(e) {
        const item = e.target.closest('.context-menu-item');
        if (!item || !state.selectedNoteId) return;
        
        const action = item.dataset.action;
        const noteId = state.selectedNoteId;
        
        switch (action) {
            case 'edit':
                const textarea = elements.notesContainer?.querySelector(`[data-note-id="${noteId}"] .note-content`);
                textarea?.focus();
                break;
            case 'duplicate':
                duplicateNote(noteId);
                break;
            case 'connect':
                startConnectionMode(noteId);
                break;
            case 'delete':
                deleteNote(noteId);
                break;
        }
        
        hideContextMenu();
    }
    
    // ==================== SELECTION ====================
    function selectNote(noteId) {
        state.selectedNoteId = noteId;
        renderNotes(); // Re-render to update selection state
    }
    
    function deselectAll() {
        state.selectedNoteId = null;
        renderNotes();
        if (connManager) {
            connManager.deselectAll();
        }
    }
    
    // ==================== UNDO/REDO ====================
    function undo() {
        if (window.stateManager) {
            window.stateManager.undo();
        }
    }
    
    function redo() {
        if (window.stateManager) {
            window.stateManager.redo();
        }
    }
    
    function updateUndoRedoButtons() {
        if (elements.btnUndo && elements.btnRedo) {
            const canUndo = window.stateManager?.getCanUndo() || false;
            const canRedo = window.stateManager?.getCanRedo() || false;
            
            elements.btnUndo.disabled = !canUndo;
            elements.btnRedo.disabled = !canRedo;
        }
    }
    
    // ==================== STORAGE ====================
    let saveTimeout = null;
    
    function saveToStorageDebounced() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveToStorage, CONFIG.AUTO_SAVE_DELAY);
    }
    
    function saveToStorage() {
        try {
            const data = {
                state: {
                    notes: state.notes,
                    connections: state.connections,
                    zoom: state.zoom,
                    gridEnabled: state.gridEnabled,
                    panX: state.panX,
                    panY: state.panY
                },
                timestamp: Date.now()
            };
            localStorage.setItem('leonardo-board-state', JSON.stringify(data));
            showToast('Gespeichert', 'success');
        } catch (error) {
            console.error('[Save] Error:', error);
            showToast('Speichern fehlgeschlagen', 'error');
        }
    }
    
    function loadFromStorage() {
        try {
            const data = localStorage.getItem('leonardo-board-state');
            if (data) {
                const parsed = JSON.parse(data);
                const loadedState = parsed.state || parsed;
                
                state.notes = loadedState.notes || [];
                state.connections = loadedState.connections || [];
                state.zoom = loadedState.zoom || 1;
                state.gridEnabled = loadedState.gridEnabled !== false;
                state.panX = loadedState.panX || 0;
                state.panY = loadedState.panY || 0;
                
                elements.gridOverlay?.classList.toggle('grid-active', state.gridEnabled);
                
                console.log('[Load] State loaded from storage');
            }
        } catch (error) {
            console.error('[Load] Error:', error);
        }
    }
    
    function handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                
                if (window.stateManager) {
                    window.stateManager.importFromJson(JSON.stringify(imported));
                } else {
                    state.notes = imported.notes || [];
                    state.connections = imported.connections || [];
                    render();
                    showToast('Import erfolgreich', 'success');
                }
            } catch (error) {
                showToast('Import fehlgeschlagen: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
        
        // Reset input
        e.target.value = '';
    }
    
    // ==================== KEYBOARD SHORTCUTS ====================
    function handleKeyDown(e) {
        // Ignore when typing in textarea
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
            return;
        }
        
        const key = e.key.toLowerCase();
        
        switch (key) {
            case 'n':
                e.preventDefault();
                createNote();
                break;
            case 'g':
                e.preventDefault();
                toggleGrid();
                break;
            case 'delete':
            case 'backspace':
                if (state.selectedNoteId) {
                    e.preventDefault();
                    deleteNote(state.selectedNoteId);
                }
                break;
            case 'escape':
                if (state.connectionMode) {
                    cancelConnectionMode();
                }
                hideContextMenu();
                deselectAll();
                break;
            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    undo();
                }
                break;
            case 'y':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    redo();
                }
                break;
            case 's':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    saveToStorage();
                }
                break;
            case '+':
            case '=':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    zoomIn();
                }
                break;
            case '-':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    zoomOut();
                }
                break;
            case '0':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    resetZoom();
                }
                break;
        }
    }
    
    function handleGlobalClick(e) {
        // Close context menu when clicking outside
        if (!e.target.closest('.context-menu')) {
            hideContextMenu();
        }
        
        // Handle connection target selection
        if (state.connectionMode && state.connectionSourceId) {
            const noteEl = e.target.closest('.note');
            if (noteEl) {
                const targetId = noteEl.getAttribute('data-note-id');
                if (targetId !== state.connectionSourceId) {
                    createConnection(state.connectionSourceId, targetId);
                }
            }
        }
    }
    
    // ==================== TOUCH EVENTS ====================
    let touchState = {
        lastTap: 0,
        startX: 0,
        startY: 0,
        startPanX: 0,
        startPanY: 0,
        isPinching: false,
        startDistance: 0,
        startZoom: 1
    };
    
    function handleTouchStart(e) {
        e.preventDefault();
        
        if (e.touches.length === 1) {
            // Single touch - could be tap, drag, or pan
            const touch = e.touches[0];
            touchState.startX = touch.clientX;
            touchState.startY = touch.clientY;
            touchState.startPanX = state.panX;
            touchState.startPanY = state.panY;
            
            // Check if touching a note
            const noteEl = touch.target.closest('.note');
            if (!noteEl) {
                // Touching canvas - prepare for pan
                dragState.isPanning = true;
            }
        } else if (e.touches.length === 2) {
            // Pinch zoom
            touchState.isPinching = true;
            touchState.startDistance = getTouchDistance(e.touches);
            touchState.startZoom = state.zoom;
        }
    }
    
    function handleTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1 && dragState.isPanning) {
            const touch = e.touches[0];
            const dx = touch.clientX - touchState.startX;
            const dy = touch.clientY - touchState.startY;
            
            state.panX = touchState.startPanX + dx;
            state.panY = touchState.startPanY + dy;
            applyPanTransform();
        } else if (e.touches.length === 2 && touchState.isPinching) {
            const distance = getTouchDistance(e.touches);
            const scale = distance / touchState.startDistance;
            const newZoom = Math.min(CONFIG.MAX_ZOOM, Math.max(CONFIG.MIN_ZOOM, touchState.startZoom * scale));
            setZoom(newZoom);
        }
    }
    
    function handleTouchEnd(e) {
        dragState.isPanning = false;
        touchState.isPinching = false;
        
        // Detect double tap for quick note creation
        const now = Date.now();
        if (now - touchState.lastTap < 300) {
            createNote({
                left: (touchState.startX - state.panX) / state.zoom,
                top: (touchState.startY - state.panY) / state.zoom
            });
        }
        touchState.lastTap = now;
    }
    
    function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // ==================== UTILITIES ====================
    function generateId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    function showToast(message, type = 'info') {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    function handleWindowResize() {
        // Adjust canvas size if needed
        console.log('[Resize] Window resized');
    }
    
    // ==================== START APP ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

console.log('[App] Script loaded');
