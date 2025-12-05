import potrace from 'potrace';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DxfWriter } from './dxfWriter.js';

/**
 * Floyd-Steinberg dithering algoritme
 * Perfekt til portræt-gravering på glas
 */
async function applyDithering(inputBuffer, options = {}) {
  const { contrast = 1.2, brightness = 0, dotSize = 1 } = options;
  
  // Hent billede data
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  
  // Juster kontrast og lysstyrke først
  let processed = image
    .grayscale()
    .modulate({ brightness: 1 + brightness / 100 })
    .linear(contrast, -(128 * contrast) + 128);
  
  const { data, info } = await processed
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const width = info.width;
  const height = info.height;
  const pixels = new Float32Array(data.length);
  
  // Kopier til float array
  for (let i = 0; i < data.length; i++) {
    pixels[i] = data[i];
  }
  
  // Floyd-Steinberg dithering
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldPixel = pixels[idx];
      const newPixel = oldPixel < 128 ? 0 : 255;
      pixels[idx] = newPixel;
      const error = oldPixel - newPixel;
      
      // Distribuer fejl til naboer
      if (x + 1 < width) {
        pixels[idx + 1] += error * 7 / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          pixels[(y + 1) * width + (x - 1)] += error * 3 / 16;
        }
        pixels[(y + 1) * width + x] += error * 5 / 16;
        if (x + 1 < width) {
          pixels[(y + 1) * width + (x + 1)] += error * 1 / 16;
        }
      }
    }
  }
  
  // Konverter tilbage til uint8
  const outputData = Buffer.alloc(data.length);
  for (let i = 0; i < pixels.length; i++) {
    outputData[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
  }
  
  // Opret output billede
  let output = sharp(outputData, {
    raw: { width, height, channels: 1 }
  });
  
  // Hvis dotSize > 1, gør punkterne større
  if (dotSize > 1) {
    const newWidth = Math.round(width / dotSize);
    const newHeight = Math.round(height / dotSize);
    output = output
      .resize(newWidth, newHeight, { kernel: 'nearest' })
      .resize(width, height, { kernel: 'nearest' });
  }
  
  return output.png().toBuffer();
}

/**
 * Genererer et preview-billede med de valgte indstillinger
 * Returnerer en PNG buffer
 */
export async function generatePreview(imagePath, options = {}) {
  const { 
    threshold = 128, 
    invert = false,
    mode = 'edge',
    edgeStrength = 1,
    detail = 'medium',
    contrast = 20,
    brightness = 0,
    dotSize = 1,
    cropX = null,
    cropY = null,
    cropWidth = null,
    cropHeight = null
  } = options;
  
  const metadata = await sharp(imagePath).metadata();
  const maxDim = 800; // Mindre størrelse til preview
  
  let pipeline = sharp(imagePath);
  
  // Anvend crop hvis koordinater er angivet (i procent)
  if (cropX !== null && cropY !== null && cropWidth !== null && cropHeight !== null) {
    const left = Math.round((cropX / 100) * metadata.width);
    const top = Math.round((cropY / 100) * metadata.height);
    const width = Math.round((cropWidth / 100) * metadata.width);
    const height = Math.round((cropHeight / 100) * metadata.height);
    
    pipeline = pipeline.extract({ left, top, width, height });
  }
  
  // Resize til preview størrelse
  const croppedMeta = await pipeline.clone().metadata();
  if (croppedMeta.width > maxDim || croppedMeta.height > maxDim) {
    pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside' });
  }
  
  // HALFTONE MODE - generer ægte halftone preview med punkter
  if (mode === 'dither') {
    return generateHalftonePreview(imagePath, {
      contrast, brightness, dotSize, invert,
      cropX, cropY, cropWidth, cropHeight
    });
  }
  
  // STRING ART MODE - linjer mellem pins i cirkel
  if (mode === 'stringart') {
    return generateStringArtPreview(imagePath, {
      numPins: 200,
      numLines: 2500,
      minDistance: 20,
      cropX, cropY, cropWidth, cropHeight
    });
  }
  
  // Konverter til grayscale for andre modes
  pipeline = pipeline.grayscale();
  
  if (mode === 'edge') {
    const detailSettings = {
      low: { blur: 2, kernelMultiplier: 1 },
      medium: { blur: 1, kernelMultiplier: 1.5 },
      high: { blur: 0.5, kernelMultiplier: 2 }
    };
    
    const settings = detailSettings[detail] || detailSettings.medium;
    
    if (settings.blur > 0) {
      pipeline = pipeline.blur(settings.blur);
    }
    
    const k = settings.kernelMultiplier * edgeStrength;
    pipeline = pipeline.convolve({
      width: 3,
      height: 3,
      kernel: [
        -k, -k, -k,
        -k, 8*k, -k,
        -k, -k, -k
      ]
    });
    
    pipeline = pipeline.normalize();
    const edgeThreshold = Math.max(20, Math.min(threshold, 200));
    pipeline = pipeline.threshold(edgeThreshold);
    
    if (!invert) {
      pipeline = pipeline.negate();
    }
  } else {
    // Threshold mode
    pipeline = pipeline.threshold(threshold);
    if (invert) {
      pipeline = pipeline.negate();
    }
  }
  
  // Returner som PNG buffer
  return pipeline.png().toBuffer();
}

