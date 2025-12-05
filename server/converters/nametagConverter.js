import { DxfWriter } from './dxfWriter.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Simple single-stroke font (genbrugt fra textConverter)
const FONT_DATA = {
  'A': [[0,0,0.5,1],[0.5,1,1,0],[0.25,0.5,0.75,0.5]],
  'B': [[0,0,0,1],[0,1,0.7,1],[0.7,1,0.8,0.9],[0.8,0.9,0.8,0.6],[0.8,0.6,0.7,0.5],[0.7,0.5,0,0.5],[0,0.5,0.7,0.5],[0.7,0.5,0.8,0.4],[0.8,0.4,0.8,0.1],[0.8,0.1,0.7,0],[0.7,0,0,0]],
  'C': [[1,0.2,0.8,0],[0.8,0,0.2,0],[0.2,0,0,0.2],[0,0.2,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8]],
  'D': [[0,0,0,1],[0,1,0.6,1],[0.6,1,0.9,0.8],[0.9,0.8,0.9,0.2],[0.9,0.2,0.6,0],[0.6,0,0,0]],
  'E': [[0.8,0,0,0],[0,0,0,1],[0,1,0.8,1],[0,0.5,0.6,0.5]],
  'F': [[0,0,0,1],[0,1,0.8,1],[0,0.5,0.6,0.5]],
  'G': [[1,0.8,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.8],[0,0.8,0,0.2],[0,0.2,0.2,0],[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,0.5],[1,0.5,0.5,0.5]],
  'H': [[0,0,0,1],[1,0,1,1],[0,0.5,1,0.5]],
  'I': [[0.3,0,0.7,0],[0.5,0,0.5,1],[0.3,1,0.7,1]],
  'J': [[0.2,1,0.8,1],[0.5,1,0.5,0.2],[0.5,0.2,0.3,0],[0.3,0,0.1,0.2]],
  'K': [[0,0,0,1],[0,0.5,1,1],[0,0.5,1,0]],
  'L': [[0,1,0,0],[0,0,0.8,0]],
  'M': [[0,0,0,1],[0,1,0.5,0.5],[0.5,0.5,1,1],[1,1,1,0]],
  'N': [[0,0,0,1],[0,1,1,0],[1,0,1,1]],
  'O': [[0.2,0,0,0.2],[0,0.2,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0]],
  'P': [[0,0,0,1],[0,1,0.7,1],[0.7,1,0.9,0.8],[0.9,0.8,0.9,0.6],[0.9,0.6,0.7,0.5],[0.7,0.5,0,0.5]],
  'Q': [[0.2,0,0,0.2],[0,0.2,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0],[0.6,0.3,1,0]],
  'R': [[0,0,0,1],[0,1,0.7,1],[0.7,1,0.9,0.8],[0.9,0.8,0.9,0.6],[0.9,0.6,0.7,0.5],[0.7,0.5,0,0.5],[0.5,0.5,1,0]],
  'S': [[1,0.8,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.8],[0,0.8,0,0.6],[0,0.6,0.2,0.5],[0.2,0.5,0.8,0.5],[0.8,0.5,1,0.4],[1,0.4,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0],[0.2,0,0,0.2]],
  'T': [[0,1,1,1],[0.5,1,0.5,0]],
  'U': [[0,1,0,0.2],[0,0.2,0.2,0],[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,1]],
  'V': [[0,1,0.5,0],[0.5,0,1,1]],
  'W': [[0,1,0.25,0],[0.25,0,0.5,0.5],[0.5,0.5,0.75,0],[0.75,0,1,1]],
  'X': [[0,0,1,1],[0,1,1,0]],
  'Y': [[0,1,0.5,0.5],[0.5,0.5,1,1],[0.5,0.5,0.5,0]],
  'Z': [[0,1,1,1],[1,1,0,0],[0,0,1,0]],
  '0': [[0.2,0,0,0.2],[0,0.2,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0],[0,0,1,1]],
  '1': [[0.3,0.8,0.5,1],[0.5,1,0.5,0],[0.3,0,0.7,0]],
  '2': [[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.6],[1,0.6,0,0],[0,0,1,0]],
  '3': [[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.6],[1,0.6,0.8,0.5],[0.8,0.5,0.4,0.5],[0.8,0.5,1,0.4],[1,0.4,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0],[0.2,0,0,0.2]],
  '4': [[0,1,0,0.5],[0,0.5,1,0.5],[0.8,1,0.8,0]],
  '5': [[1,1,0,1],[0,1,0,0.5],[0,0.5,0.8,0.5],[0.8,0.5,1,0.4],[1,0.4,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0],[0.2,0,0,0.2]],
  '6': [[0.8,1,0.2,1],[0.2,1,0,0.8],[0,0.8,0,0.2],[0,0.2,0.2,0],[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,0.4],[1,0.4,0.8,0.5],[0.8,0.5,0,0.5]],
  '7': [[0,1,1,1],[1,1,0.3,0]],
  '8': [[0.2,0.5,0,0.6],[0,0.6,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.6],[1,0.6,0.8,0.5],[0.8,0.5,0.2,0.5],[0.2,0.5,0,0.4],[0,0.4,0,0.2],[0,0.2,0.2,0],[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,0.4],[1,0.4,0.8,0.5]],
  '9': [[1,0.5,0.2,0.5],[0.2,0.5,0,0.6],[0,0.6,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0]],
  ' ': [],
  '.': [[0.4,0,0.6,0],[0.6,0,0.6,0.1],[0.6,0.1,0.4,0.1],[0.4,0.1,0.4,0]],
  ',': [[0.5,0,0.4,-0.2]],
  '-': [[0.2,0.5,0.8,0.5]],
  '_': [[0,0,1,0]],
  '!': [[0.5,0.3,0.5,1],[0.4,0,0.6,0],[0.6,0,0.6,0.1],[0.6,0.1,0.4,0.1],[0.4,0.1,0.4,0]],
  '?': [[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.6],[1,0.6,0.5,0.4],[0.5,0.4,0.5,0.25],[0.4,0,0.6,0],[0.6,0,0.6,0.1],[0.6,0.1,0.4,0.1],[0.4,0.1,0.4,0]],
  ':': [[0.4,0.6,0.6,0.6],[0.6,0.6,0.6,0.7],[0.6,0.7,0.4,0.7],[0.4,0.7,0.4,0.6],[0.4,0.1,0.6,0.1],[0.6,0.1,0.6,0.2],[0.6,0.2,0.4,0.2],[0.4,0.2,0.4,0.1]],
  '/': [[0,0,1,1]],
  '@': [[0.8,0.3,0.6,0.3],[0.6,0.3,0.5,0.4],[0.5,0.4,0.5,0.6],[0.5,0.6,0.6,0.7],[0.6,0.7,0.8,0.7],[0.8,0.7,0.8,0.3],[0.8,0.3,1,0.3],[1,0.3,1,0.8],[1,0.8,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.8],[0,0.8,0,0.2],[0,0.2,0.2,0],[0.2,0,0.8,0],[0.8,0,1,0.2]],
  'Æ': [[0,0,0.4,1],[0.4,1,0.8,1],[0.4,1,1,0],[0.15,0.5,0.65,0.5],[0.4,0.5,0.7,0.5]],
  'Ø': [[0.2,0,0,0.2],[0,0.2,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0],[0,0,1,1]],
  'Å': [[0,0,0.5,1],[0.5,1,1,0],[0.25,0.5,0.75,0.5],[0.35,1.1,0.65,1.1],[0.65,1.1,0.65,1.3],[0.65,1.3,0.35,1.3],[0.35,1.3,0.35,1.1]],
};

