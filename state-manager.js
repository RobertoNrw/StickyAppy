/**
 * State Manager - Zentralisiertes State Management mit Undo/Redo
 * Implementiert das Command Pattern für rückgängig machbare Aktionen
 */

class StateManager {
    constructor() {
        this.state = {
            notes: [],
            connections: [],
            zoom: 1,
            gridEnabled: true,
            panX: 0,
            panY: 0
        };
        
        // Undo/Redo Stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        
        // Callbacks
        this.onChangeCallbacks = [];
        this.onUndoRedoCallbacks = [];
        
        // Auto-save timer
        this.autoSaveTimer = null;
        this.autoSaveDelay = 5000; // 5 Sekunden
        
        this.loadFromStorage();
    }
    
    /**
     * Führt eine Aktion aus und speichert sie für Undo
     * @param {Function} executeFn - Funktion die die Aktion ausführt
     * @param {Function} undoFn - Funktion die die Aktion rückgängig macht
     * @param {string} actionType - Typ der Aktion für Logging
     */
    execute(executeFn, undoFn, actionType = 'unknown') {
        // Aktuelle State-Snapshot für Undo speichern
        const prevState = this.getSnapshot();
        
        // Aktion ausführen
        executeFn();
        
        // Neue State-Snapshot für Redo (wird bei nächstem Undo benötigt)
        const newState = this.getSnapshot();
        
        // Undo Stack pushen
        this.undoStack.push({
            type: actionType,
            prevState,
            newState,
            undoFn,
            timestamp: Date.now()
        });
        
        // Redo Stack leeren (bei neuer Aktion)
        this.redoStack = [];
        
        // Stack-Größe begrenzen
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        
        // Callbacks benachrichtigen
        this.notifyChange();
        this.notifyUndoRedoState();
        
        // Auto-save triggern
        this.triggerAutoSave();
        
        console.log(`[State] Action executed: ${actionType}`);
    }
    
    /**
     * Macht die letzte Aktion rückgängig
     * @returns {boolean} - Erfolg der Operation
     */
    undo() {
        if (this.undoStack.length === 0) {
            console.log('[State] Nothing to undo');
            return false;
        }
        
        const action = this.undoStack.pop();
        
        // State auf vorherigen Stand zurücksetzen
        this.restoreSnapshot(action.prevState);
        
        // Redo Stack pushen
        this.redoStack.push(action);
        
        // Callbacks benachrichtigen
        this.notifyChange();
        this.notifyUndoRedoState();
        
        console.log(`[State] Undone: ${action.type}`);
        this.showToast(`Rückgängig: ${action.type}`, 'info');
        
        return true;
    }
    
    /**
     * Stellt eine rückgängig gemachte Aktion wieder her
     * @returns {boolean} - Erfolg der Operation
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('[State] Nothing to redo');
            return false;
        }
        
        const action = this.redoStack.pop();
        
        // State auf neuen Stand setzen
        this.restoreSnapshot(action.newState);
        
        // Undo Stack pushen
        this.undoStack.push(action);
        
        // Callbacks benachrichtigen
        this.notifyChange();
        this.notifyUndoRedoState();
        
        console.log(`[State] Redone: ${action.type}`);
        this.showToast(`Wiederhergestellt: ${action.type}`, 'info');
        
        return true;
    }
    
    /**
     * Erstellt einen Snapshot des aktuellen States
     * @returns {Object} - Deep copy des States
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }
    
    /**
     * Stellt den State aus einem Snapshot wieder her
     * @param {Object} snapshot - State Snapshot
     */
    restoreSnapshot(snapshot) {
        this.state = JSON.parse(JSON.stringify(snapshot));
        this.notifyChange(true); // silent = true für interne Restores
    }
    
    /**
     * Registriert einen Change Callback
     * @param {Function} callback 
     */
    onChange(callback) {
        this.onChangeCallbacks.push(callback);
    }
    
    /**
     * Registriert einen Undo/Redo State Callback
     * @param {Function} callback 
     */
    onUndoRedoState(callback) {
        this.onUndoRedoCallbacks.push(callback);
    }
    
    /**
     * Benachrichtigt alle Change Callbacks
     * @param {boolean} silent - Wenn true, keine UI Updates
     */
    notifyChange(silent = false) {
        this.onChangeCallbacks.forEach(cb => cb(this.state, silent));
    }
    
    /**
     * Benachrichtigt alle Undo/Redo State Callbacks
     */
    notifyUndoRedoState() {
        const canUndo = this.undoStack.length > 0;
        const canRedo = this.redoStack.length > 0;
        this.onUndoRedoCallbacks.forEach(cb => cb(canUndo, canRedo));
    }
    