/**
 * STRING ART ALGORITME v3 - OPTIMERET
 * Pre-beregner alle linjer for maksimal hastighed
 */
async function generateStringArt(imagePath, options = {}) {
  const {
    numPins = 200,
    numLines = 2500,
    minDistance = 20,
    outputWidth = 100,
    cropX = null,
    cropY = null,
    cropWidth = null,
    cropHeight = null
  } = options;
  
  // Mindre billede = hurtigere
  const size = 150;
  
  let pipeline = sharp(imagePath);
  
  if (cropX !== null && cropY !== null && cropWidth !== null && cropHeight !== null) {
    const metadata = await sharp(imagePath).metadata();
    pipeline = pipeline.extract({
      left: Math.round((cropX / 100) * metadata.width),
      top: Math.round((cropY / 100) * metadata.height),
      width: Math.round((cropWidth / 100) * metadata.width),
      height: Math.round((cropHeight / 100) * metadata.height)
    });
  }
  
  const { data } = await pipeline
    .resize(size, size, { fit: 'cover' })
    .grayscale()
    .normalize()
    // Høj kontrast for tydelige områder
    .linear(1.8, -50)
    .negate() // Mørke = høje værdier
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  // Billeddata som array
  const imageData = new Float32Array(data);
  
  // Pin positioner
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) - 2;
  
  const pins = [];
  for (let i = 0; i < numPins; i++) {
    const angle = (2 * Math.PI * i) / numPins;
    pins.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  }
  
  // PRE-BEREGN alle linje-pixels (den store optimering!)
  // Dette gøres kun én gang og gemmes i et Map
  const lineCache = new Map();
  
  function getLineKey(p1, p2) {
    return p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
  }
  
  function getLinePixels(pin1, pin2) {
    const key = getLineKey(pin1, pin2);
    if (lineCache.has(key)) return lineCache.get(key);
    
    const x0 = pins[pin1].x, y0 = pins[pin1].y;
    const x1 = pins[pin2].x, y1 = pins[pin2].y;
    const pixels = [];
    
    // Simpel linje-algoritme
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x0 + t * (x1 - x0));
      const y = Math.round(y0 + t * (y1 - y0));
      if (x >= 0 && x < size && y >= 0 && y < size) {
        pixels.push(y * size + x);
      }
    }
    
    lineCache.set(key, pixels);
    return pixels;
  }
  
  // Pre-beregn ALLE linjer der respekterer minDistance
  for (let i = 0; i < numPins; i++) {
    for (let j = i + minDistance; j < numPins - minDistance; j++) {
      getLinePixels(i, j);
    }
  }
  
  // Hovedalgoritme - nu MEGET hurtigere med cached linjer
  const lines = [];
  let currentPin = 0;
  
  for (let lineNum = 0; lineNum < numLines; lineNum++) {
    let bestPin = -1;
    let bestScore = -1;
    
    // Tjek alle gyldige pins
    for (let i = minDistance; i < numPins - minDistance; i++) {
      const candidatePin = (currentPin + i) % numPins;
      const pixels = getLinePixels(currentPin, candidatePin);
      
      // Beregn score direkte fra cache
      let score = 0;
      for (const idx of pixels) {
        score += imageData[idx];
      }
      score /= pixels.length;
      
      if (score > bestScore) {
        bestScore = score;
        bestPin = candidatePin;
      }
    }
    
    if (bestPin === -1 || bestScore < 1) break; // Lavere grænse = flere linjer
    
    // Træk linje fra billede og beregn tykkelse
    const pixels = getLinePixels(currentPin, bestPin);
    let darkness = 0;
    for (const idx of pixels) {
      darkness += imageData[idx];
      imageData[idx] = Math.max(0, imageData[idx] - 25);
    }
    const thickness = 0.3 + (darkness / pixels.length / 255) * 1.2;
    
    lines.push({ from: currentPin, to: bestPin, thickness });
    currentPin = bestPin;
  }
  
  console.log(`String Art: ${lines.length} linjer genereret`);
  
  return { lines, pins, numPins, outputWidth, size };
}