/**
 * Genererer tekst som linjer
 */
function generateTextLines(text, x, y, fontSize, centered = true) {
  const lines = [];
  const charWidth = fontSize * 0.7;
  const spacing = fontSize * 0.2;
  
  const textWidth = text.length * charWidth + (text.length - 1) * spacing;
  let startX = centered ? x - textWidth / 2 : x;
  
  for (const char of text.toUpperCase()) {
    const charData = FONT_DATA[char] || FONT_DATA[' '];
    
    for (const stroke of charData) {
      lines.push({
        x1: startX + stroke[0] * charWidth,
        y1: y + stroke[1] * fontSize,
        x2: startX + stroke[2] * charWidth,
        y2: y + stroke[3] * fontSize
      });
    }
    
    startX += charWidth + spacing;
  }
  
  return lines;
}

/**
 * Genererer ramme baseret på form
 */
function generateFrame(width, height, shape, cornerRadius = 5) {
  const lines = [];
  
  if (shape === 'rectangle') {
    lines.push({ x1: 0, y1: 0, x2: width, y2: 0 });
    lines.push({ x1: width, y1: 0, x2: width, y2: height });
    lines.push({ x1: width, y1: height, x2: 0, y2: height });
    lines.push({ x1: 0, y1: height, x2: 0, y2: 0 });
  } else if (shape === 'rounded') {
    const r = Math.min(cornerRadius, width / 4, height / 4);
    // Top
    lines.push({ x1: r, y1: 0, x2: width - r, y2: 0 });
    // Right
    lines.push({ x1: width, y1: r, x2: width, y2: height - r });
    // Bottom
    lines.push({ x1: width - r, y1: height, x2: r, y2: height });
    // Left
    lines.push({ x1: 0, y1: height - r, x2: 0, y2: r });
    // Corners (simplified as lines)
    const arcSegments = 8;
    // Top-right
    for (let i = 0; i < arcSegments; i++) {
      const a1 = (Math.PI / 2) * (i / arcSegments);
      const a2 = (Math.PI / 2) * ((i + 1) / arcSegments);
      lines.push({
        x1: width - r + Math.sin(a1) * r,
        y1: r - Math.cos(a1) * r,
        x2: width - r + Math.sin(a2) * r,
        y2: r - Math.cos(a2) * r
      });
    }
    // Bottom-right
    for (let i = 0; i < arcSegments; i++) {
      const a1 = (Math.PI / 2) * (i / arcSegments) + Math.PI / 2;
      const a2 = (Math.PI / 2) * ((i + 1) / arcSegments) + Math.PI / 2;
      lines.push({
        x1: width - r + Math.sin(a1) * r,
        y1: height - r - Math.cos(a1) * r,
        x2: width - r + Math.sin(a2) * r,
        y2: height - r - Math.cos(a2) * r
      });
    }
    // Bottom-left
    for (let i = 0; i < arcSegments; i++) {
      const a1 = (Math.PI / 2) * (i / arcSegments) + Math.PI;
      const a2 = (Math.PI / 2) * ((i + 1) / arcSegments) + Math.PI;
      lines.push({
        x1: r + Math.sin(a1) * r,
        y1: height - r - Math.cos(a1) * r,
        x2: r + Math.sin(a2) * r,
        y2: height - r - Math.cos(a2) * r
      });
    }
    // Top-left
    for (let i = 0; i < arcSegments; i++) {
      const a1 = (Math.PI / 2) * (i / arcSegments) + Math.PI * 1.5;
      const a2 = (Math.PI / 2) * ((i + 1) / arcSegments) + Math.PI * 1.5;
      lines.push({
        x1: r + Math.sin(a1) * r,
        y1: r - Math.cos(a1) * r,
        x2: r + Math.sin(a2) * r,
        y2: r - Math.cos(a2) * r
      });
    }
  } else if (shape === 'oval') {
    const rx = width / 2;
    const ry = height / 2;
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      const a1 = (Math.PI * 2 * i) / segments;
      const a2 = (Math.PI * 2 * (i + 1)) / segments;
      lines.push({
        x1: rx + Math.cos(a1) * rx,
        y1: ry + Math.sin(a1) * ry,
        x2: rx + Math.cos(a2) * rx,
        y2: ry + Math.sin(a2) * ry
      });
    }
  } else if (shape === 'badge') {
    // Hexagon-lignende badge
    const points = [
      { x: width * 0.2, y: 0 },
      { x: width * 0.8, y: 0 },
      { x: width, y: height * 0.3 },
      { x: width, y: height * 0.7 },
      { x: width * 0.8, y: height },
      { x: width * 0.2, y: height },
      { x: 0, y: height * 0.7 },
      { x: 0, y: height * 0.3 },
    ];
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
  }
  
  return lines;
}

