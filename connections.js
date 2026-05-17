/**
 * Connections Manager - Verwaltet Verbindungen zwischen Notes
 * Optimiert für Performance mit minimalem Re-rendering
 */

class ConnectionsManager {
    constructor(svgElement, stateManager) {
        this.svg = svgElement;
        this.group = svgElement.querySelector('#connections-group');
        this.stateManager = stateManager;
        
        // Cache für Connection Elements
        this.connectionElements = new Map();
        
        // Throttling für Updates
        this.pendingUpdate = false;
        this.updateQueue = [];
        this.lastUpdateTime = 0;
        this.minUpdateInterval = 16; // ~60fps
        
        // Arrow marker ID
        this.arrowMarkerId = 'arrowhead';
    }
    
    /**
     * Initialisiert den Connections Manager
     */
    init() {
        this.render();
        console.log('[Connections] Initialized');
    }
    
    /**
     * Rendert alle Connections basierend auf State
     * @param {boolean} force - Erzwingt komplettes Re-rendering
     */
    render(force = false) {
        const connections = this.stateManager.getConnections();
        const notes = this.stateManager.getNotes();
        
        // Create note lookup map for fast access
        const noteMap = new Map(notes.map(n => [n.id, n]));
        
        if (force) {
            // Komplettes Re-rendering
            this.group.innerHTML = '';
            this.connectionElements.clear();
            
            connections.forEach(conn => {
                this.createConnectionElement(conn, noteMap);
            });
        } else {
            // Inkrementelles Update
            const currentIds = new Set(connections.map(c => c.id));
            
            // Remove deleted connections
            for (const [id, element] of this.connectionElements.entries()) {
                if (!currentIds.has(id)) {
                    element.remove();
                    this.connectionElements.delete(id);
                }
            }
            
            // Add/update connections
            connections.forEach(conn => {
                if (!this.connectionElements.has(conn.id)) {
                    this.createConnectionElement(conn, noteMap);
                } else {
                    this.updateConnectionElement(conn, noteMap);
                }
            });
        }
    }
    
    /**
     * Erstellt ein neues Connection Element
     * @param {Object} connection - Connection Daten
     * @param {Map} noteMap - Note Lookup Map
     */
    createConnectionElement(connection, noteMap) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-line');
        path.setAttribute('data-id', connection.id);
        path.setAttribute('marker-end', `url(#${this.arrowMarkerId})`);
        