/**
 * Konverterer String Art til DXF med varierende linjetykkelse
 */
async function convertStringArtToDxf(imagePath, outputDir, options = {}) {
  const stringArt = await generateStringArt(imagePath, options);
  const { lines, pins, numPins, outputWidth, size } = stringArt;
  
  const dxf = new DxfWriter();
  
  // Skaler pins til output størrelse
  const scale = outputWidth / size;
  const scaledPins = pins.map(p => ({
    x: p.x * scale,
    y: p.y * scale
  }));
  
  // Tegn alle linjer - brug tykkelse til at tegne parallelle linjer
  for (const line of lines) {
    const p1 = scaledPins[line.from];
    const p2 = scaledPins[line.to];
    const thickness = line.thickness || 0.5;
    
    // Hovedlinje
    dxf.addLine(p1.x, p1.y, p2.x, p2.y);
    
    // Tilføj parallelle linjer for tykkere streger
    if (thickness > 0.5) {
      // Beregn vinkelret offset
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > 0) {
        const nx = -dy / len; // Normal vektor
        const ny = dx / len;
        
        const offset = 0.15 * scale; // 0.15mm offset
        const numParallel = Math.floor(thickness * 2);
        
        for (let i = 1; i <= numParallel; i++) {
          const off = offset * i * 0.5;
          dxf.addLine(p1.x + nx*off, p1.y + ny*off, p2.x + nx*off, p2.y + ny*off);
          dxf.addLine(p1.x - nx*off, p1.y - ny*off, p2.x - nx*off, p2.y - ny*off);
        }
      }
    }
  }
  
  // Tegn cirkel (ramme)
  const center = outputWidth / 2;
  const radius = (outputWidth / 2) - (5 * scale);
  dxf.addCircle(center, center, radius);
  
  const filename = `stringart-${uuidv4()}.dxf`;
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, dxf.generateDxf());
  
  console.log(`String Art DXF gemt: ${filename}`);
  
  return outputPath;
}

/**
 * Genererer String Art preview med varierende linjetykkelse
 */
