// connections.js
export class ConnectionsManager {
  constructor(svgElement, getNoteElementById) {
    this.svg                = svgElement;
    this.getNoteElementById = getNoteElementById;
    this.connections        = [];
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
    this.render();
  }

  render() {
    let defs = this.svg.querySelector('defs');
    this.svg.innerHTML = '';

    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
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
      defs.appendChild(marker);
    }
    this.svg.appendChild(defs);

    this.connections.forEach(conn => {
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
    });
  }
}