        // Click handler für Delete
        path.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                this.stateManager.deleteConnection(connection.id);
                this.stateManager.showToast('Verbindung gelöscht', 'info');
            }
        });
        path.style.cursor = 'pointer';
        
        this.group.appendChild(path);
        this.connectionElements.set(connection.id, path);
        
        // Initiale Position setzen
        this.updateConnectionElement(connection, noteMap);
    }
    
    /**
     * Updated die Position einer Connection
     * @param {Object} connection - Connection Daten
     * @param {Map} noteMap - Note Lookup Map
     */
    updateConnectionElement(connection, noteMap) {
        const fromNote = noteMap.get(connection.from);
        const toNote = noteMap.get(connection.to);
        
        if (!fromNote || !toNote) {
            // Notes existieren nicht mehr
            return;
        }
        
        const path = this.connectionElements.get(connection.id);
        if (!path) return;
        
        // Berechne Start und End Punkte
        const startPoint = this.getConnectionPoint(fromNote, 'end');
        const endPoint = this.getConnectionPoint(toNote, 'start');
        
        // Erzeuge Kurve
        const d = this.createCurvePath(startPoint, endPoint);
        path.setAttribute('d', d);
        
        // Farbe basierend auf Selection Status
        if (connection.selected) {
            path.classList.add('selected');
        } else {
            path.classList.remove('selected');
        }
    }
    
    /**
     * Berechnet den Verbindungspunkt einer Note
     * @param {Object} note - Note Daten
     * @param {string} side - 'start' oder 'end'
     * @returns {Object} - {x, y} Koordinaten
     */
    getConnectionPoint(note, side) {
        const noteEl = document.querySelector(`[data-note-id="${note.id}"]`);
        if (!noteEl) {
            return { x: note.left + note.width / 2, y: note.top + note.height / 2 };
        }
        
        const rect = noteEl.getBoundingClientRect();
        const containerRect = document.getElementById('paper-canvas').getBoundingClientRect();
        
        // Relative Position zum Canvas
        const centerX = rect.left - containerRect.left + rect.width / 2;
        const centerY = rect.top - containerRect.top + rect.height / 2;
        
        // Side-basierte Anpassung
        let x = centerX;
        let y = centerY;
        
        if (side === 'start') {
            // Rechte Seite der Note
            x = rect.left - containerRect.left + rect.width;
        } else {
            // Linke Seite der Note
            x = rect.left - containerRect.left;
        }
        
        return { x, y };
    }
    
    /**
     * Erstellt einen geschwungenen Pfad zwischen zwei Punkten
     * @param {Object} start - {x, y}
     * @param {Object} end - {x, y}
     * @returns {string} - SVG Path D Attribute
     */
    createCurvePath(start, end) {
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        
        // Control points für Bézier Kurve
        const controlOffset = Math.min(dx, dy) * 0.5 + 50;
        
        let cp1x, cp1y, cp2x, cp2y;
        
        if (dx > dy) {
            // Horizontal dominant
            cp1x = start.x + controlOffset;
            cp1y = start.y;
            cp2x = end.x - controlOffset;
            cp2y = end.y;
        } else {
            // Vertical dominant
            cp1x = start.x;
            cp1y = start.y + controlOffset;
            cp2x = end.x;
            cp2y = end.y - controlOffset;
        }
        
        return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
    }
    
    /**
     * Queue ein Update mit Throttling
     */
    queueUpdate() {
        if (this.pendingUpdate) return;
        
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        
        if (timeSinceLastUpdate >= this.minUpdateInterval) {
            this.performUpdate();
        } else {
            this.pendingUpdate = true;
            setTimeout(() => {
                this.pendingUpdate = false;
                this.performUpdate();
            }, this.minUpdateInterval - timeSinceLastUpdate);
        }
    }
    
    /**
     * Führt das Update durch
     */
    performUpdate() {
        this.lastUpdateTime = Date.now();
        this.render(false); // inkrementell
    }
    
    /**
     * Updated eine spezifische Connection
     * @param {string} connectionId 
     */
    updateConnection(connectionId) {
        const connections = this.stateManager.getConnections();
        const notes = this.stateManager.getNotes();
        const noteMap = new Map(notes.map(n => [n.id, n]));
        
        const connection = connections.find(c => c.id === connectionId);
        if (connection && this.connectionElements.has(connectionId)) {
            this.updateConnectionElement(connection, noteMap);
        }
    }
    
    /**
     * Updated alle Connections die eine Note betreffen
     * @param {string} noteId 
     */
    updateConnectionsForNote(noteId) {
        const connections = this.stateManager.getConnections();
        const notes = this.stateManager.getNotes();
        const noteMap = new Map(notes.map(n => [n.id, n]));
        
        const affectedConnections = connections.filter(
            c => c.from === noteId || c.to === noteId
        );
        
        affectedConnections.forEach(conn => {
            if (this.connectionElements.has(conn.id)) {
                this.updateConnectionElement(conn, noteMap);
            }
        });
    }
    
    /**
     * Wählt eine Connection aus
     * @param {string} connectionId 
     */
    selectConnection(connectionId) {
        const connections = this.stateManager.getConnections();
        const connection = connections.find(c => c.id === connectionId);
        
        if (connection) {
            this.stateManager.execute(
                () => { connection.selected = true; },
                () => { connection.selected = false; },
                'Select Connection'
            );
            this.updateConnection(connectionId);
        }
    }
    
    /**
     * Deselektiert alle Connections
     */
    deselectAll() {
        const connections = this.stateManager.getConnections();
        let changed = false;
        
        connections.forEach(conn => {
            if (conn.selected) {
                conn.selected = false;
                changed = true;
                const path = this.connectionElements.get(conn.id);
                if (path) path.classList.remove('selected');
            }
        });
        
        if (changed) {
            this.stateManager.notifyChange();
        }
    }
    
    /**
     * Löscht alle Connections
     */
    clear() {
        this.group.innerHTML = '';
        this.connectionElements.clear();
    }
}

// Export für globale Verwendung
window.ConnectionsManager = ConnectionsManager;
console.log('[Connections] Module loaded');