/**
 * Genererer huller
 */
function generateHoles(width, height, holePosition, holeSize) {
  const holes = [];
  const margin = holeSize + 2;
  
  if (holePosition === 'left' || holePosition === 'both') {
    holes.push({ x: margin, y: height / 2, r: holeSize / 2 });
  }
  if (holePosition === 'right' || holePosition === 'both') {
    holes.push({ x: width - margin, y: height / 2, r: holeSize / 2 });
  }
  if (holePosition === 'top') {
    holes.push({ x: width / 2, y: height - margin, r: holeSize / 2 });
  }
  if (holePosition === 'lanyard') {
    holes.push({ x: width / 2, y: height - margin, r: holeSize / 2 });
  }
  
  return holes;
}

/**
 * Genererer navneskilt preview som PNG
 */
export async function generateNametagPreviewPng(options = {}) {
  const {
    text = 'NAVN',
    subtitle = '',
    width = 80,
    height = 30,
    shape = 'rounded',
    holePosition = 'left',
    holeSize = 3,
    fontSize = 10,
    subtitleSize = 5
  } = options;

  const scale = 3;
  const padding = 10;
  const svgWidth = (width + padding * 2) * scale;
  const svgHeight = (height + padding * 2) * scale;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">`;
  svg += `<rect width="100%" height="100%" fill="#f5f5f5"/>`;
  
  // Transform gruppe
  svg += `<g transform="translate(${padding * scale}, ${padding * scale}) scale(${scale})">`;
  
  // Ramme
  const frameLines = generateFrame(width, height, shape);
  svg += `<g stroke="#333" stroke-width="0.5" fill="none">`;
  for (const line of frameLines) {
    svg += `<line x1="${line.x1}" y1="${height - line.y1}" x2="${line.x2}" y2="${height - line.y2}"/>`;
  }
  svg += `</g>`;
  
  // Huller
  const holes = generateHoles(width, height, holePosition, holeSize);
  svg += `<g fill="none" stroke="#333" stroke-width="0.5">`;
  for (const hole of holes) {
    svg += `<circle cx="${hole.x}" cy="${height - hole.y}" r="${hole.r}"/>`;
  }
  svg += `</g>`;
  
  // Tekst
  const textY = subtitle ? height * 0.6 : height * 0.5 - fontSize * 0.5;
  const textLines = generateTextLines(text, width / 2, textY, fontSize);
  svg += `<g stroke="#333" stroke-width="0.3" fill="none">`;
  for (const line of textLines) {
    svg += `<line x1="${line.x1}" y1="${height - line.y1}" x2="${line.x2}" y2="${height - line.y2}"/>`;
  }
  svg += `</g>`;
  
  // Undertekst
  if (subtitle) {
    const subY = height * 0.25;
    const subLines = generateTextLines(subtitle, width / 2, subY, subtitleSize);
    svg += `<g stroke="#666" stroke-width="0.2" fill="none">`;
    for (const line of subLines) {
      svg += `<line x1="${line.x1}" y1="${height - line.y1}" x2="${line.x2}" y2="${height - line.y2}"/>`;
    }
    svg += `</g>`;
  }
  
  svg += `</g>`;
  svg += `</svg>`;
  
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  return pngBuffer;
}