async function generateStringArtPreview(imagePath, options = {}) {
  const stringArt = await generateStringArt(imagePath, options);
  const { lines, pins, size } = stringArt;
  
  const previewSize = 400;
  const scale = previewSize / size;
  
  // Skaler pins til preview størrelse
  const scaledPins = pins.map(p => ({
    x: p.x * scale,
    y: p.y * scale
  }));
  
  // Opret SVG med alle linjer
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${previewSize}" height="${previewSize}" style="background:white">`;
  
  // Tegn cirkel
  const center = previewSize / 2;
  const radius = (previewSize / 2) - (5 * scale);
  svg += `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#ccc" stroke-width="1"/>`;
  
  // Tegn alle linjer med varierende tykkelse
  for (const line of lines) {
    const p1 = scaledPins[line.from];
    const p2 = scaledPins[line.to];
    const strokeWidth = (line.thickness || 0.5) * 1.5; // Skaler tykkelse for visuel effekt
    svg += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="black" stroke-width="${strokeWidth.toFixed(2)}" stroke-opacity="0.6"/>`;
  }
  
  svg += '</svg>';
  
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Genererer halftone preview billede med ægte punkter
 * Matcher det faktiske DXF output
 */
async function generateHalftonePreview(imagePath, options = {}) {
  const {
    contrast = 20,
    brightness = 0,
    dotSize = 2,
    invert = false,
    cropX = null,
    cropY = null,
    cropWidth = null,
    cropHeight = null
  } = options;
  
  // Først crop billedet hvis nødvendigt
  let sourceImage = sharp(imagePath);
  if (cropX !== null && cropY !== null && cropWidth !== null && cropHeight !== null) {
    const metadata = await sharp(imagePath).metadata();
    const left = Math.round((cropX / 100) * metadata.width);
    const top = Math.round((cropY / 100) * metadata.height);
    const width = Math.round((cropWidth / 100) * metadata.width);
    const height = Math.round((cropHeight / 100) * metadata.height);
    sourceImage = sourceImage.extract({ left, top, width, height });
  }
  
  // Grid størrelse som i DXF
  const dotsAcross = Math.max(30, Math.round(90 / dotSize));
  
  const croppedMeta = await sourceImage.clone().metadata();
  const aspectRatio = croppedMeta.height / croppedMeta.width;
  const dotsDown = Math.round(dotsAcross * aspectRatio);
  
  // Preview størrelse - større for bedre visning
  const previewWidth = 400;
  const cellSize = previewWidth / dotsAcross;
  const previewHeight = Math.round(dotsDown * cellSize);
  
  let pipeline = sourceImage.clone();
  pipeline = pipeline.resize(dotsAcross, dotsDown, { fit: 'fill' });
  pipeline = pipeline.grayscale().normalize();
  
  if (brightness !== 0 || contrast !== 0) {
    const brightnessFactor = 1 + brightness / 100;
    const contrastFactor = 1 + contrast / 100;
    pipeline = pipeline.linear(contrastFactor, (1 - contrastFactor) * 128 + (brightnessFactor - 1) * 255);
  }
  
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  
  // Opret SVG med halftone punkter
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${previewWidth}" height="${previewHeight}" style="background:white">`;
  
  const maxRadius = cellSize * 0.5;
  const minRadius = cellSize * 0.02;
  
  for (let row = 0; row < info.height; row++) {
    for (let col = 0; col < info.width; col++) {
      const idx = row * info.width + col;
      let pixel = data[idx];
      
      if (invert) pixel = 255 - pixel;
      
      const darkness = 1.0 - (pixel / 255.0);
      if (darkness < 0.03) continue;
      
      const radius = minRadius + (maxRadius - minRadius) * darkness;
      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;
      
      svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius.toFixed(1)}" fill="black"/>`;
    }
  }
  
  svg += '</svg>';
  
  // Konverter SVG til PNG
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Konverterer billede til DXF med ÆGTE HALFTONE
 * Kopierer præcis hvad Halftoner software gør:
 * - Ordnet grid med fast spacing
 * - Punktstørrelse varierer med mørkhed
 * - Store punkter = mørkt, små punkter = lyst
 */
async function convertHalftoneToDxf(imagePath, outputDir, options = {}) {
  const { 
    invert = false,
    contrast = 20,
    brightness = 0,
    dotSize = 2,
    outputWidth = 100 // Output bredde i mm
  } = options;
  
  const dxf = new DxfWriter();
  
  // Grid størrelse som i Halftoner - ca. 50-80 punkter på bredden
  // dotSize 1 = 80 punkter, dotSize 5 = 40 punkter
  const dotsAcross = Math.max(30, Math.round(90 / dotSize));
  
  // Hent original billedstørrelse for aspect ratio
  const metadata = await sharp(imagePath).metadata();
  const aspectRatio = metadata.height / metadata.width;
  const dotsDown = Math.round(dotsAcross * aspectRatio);
  
  let pipeline = sharp(imagePath);
  
  // Resize til præcis grid størrelse
  pipeline = pipeline.resize(dotsAcross, dotsDown, { fit: 'fill' });
  
  // Billedbehandling
  pipeline = pipeline
    .grayscale()
    .normalize(); // Auto-kontrast
  
  // Juster lysstyrke og kontrast
  if (brightness !== 0 || contrast !== 0) {
    const brightnessFactor = 1 + brightness / 100;
    const contrastFactor = 1 + contrast / 100;
    pipeline = pipeline.linear(contrastFactor, (1 - contrastFactor) * 128 + (brightnessFactor - 1) * 255);
  }
  
  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const gridWidth = info.width;
  const gridHeight = info.height;
  
  // Beregn spacing mellem punkter (celle-størrelse)
  const cellSize = outputWidth / gridWidth;
  
  // Max og min radius - STOR variation som i Halftoner
  // Max radius kan være op til 70% af celle for at punkter overlapper i mørke områder
  const maxRadius = cellSize * 0.65;
  // Min radius er meget lille
  const minRadius = cellSize * 0.03;
  
  const actualHeight = gridHeight * cellSize;
  
  console.log(`=== HALFTONE GENERATION ===`);
  console.log(`Grid: ${gridWidth} x ${gridHeight} punkter`);
  console.log(`Output: ${outputWidth.toFixed(1)}mm x ${actualHeight.toFixed(1)}mm`);
  console.log(`Celle: ${cellSize.toFixed(2)}mm, Max Ø: ${(maxRadius*2).toFixed(2)}mm`);
  
  // Generer ALLE punkter i grid
  let pointCount = 0;
  let minRadiusUsed = Infinity;
  let maxRadiusUsed = 0;
  
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const idx = row * gridWidth + col;
      let pixelValue = data[idx]; // 0=sort, 255=hvid
      
      // Inverter hvis nødvendigt (til mørke materialer)
      if (invert) {
        pixelValue = 255 - pixelValue;
      }
      
      // Beregn mørkhed (0.0 = hvid, 1.0 = sort)
      const darkness = 1.0 - (pixelValue / 255.0);
      
      // Spring over næsten hvide pixels (under 3% mørke)
      if (darkness < 0.03) continue;
      
      // Beregn radius - lineært proportional med mørkhed
      const radius = minRadius + (maxRadius - minRadius) * darkness;
      
      // Track min/max for debug
      if (radius < minRadiusUsed) minRadiusUsed = radius;
      if (radius > maxRadiusUsed) maxRadiusUsed = radius;
      
      // Punkt position - centreret i celle
      const cx = col * cellSize + cellSize / 2;
      const cy = (gridHeight - 1 - row) * cellSize + cellSize / 2; // Flip Y
      
      // Tegn fyldt cirkel som spiral for at simulere fyldt punkt
      // Dette giver bedre visuel effekt i viewer OG bedre gravering
      const lineSpacing = 0.1; // 0.1mm mellem spiral-linjer
      const numRings = Math.ceil(radius / lineSpacing);
      
      // Tegn koncentriske cirkler fra ydre til center
      for (let ring = 0; ring < numRings; ring++) {
        const r = radius - (ring * lineSpacing);
        if (r > 0.02) { // Minimum radius
          dxf.addCircle(cx, cy, r);
        }
      }
      
      pointCount++;
    }
  }
  
  console.log(`Punkter: ${pointCount} (af ${gridWidth * gridHeight} mulige)`);
  console.log(`Radius range: ${minRadiusUsed.toFixed(3)}mm - ${maxRadiusUsed.toFixed(3)}mm`);
  console.log(`===========================`);
  
  const filename = `portrait-${uuidv4()}.dxf`;
  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, dxf.generateDxf());
  
  return outputPath;
}

