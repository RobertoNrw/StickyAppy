// connections.js
export class ConnectionsManager {
  constructor(svgElement, getNoteElementById) {
    this.svg = svgElement;
    this.getNoteElementById = getNoteElementById;
    this.connections = [];
  }
  
  addConnection(sourceId, targetId) {
    if (this.connections.some(c => (c.sourceId === sourceId && c.targetId === targetId) || (c.sourceId === targetId && c.targetId === sourceId))) return;
    this.connections.push({ sourceId, targetId });
    this.render();
  }
  
  removeConnection(sourceId, targetId) {
    this.connections = this.connections.filter(c => !(c.sourceId === sourceId && c.targetId === targetId));
    this.render();
  }
  
  updateLines() {
    this.render();
  }
  
  render() {
    const defs = this.svg.querySelector('defs');
    this.svg.innerHTML = '';
    this.svg.appendChild(defs);
    
    this.connections.forEach(conn => {
      const sourceEl = this.getNoteElementById(conn.sourceId);
      const targetEl = this.getNoteElementById(conn.targetId);
      
      if (!sourceEl || !targetEl) return;
      
      const sRect = sourceEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();
      const canvasRect = this.svg.getBoundingClientRect();
      
      const sX = sRect.left + sRect.width/2 - canvasRect.left;
      const sY = sRect.top + sRect.height/2 - canvasRect.top;
      const tX = tRect.left + tRect.width/2 - canvasRect.left;
      const tY = tRect.top + tRect.height/2 - canvasRect.top;
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      
      // Imperfect hand-drawn curve
      const cpX = (sX + tX) / 2 + (Math.random() * 40 - 20);
      const cpY = (sY + tY) / 2 + (Math.random() * 40 - 20);
      
      path.setAttribute('d', `M ${sX} ${sY} Q ${cpX} ${cpY} ${tX} ${tY}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(101,67,33,0.4)');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('marker-end', 'url(#arrowhead)');
      
      this.svg.appendChild(path);
    });
  }
}
