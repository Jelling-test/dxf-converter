import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { convertImageToDxf } from './converters/imageConverter.js';
import { convertTextToDxf, convertBatchTextToDxf } from './converters/textConverter.js';
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
      mode: req.body.mode || 'edge', // 'edge' for fotos, 'threshold' for grafik
      edgeStrength: parseFloat(req.body.edgeStrength) || 1,
      detail: req.body.detail || 'medium' // 'low', 'medium', 'high'
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

// Download fil
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(outputDir, filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Fil ikke fundet' });
  }
  
  res.download(filepath);
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
