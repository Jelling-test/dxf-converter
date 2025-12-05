import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { FileImage, Download, Loader2, Settings, Upload, X, RefreshCw, Eye, Crop, Square, Circle } from 'lucide-react'

// Materiale presets med optimerede indstillinger for halftone gravering
const MATERIAL_PRESETS = {
  glass: {
    name: 'Glas',
    icon: '🥃',
    description: 'Ølglas, vinglas, spejle - medium detalje',
    settings: { contrast: 40, brightness: 10, dotSize: 3, invert: false }
  },
  metal: {
    name: 'Metal',
    icon: '🔩',
    description: 'Rustfrit stål, aluminium - høj kontrast',
    settings: { contrast: 60, brightness: 0, dotSize: 3, invert: false }
  },
  wood: {
    name: 'Træ',
    icon: '🪵',
    description: 'Skærebrætter, skilte - grovere punkter',
    settings: { contrast: 35, brightness: 5, dotSize: 4, invert: false }
  },
  plastic: {
    name: 'Plastik',
    icon: '📦',
    description: 'Akryl, PVC - skarp og tydelig',
    settings: { contrast: 50, brightness: 5, dotSize: 3, invert: false }
  }
}

export default function ImageConverter() {
  const [file, setFile] = useState(null)
  const [originalPreview, setOriginalPreview] = useState(null)
  const [processedPreview, setProcessedPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [material, setMaterial] = useState('glass')
  const [threshold, setThreshold] = useState(100)
  const [scale, setScale] = useState(1)
  const [invert, setInvert] = useState(false)
  const [mode, setMode] = useState('dither') // 'dither' for portrætter, 'edge' for linjer, 'threshold' for grafik
  const [detail, setDetail] = useState('high') // 'low', 'medium', 'high'
  const [edgeStrength, setEdgeStrength] = useState(1.5)
  const [contrast, setContrast] = useState(40)
  const [brightness, setBrightness] = useState(10)
  const [dotSize, setDotSize] = useState(3) // Grovere = mere synligt
  const [outputWidth, setOutputWidth] = useState(80) // Output bredde i mm
  const [loading, setLoading] = useState(false)
  
  // Crop/beskæring states
  const [cropMode, setCropMode] = useState(false)
  const [cropStart, setCropStart] = useState(null)
  const [cropEnd, setCropEnd] = useState(null)
  const [cropArea, setCropArea] = useState(null) // { x, y, width, height } i procent
  const imageContainerRef = useRef(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  
  // Anvend materiale preset og tving preview opdatering
  const applyMaterialPreset = (materialKey) => {
    setMaterial(materialKey)
    const preset = MATERIAL_PRESETS[materialKey]
    if (preset) {
      setContrast(preset.settings.contrast)
      setBrightness(preset.settings.brightness)
      setDotSize(preset.settings.dotSize)
      setInvert(preset.settings.invert)
      
      // Tving preview opdatering efter state er sat
      if (file) {
        setTimeout(() => {
          generatePreviewWithSettings(preset.settings)
        }, 100)
      }
    }
  }
  
  // Generer preview med specifikke settings (bruges ved materiale skift)
  const generatePreviewWithSettings = async (settings) => {
    if (!file) return
    
    setPreviewLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('threshold', threshold)
      formData.append('invert', settings.invert)
      formData.append('mode', mode)
      formData.append('detail', detail)
      formData.append('edgeStrength', edgeStrength)
      formData.append('contrast', settings.contrast)
      formData.append('brightness', settings.brightness)
      formData.append('dotSize', settings.dotSize)
      
      // Tilføj crop koordinater hvis de findes
      if (cropArea) {
        formData.append('cropX', cropArea.x)
        formData.append('cropY', cropArea.y)
        formData.append('cropWidth', cropArea.width)
        formData.append('cropHeight', cropArea.height)
      }

      const response = await axios.post('/api/preview/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      })

      const imageUrl = URL.createObjectURL(response.data)
      setProcessedPreview(imageUrl)
    } catch (err) {
      console.error('Preview fejl:', err)
    } finally {
      setPreviewLoading(false)
    }
  }
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(true)
  const previewTimeoutRef = useRef(null)

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      setFile(selectedFile)
      setOriginalPreview(URL.createObjectURL(selectedFile))
      setProcessedPreview(null)
      setResult(null)
      setError(null)
    }
  }, [])

  // Generer preview når fil eller indstillinger ændres
  const generatePreview = useCallback(async () => {
    if (!file) return
    
    setPreviewLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('threshold', threshold)
      formData.append('invert', invert)
      formData.append('mode', mode)
      formData.append('detail', detail)
      formData.append('edgeStrength', edgeStrength)
      formData.append('contrast', contrast)
      formData.append('brightness', brightness)
      formData.append('dotSize', dotSize)
      
      // Tilføj crop koordinater hvis de findes
      if (cropArea) {
        formData.append('cropX', cropArea.x)
        formData.append('cropY', cropArea.y)
        formData.append('cropWidth', cropArea.width)
        formData.append('cropHeight', cropArea.height)
      }

      const response = await axios.post('/api/preview/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      })

      const imageUrl = URL.createObjectURL(response.data)
      setProcessedPreview(imageUrl)
    } catch (err) {
      console.error('Preview fejl:', err)
    } finally {
      setPreviewLoading(false)
    }
  }, [file, threshold, invert, mode, detail, edgeStrength, contrast, brightness, dotSize, cropArea])

  // Debounced preview opdatering når indstillinger ændres
  useEffect(() => {
    if (!file) return
    
    // Clear previous timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
    }
    
    // Set new timeout (300ms debounce)
    previewTimeoutRef.current = setTimeout(() => {
      generatePreview()
    }, 300)
    
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }
    }
  }, [file, threshold, invert, mode, detail, edgeStrength, contrast, brightness, dotSize, cropArea, generatePreview])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
    },
    multiple: false
  })

  const handleConvert = async () => {
    if (!file) {
      setError('Vælg venligst et billede')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('threshold', threshold)
      formData.append('scale', scale)
      formData.append('invert', invert)
      formData.append('mode', mode)
      formData.append('detail', detail)
      formData.append('edgeStrength', edgeStrength)
      formData.append('contrast', contrast)
      formData.append('brightness', brightness)
      formData.append('dotSize', dotSize)
      formData.append('outputWidth', outputWidth)
      
      // Tilføj crop koordinater hvis de findes
      if (cropArea) {
        formData.append('cropX', cropArea.x)
        formData.append('cropY', cropArea.y)
        formData.append('cropWidth', cropArea.width)
        formData.append('cropHeight', cropArea.height)
      }

      const response = await axios.post('/api/convert/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Der opstod en fejl ved konvertering')
    } finally {
      setLoading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setOriginalPreview(null)
    setProcessedPreview(null)
    setResult(null)
    setError(null)
    setCropArea(null)
    setCropMode(false)
  }
  
  // Crop funktioner
  const handleCropMouseDown = (e) => {
    if (!cropMode || !imageContainerRef.current) return
    
    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    setCropStart({ x, y })
    setCropEnd({ x, y })
  }
  
  const handleCropMouseMove = (e) => {
    if (!cropMode || !cropStart || !imageContainerRef.current) return
    
    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    
    setCropEnd({ x, y })
  }
  
  const handleCropMouseUp = () => {
    if (!cropStart || !cropEnd) return
    
    const x = Math.min(cropStart.x, cropEnd.x)
    const y = Math.min(cropStart.y, cropEnd.y)
    const width = Math.abs(cropEnd.x - cropStart.x)
    const height = Math.abs(cropEnd.y - cropStart.y)
    
    if (width > 5 && height > 5) {
      setCropArea({ x, y, width, height })
    }
    
    setCropStart(null)
    setCropEnd(null)
    setCropMode(false)
  }
  
  const clearCrop = () => {
    setCropArea(null)
    setCropStart(null)
    setCropEnd(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileImage className="w-5 h-5 text-purple-400" />
            Billede til DXF
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload et billede og få det vektoriseret til DXF format
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Indstillinger */}
      {showSettings && (
        <div className="bg-slate-700/50 rounded-xl p-4 space-y-4">
          
          {/* Materiale valg */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Vælg materiale / overflade</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyMaterialPreset(key)}
                  className={`py-3 px-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                    material === key
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  <span className="text-2xl">{preset.icon}</span>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-blue-400 mt-2">
              {MATERIAL_PRESETS[material]?.icon} {MATERIAL_PRESETS[material]?.description}
            </p>
          </div>

          {/* Mode selector */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Konverteringstype</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setMode('dither')}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'dither'
                    ? 'bg-green-600 text-white ring-2 ring-green-400'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                ⭐ Portræt/Gravering
              </button>
              <button
                onClick={() => setMode('edge')}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'edge'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                🖼️ Linjer (Edge)
              </button>
              <button
                onClick={() => setMode('threshold')}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'threshold'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                📐 Logo/Grafik
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {mode === 'dither' 
                ? '⭐ ANBEFALET til portrætter og glas-gravering - bevarer alle detaljer med punktmønster' 
                : mode === 'edge'
                ? 'Finder kanter og konturer - bedst til simpel grafik'
                : 'Simpel sort/hvid - bedst til logoer og tekst'}
            </p>
          </div>

          {/* Dithering indstillinger */}
          {mode === 'dither' && (
            <div className="bg-green-900/30 rounded-lg p-3 border border-green-700/50">
              <p className="text-green-300 text-sm font-medium mb-3">🎨 Portræt indstillinger</p>
              
              {/* Output størrelse - fremhævet */}
              <div className="bg-green-800/50 rounded-lg p-3 mb-3">
                <label className="block text-sm text-green-200 font-medium mb-2">
                  📐 Output bredde: {outputWidth} mm
                </label>
                <input
                  type="range"
                  value={outputWidth}
                  onChange={(e) => setOutputWidth(parseInt(e.target.value))}
                  min="30"
                  max="300"
                  step="10"
                  className="w-full accent-green-400"
                />
                <div className="flex justify-between text-xs text-green-400 mt-1">
                  <span>30mm (lille)</span>
                  <span>150mm (medium)</span>
                  <span>300mm (stor)</span>
                </div>
              </div>
              
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Kontrast ({contrast}%)
                  </label>
                  <input
                    type="range"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    min="0"
                    max="100"
                    className="w-full accent-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Lysstyrke ({brightness})
                  </label>
                  <input
                    type="range"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    min="-50"
                    max="50"
                    className="w-full accent-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Detalje ({dotSize})
                  </label>
                  <input
                    type="range"
                    value={dotSize}
                    onChange={(e) => setDotSize(parseInt(e.target.value))}
                    min="1"
                    max="5"
                    className="w-full accent-green-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">1=fin detalje, 5=grov</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Detail level - kun for edge mode */}
            {mode === 'edge' && (
              <div>
                <label className="block text-sm text-slate-300 mb-1">Detaljeniveau</label>
                <select
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500"
                >
                  <option value="low">Lav (færre linjer)</option>
                  <option value="medium">Medium</option>
                  <option value="high">Høj (flere detaljer)</option>
                </select>
              </div>
            )}

            {/* Edge strength - kun for edge mode */}
            {mode === 'edge' && (
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Kant styrke ({edgeStrength.toFixed(1)})
                </label>
                <input
                  type="range"
                  value={edgeStrength}
                  onChange={(e) => setEdgeStrength(parseFloat(e.target.value))}
                  min="0.5"
                  max="3"
                  step="0.1"
                  className="w-full accent-purple-500"
                />
              </div>
            )}

            {/* Threshold - kun for edge og threshold mode */}
            {mode !== 'dither' && (
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Threshold ({threshold})
                </label>
                <input
                  type="range"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  min="10"
                  max="240"
                  className="w-full accent-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {mode === 'edge' ? 'Kant følsomhed' : 'Sort/hvid grænse'}
                </p>
              </div>
            )}

            {/* Skala - kun for ikke-dither modes */}
            {mode !== 'dither' && (
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Skala ({scale}x)
                </label>
                <input
                  type="range"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  min="0.1"
                  max="10"
                  step="0.1"
                  className="w-full accent-purple-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-300 mb-2">Inverter</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={invert}
                  onChange={(e) => setInvert(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-slate-300">Inverter sort/hvid</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Dropzone */}
      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          {isDragActive ? (
            <p className="text-purple-400">Slip billedet her...</p>
          ) : (
            <>
              <p className="text-slate-300">Træk og slip et billede her</p>
              <p className="text-slate-500 text-sm mt-1">eller klik for at vælge</p>
              <p className="text-slate-600 text-xs mt-4">
                Understøtter: PNG, JPG, GIF, BMP, WebP
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={clearFile}
            className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg z-10"
          >
            <X className="w-4 h-4" />
          </button>
          
          {/* Side-by-side Preview */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Original billede med crop */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">Original</span>
                </div>
                <div className="flex gap-2">
                  {cropArea && (
                    <button
                      onClick={clearCrop}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                    >
                      Nulstil beskæring
                    </button>
                  )}
                  <button
                    onClick={() => setCropMode(!cropMode)}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                      cropMode 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                    }`}
                  >
                    <Crop className="w-3 h-3" />
                    {cropMode ? 'Tegn område...' : 'Beskær'}
                  </button>
                </div>
              </div>
              <div 
                ref={imageContainerRef}
                className={`aspect-square bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden relative ${
                  cropMode ? 'cursor-crosshair' : ''
                }`}
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
              >
                <img
                  src={originalPreview}
                  alt="Original"
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
                
                {/* Crop overlay - valgt område */}
                {cropArea && !cropMode && (
                  <div 
                    className="absolute border-2 border-orange-500 bg-orange-500/20 pointer-events-none"
                    style={{
                      left: `${cropArea.x}%`,
                      top: `${cropArea.y}%`,
                      width: `${cropArea.width}%`,
                      height: `${cropArea.height}%`
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-orange-600 text-white text-xs px-2 py-1 rounded">
                      Beskæret område
                    </div>
                  </div>
                )}
                
                {/* Crop selection - mens man tegner */}
                {cropStart && cropEnd && (
                  <div 
                    className="absolute border-2 border-dashed border-orange-400 bg-orange-400/20 pointer-events-none"
                    style={{
                      left: `${Math.min(cropStart.x, cropEnd.x)}%`,
                      top: `${Math.min(cropStart.y, cropEnd.y)}%`,
                      width: `${Math.abs(cropEnd.x - cropStart.x)}%`,
                      height: `${Math.abs(cropEnd.y - cropStart.y)}%`
                    }}
                  />
                )}
                
                {/* Dim resten af billedet når crop er aktivt */}
                {cropArea && !cropMode && (
                  <div 
                    className="absolute inset-0 bg-black/50 pointer-events-none"
                    style={{
                      clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${cropArea.x}% ${cropArea.y}%, ${cropArea.x}% ${cropArea.y + cropArea.height}%, ${cropArea.x + cropArea.width}% ${cropArea.y + cropArea.height}%, ${cropArea.x + cropArea.width}% ${cropArea.y}%, ${cropArea.x}% ${cropArea.y}%)`
                    }}
                  />
                )}
              </div>
              <p className="text-center text-slate-500 text-xs mt-2 truncate">
                {cropArea 
                  ? `📐 Beskæret: ${cropArea.width.toFixed(0)}% x ${cropArea.height.toFixed(0)}%`
                  : file.name
                }
              </p>
            </div>
            
            {/* Processed preview */}
            <div className="bg-slate-900 rounded-xl p-4 border border-purple-700/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">Preview (DXF resultat)</span>
                </div>
                {previewLoading && (
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                )}
              </div>
              <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden">
                {processedPreview ? (
                  <img
                    src={processedPreview}
                    alt="Processed preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : previewLoading ? (
                  <div className="text-slate-400 flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Genererer preview...</span>
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm">
                    Preview genereres...
                  </div>
                )}
              </div>
              <p className="text-center text-purple-400/70 text-xs mt-2">
                Juster indstillinger ovenfor for at se ændringer
              </p>
            </div>
          </div>
          
          {/* Manuel refresh knap */}
          <button
            onClick={generatePreview}
            disabled={previewLoading}
            className="mt-3 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${previewLoading ? 'animate-spin' : ''}`} />
            Opdater preview
          </button>
        </div>
      )}

      {/* Konverter knap */}
      <button
        onClick={handleConvert}
        disabled={loading || !file}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Konverterer...
          </>
        ) : (
          <>
            <FileImage className="w-5 h-5" />
            Konverter til DXF
          </>
        )}
      </button>

      {/* Fejl */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Resultat */}
      {result && (
        <div className="bg-green-900/50 border border-green-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-200 font-medium">DXF fil genereret!</p>
              <p className="text-green-300/70 text-sm">{result.filename}</p>
            </div>
            <a
              href={result.downloadUrl}
              download
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
