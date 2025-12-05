/**
 * String Art Converter - Konverterer billeder til string art mønster
 * Bruger forbedret greedy algoritme med:
 * - Flere søm-former (circle, square, border)
 * - Early stopping for hurtigere beregning
 * - Line opacity for bedre overlap-kontrol
 * - JSON eksport med step-by-step instruktioner
 * 
 * Inspireret af: strandify, piellardj, myncepu string art projekter
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { DxfWriter } from './dxfWriter.js';

// Størrelser i mm
const SIZES = {
  postcard: { width: 148, height: 105, name: 'Postkort (148x105mm)', shape: 'border' },
  a5: { width: 210, height: 148, name: 'A5 (210x148mm)', shape: 'border' },
  a4: { width: 297, height: 210, name: 'A4 (297x210mm)', shape: 'border' },
  square_small: { width: 150, height: 150, name: 'Kvadrat lille (150x150mm)', shape: 'square' },
  square_medium: { width: 200, height: 200, name: 'Kvadrat medium (200x200mm)', shape: 'square' },
  square_large: { width: 250, height: 250, name: 'Kvadrat stor (250x250mm)', shape: 'square' },
  circle_small: { width: 150, height: 150, name: 'Cirkel lille (Ø150mm)', shape: 'circle' },
  circle_medium: { width: 200, height: 200, name: 'Cirkel medium (Ø200mm)', shape: 'circle' },
  circle_large: { width: 250, height: 250, name: 'Cirkel stor (Ø250mm)', shape: 'circle' },
};

// Søm-form typer
const PIN_SHAPES = {
  circle: 'Søm placeret i en cirkel',
  square: 'Søm placeret langs en firkants kanter',
  border: 'Søm placeret langs rektangulær ramme'
};

/**
 * Bresenham's line algorithm - returnerer alle pixels langs en linje
 */
function getLinePixels(x0, y0, x1, y1) {
  const pixels = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    pixels.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return pixels;
}

/**
 * Beregner søm-positioner baseret på form
 * @param {string} shape - 'circle', 'square', eller 'border'
 */
function calculatePinPositions(numPins, width, height, shape = 'circle', margin = 5) {
  const pins = [];
  const centerX = width / 2;
  const centerY = height / 2;
  
  if (shape === 'circle') {
    // Cirkulær placering
    const radius = Math.min(width, height) / 2 - margin;
    for (let i = 0; i < numPins; i++) {
      const angle = (2 * Math.PI * i) / numPins - Math.PI / 2; // Start fra top
      pins.push({
        x: Math.round(centerX + radius * Math.cos(angle)),
        y: Math.round(centerY + radius * Math.sin(angle)),
        index: i
      });
    }
  } else if (shape === 'square') {
    // Kvadratisk placering - søm langs alle 4 sider
    const size = Math.min(width, height) - margin * 2;
    const startX = centerX - size / 2;
    const startY = centerY - size / 2;
    const pinsPerSide = Math.floor(numPins / 4);
    const spacing = size / pinsPerSide;
    
    let index = 0;
    // Top side (venstre til højre)
    for (let i = 0; i < pinsPerSide; i++) {
      pins.push({ x: Math.round(startX + i * spacing), y: Math.round(startY), index: index++ });
    }
    // Højre side (top til bund)
    for (let i = 0; i < pinsPerSide; i++) {
      pins.push({ x: Math.round(startX + size), y: Math.round(startY + i * spacing), index: index++ });
    }
    // Bund side (højre til venstre)
    for (let i = 0; i < pinsPerSide; i++) {
      pins.push({ x: Math.round(startX + size - i * spacing), y: Math.round(startY + size), index: index++ });
    }
    // Venstre side (bund til top)
    for (let i = 0; i < pinsPerSide; i++) {
      pins.push({ x: Math.round(startX), y: Math.round(startY + size - i * spacing), index: index++ });
    }
  } else if (shape === 'border') {
    // Rektangulær placering - søm langs alle 4 sider med korrekt aspect ratio
    const rectWidth = width - margin * 2;
    const rectHeight = height - margin * 2;
    const perimeter = 2 * (rectWidth + rectHeight);
    const spacing = perimeter / numPins;
    
    let distance = 0;
    let index = 0;
    
    for (let i = 0; i < numPins; i++) {
      let x, y;
      const d = distance % perimeter;
      
      if (d < rectWidth) {
        // Top side
        x = margin + d;
        y = margin;
      } else if (d < rectWidth + rectHeight) {
        // Højre side
        x = margin + rectWidth;
        y = margin + (d - rectWidth);
      } else if (d < 2 * rectWidth + rectHeight) {
        // Bund side
        x = margin + rectWidth - (d - rectWidth - rectHeight);
        y = margin + rectHeight;
      } else {
        // Venstre side
        x = margin;
        y = margin + rectHeight - (d - 2 * rectWidth - rectHeight);
      }
      
      pins.push({ x: Math.round(x), y: Math.round(y), index: index++ });
      distance += spacing;
    }
  }
  
  return pins;
}

