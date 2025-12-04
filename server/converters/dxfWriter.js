/**
 * DXF writer til at generere DXF filer kompatible med AutoCAD og CNC software
 * Bruger DXF R12 format for maksimal kompatibilitet
 */

export class DxfWriter {
  constructor() {
    this.entities = [];
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this.handleCounter = 1;
  }

  getHandle() {
    return (this.handleCounter++).toString(16).toUpperCase();
  }

  updateBounds(x, y) {
    if (isFinite(x) && isFinite(y)) {
      this.minX = Math.min(this.minX, x);
      this.minY = Math.min(this.minY, y);
      this.maxX = Math.max(this.maxX, x);
      this.maxY = Math.max(this.maxY, y);
    }
  }

  addLine(x1, y1, x2, y2, layer = '0') {
    this.updateBounds(x1, y1);
    this.updateBounds(x2, y2);
    this.entities.push({
      type: 'LINE',
      x1, y1, x2, y2, layer
    });
  }

  // Konverterer polyline til individuelle linjer for bedre kompatibilitet
  addPolyline(points, closed = false, layer = '0') {
    if (points.length < 2) return;
    
    // Tilføj som individuelle LINE entiteter for maksimal kompatibilitet
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (isFinite(p1.x) && isFinite(p1.y) && isFinite(p2.x) && isFinite(p2.y)) {
        this.addLine(p1.x, p1.y, p2.x, p2.y, layer);
      }
    }
    
    // Luk polyline hvis nødvendigt
    if (closed && points.length > 2) {
      const first = points[0];
      const last = points[points.length - 1];
      if (isFinite(first.x) && isFinite(first.y) && isFinite(last.x) && isFinite(last.y)) {
        this.addLine(last.x, last.y, first.x, first.y, layer);
      }
    }
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

