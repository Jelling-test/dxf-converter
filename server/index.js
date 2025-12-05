import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { convertImageToDxf } from './converters/imageConverter.js';
import { generateStringArtPreview, generateStringArtPreviewPng, convertStringArtToDxf, exportStringArtJson } from './converters/stringArtConverter.js';
import { convertTextToDxf, convertBatchTextToDxf } from './converters/textConverter.js';
import { generateQRCodePng, convertQRCodeToDxf } from './converters/qrCodeConverter.js';
import { generatePuzzlePreviewPng, convertPuzzleToDxf } from './converters/puzzleConverter.js';
import { generateNametagPreviewPng, convertNametagToDxf } from './converters/nametagConverter.js';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Opret uploads og output mapper
const uploadsDir = path.join(__dirname, '../uploads');
const outputDir = path.join(__dirname, '../output');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Multer konfiguration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// API Routes

// Preview billede med indstillinger (returnerer PNG)
app.post('/api/preview/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil uploadet' });
    }

    const { generatePreview } = await import('./converters/imageConverter.js');
    
    const options = {
      threshold: parseInt(req.body.threshold) || 128,
      invert: req.body.invert === 'true',
      mode: req.body.mode || 'edge',
      edgeStrength: parseFloat(req.body.edgeStrength) || 1,
      detail: req.body.detail || 'medium',
      contrast: parseInt(req.body.contrast) || 20,
      brightness: parseInt(req.body.brightness) || 0,
      dotSize: parseInt(req.body.dotSize) || 1,
      // Crop koordinater (i procent)
      cropX: req.body.cropX ? parseFloat(req.body.cropX) : null,
      cropY: req.body.cropY ? parseFloat(req.body.cropY) : null,
      cropWidth: req.body.cropWidth ? parseFloat(req.body.cropWidth) : null,
      cropHeight: req.body.cropHeight ? parseFloat(req.body.cropHeight) : null
    };

    const previewBuffer = await generatePreview(req.file.path, options);
    
    // Slet uploaded fil efter preview
    fs.unlinkSync(req.file.path);
    
    res.set('Content-Type', 'image/png');
    res.send(previewBuffer);
  } catch (error) {
    console.error('Fejl ved preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Konverter billede til DXF
app.post('/api/convert/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil uploadet' });
    }

    const options = {
      threshold: parseInt(req.body.threshold) || 128,
      scale: parseFloat(req.body.scale) || 1,
      invert: req.body.invert === 'true',
      mode: req.body.mode || 'edge',
      edgeStrength: parseFloat(req.body.edgeStrength) || 1,
      detail: req.body.detail || 'medium',
      contrast: parseInt(req.body.contrast) || 20,
      brightness: parseInt(req.body.brightness) || 0,
      dotSize: parseInt(req.body.dotSize) || 1,
      outputWidth: parseInt(req.body.outputWidth) || 100, // Output bredde i mm
      // Crop koordinater (i procent)
      cropX: req.body.cropX ? parseFloat(req.body.cropX) : null,
      cropY: req.body.cropY ? parseFloat(req.body.cropY) : null,
      cropWidth: req.body.cropWidth ? parseFloat(req.body.cropWidth) : null,
      cropHeight: req.body.cropHeight ? parseFloat(req.body.cropHeight) : null
    };

    const dxfPath = await convertImageToDxf(req.file.path, outputDir, options);
    const filename = path.basename(dxfPath);
    
    res.json({ 
      success: true, 
      filename,
      downloadUrl: `/api/download/${filename}`
    });
  } catch (error) {
    console.error('Fejl ved billede konvertering:', error);
    res.status(500).json({ error: error.message });
  }
});

// Konverter tekst til DXF
app.post('/api/convert/text', async (req, res) => {
  try {
    const { text, fontSize, fontHeight, spacing } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Ingen tekst angivet' });
    }

    const options = {
      fontSize: parseFloat(fontSize) || 10,
      fontHeight: parseFloat(fontHeight) || 10,
      spacing: parseFloat(spacing) || 2
    };

    const dxfPath = await convertTextToDxf(text, outputDir, options);
    const filename = path.basename(dxfPath);
    
    res.json({ 
      success: true, 
      filename,
      downloadUrl: `/api/download/${filename}`
    });
  } catch (error) {
    console.error('Fejl ved tekst konvertering:', error);
    res.status(500).json({ error: error.message });
  }
});