/**
 * Pre-beregner alle mulige linjer mellem søm
 * @param {number} minPinDistance - Minimum antal søm mellem forbundne søm
 */
function precomputeLines(pins, width, height, minPinDistance = 10) {
  const lines = new Map();
  
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const pin1 = pins[i];
      const pin2 = pins[j];
      
      // Spring over søm der er for tæt på hinanden
      const distance = Math.abs(i - j);
      const minDist = Math.min(distance, pins.length - distance);
      if (minDist < minPinDistance) continue;
      
      const pixels = getLinePixels(pin1.x, pin1.y, pin2.x, pin2.y)
        .filter(p => p.x >= 0 && p.x < width && p.y >= 0 && p.y < height);
      
      const key = `${i}-${j}`;
      lines.set(key, {
        pin1: i,
        pin2: j,
        pixels: pixels
      });
    }
  }
  
  return lines;
}

/**
 * Beregner linje-score (gabrieleballetti metode)
 * 
 * score = sum(original.pixel + (255 - draft.pixel)) / distance
 * - original = mål-billede (mørk = lav værdi)
 * - draft = hvad vi har tegnet (starter hvid 255, mørknes)
 * - Lavere score = bedre (mørkt mål + lite tegnet)
 */
function getLineScore(line, originalImage, draftImage, width) {
  let score = 0;
  
  for (const pixel of line.pixels) {
    const idx = pixel.y * width + pixel.x;
    const original = originalImage[idx];  // Mål (0=sort, 255=hvid)
    const draft = draftImage[idx];        // Tegnet (starter 255, mørknes)
    
    // Score = hvor mørkt målet er + hvor lidt vi har tegnet
    score += original + (255 - draft);
  }
  
  // Normaliser med linje-længde
  return score / line.pixels.length;
}

/**
 * Tegn linje på draft ved at mørkne pixels
 * value = current * (1 - opacity)
 */
function drawLine(line, draftImage, width, opacity) {
  for (const pixel of line.pixels) {
    const idx = pixel.y * width + pixel.x;
    draftImage[idx] = draftImage[idx] * (1 - opacity);
  }
}

/**
 * Hovedalgoritme - genererer string art
 * Forbedret med:
 * - Flere søm-former (circle, square, border)
 * - Early stopping
 * - Line opacity kontrol
 * - Konfigurerbar minPinDistance
 */