/**
 * Konverterer et billede til DXF ved hjælp af edge detection og potrace vektorisering
 */
export async function convertImageToDxf(imagePath, outputDir, options = {}) {
  const { 
    threshold = 128, 
    scale = 1, 
    invert = false,
    mode = 'edge',
    edgeStrength = 1,
    detail = 'medium',
    contrast = 20,
    brightness = 0,
    dotSize = 1,
    outputWidth = 100
  } = options;
  
  // Dithering/Halftone mode - brug halftone for bedre resultat
  if (mode === 'dither') {
    return convertHalftoneToDxf(imagePath, outputDir, {
      invert, contrast, brightness, dotSize, outputWidth
    });
  }
  
  // String Art mode - linjer mellem pins i cirkel
  if (mode === 'stringart') {
    return convertStringArtToDxf(imagePath, outputDir, {
      numPins: 200,
      numLines: 2500,
      lineWeight: 20,
      minDistance: 20,
      outputWidth
    });
  }
  
  const tempPath = path.join(outputDir, `temp-${uuidv4()}.png`);
  
  // Hent billede dimensioner
  const metadata = await sharp(imagePath).metadata();
  const maxDim = 1500; // Max dimension for processering
  
  let pipeline = sharp(imagePath);
  
  // Resize hvis for stort (bevarer aspect ratio)
  if (metadata.width > maxDim || metadata.height > maxDim) {
    pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside' });
  }
  
  // Konverter til grayscale
  pipeline = pipeline.grayscale();
  
  if (mode === 'edge') {
    // Edge detection tilgang
    const detailSettings = {
      low: { blur: 2, kernelMultiplier: 1 },
      medium: { blur: 1, kernelMultiplier: 1.5 },
      high: { blur: 0.5, kernelMultiplier: 2 }
    };
    
    const settings = detailSettings[detail] || detailSettings.medium;
    
    if (settings.blur > 0) {
      pipeline = pipeline.blur(settings.blur);
    }
    
    const k = settings.kernelMultiplier * edgeStrength;
    pipeline = pipeline.convolve({
      width: 3,
      height: 3,
      kernel: [
        -k, -k, -k,
        -k, 8*k, -k,
        -k, -k, -k
      ]
    });
    
    pipeline = pipeline.normalize();
    const edgeThreshold = Math.max(20, Math.min(threshold, 200));
    pipeline = pipeline.threshold(edgeThreshold);
    
    if (!invert) {
      pipeline = pipeline.negate();
    }
    
  } else {
    // Standard threshold tilgang
    pipeline = pipeline.threshold(threshold);
    if (invert) {
      pipeline = pipeline.negate();
    }
  }
  
  await pipeline.toFile(tempPath);
  
  return new Promise((resolve, reject) => {
    // Potrace indstillinger baseret på detail level
    const potraceSettings = {
      low: { turdSize: 10, optTolerance: 1, alphaMax: 1 },
      medium: { turdSize: 4, optTolerance: 0.5, alphaMax: 1 },
      high: { turdSize: 2, optTolerance: 0.2, alphaMax: 1.3 }
    };
    
    const pSettings = potraceSettings[detail] || potraceSettings.medium;
    
    potrace.trace(tempPath, {
      turdSize: pSettings.turdSize,
      optTolerance: pSettings.optTolerance,
      alphaMax: pSettings.alphaMax,
      threshold: 128 // Billedet er allerede threshold'et
    }, (err, svg) => {
      // Ryd op i temp fil
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      
      if (err) {
        reject(err);
        return;
      }
      
      try {
        // Parse SVG path data og konverter til DXF
        const dxf = svgToDxf(svg, scale);
        
        const filename = `image-${uuidv4()}.dxf`;
        const outputPath = path.join(outputDir, filename);
        fs.writeFileSync(outputPath, dxf);
        
        resolve(outputPath);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

/**
 * Konverterer SVG path data til DXF format
 */
function svgToDxf(svgString, scale = 1) {
  const dxf = new DxfWriter();
  
  // Find alle path elementer
  const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
  let match;
  
  while ((match = pathRegex.exec(svgString)) !== null) {
    const pathData = match[1];
    const points = parsePathData(pathData, scale);
    
    // Tilføj polylines for hver path
    for (const polyline of points) {
      if (polyline.length >= 2) {
        dxf.addPolyline(polyline, true);
      }
    }
  }
  
  return dxf.generateDxf();
}

/**
 * Parser SVG path data til punkter
 */
function parsePathData(pathData, scale = 1) {
  const polylines = [];
  let currentPolyline = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  
  // Tokenize path data
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  
  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
    
    switch (type) {
      case 'M': // Move to absolute
        if (currentPolyline.length > 0) {
          polylines.push(currentPolyline);
          currentPolyline = [];
        }
        currentX = args[0] * scale;
        currentY = args[1] * scale;
        startX = currentX;
        startY = currentY;
        currentPolyline.push({ x: currentX, y: -currentY }); // Flip Y for DXF
        
        // Efterfølgende par er lineTo
        for (let i = 2; i < args.length; i += 2) {
          currentX = args[i] * scale;
          currentY = args[i + 1] * scale;
          currentPolyline.push({ x: currentX, y: -currentY });
        }
        break;
        
      case 'm': // Move to relative
        if (currentPolyline.length > 0) {
          polylines.push(currentPolyline);
          currentPolyline = [];
        }
        currentX += args[0] * scale;
        currentY += args[1] * scale;
        startX = currentX;
        startY = currentY;
        currentPolyline.push({ x: currentX, y: -currentY });
        
        for (let i = 2; i < args.length; i += 2) {
          currentX += args[i] * scale;
          currentY += args[i + 1] * scale;
          currentPolyline.push({ x: currentX, y: -currentY });
        }
        break;
        
      case 'L': // Line to absolute
        for (let i = 0; i < args.length; i += 2) {
          currentX = args[i] * scale;
          currentY = args[i + 1] * scale;
          currentPolyline.push({ x: currentX, y: -currentY });
        }
        break;
        
      case 'l': // Line to relative
        for (let i = 0; i < args.length; i += 2) {
          currentX += args[i] * scale;
          currentY += args[i + 1] * scale;
          currentPolyline.push({ x: currentX, y: -currentY });
        }
        break;
        
      case 'H': // Horizontal line absolute
        for (const arg of args) {
          currentX = arg * scale;
          currentPolyline.push({ x: currentX, y: -currentY });
        }
        break;
        
      case 'h': // Horizontal line relative
        for (const arg of args) {
          currentX += arg * scale;
          currentPolyline.push({ x: currentX, y: -currentY });
        }
        break;
        
      case 'V': // Vertical line absolute
        for (const arg of args) {
          currentY = arg * scale;
          currentPolyline.push({ x: currentX, y: -currentY });
        }
        break;
        
      case 'v': // Vertical line relative
        for (const arg of args) {
          currentY += arg * scale;
          currentPolyline.push({ x: currentX, y: -currentY });
        }
        break;
        
      case 'C': // Cubic bezier absolute
        for (let i = 0; i < args.length; i += 6) {
          const points = cubicBezierToPoints(
            currentX, currentY,
            args[i] * scale, args[i + 1] * scale,
            args[i + 2] * scale, args[i + 3] * scale,
            args[i + 4] * scale, args[i + 5] * scale
          );
          points.forEach(p => currentPolyline.push({ x: p.x, y: -p.y }));
          currentX = args[i + 4] * scale;
          currentY = args[i + 5] * scale;
        }
        break;
        
      case 'c': // Cubic bezier relative
        for (let i = 0; i < args.length; i += 6) {
          const points = cubicBezierToPoints(
            currentX, currentY,
            currentX + args[i] * scale, currentY + args[i + 1] * scale,
            currentX + args[i + 2] * scale, currentY + args[i + 3] * scale,
            currentX + args[i + 4] * scale, currentY + args[i + 5] * scale
          );
          points.forEach(p => currentPolyline.push({ x: p.x, y: -p.y }));
          currentX += args[i + 4] * scale;
          currentY += args[i + 5] * scale;
        }
        break;
        
      case 'Z':
      case 'z': // Close path
        if (currentPolyline.length > 0) {
          currentPolyline.push({ x: startX, y: -startY });
          polylines.push(currentPolyline);
          currentPolyline = [];
        }
        currentX = startX;
        currentY = startY;
        break;
    }
  }
  
  if (currentPolyline.length > 0) {
    polylines.push(currentPolyline);
  }
  
  return polylines;
}

/**
 * Konverterer cubic bezier kurve til linje-punkter
 */
function cubicBezierToPoints(x0, y0, x1, y1, x2, y2, x3, y3, segments = 10) {
  const points = [];
  
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
    
    points.push({ x, y });
  }
  
  return points;
}