// Konverter batch tekst (separeret fil) til multiple DXF filer
app.post('/api/convert/batch', upload.single('file'), async (req, res) => {
  try {
    const separator = req.body.separator || '\n';
    const prefix = req.body.prefix || '';
    const suffix = req.body.suffix || '';
    const generateRange = req.body.generateRange === 'true';
    const rangeStart = parseInt(req.body.rangeStart) || 1;
    const rangeEnd = parseInt(req.body.rangeEnd) || 100;

    let items = [];

    if (generateRange) {
      // Generer numre fra start til slut
      for (let i = rangeStart; i <= rangeEnd; i++) {
        items.push(`${prefix}${i}${suffix}`);
      }
    } else if (req.file) {
      // Læs fra uploadet fil
      const content = fs.readFileSync(req.file.path, 'utf-8');
      items = content.split(separator).map(item => `${prefix}${item.trim()}${suffix}`).filter(item => item.trim());
    } else if (req.body.items) {
      // Direkte items fra body
      items = JSON.parse(req.body.items).map(item => `${prefix}${item}${suffix}`);
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'Ingen elementer at konvertere' });
    }

    const options = {
      fontSize: parseFloat(req.body.fontSize) || 10,
      fontHeight: parseFloat(req.body.fontHeight) || 10,
      spacing: parseFloat(req.body.spacing) || 2
    };

    const dxfPaths = await convertBatchTextToDxf(items, outputDir, options);
    
    // Opret ZIP fil med alle DXF filer
    const zipFilename = `batch-${uuidv4()}.zip`;
    const zipPath = path.join(outputDir, zipFilename);
    
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.pipe(output);
    
    for (const dxfPath of dxfPaths) {
      archive.file(dxfPath, { name: path.basename(dxfPath) });
    }
    
    await archive.finalize();
    
    // Vent på at zip er færdig
    await new Promise((resolve) => output.on('close', resolve));
    
    res.json({ 
      success: true, 
      count: items.length,
      filename: zipFilename,
      downloadUrl: `/api/download/${zipFilename}`
    });
  } catch (error) {
    console.error('Fejl ved batch konvertering:', error);
    res.status(500).json({ error: error.message });
  }
});