async function generateStringArt(imagePath, options = {}) {
  const {
    numPins = 200,
    numLines = 4000,
    size = 'circle_medium',
    minPinDistance = 10,       // Minimum afstand mellem pins (hookSkip)
    // Crop koordinater (i procent)
    cropX = null,
    cropY = null,
    cropWidth = null,
    cropHeight = null
  } = options;

  // Hent størrelse og form
  const sizeConfig = SIZES[size] || SIZES.circle_medium;
  const outputWidth = sizeConfig.width;
  const outputHeight = sizeConfig.height;
  const shape = sizeConfig.shape || 'circle';

  // Beregn intern arbejds-opløsning (pixels)
  const workResolution = 500;
  const aspectRatio = outputHeight / outputWidth;
  const workWidth = workResolution;
  const workHeight = Math.round(workResolution * aspectRatio);

  // Indlæs og forbehandle billede
  let image = sharp(imagePath);
  
  // Hvis crop er defineret, beskær billedet først
  if (cropX !== null && cropY !== null && cropWidth !== null && cropHeight !== null) {
    const metadata = await image.metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;
    
    const extractLeft = Math.round((cropX / 100) * imgWidth);
    const extractTop = Math.round((cropY / 100) * imgHeight);
    const extractWidth = Math.round((cropWidth / 100) * imgWidth);
    const extractHeight = Math.round((cropHeight / 100) * imgHeight);
    
    if (extractWidth > 0 && extractHeight > 0) {
      image = image.extract({
        left: Math.max(0, extractLeft),
        top: Math.max(0, extractTop),
        width: Math.min(extractWidth, imgWidth - extractLeft),
        height: Math.min(extractHeight, imgHeight - extractTop)
      });
      console.log(`Billede beskåret: ${extractWidth}x${extractHeight} fra (${extractLeft}, ${extractTop})`);
    }
  }

  // Resize og konverter til gråtone - SIMPELT uden ekstra processing
  const processedBuffer = await image
    .resize(workWidth, workHeight, { fit: 'cover' })
    .greyscale()
    .raw()
    .toBuffer();

  // Original billede (mål) - direkte fra buffer
  const originalImage = new Float32Array(workWidth * workHeight);
  for (let i = 0; i < processedBuffer.length; i++) {
    originalImage[i] = processedBuffer[i];
  }
  
  // Draft billede - starter HVID (255), mørknes når vi tegner
  const draftImage = new Float32Array(workWidth * workHeight).fill(255);
  
  // Opacity for hver linje (højere = mere synlige linjer)
  const draftOpacity = 0.2;
  
  // Threshold for at stoppe (højere = flere linjer) 
  // 300+ giver mange linjer, 250 stopper tidligere
  const threshold = 320;

  // Beregn søm-positioner baseret på form
  console.log(`Beregner ${numPins} søm-positioner (${shape})...`);
  const pins = calculatePinPositions(numPins, workWidth, workHeight, shape, 5);

  // Pre-beregn alle linjer
  console.log(`Pre-beregner linjer...`);
  const allLines = precomputeLines(pins, workWidth, workHeight, minPinDistance);
  console.log(`${allLines.size} mulige linjer beregnet`);

  // GABRIELEBALLETTI ALGORITME
  // 1. Følg tråden fra pin til pin
  // 2. Find linjen med LAVEST score (mørkt mål + lite tegnet)
  // 3. Tegn linjen ved at mørkne draft
  // 4. Stop når score > threshold
  
  const selectedLines = [];
  const adjacency = {}; // Marker brugte forbindelser
  let currentPin = 0;

  console.log(`Genererer op til ${numLines} linjer (gabrieleballetti metode)...`);
  const startTime = Date.now();

  for (let lineNum = 0; lineNum < numLines; lineNum++) {
    let bestLine = null;
    let bestTargetPin = -1;
    let bestScore = Infinity;

    // Find bedste linje fra currentPin til alle andre pins
    for (let targetPin = 0; targetPin < pins.length; targetPin++) {
      if (targetPin === currentPin) continue;
      
      // Check om forbindelsen allerede er brugt
      if (adjacency[currentPin]?.[targetPin]) continue;
      
      const pin1 = Math.min(currentPin, targetPin);
      const pin2 = Math.max(currentPin, targetPin);
      const key = `${pin1}-${pin2}`;
      
      const line = allLines.get(key);
      if (!line || line.pixels.length === 0) continue;
      
      // Beregn score (lavere = bedre)
      const score = getLineScore(line, originalImage, draftImage, workWidth);
      
      if (score < bestScore) {
        bestScore = score;
        bestLine = line;
        bestTargetPin = targetPin;
      }
    }

    // Stop hvis ingen linje fundet eller score over threshold
    if (!bestLine || bestScore >= threshold) {
      console.log(`Stopper ved linje ${lineNum} - bestScore: ${bestScore?.toFixed(1)}, threshold: ${threshold}`);
      break;
    }

    // Marker forbindelsen som brugt (begge retninger)
    if (!adjacency[currentPin]) adjacency[currentPin] = {};
    if (!adjacency[bestTargetPin]) adjacency[bestTargetPin] = {};
    adjacency[currentPin][bestTargetPin] = true;
    adjacency[bestTargetPin][currentPin] = true;
    
    // Tegn linjen på draft (mørkner pixels)
    drawLine(bestLine, draftImage, workWidth, draftOpacity);
    
    selectedLines.push({
      pin1: bestLine.pin1,
      pin2: bestLine.pin2,
      step: lineNum + 1
    });

    // Flyt til næste pin
    currentPin = bestTargetPin;

    // Progress log
    if ((lineNum + 1) % 500 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`  ${lineNum + 1}/${numLines} linjer (${elapsed.toFixed(1)}s, score: ${bestScore.toFixed(1)})`);
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`Færdig! ${selectedLines.length} linjer genereret på ${totalTime.toFixed(1)}s`);

  // Konverter til output-koordinater (mm)
  const scaleX = outputWidth / workWidth;
  const scaleY = outputHeight / workHeight;

  const outputPins = pins.map(pin => ({
    x: pin.x * scaleX,
    y: (workHeight - pin.y) * scaleY,
    index: pin.index
  }));

  const outputLines = selectedLines.map(line => ({
    pin1: line.pin1,
    pin2: line.pin2,
    step: line.step,
    x1: outputPins[line.pin1].x,
    y1: outputPins[line.pin1].y,
    x2: outputPins[line.pin2].x,
    y2: outputPins[line.pin2].y
  }));

  // Generer step-by-step instruktioner
  const instructions = selectedLines.map((line, idx) => 
    `${idx + 1}. Fra søm ${line.pin1} til søm ${line.pin2}`
  );

  return {
    pins: outputPins,
    lines: outputLines,
    instructions,
    width: outputWidth,
    height: outputHeight,
    shape,
    stats: {
      numPins: pins.length,
      numLines: selectedLines.length,
      totalTime,
      shape
    }
  };
}

