import potrace from 'potrace';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DxfWriter } from './dxfWriter.js';

/**
 * Konverterer et billede til DXF ved hjælp af edge detection og potrace vektorisering
 */
export async function convertImageToDxf(imagePath, outputDir, options = {}) {
  const { 
    threshold = 128, 
    scale = 1, 
    invert = false,
    mode = 'edge',  // 'edge' for fotos, 'threshold' for simpel grafik
    edgeStrength = 1,
    detail = 'medium' // 'low', 'medium', 'high'
  } = options;
  
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
    // Edge detection tilgang - meget bedre til fotografier
    // Bruger Laplacian-lignende kernel til kantdetektion
    
    // Detail level bestemmer blur og kernel styrke
    const detailSettings = {
      low: { blur: 2, kernelMultiplier: 1 },
      medium: { blur: 1, kernelMultiplier: 1.5 },
      high: { blur: 0.5, kernelMultiplier: 2 }
    };
    
    const settings = detailSettings[detail] || detailSettings.medium;
    
    // Først: let blur for at reducere støj
    if (settings.blur > 0) {
      pipeline = pipeline.blur(settings.blur);
    }
    
    // Edge detection kernel (Laplacian)
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
    
    // Normaliser og inverter (kanter bliver sorte på hvid baggrund)
    pipeline = pipeline.normalize();
    
    // Threshold for at få rene linjer
    const edgeThreshold = Math.max(20, Math.min(threshold, 200));
    pipeline = pipeline.threshold(edgeThreshold);
    
    // Inverter så kanter er sorte (det potrace foretrækker)
    if (!invert) {
      pipeline = pipeline.negate();
    }
    
  } else {
    // Standard threshold tilgang (god til logoer, tekst, simpel grafik)
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
