/**
 * Simpel DXF writer til at generere DXF filer
 */

export class DxfWriter {
  constructor() {
    this.entities = [];
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
  }

  updateBounds(x, y) {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
  }

  addLine(x1, y1, x2, y2, layer = '0') {
    this.updateBounds(x1, y1);
    this.updateBounds(x2, y2);
    this.entities.push({
      type: 'LINE',
      x1, y1, x2, y2, layer
    });
  }

  addPolyline(points, closed = false, layer = '0') {
    if (points.length < 2) return;
    
    points.forEach(p => this.updateBounds(p.x, p.y));
    this.entities.push({
      type: 'LWPOLYLINE',
      points,
      closed,
      layer
    });
  }

  addCircle(cx, cy, radius, layer = '0') {
    this.updateBounds(cx - radius, cy - radius);
    this.updateBounds(cx + radius, cy + radius);
    this.entities.push({
      type: 'CIRCLE',
      cx, cy, radius, layer
    });
  }

  addArc(cx, cy, radius, startAngle, endAngle, layer = '0') {
    this.updateBounds(cx - radius, cy - radius);
    this.updateBounds(cx + radius, cy + radius);
    this.entities.push({
      type: 'ARC',
      cx, cy, radius, startAngle, endAngle, layer
    });
  }

  addText(text, x, y, height, layer = '0') {
    this.updateBounds(x, y);
    this.updateBounds(x + text.length * height * 0.6, y + height);
    this.entities.push({
      type: 'TEXT',
      text, x, y, height, layer
    });
  }

  generateDxf() {
    let dxf = '';

    // Header section
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1015\n'; // AutoCAD 2000
    dxf += '9\n$INSUNITS\n70\n4\n'; // Millimeter
    
    if (this.entities.length > 0) {
      dxf += `9\n$EXTMIN\n10\n${this.minX}\n20\n${this.minY}\n30\n0\n`;
      dxf += `9\n$EXTMAX\n10\n${this.maxX}\n20\n${this.maxY}\n30\n0\n`;
    }
    
    dxf += '0\nENDSEC\n';

    // Tables section
    dxf += '0\nSECTION\n2\nTABLES\n';
    
    // Layer table
    dxf += '0\nTABLE\n2\nLAYER\n70\n1\n';
    dxf += '0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n';
    dxf += '0\nENDTAB\n';
    
    dxf += '0\nENDSEC\n';

    // Entities section
    dxf += '0\nSECTION\n2\nENTITIES\n';

    for (const entity of this.entities) {
      switch (entity.type) {
        case 'LINE':
          dxf += '0\nLINE\n';
          dxf += `8\n${entity.layer}\n`;
          dxf += `10\n${entity.x1}\n20\n${entity.y1}\n30\n0\n`;
          dxf += `11\n${entity.x2}\n21\n${entity.y2}\n31\n0\n`;
          break;

        case 'LWPOLYLINE':
          dxf += '0\nLWPOLYLINE\n';
          dxf += `8\n${entity.layer}\n`;
          dxf += `90\n${entity.points.length}\n`;
          dxf += `70\n${entity.closed ? 1 : 0}\n`;
          for (const p of entity.points) {
            dxf += `10\n${p.x}\n20\n${p.y}\n`;
          }
          break;

        case 'CIRCLE':
          dxf += '0\nCIRCLE\n';
          dxf += `8\n${entity.layer}\n`;
          dxf += `10\n${entity.cx}\n20\n${entity.cy}\n30\n0\n`;
          dxf += `40\n${entity.radius}\n`;
          break;

        case 'ARC':
          dxf += '0\nARC\n';
          dxf += `8\n${entity.layer}\n`;
          dxf += `10\n${entity.cx}\n20\n${entity.cy}\n30\n0\n`;
          dxf += `40\n${entity.radius}\n`;
          dxf += `50\n${entity.startAngle}\n51\n${entity.endAngle}\n`;
          break;

        case 'TEXT':
          dxf += '0\nTEXT\n';
          dxf += `8\n${entity.layer}\n`;
          dxf += `10\n${entity.x}\n20\n${entity.y}\n30\n0\n`;
          dxf += `40\n${entity.height}\n`;
          dxf += `1\n${entity.text}\n`;
          break;
      }
    }

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    return dxf;
  }
}