/**
 * Genererer preview som SVG
 */
export async function generateStringArtPreview(imagePath, options = {}) {
  const result = await generateStringArt(imagePath, options);
  
  const { pins, lines, width, height, shape } = result;
  const padding = 10;
  const svgWidth = width + padding * 2;
  const svgHeight = height + padding * 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">`;
  
  // Baggrund
  svg += `<rect width="100%" height="100%" fill="white"/>`;
  
  // Ramme baseret på form
  if (shape === 'circle') {
    const cx = svgWidth / 2;
    const cy = svgHeight / 2;
    const r = Math.min(width, height) / 2;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ccc" stroke-width="0.5"/>`;
  } else if (shape === 'square') {
    const size = Math.min(width, height);
    const startX = padding + (width - size) / 2;
    const startY = padding + (height - size) / 2;
    svg += `<rect x="${startX}" y="${startY}" width="${size}" height="${size}" fill="none" stroke="#ccc" stroke-width="0.5"/>`;
  } else {
    svg += `<rect x="${padding}" y="${padding}" width="${width}" height="${height}" fill="none" stroke="#ccc" stroke-width="0.5"/>`;
  }

  // Tegn linjer
  svg += `<g stroke="black" stroke-width="0.15" stroke-opacity="0.6">`;
  for (const line of lines) {
    svg += `<line x1="${line.x1 + padding}" y1="${svgHeight - line.y1 - padding}" x2="${line.x2 + padding}" y2="${svgHeight - line.y2 - padding}"/>`;
  }
  svg += `</g>`;

  // Tegn søm som små prikker
  svg += `<g fill="#333">`;
  for (const pin of pins) {
    svg += `<circle cx="${pin.x + padding}" cy="${svgHeight - pin.y - padding}" r="0.8"/>`;
  }
  svg += `</g>`;

  svg += `</svg>`;

  return {
    svg,
    stats: result.stats,
    result // Inkluder hele resultatet for JSON eksport
  };
}

/**
 * Genererer preview som PNG buffer
 */