// Preview string art (returnerer PNG)
app.post('/api/preview/stringart', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil uploadet' });
    }

    const options = {
      size: req.body.size || 'circle_medium',
      numPins: parseInt(req.body.numPins) || 200,
      numLines: parseInt(req.body.numLines) || 3000,
      lineWeight: parseFloat(req.body.lineWeight) || 1,
      lineOpacity: parseFloat(req.body.lineOpacity) || 0.1,
      minPinDistance: parseInt(req.body.minPinDistance) || 10,
      earlyStopThreshold: 100,
      // Crop koordinater
      cropX: req.body.cropX ? parseFloat(req.body.cropX) : null,
      cropY: req.body.cropY ? parseFloat(req.body.cropY) : null,
      cropWidth: req.body.cropWidth ? parseFloat(req.body.cropWidth) : null,
      cropHeight: req.body.cropHeight ? parseFloat(req.body.cropHeight) : null
    };

    console.log('Genererer string art preview med options:', options);

    const { buffer, stats } = await generateStringArtPreviewPng(req.file.path, options);
    
    fs.unlinkSync(req.file.path);
    
    res.set('X-StringArt-Stats', JSON.stringify(stats));
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Fejl ved string art preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Hent string art guide data (sekvens og pin positioner)
app.post('/api/stringart/guide-data', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil uploadet' });
    }

    const options = {
      size: req.body.size || 'circle_medium',
      numPins: parseInt(req.body.numPins) || 200,
      numLines: parseInt(req.body.numLines) || 3000,
      minPinDistance: parseInt(req.body.minPinDistance) || 10,
      cropX: req.body.cropX ? parseFloat(req.body.cropX) : null,
      cropY: req.body.cropY ? parseFloat(req.body.cropY) : null,
      cropWidth: req.body.cropWidth ? parseFloat(req.body.cropWidth) : null,
      cropHeight: req.body.cropHeight ? parseFloat(req.body.cropHeight) : null
    };

    console.log('Genererer guide data med options:', options);

    const { svg, stats, result } = await generateStringArtPreview(req.file.path, options);
    
    fs.unlinkSync(req.file.path);
    
    // Byg sekvens fra linjer (rækkefølge af søm-numre)
    const sequence = [];
    if (result.lines && result.lines.length > 0) {
      // Start med første linjes pin1
      sequence.push(result.lines[0].pin1);
      for (const line of result.lines) {
        sequence.push(line.pin2);
      }
    }
    
    res.json({
      success: true,
      sequence,
      pins: result.pins,
      stats,
      totalLines: result.lines.length
    });
  } catch (error) {
    console.error('Fejl ved generering af guide data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Konverter billede til String Art DXF
app.post('/api/convert/stringart', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil uploadet' });
    }

    const options = {
      size: req.body.size || 'circle_medium',
      numPins: parseInt(req.body.numPins) || 200,
      numLines: parseInt(req.body.numLines) || 3500,
      lineWeight: parseFloat(req.body.lineWeight) || 1,
      lineOpacity: parseFloat(req.body.lineOpacity) || 0.1,
      minPinDistance: parseInt(req.body.minPinDistance) || 10,
      earlyStopThreshold: parseInt(req.body.earlyStopThreshold) || 50,
      cropX: req.body.cropX ? parseFloat(req.body.cropX) : null,
      cropY: req.body.cropY ? parseFloat(req.body.cropY) : null,
      cropWidth: req.body.cropWidth ? parseFloat(req.body.cropWidth) : null,
      cropHeight: req.body.cropHeight ? parseFloat(req.body.cropHeight) : null
    };

    console.log('Genererer string art DXF med options:', options);

    const result = await convertStringArtToDxf(req.file.path, outputDir, options);
    const filename = path.basename(result.path);
    
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      filename,
      downloadUrl: `/api/download/${filename}`,
      stats: result.stats
    });
  } catch (error) {
    console.error('Fejl ved string art konvertering:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eksporter string art som JSON med instruktioner
app.post('/api/export/stringart-json', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil uploadet' });
    }

    const options = {
      size: req.body.size || 'circle_medium',
      numPins: parseInt(req.body.numPins) || 200,
      numLines: parseInt(req.body.numLines) || 3500,
      lineWeight: parseFloat(req.body.lineWeight) || 1,
      lineOpacity: parseFloat(req.body.lineOpacity) || 0.1,
      minPinDistance: parseInt(req.body.minPinDistance) || 10,
      cropX: req.body.cropX ? parseFloat(req.body.cropX) : null,
      cropY: req.body.cropY ? parseFloat(req.body.cropY) : null,
      cropWidth: req.body.cropWidth ? parseFloat(req.body.cropWidth) : null,
      cropHeight: req.body.cropHeight ? parseFloat(req.body.cropHeight) : null
    };

    console.log('Eksporterer string art JSON med options:', options);

    const result = await exportStringArtJson(req.file.path, outputDir, options);
    
    fs.unlinkSync(req.file.path);
    
    // Opret ZIP med begge filer
    const zipFilename = `stringart-instructions-${Date.now()}.zip`;
    const zipPath = path.join(outputDir, zipFilename);
    
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.pipe(output);
    archive.file(result.jsonPath, { name: path.basename(result.jsonPath) });
    archive.file(result.txtPath, { name: path.basename(result.txtPath) });
    
    await archive.finalize();
    await new Promise((resolve) => output.on('close', resolve));
    
    res.json({ 
      success: true, 
      filename: zipFilename,
      downloadUrl: `/api/download/${zipFilename}`,
      stats: result.stats
    });
  } catch (error) {
    console.error('Fejl ved string art JSON eksport:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download fil
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(outputDir, filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Fil ikke fundet' });
  }
  
  res.download(filepath);
});

// ==================== QR-KODE ENDPOINTS ====================

// Preview QR-kode som PNG
app.post('/api/preview/qrcode', express.json(), async (req, res) => {
  try {
    const { type, data, size = 400 } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ error: 'Type og data er påkrævet' });
    }

    console.log(`Genererer QR-kode preview: type=${type}`);

    const result = await generateQRCodePng(type, data, { size });
    
    res.set('Content-Type', 'image/png');
    res.set('X-QR-Data', encodeURIComponent(result.data));
    res.send(result.buffer);
  } catch (error) {
    console.error('Fejl ved QR-kode preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Konverter QR-kode til DXF
app.post('/api/convert/qrcode', express.json(), async (req, res) => {
  try {
    const { type, data, size = 50 } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ error: 'Type og data er påkrævet' });
    }

    console.log(`Konverterer QR-kode til DXF: type=${type}, size=${size}mm`);

    const result = await convertQRCodeToDxf(type, data, outputDir, { size });
    
    res.json({
      success: true,
      filename: result.filename,
      downloadUrl: `/api/download/${result.filename}`,
      data: result.data,
      moduleCount: result.moduleCount,
      size: result.size
    });
  } catch (error) {
    console.error('Fejl ved QR-kode konvertering:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PUZZLE ENDPOINTS ====================

// Preview puzzle
app.post('/api/preview/puzzle', upload.single('image'), async (req, res) => {
  try {
    const options = {
      width: parseInt(req.body.width) || 150,
      height: parseInt(req.body.height) || 150,
      cols: parseInt(req.body.cols) || 4,
      rows: parseInt(req.body.rows) || 4,
      tabStyle: req.body.tabStyle || 'classic'
    };

    console.log('Genererer puzzle preview:', options);

    const buffer = await generatePuzzlePreviewPng(req.file?.path, options);
    
    if (req.file) fs.unlinkSync(req.file.path);
    
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Fejl ved puzzle preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Konverter puzzle til DXF
app.post('/api/convert/puzzle', upload.single('image'), async (req, res) => {
  try {
    const options = {
      width: parseInt(req.body.width) || 150,
      height: parseInt(req.body.height) || 150,
      cols: parseInt(req.body.cols) || 4,
      rows: parseInt(req.body.rows) || 4,
      tabStyle: req.body.tabStyle || 'classic'
    };

    console.log('Konverterer puzzle til DXF:', options);

    const result = await convertPuzzleToDxf(req.file?.path, outputDir, options);
    
    if (req.file) fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      filename: result.filename,
      downloadUrl: `/api/download/${result.filename}`,
      width: result.width,
      height: result.height,
      cols: result.cols,
      rows: result.rows,
      totalPieces: result.totalPieces
    });
  } catch (error) {
    console.error('Fejl ved puzzle konvertering:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== NAMETAG ENDPOINTS ====================

// Preview navneskilt
app.post('/api/preview/nametag', express.json(), async (req, res) => {
  try {
    const options = {
      text: req.body.text || 'NAVN',
      subtitle: req.body.subtitle || '',
      width: parseInt(req.body.width) || 80,
      height: parseInt(req.body.height) || 30,
      shape: req.body.shape || 'rounded',
      holePosition: req.body.holePosition || 'left',
      holeSize: parseFloat(req.body.holeSize) || 3,
      fontSize: parseFloat(req.body.fontSize) || 10,
      subtitleSize: parseFloat(req.body.subtitleSize) || 5
    };

    console.log('Genererer navneskilt preview:', options);

    const buffer = await generateNametagPreviewPng(options);
    
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Fejl ved navneskilt preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Konverter navneskilt til DXF
app.post('/api/convert/nametag', express.json(), async (req, res) => {
  try {
    const options = {
      text: req.body.text || 'NAVN',
      subtitle: req.body.subtitle || '',
      width: parseInt(req.body.width) || 80,
      height: parseInt(req.body.height) || 30,
      shape: req.body.shape || 'rounded',
      holePosition: req.body.holePosition || 'left',
      holeSize: parseFloat(req.body.holeSize) || 3,
      fontSize: parseFloat(req.body.fontSize) || 10,
      subtitleSize: parseFloat(req.body.subtitleSize) || 5
    };

    console.log('Konverterer navneskilt til DXF:', options);

    const result = await convertNametagToDxf(outputDir, options);
    
    res.json({
      success: true,
      filename: result.filename,
      downloadUrl: `/api/download/${result.filename}`,
      width: result.width,
      height: result.height,
      text: result.text
    });
  } catch (error) {
    console.error('Fejl ved navneskilt konvertering:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ryd op i gamle filer (kør hver time)
setInterval(() => {
  const maxAge = 60 * 60 * 1000; // 1 time
  const now = Date.now();
  
  [uploadsDir, outputDir].forEach(dir => {
    fs.readdirSync(dir).forEach(file => {
      const filepath = path.join(dir, file);
      const stats = fs.statSync(filepath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filepath);
      }
    });
  });
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server kører på http://localhost:${PORT}`);
});
