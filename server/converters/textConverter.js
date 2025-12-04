import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DxfWriter } from './dxfWriter.js';

/**
 * Konverterer tekst til DXF
 * Teksten bliver lavet som single-stroke font til CNC/laser brug
 */
export async function convertTextToDxf(text, outputDir, options = {}) {
  const { fontSize = 10, fontHeight = 10, spacing = 2 } = options;
  
  const dxf = new DxfWriter();
  
  // Brug vores egne stroke-baserede bogstaver
  let xOffset = 0;
  
  for (const char of text) {
    if (char === ' ') {
      xOffset += fontSize * 0.5;
      continue;
    }
    
    const charPaths = getCharacterPaths(char, fontSize, fontHeight);
    
    for (const pathPoints of charPaths) {
      const offsetPoints = pathPoints.map(p => ({
        x: p.x + xOffset,
        y: p.y
      }));
      
      if (offsetPoints.length >= 2) {
        dxf.addPolyline(offsetPoints, false);
      }
    }
    
    xOffset += getCharWidth(char, fontSize) + spacing;
  }
  
  const filename = `text-${uuidv4()}.dxf`;
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, dxf.generateDxf());
  
  return outputPath;
}

/**
 * Konverterer batch af tekster til individuelle DXF filer
 */
export async function convertBatchTextToDxf(items, outputDir, options = {}) {
  const paths = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const dxf = new DxfWriter();
    
    let xOffset = 0;
    const { fontSize = 10, fontHeight = 10, spacing = 2 } = options;
    
    for (const char of item) {
      if (char === ' ') {
        xOffset += fontSize * 0.5;
        continue;
      }
      
      const charPaths = getCharacterPaths(char, fontSize, fontHeight);
      
      for (const pathPoints of charPaths) {
        const offsetPoints = pathPoints.map(p => ({
          x: p.x + xOffset,
          y: p.y
        }));
        
        if (offsetPoints.length >= 2) {
          dxf.addPolyline(offsetPoints, false);
        }
      }
      
      xOffset += getCharWidth(char, fontSize) + spacing;
    }
    
    // Brug item som filnavn (sanitized)
    const safeName = item.replace(/[^a-zA-Z0-9æøåÆØÅ-]/g, '_').slice(0, 50);
    const filename = `${safeName}-${i + 1}.dxf`;
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, dxf.generateDxf());
    
    paths.push(outputPath);
  }
  
  return paths;
}

/**
 * Single-stroke font definition
 * Returnerer paths for hvert tegn normaliseret til fontSize
 */
function getCharacterPaths(char, fontSize, fontHeight) {
  const scale = fontHeight / 10; // Base height er 10
  const paths = FONT_DATA[char.toUpperCase()] || FONT_DATA[char] || [];
  
  return paths.map(path => 
    path.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }))
  );
}

function getCharWidth(char, fontSize) {
  const baseWidth = CHAR_WIDTHS[char.toUpperCase()] || CHAR_WIDTHS[char] || 6;
  return baseWidth * (fontSize / 10);
}