    /**
     * Trigger Auto-save mit Debounce
     */
    triggerAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setTimeout(() => {
            this.saveToStorage();
            this.showToast('Automatisch gespeichert', 'success');
        }, this.autoSaveDelay);
    }
    
    /**
     * Speichert State in localStorage
     */
    saveToStorage() {
        try {
            const data = {
                state: this.state,
                timestamp: Date.now()
            };
            localStorage.setItem('leonardo-board-state', JSON.stringify(data));
            console.log('[State] Saved to localStorage');
        } catch (error) {
            console.error('[State] Save failed:', error);
            this.showToast('Speichern fehlgeschlagen', 'error');
        }
    }
    
    /**
     * Lädt State aus localStorage
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem('leonardo-board-state');
            if (data) {
                const parsed = JSON.parse(data);
                this.state = parsed.state || parsed;
                console.log('[State] Loaded from localStorage');
                this.notifyChange();
            }
        } catch (error) {
            console.error('[State] Load failed:', error);
        }
    }
    
    /**
     * Exportiert State als JSON
     * @returns {string} - JSON String
     */
    exportToJson() {
        return JSON.stringify(this.state, null, 2);
    }
    
    /**
     * Importiert State aus JSON
     * @param {string} jsonString - JSON String
     */
    importFromJson(jsonString) {
        try {
            const importedState = JSON.parse(jsonString);
            
            // Validation
            if (!importedState.notes || !Array.isArray(importedState.notes)) {
                throw new Error('Ungültiges Format: notes Array fehlt');
            }
            
            // Execute as action
            this.execute(
                () => {
                    this.state = importedState;
                },
                () => {
                    // Undo würde alten State wiederherstellen
                    this.loadFromStorage();
                },
                'Import'
            );
            
            this.showToast('Import erfolgreich', 'success');
            return true;
        } catch (error) {
            console.error('[State] Import failed:', error);
            this.showToast(`Import fehlgeschlagen: ${error.message}`, 'error');
            return false;
        }
    }
    
    /**
     * Setzt State auf Initialwerte zurück
     */
    reset() {
        this.execute(
            () => {
                this.state = {
                    notes: [],
                    connections: [],
                    zoom: 1,
                    gridEnabled: true,
                    panX: 0,
                    panY: 0
                };
            },
            () => {
                this.loadFromStorage();
            },
            'Reset'
        );
        
        this.showToast('Board zurückgesetzt', 'info');
    }
    
    /**
     * Zeigt Toast Notification
     * @param {string} message 
     * @param {string} type - 'success', 'error', 'info', 'warning'
     */
    showToast(message, type = 'info') {
        const event = new CustomEvent('toast', { 
            detail: { message, type } 
        });
        window.dispatchEvent(event);
    }
    
    /**
     * Getter für State Properties
     */
    getNotes() { return [...this.state.notes]; }
    getConnections() { return [...this.state.connections]; }
    getZoom() { return this.state.zoom; }
    isGridEnabled() { return this.state.gridEnabled; }
    getPan() { return { x: this.state.panX, y: this.state.panY }; }
    getCanUndo() { return this.undoStack.length > 0; }
    getCanRedo() { return this.redoStack.length > 0; }
    
    /**
     * Setter für State Properties mit automatischem Tracking
     */
    setZoom(zoom) {
        const oldZoom = this.state.zoom;
        this.execute(
            () => { this.state.zoom = zoom; },
            () => { this.state.zoom = oldZoom; },
            'Zoom'
        );
    }
    
    toggleGrid() {
        const oldGrid = this.state.gridEnabled;
        this.execute(
            () => { this.state.gridEnabled = !oldGrid; },
            () => { this.state.gridEnabled = oldGrid; },
            'Grid Toggle'
        );
    }
    
    setPan(x, y) {
        const oldPan = { x: this.state.panX, y: this.state.panY };
        this.execute(
            () => { 
                this.state.panX = x; 
                this.state.panY = y; 
            },
            () => { 
                this.state.panX = oldPan.x; 
                this.state.panY = oldPan.y; 
            },
            'Pan'
        );
    }
    
    addNote(note) {
        this.execute(
            () => { this.state.notes.push(note); },
            () => { 
                const index = this.state.notes.findIndex(n => n.id === note.id);
                if (index !== -1) this.state.notes.splice(index, 1);
            },
            'Add Note'
        );
    }
    
    updateNote(id, updates) {
        const oldNote = this.state.notes.find(n => n.id === id);
        if (!oldNote) return false;
        
        this.execute(
            () => { 
                const note = this.state.notes.find(n => n.id === id);
                Object.assign(note, updates);
            },
            () => { 
                const note = this.state.notes.find(n => n.id === id);
                Object.assign(note, oldNote);
            },
            'Update Note'
        );
        return true;
    }
    
    deleteNote(id) {
        const note = this.state.notes.find(n => n.id === id);
        if (!note) return false;
        
        // Auch Connections löschen die diese Note betreffen
        const affectedConnections = this.state.connections.filter(
            c => c.from === id || c.to === id
        );
        
        this.execute(
            () => { 
                this.state.notes = this.state.notes.filter(n => n.id !== id);
                this.state.connections = this.state.connections.filter(
                    c => c.from !== id && c.to !== id
                );
            },
            () => { 
                this.state.notes.push(note);
                this.state.connections.push(...affectedConnections);
            },
            'Delete Note'
        );
        return true;
    }
    
    addConnection(connection) {
        // Prüfen ob Connection bereits existiert
        const exists = this.state.connections.some(
            c => (c.from === connection.from && c.to === connection.to) ||
                 (c.from === connection.to && c.to === connection.from)
        );
        
        if (exists) {
            this.showToast('Verbindung existiert bereits', 'warning');
            return false;
        }
        
        this.execute(
            () => { this.state.connections.push(connection); },
            () => { 
                const index = this.state.connections.findIndex(
                    c => c.id === connection.id
                );
                if (index !== -1) this.state.connections.splice(index, 1);
            },
            'Add Connection'
        );
        return true;
    }
    
    deleteConnection(id) {
        const connection = this.state.connections.find(c => c.id === id);
        if (!connection) return false;
        
        this.execute(
            () => { 
                this.state.connections = this.state.connections.filter(c => c.id !== id);
            },
            () => { this.state.connections.push(connection); },
            'Delete Connection'
        );
        return true;
    }
}

// Globale Instanz erstellen
window.stateManager = new StateManager();

console.log('[State] StateManager initialized');
