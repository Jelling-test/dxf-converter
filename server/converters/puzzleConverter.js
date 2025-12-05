import { DxfWriter } from './dxfWriter.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * Genererer puzzle-tab kurve (den bølgede kant)
 */
function generateTabPath(x1, y1, x2, y2, tabOut, tabStyle = 'classic') {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  // Normaliser retningsvektor
  const nx = dx / len;
  const ny = dy / len;
  
  // Perpendikular vektor
  const px = -ny;
  const py = nx;
  
  const tabDepth = len * 0.15 * (tabOut ? 1 : -1);
  const tabWidth = len * 0.3;
  
  const points = [];
  
  if (tabStyle === 'straight') {
    // Lige linjer - ingen tabs
    points.push({ x: x1, y: y1 });
    points.push({ x: x2, y: y2 });
  } else if (tabStyle === 'rounded') {
    // Afrundede tabs
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const baseX = x1 + dx * t;
      const baseY = y1 + dy * t;
      
      // Sinusbølge for tab
      const tabOffset = Math.sin(t * Math.PI) * tabDepth;
      
      points.push({
        x: baseX + px * tabOffset,
        y: baseY + py * tabOffset
      });
    }
  } else {
    // Klassisk puzzle-tab
    const neckStart = 0.35;
    const neckEnd = 0.65;
    const tabStart = 0.4;
    const tabEnd = 0.6;
    
    // Start punkt
    points.push({ x: x1, y: y1 });
    
    // Til hals start
    points.push({
      x: x1 + dx * neckStart,
      y: y1 + dy * neckStart
    });
    
    // Hals ind
    points.push({
      x: x1 + dx * neckStart + px * tabDepth * 0.3,
      y: y1 + dy * neckStart + py * tabDepth * 0.3
    });
    
    // Tab kurve (simplificeret)
    const tabPoints = 8;
    for (let i = 0; i <= tabPoints; i++) {
      const t = i / tabPoints;
      const angle = Math.PI * t;
      const tabX = x1 + dx * (tabStart + (tabEnd - tabStart) * t);
      const tabY = y1 + dy * (tabStart + (tabEnd - tabStart) * t);
      const bulge = Math.sin(angle) * tabDepth;
      
      points.push({
        x: tabX + px * (tabDepth * 0.3 + bulge * 0.7),
        y: tabY + py * (tabDepth * 0.3 + bulge * 0.7)
      });
    }
    
    // Hals ud
    points.push({
      x: x1 + dx * neckEnd + px * tabDepth * 0.3,
      y: y1 + dy * neckEnd + py * tabDepth * 0.3
    });
    
    // Til hals slut
    points.push({
      x: x1 + dx * neckEnd,
      y: y1 + dy * neckEnd
    });
    
    // Slut punkt
    points.push({ x: x2, y: y2 });
  }
  
  return points;
}

/**
 * Genererer puzzle preview som SVG
 */
