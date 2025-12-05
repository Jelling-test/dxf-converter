import QRCode from 'qrcode';
import { DxfWriter } from './dxfWriter.js';
import path from 'path';
import fs from 'fs';

/**
 * Formaterer data til QR-kode baseret på type
 */
function formatQRData(type, data) {
  switch (type) {
    case 'url':
      // Tilføj https:// hvis ikke til stede
      if (!data.startsWith('http://') && !data.startsWith('https://')) {
        return 'https://' + data;
      }
      return data;
      
    case 'text':
      return data;
      
    case 'wifi':
      // Forvent format: { ssid, password, encryption }
      const wifi = typeof data === 'string' ? JSON.parse(data) : data;
      const encryption = wifi.encryption || 'WPA';
      return `WIFI:T:${encryption};S:${wifi.ssid};P:${wifi.password};;`;
      
    case 'geo':
      // Forvent format: { lat, lng } eller "lat,lng"
      if (typeof data === 'string') {
        const [lat, lng] = data.split(',').map(s => s.trim());
        return `geo:${lat},${lng}`;
      }
      return `geo:${data.lat},${data.lng}`;
      
    default:
      return data;
  }
}

/**
 * Genererer QR-kode som SVG
 */
export async function generateQRCodeSvg(type, data, options = {}) {
  const {
    size = 200,
    margin = 2,
    errorCorrectionLevel = 'M'
  } = options;

  const formattedData = formatQRData(type, data);
  
  const svg = await QRCode.toString(formattedData, {
    type: 'svg',
    width: size,
    margin: margin,
    errorCorrectionLevel: errorCorrectionLevel,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return {
    svg,
    data: formattedData,
    type
  };
}

/**
 * Genererer QR-kode som PNG for preview
 */
export async function generateQRCodePng(type, data, options = {}) {
  const {
    size = 400,
    margin = 2,
    errorCorrectionLevel = 'M'
  } = options;

  const formattedData = formatQRData(type, data);
  
  const buffer = await QRCode.toBuffer(formattedData, {
    type: 'png',
    width: size,
    margin: margin,
    errorCorrectionLevel: errorCorrectionLevel,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return {
    buffer,
    data: formattedData,
    type
  };
}

/**
 * Genererer QR-kode og konverterer til DXF
 */
export async function convertQRCodeToDxf(type, data, outputDir, options = {}) {
  const {
    size = 50, // mm
    margin = 2,
    errorCorrectionLevel = 'M'
  } = options;

  const formattedData = formatQRData(type, data);
  
  // Generer QR-kode matrix
  const qrData = await QRCode.create(formattedData, {
    errorCorrectionLevel: errorCorrectionLevel
  });
  
  const modules = qrData.modules;
  const moduleCount = modules.size;
  const moduleSize = size / (moduleCount + margin * 2);
  const offset = margin * moduleSize;
  
  const dxf = new DxfWriter();
  
  // Tilføj ramme
  dxf.addLine(0, 0, size, 0, 'FRAME');
  dxf.addLine(size, 0, size, size, 'FRAME');
  dxf.addLine(size, size, 0, size, 'FRAME');
  dxf.addLine(0, size, 0, 0, 'FRAME');
  
  // Tilføj QR-moduler som små firkanter
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules.get(row, col)) {
        const x = offset + col * moduleSize;
        const y = size - offset - (row + 1) * moduleSize; // Flip Y
        
        // Tegn firkantet modul som 4 linjer
        dxf.addLine(x, y, x + moduleSize, y, 'QR_MODULES');
        dxf.addLine(x + moduleSize, y, x + moduleSize, y + moduleSize, 'QR_MODULES');
        dxf.addLine(x + moduleSize, y + moduleSize, x, y + moduleSize, 'QR_MODULES');
        dxf.addLine(x, y + moduleSize, x, y, 'QR_MODULES');
      }
    }
  }
  
  // Gem DXF
  const dxfContent = dxf.generateDxf();
  const filename = `qrcode-${type}-${Date.now()}.dxf`;
  const outputPath = path.join(outputDir, filename);
  
  fs.writeFileSync(outputPath, dxfContent);
  
  return {
    path: outputPath,
    filename,
    data: formattedData,
    type,
    moduleCount,
    size
  };
}