// Single-stroke font data - simple linjer der er gode til CNC/laser
const FONT_DATA = {
  'A': [
    [{ x: 0, y: 0 }, { x: 3, y: 10 }, { x: 6, y: 0 }],
    [{ x: 1.5, y: 4 }, { x: 4.5, y: 4 }]
  ],
  'B': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 5, y: 6 }, { x: 4, y: 5 }, { x: 0, y: 5 }],
    [{ x: 4, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 0, y: 0 }]
  ],
  'C': [
    [{ x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 8 }, { x: 1, y: 9 }, { x: 2, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 8 }]
  ],
  'D': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 3, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 7 }, { x: 6, y: 3 }, { x: 5, y: 1 }, { x: 3, y: 0 }, { x: 0, y: 0 }]
  ],
  'E': [
    [{ x: 6, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }, { x: 6, y: 10 }],
    [{ x: 0, y: 5 }, { x: 4, y: 5 }]
  ],
  'F': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 6, y: 10 }],
    [{ x: 0, y: 5 }, { x: 4, y: 5 }]
  ],
  'G': [
    [{ x: 6, y: 8 }, { x: 5, y: 9 }, { x: 4, y: 10 }, { x: 2, y: 10 }, { x: 1, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 4, y: 5 }]
  ],
  'H': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }],
    [{ x: 6, y: 0 }, { x: 6, y: 10 }],
    [{ x: 0, y: 5 }, { x: 6, y: 5 }]
  ],
  'I': [
    [{ x: 3, y: 0 }, { x: 3, y: 10 }],
    [{ x: 1, y: 0 }, { x: 5, y: 0 }],
    [{ x: 1, y: 10 }, { x: 5, y: 10 }]
  ],
  'J': [
    [{ x: 6, y: 10 }, { x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }]
  ],
  'K': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }],
    [{ x: 6, y: 10 }, { x: 0, y: 4 }, { x: 6, y: 0 }]
  ],
  'L': [
    [{ x: 0, y: 10 }, { x: 0, y: 0 }, { x: 6, y: 0 }]
  ],
  'M': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 3, y: 5 }, { x: 6, y: 10 }, { x: 6, y: 0 }]
  ],
  'N': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 6, y: 0 }, { x: 6, y: 10 }]
  ],
  'O': [
    [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 8 }, { x: 1, y: 9 }, { x: 2, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 8 }, { x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }]
  ],
  'P': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 8 }, { x: 6, y: 6 }, { x: 5, y: 5 }, { x: 4, y: 4 }, { x: 0, y: 4 }]
  ],
  'Q': [
    [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 8 }, { x: 1, y: 9 }, { x: 2, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 8 }, { x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }],
    [{ x: 4, y: 2 }, { x: 6, y: 0 }]
  ],
  'R': [
    [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 8 }, { x: 6, y: 6 }, { x: 5, y: 5 }, { x: 4, y: 4 }, { x: 0, y: 4 }],
    [{ x: 3, y: 4 }, { x: 6, y: 0 }]
  ],
  'S': [
    [{ x: 6, y: 8 }, { x: 5, y: 9 }, { x: 4, y: 10 }, { x: 2, y: 10 }, { x: 1, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 6 }, { x: 1, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }]
  ],
  'T': [
    [{ x: 3, y: 0 }, { x: 3, y: 10 }],
    [{ x: 0, y: 10 }, { x: 6, y: 10 }]
  ],
  'U': [
    [{ x: 0, y: 10 }, { x: 0, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 10 }]
  ],
  'V': [
    [{ x: 0, y: 10 }, { x: 3, y: 0 }, { x: 6, y: 10 }]
  ],
  'W': [
    [{ x: 0, y: 10 }, { x: 1.5, y: 0 }, { x: 3, y: 5 }, { x: 4.5, y: 0 }, { x: 6, y: 10 }]
  ],
  'X': [
    [{ x: 0, y: 0 }, { x: 6, y: 10 }],
    [{ x: 6, y: 0 }, { x: 0, y: 10 }]
  ],
  'Y': [
    [{ x: 0, y: 10 }, { x: 3, y: 5 }, { x: 6, y: 10 }],
    [{ x: 3, y: 5 }, { x: 3, y: 0 }]
  ],
  'Z': [
    [{ x: 0, y: 10 }, { x: 6, y: 10 }, { x: 0, y: 0 }, { x: 6, y: 0 }]
  ],
  // Tal
  '0': [
    [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 8 }, { x: 1, y: 9 }, { x: 2, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 8 }, { x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }],
    [{ x: 1, y: 2 }, { x: 5, y: 8 }]
  ],
  '1': [
    [{ x: 2, y: 8 }, { x: 3, y: 10 }, { x: 3, y: 0 }],
    [{ x: 1, y: 0 }, { x: 5, y: 0 }]
  ],
  '2': [
    [{ x: 0, y: 8 }, { x: 1, y: 9 }, { x: 2, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 8 }, { x: 6, y: 6 }, { x: 0, y: 0 }, { x: 6, y: 0 }]
  ],
  '3': [
    [{ x: 0, y: 10 }, { x: 6, y: 10 }, { x: 3, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }]
  ],
  '4': [
    [{ x: 4, y: 0 }, { x: 4, y: 10 }, { x: 0, y: 4 }, { x: 6, y: 4 }]
  ],
  '5': [
    [{ x: 6, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }]
  ],
  '6': [
    [{ x: 5, y: 10 }, { x: 3, y: 10 }, { x: 1, y: 9 }, { x: 0, y: 7 }, { x: 0, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 4 }, { x: 5, y: 5 }, { x: 4, y: 6 }, { x: 2, y: 6 }, { x: 1, y: 5 }, { x: 0, y: 4 }]
  ],
  '7': [
    [{ x: 0, y: 10 }, { x: 6, y: 10 }, { x: 3, y: 0 }]
  ],
  '8': [
    [{ x: 2, y: 5 }, { x: 1, y: 6 }, { x: 0, y: 7 }, { x: 0, y: 9 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 9 }, { x: 6, y: 7 }, { x: 5, y: 6 }, { x: 4, y: 5 }, { x: 2, y: 5 }],
    [{ x: 2, y: 5 }, { x: 1, y: 4 }, { x: 0, y: 3 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 1 }, { x: 6, y: 3 }, { x: 5, y: 4 }, { x: 4, y: 5 }]
  ],
  '9': [
    [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 1 }, { x: 6, y: 3 }, { x: 6, y: 8 }, { x: 5, y: 9 }, { x: 4, y: 10 }, { x: 2, y: 10 }, { x: 1, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 6 }, { x: 1, y: 5 }, { x: 2, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }]
  ],
  // Specialtegn
  '-': [
    [{ x: 1, y: 5 }, { x: 5, y: 5 }]
  ],
  '.': [
    [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }]
  ],
  ',': [
    [{ x: 3, y: 1 }, { x: 2, y: -1 }]
  ],
  ':': [
    [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 }],
    [{ x: 2, y: 7 }, { x: 3, y: 7 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 2, y: 7 }]
  ],
  '/': [
    [{ x: 0, y: 0 }, { x: 6, y: 10 }]
  ],
  // Danske bogstaver
  'Æ': [
    [{ x: 0, y: 0 }, { x: 3, y: 10 }, { x: 6, y: 10 }],
    [{ x: 3, y: 10 }, { x: 3, y: 0 }, { x: 6, y: 0 }],
    [{ x: 1.5, y: 4 }, { x: 5, y: 4 }]
  ],
  'Ø': [
    [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 8 }, { x: 1, y: 9 }, { x: 2, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 9 }, { x: 6, y: 8 }, { x: 6, y: 2 }, { x: 5, y: 1 }, { x: 4, y: 0 }, { x: 2, y: 0 }],
    [{ x: 1, y: 1 }, { x: 5, y: 9 }]
  ],
  'Å': [
    [{ x: 0, y: 0 }, { x: 3, y: 10 }, { x: 6, y: 0 }],
    [{ x: 1.5, y: 4 }, { x: 4.5, y: 4 }],
    [{ x: 2, y: 12 }, { x: 2, y: 13 }, { x: 4, y: 13 }, { x: 4, y: 12 }, { x: 2, y: 12 }]
  ]
};

const CHAR_WIDTHS = {
  'A': 6, 'B': 6, 'C': 6, 'D': 6, 'E': 6, 'F': 6, 'G': 6, 'H': 6, 'I': 6, 'J': 6,
  'K': 6, 'L': 6, 'M': 6, 'N': 6, 'O': 6, 'P': 6, 'Q': 6, 'R': 6, 'S': 6, 'T': 6,
  'U': 6, 'V': 6, 'W': 6, 'X': 6, 'Y': 6, 'Z': 6,
  '0': 6, '1': 6, '2': 6, '3': 6, '4': 6, '5': 6, '6': 6, '7': 6, '8': 6, '9': 6,
  '-': 6, '.': 4, ',': 4, ':': 4, '/': 6,
  'Æ': 8, 'Ø': 6, 'Å': 6
};