export async function generatePuzzlePreviewSvg(imagePath, options = {}) {
  const {
    width = 150,
    height = 150,
    cols = 4,
    rows = 4,
    tabStyle = 'classic'
  } = options;

  const pieceWidth = width / cols;
  const pieceHeight = height / rows;
  const padding = 10;
  const svgWidth = width + padding * 2;
  const svgHeight = height + padding * 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth * 2}" height="${svgHeight * 2}">`;
  svg += `<rect width="100%" height="100%" fill="#f0f0f0"/>`;
  
  // Ramme
  svg += `<rect x="${padding}" y="${padding}" width="${width}" height="${height}" fill="none" stroke="#333" stroke-width="0.5"/>`;

  // Random tab directions (konsistent for preview)
  const hTabs = [];
  const vTabs = [];
  
  for (let row = 0; row < rows; row++) {
    hTabs[row] = [];
    for (let col = 0; col < cols - 1; col++) {
      hTabs[row][col] = Math.random() > 0.5;
    }
  }
  
  for (let row = 0; row < rows - 1; row++) {
    vTabs[row] = [];
    for (let col = 0; col < cols; col++) {
      vTabs[row][col] = Math.random() > 0.5;
    }
  }

  // Tegn vertikale linjer (mellem kolonner)
  svg += `<g stroke="#333" stroke-width="0.5" fill="none">`;
  for (let col = 1; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = padding + col * pieceWidth;
      const y1 = padding + row * pieceHeight;
      const y2 = padding + (row + 1) * pieceHeight;
      const tabOut = hTabs[row][col - 1];
      
      const points = generateTabPath(x, y1, x, y2, tabOut, tabStyle);
      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
      svg += `<path d="${pathD}"/>`;
    }
  }
  
  // Tegn horisontale linjer (mellem rækker)
  for (let row = 1; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const y = padding + row * pieceHeight;
      const x1 = padding + col * pieceWidth;
      const x2 = padding + (col + 1) * pieceWidth;
      const tabOut = vTabs[row - 1][col];
      
      const points = generateTabPath(x1, y, x2, y, tabOut, tabStyle);
      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
      svg += `<path d="${pathD}"/>`;
    }
  }
  svg += `</g>`;
  
  svg += `</svg>`;
  
  return svg;
}

/**
 * Genererer puzzle preview som PNG
 */
export async function generatePuzzlePreviewPng(imagePath, options = {}) {
  const svg = await generatePuzzlePreviewSvg(imagePath, options);
  
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  return pngBuffer;
}

/**
 * Konverterer til puzzle DXF
 */
export async function convertPuzzleToDxf(imagePath, outputDir, options = {}) {
  const {
    width = 150,
    height = 150,
    cols = 4,
    rows = 4,
    tabStyle = 'classic'
  } = options;

  const pieceWidth = width / cols;
  const pieceHeight = height / rows;
  
  const dxf = new DxfWriter();
  
  // Ydre ramme
  dxf.addLine(0, 0, width, 0, 'FRAME');
  dxf.addLine(width, 0, width, height, 'FRAME');
  dxf.addLine(width, height, 0, height, 'FRAME');
  dxf.addLine(0, height, 0, 0, 'FRAME');

  // Seed for konsistente tabs
  const seed = Date.now();
  const random = (i) => {
    const x = Math.sin(seed + i * 12.9898) * 43758.5453;
    return x - Math.floor(x) > 0.5;
  };

  let tabIndex = 0;

  // Vertikale linjer (mellem kolonner)
  for (let col = 1; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = col * pieceWidth;
      const y1 = row * pieceHeight;
      const y2 = (row + 1) * pieceHeight;
      const tabOut = random(tabIndex++);
      
      const points = generateTabPath(x, y1, x, y2, tabOut, tabStyle);
      
      for (let i = 0; i < points.length - 1; i++) {
        dxf.addLine(points[i].x, points[i].y, points[i+1].x, points[i+1].y, 'PIECES');
      }
    }
  }
  
  // Horisontale linjer (mellem rækker)
  for (let row = 1; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const y = row * pieceHeight;
      const x1 = col * pieceWidth;
      const x2 = (col + 1) * pieceWidth;
      const tabOut = random(tabIndex++);
      
      const points = generateTabPath(x1, y, x2, y, tabOut, tabStyle);
      
      for (let i = 0; i < points.length - 1; i++) {
        dxf.addLine(points[i].x, points[i].y, points[i+1].x, points[i+1].y, 'PIECES');
      }
    }
  }

  // Gem DXF
  const dxfContent = dxf.generateDxf();
  const filename = `puzzle-${cols}x${rows}-${Date.now()}.dxf`;
  const outputPath = path.join(outputDir, filename);
  
  fs.writeFileSync(outputPath, dxfContent);
  
  return {
    path: outputPath,
    filename,
    width,
    height,
    cols,
    rows,
    totalPieces: cols * rows
  };
}