export async function generateStringArtPreviewPng(imagePath, options = {}) {
  const { svg, stats } = await generateStringArtPreview(imagePath, options);
  
  // Konverter SVG til PNG med sharp
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(800, 800, { fit: 'inside' })
    .png()
    .toBuffer();

  return { buffer: pngBuffer, stats };
}

/**
 * Konverterer til DXF
 */
export async function convertStringArtToDxf(imagePath, outputDir, options = {}) {
  const result = await generateStringArt(imagePath, options);
  
  const { pins, lines, width, height, shape, instructions } = result;
  const dxf = new DxfWriter();

  // Tilføj ramme baseret på form
  if (shape === 'circle') {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2;
    dxf.addCircle(cx, cy, radius, 'FRAME');
  } else if (shape === 'square') {
    const size = Math.min(width, height);
    const startX = (width - size) / 2;
    const startY = (height - size) / 2;
    dxf.addLine(startX, startY, startX + size, startY, 'FRAME');
    dxf.addLine(startX + size, startY, startX + size, startY + size, 'FRAME');
    dxf.addLine(startX + size, startY + size, startX, startY + size, 'FRAME');
    dxf.addLine(startX, startY + size, startX, startY, 'FRAME');
  } else {
    // Rektangulær ramme (border)
    dxf.addLine(0, 0, width, 0, 'FRAME');
    dxf.addLine(width, 0, width, height, 'FRAME');
    dxf.addLine(width, height, 0, height, 'FRAME');
    dxf.addLine(0, height, 0, 0, 'FRAME');
  }

  // Tilføj søm-markeringer (små cirkler)
  for (const pin of pins) {
    dxf.addCircle(pin.x, pin.y, 0.5, 'PINS');
  }

  // Tilføj alle linjer
  for (const line of lines) {
    dxf.addLine(line.x1, line.y1, line.x2, line.y2, 'STRINGS');
  }

  // Generer og gem DXF
  const dxfContent = dxf.generateDxf();
  const timestamp = Date.now();
  const filename = `stringart-${timestamp}.dxf`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, dxfContent);

  return {
    path: outputPath,
    stats: result.stats,
    instructions
  };
}

/**
 * Eksporterer string art data som JSON med instruktioner
 */
export async function exportStringArtJson(imagePath, outputDir, options = {}) {
  const result = await generateStringArt(imagePath, options);
  
  const timestamp = Date.now();
  
  // JSON data fil
  const jsonData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      width: result.width,
      height: result.height,
      shape: result.shape,
      stats: result.stats
    },
    pins: result.pins.map(p => ({
      index: p.index,
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100
    })),
    path: result.lines.map(l => l.pin1), // Kun pin-indekser for kompakt format
    fullPath: result.lines.map(l => ({
      step: l.step,
      from: l.pin1,
      to: l.pin2
    }))
  };
  
  const jsonFilename = `stringart-${timestamp}.json`;
  const jsonPath = path.join(outputDir, jsonFilename);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

  // Instruktionsfil (læsbar tekst)
  let instructionsText = `STRING ART INSTRUKTIONER
========================
Genereret: ${new Date().toLocaleString('da-DK')}
Størrelse: ${result.width}mm x ${result.height}mm
Form: ${result.shape}
Antal søm: ${result.stats.numPins}
Antal linjer: ${result.stats.numLines}

SØM-POSITIONER (i mm fra nederste venstre hjørne):
`;
  
  for (const pin of result.pins) {
    instructionsText += `  Søm ${pin.index}: (${pin.x.toFixed(1)}, ${pin.y.toFixed(1)})\n`;
  }

  instructionsText += `
TRÅD-INSTRUKTIONER:
Start ved søm 0 og følg trinene:
`;

  for (const instruction of result.instructions) {
    instructionsText += `  ${instruction}\n`;
  }

  const txtFilename = `stringart-${timestamp}-instructions.txt`;
  const txtPath = path.join(outputDir, txtFilename);
  fs.writeFileSync(txtPath, instructionsText);

  return {
    jsonPath,
    txtPath,
    stats: result.stats
  };
}

// Eksporter størrelser og former for frontend
export const STRING_ART_SIZES = SIZES;
export const STRING_ART_SHAPES = PIN_SHAPES;
