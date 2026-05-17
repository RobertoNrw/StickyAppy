// connections.js
export class ConnectionsManager {
  constructor(svgElement, getNoteElementById) {
    this.svg                = svgElement;
    this.getNoteElementById = getNoteElementById;
    this.connections        = [];
    this.defs               = null; // Cache für defs Element
    this.pathElements       = [];   // Cache für Path-Elemente zur Wiederverwendung
  }
  
  // ─── Beim App-Start: gespeicherte Verbindungen inkl. cpOffsets laden ────────
  loadSaved(savedConnections) {
    this.connections = savedConnections.map(c => ({
      sourceId:  c.sourceId,
      targetId:  c.targetId,
      cpOffsetX: c.cpOffsetX ?? (Math.random() * 80 - 40),
      cpOffsetY: c.cpOffsetY ?? (Math.random() * 80 - 40)
    }));
    this.render();
  }

  addConnection(sourceId, targetId, cpOffsetX, cpOffsetY) {
    if (this.connections.some(c =>
      (c.sourceId === sourceId && c.targetId === targetId) ||
      (c.sourceId === targetId && c.targetId === sourceId)
    )) return null;
    const conn = {
      sourceId,
      targetId,
      cpOffsetX: cpOffsetX ?? (Math.random() * 80 - 40),
      cpOffsetY: cpOffsetY ?? (Math.random() * 80 - 40)
    };
    this.connections.push(conn);
    this.render();
    return conn;
  }

  removeConnection(sourceId, targetId) {
    this.connections = this.connections.filter(
      c => !(c.sourceId === sourceId && c.targetId === targetId)
    );
    this.render();
  }

  updateLines() {
    // Performance-optimiert: Nur Paths updaten, nicht komplett neu rendern
    this.updatePaths();
  }
  
  // Initialisiert defs einmalig
  ensureDefs() {
    if (this.defs && this.svg.contains(this.defs)) return this.defs;
    
    let existingDefs = this.svg.querySelector('defs');
    if (existingDefs) {
      this.defs = existingDefs;
      return this.defs;
    }
    
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker  = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id',           'arrowhead');
    marker.setAttribute('markerWidth',  '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX',         '9');
    marker.setAttribute('refY',         '3.5');
    marker.setAttribute('orient',       'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill',   'rgba(101,67,33,0.5)');
    marker.appendChild(polygon);
    this.defs.appendChild(marker);
    this.svg.appendChild(this.defs);
    return this.defs;
  }

  render() {
    // Defs sicherstellen (wird nur einmal erstellt)
    this.ensureDefs();
    
    // Alte Paths entfernen (außer defs)
    const oldPaths = this.svg.querySelectorAll('path');
    oldPaths.forEach(p => p.remove());
    this.pathElements = [];
    
    // Neue Paths erstellen und cachen
    this.connections.forEach((conn, index) => {
      const sourceEl = this.getNoteElementById(conn.sourceId);
      const targetEl = this.getNoteElementById(conn.targetId);
      if (!sourceEl || !targetEl) return;

      const sRect     = sourceEl.getBoundingClientRect();
      const tRect     = targetEl.getBoundingClientRect();
      const canvasRect = this.svg.getBoundingClientRect();

      const sX = sRect.left + sRect.width  / 2 - canvasRect.left;
      const sY = sRect.top  + sRect.height / 2 - canvasRect.top;
      const tX = tRect.left + tRect.width  / 2 - canvasRect.left;
      const tY = tRect.top  + tRect.height / 2 - canvasRect.top;

      const cpX = (sX + tX) / 2 + conn.cpOffsetX;
      const cpY = (sY + tY) / 2 + conn.cpOffsetY;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d',          `M ${sX} ${sY} Q ${cpX} ${cpY} ${tX} ${tY}`);
      path.setAttribute('fill',       'none');
      path.setAttribute('stroke',     'rgba(101,67,33,0.4)');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('marker-end', 'url(#arrowhead)');
      this.svg.appendChild(path);
      this.pathElements.push({ path, conn });
    });
  }
  
  // Performance-optimierte Update-Methode: Nur Path-Daten aktualisieren
  updatePaths() {
    if (!this.defs || !this.svg.contains(this.defs)) {
      this.render();
      return;
    }
    
    const canvasRect = this.svg.getBoundingClientRect();
    
    this.pathElements.forEach(({ path, conn }) => {
      const sourceEl = this.getNoteElementById(conn.sourceId);
      const targetEl = this.getNoteElementById(conn.targetId);
      if (!sourceEl || !targetEl) return;

      const sRect = sourceEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();

      const sX = sRect.left + sRect.width  / 2 - canvasRect.left;
      const sY = sRect.top  + sRect.height / 2 - canvasRect.top;
      const tX = tRect.left + tRect.width  / 2 - canvasRect.left;
      const tY = tRect.top  + tRect.height / 2 - canvasRect.top;

      const cpX = (sX + tX) / 2 + conn.cpOffsetX;
      const cpY = (sY + tY) / 2 + conn.cpOffsetY;

      // Nur das 'd' Attribut updaten, nicht das ganze Element neu erstellen
      path.setAttribute('d', `M ${sX} ${sY} Q ${cpX} ${cpY} ${tX} ${tY}`);
    });
  }
}