  generateDxf() {
    let dxf = '';
    
    // Sæt default bounds hvis ingen entities
    if (!isFinite(this.minX)) {
      this.minX = 0;
      this.minY = 0;
      this.maxX = 100;
      this.maxY = 100;
    }

    // === HEADER SECTION ===
    dxf += '0\n';
    dxf += 'SECTION\n';
    dxf += '2\n';
    dxf += 'HEADER\n';
    
    // AutoCAD version - R12 for maksimal kompatibilitet
    dxf += '9\n';
    dxf += '$ACADVER\n';
    dxf += '1\n';
    dxf += 'AC1009\n';
    
    // Insertion units - millimeter
    dxf += '9\n';
    dxf += '$INSUNITS\n';
    dxf += '70\n';
    dxf += '4\n';
    
    // Drawing extents
    dxf += '9\n';
    dxf += '$EXTMIN\n';
    dxf += '10\n';
    dxf += this.minX.toFixed(6) + '\n';
    dxf += '20\n';
    dxf += this.minY.toFixed(6) + '\n';
    dxf += '30\n';
    dxf += '0.0\n';
    
    dxf += '9\n';
    dxf += '$EXTMAX\n';
    dxf += '10\n';
    dxf += this.maxX.toFixed(6) + '\n';
    dxf += '20\n';
    dxf += this.maxY.toFixed(6) + '\n';
    dxf += '30\n';
    dxf += '0.0\n';
    
    dxf += '0\n';
    dxf += 'ENDSEC\n';

    // === TABLES SECTION ===
    dxf += '0\n';
    dxf += 'SECTION\n';
    dxf += '2\n';
    dxf += 'TABLES\n';
    
    // LTYPE table
    dxf += '0\n';
    dxf += 'TABLE\n';
    dxf += '2\n';
    dxf += 'LTYPE\n';
    dxf += '70\n';
    dxf += '1\n';
    
    dxf += '0\n';
    dxf += 'LTYPE\n';
    dxf += '2\n';
    dxf += 'CONTINUOUS\n';
    dxf += '70\n';
    dxf += '0\n';
    dxf += '3\n';
    dxf += 'Solid line\n';
    dxf += '72\n';
    dxf += '65\n';
    dxf += '73\n';
    dxf += '0\n';
    dxf += '40\n';
    dxf += '0.0\n';
    
    dxf += '0\n';
    dxf += 'ENDTAB\n';
    
    // LAYER table
    dxf += '0\n';
    dxf += 'TABLE\n';
    dxf += '2\n';
    dxf += 'LAYER\n';
    dxf += '70\n';
    dxf += '1\n';
    
    dxf += '0\n';
    dxf += 'LAYER\n';
    dxf += '2\n';
    dxf += '0\n';
    dxf += '70\n';
    dxf += '0\n';
    dxf += '62\n';
    dxf += '7\n';
    dxf += '6\n';
    dxf += 'CONTINUOUS\n';
    
    dxf += '0\n';
    dxf += 'ENDTAB\n';
    
    // STYLE table (required for some viewers)
    dxf += '0\n';
    dxf += 'TABLE\n';
    dxf += '2\n';
    dxf += 'STYLE\n';
    dxf += '70\n';
    dxf += '1\n';
    
    dxf += '0\n';
    dxf += 'STYLE\n';
    dxf += '2\n';
    dxf += 'STANDARD\n';
    dxf += '70\n';
    dxf += '0\n';
    dxf += '40\n';
    dxf += '0.0\n';
    dxf += '41\n';
    dxf += '1.0\n';
    dxf += '50\n';
    dxf += '0.0\n';
    dxf += '71\n';
    dxf += '0\n';
    dxf += '42\n';
    dxf += '2.5\n';
    dxf += '3\n';
    dxf += 'txt\n';
    dxf += '4\n';
    dxf += '\n';
    
    dxf += '0\n';
    dxf += 'ENDTAB\n';
    
    dxf += '0\n';
    dxf += 'ENDSEC\n';

    // === ENTITIES SECTION ===
    dxf += '0\n';
    dxf += 'SECTION\n';
    dxf += '2\n';
    dxf += 'ENTITIES\n';

    for (const entity of this.entities) {
      switch (entity.type) {
        case 'LINE':
          dxf += '0\n';
          dxf += 'LINE\n';
          dxf += '8\n';
          dxf += entity.layer + '\n';
          dxf += '10\n';
          dxf += entity.x1.toFixed(6) + '\n';
          dxf += '20\n';
          dxf += entity.y1.toFixed(6) + '\n';
          dxf += '30\n';
          dxf += '0.0\n';
          dxf += '11\n';
          dxf += entity.x2.toFixed(6) + '\n';
          dxf += '21\n';
          dxf += entity.y2.toFixed(6) + '\n';
          dxf += '31\n';
          dxf += '0.0\n';
          break;

        case 'CIRCLE':
          dxf += '0\n';
          dxf += 'CIRCLE\n';
          dxf += '8\n';
          dxf += entity.layer + '\n';
          dxf += '10\n';
          dxf += entity.cx.toFixed(6) + '\n';
          dxf += '20\n';
          dxf += entity.cy.toFixed(6) + '\n';
          dxf += '30\n';
          dxf += '0.0\n';
          dxf += '40\n';
          dxf += entity.radius.toFixed(6) + '\n';
          break;

        case 'ARC':
          dxf += '0\n';
          dxf += 'ARC\n';
          dxf += '8\n';
          dxf += entity.layer + '\n';
          dxf += '10\n';
          dxf += entity.cx.toFixed(6) + '\n';
          dxf += '20\n';
          dxf += entity.cy.toFixed(6) + '\n';
          dxf += '30\n';
          dxf += '0.0\n';
          dxf += '40\n';
          dxf += entity.radius.toFixed(6) + '\n';
          dxf += '50\n';
          dxf += entity.startAngle.toFixed(6) + '\n';
          dxf += '51\n';
          dxf += entity.endAngle.toFixed(6) + '\n';
          break;
      }
    }

    dxf += '0\n';
    dxf += 'ENDSEC\n';
    
    // === EOF ===
    dxf += '0\n';
    dxf += 'EOF\n';

    return dxf;
  }
}