/**
 * Konverterer navneskilt til DXF
 */
export async function convertNametagToDxf(outputDir, options = {}) {
  const {
    text = 'NAVN',
    subtitle = '',
    width = 80,
    height = 30,
    shape = 'rounded',
    holePosition = 'left',
    holeSize = 3,
    fontSize = 10,
    subtitleSize = 5
  } = options;

  const dxf = new DxfWriter();
  
  // Ramme
  const frameLines = generateFrame(width, height, shape);
  for (const line of frameLines) {
    dxf.addLine(line.x1, line.y1, line.x2, line.y2, 'FRAME');
  }
  
  // Huller
  const holes = generateHoles(width, height, holePosition, holeSize);
  for (const hole of holes) {
    dxf.addCircle(hole.x, hole.y, hole.r, 'HOLES');
  }
  
  // Hovedtekst
  const textY = subtitle ? height * 0.6 : height * 0.5 - fontSize * 0.5;
  const textLines = generateTextLines(text, width / 2, textY, fontSize);
  for (const line of textLines) {
    dxf.addLine(line.x1, line.y1, line.x2, line.y2, 'TEXT');
  }
  
  // Undertekst
  if (subtitle) {
    const subY = height * 0.25;
    const subLines = generateTextLines(subtitle, width / 2, subY, subtitleSize);
    for (const line of subLines) {
      dxf.addLine(line.x1, line.y1, line.x2, line.y2, 'TEXT');
    }
  }

  // Gem DXF
  const dxfContent = dxf.generateDxf();
  const safeName = text.replace(/[^a-zA-Z0-9æøåÆØÅ]/g, '_').substring(0, 20);
  const filename = `nametag-${safeName}-${Date.now()}.dxf`;
  const outputPath = path.join(outputDir, filename);
  
  fs.writeFileSync(outputPath, dxfContent);
  
  return {
    path: outputPath,
    filename,
    width,
    height,
    text,
    subtitle
  };
}
