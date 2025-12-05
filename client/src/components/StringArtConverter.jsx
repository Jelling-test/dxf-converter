import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Sparkles, Download, Loader2, Settings, Upload, X, RefreshCw, Eye, FileJson, Crop, PlayCircle } from 'lucide-react'
import StringArtGuide from './StringArtGuide'

// Størrelses presets med shape info
const SIZE_PRESETS = {
  circle_small: { name: 'Cirkel Ø150mm', width: 150, height: 150, icon: '⭕', shape: 'circle' },
  circle_medium: { name: 'Cirkel Ø200mm', width: 200, height: 200, icon: '⭕', shape: 'circle' },
  circle_large: { name: 'Cirkel Ø250mm', width: 250, height: 250, icon: '⭕', shape: 'circle' },
  square_small: { name: 'Kvadrat 150mm', width: 150, height: 150, icon: '⬜', shape: 'square' },
  square_medium: { name: 'Kvadrat 200mm', width: 200, height: 200, icon: '⬜', shape: 'square' },
  square_large: { name: 'Kvadrat 250mm', width: 250, height: 250, icon: '⬜', shape: 'square' },
  postcard: { name: 'Postkort (148x105mm)', width: 148, height: 105, icon: '📮', shape: 'border' },
  a5: { name: 'A5 (210x148mm)', width: 210, height: 148, icon: '📄', shape: 'border' },
  a4: { name: 'A4 (297x210mm)', width: 297, height: 210, icon: '📃', shape: 'border' },
}

// Kvalitets presets (opdateret med nye parametre)
const QUALITY_PRESETS = {
  fast: { name: 'Hurtig', numPins: 150, numLines: 2000, lineOpacity: 0.15, description: 'Hurtig preview, færre detaljer' },
  balanced: { name: 'Balanceret', numPins: 200, numLines: 3500, lineOpacity: 0.1, description: 'God balance mellem kvalitet og hastighed' },
  detailed: { name: 'Detaljeret', numPins: 250, numLines: 5000, lineOpacity: 0.08, description: 'Flere detaljer, længere tid' },
  ultra: { name: 'Ultra', numPins: 300, numLines: 8000, lineOpacity: 0.06, description: 'Maksimal detalje, lang beregningstid' },
}

export default function StringArtConverter() {
  const [file, setFile] = useState(null)
  const [originalPreview, setOriginalPreview] = useState(null)
  const [processedPreview, setProcessedPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewStats, setPreviewStats] = useState(null)
  
  // Indstillinger
  const [size, setSize] = useState('circle_medium')
  const [quality, setQuality] = useState('balanced')
  const [numPins, setNumPins] = useState(200)
  const [numLines, setNumLines] = useState(3500)
  const [lineOpacity, setLineOpacity] = useState(0.1)
  const [minPinDistance, setMinPinDistance] = useState(10)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [exportingJson, setExportingJson] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(true)
  
  // Guide states
  const [showGuide, setShowGuide] = useState(false)
  const [guideData, setGuideData] = useState(null) // { sequence, pins }
  
  // Crop states
  const [cropMode, setCropMode] = useState(false)
  const [cropStart, setCropStart] = useState(null)
  const [cropEnd, setCropEnd] = useState(null)
  const [cropArea, setCropArea] = useState(null)
  const imageContainerRef = useRef(null)
  
  const previewTimeoutRef = useRef(null)

  // Anvend kvalitets preset
  const applyQualityPreset = (presetKey) => {
    setQuality(presetKey)
    const preset = QUALITY_PRESETS[presetKey]
    if (preset) {
      setNumPins(preset.numPins)
      setNumLines(preset.numLines)
      setLineOpacity(preset.lineOpacity)
    }
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

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      setFile(selectedFile)
      setOriginalPreview(URL.createObjectURL(selectedFile))
      setProcessedPreview(null)
      setPreviewStats(null)
      setResult(null)
      setError(null)
      setCropArea(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
    },
    multiple: false
  })

  // Generer preview
  const generatePreview = async () => {
    if (!file) return
    
    setPreviewLoading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('size', size)
      formData.append('numPins', numPins)
      formData.append('numLines', Math.min(numLines, 3000))
      formData.append('lineOpacity', lineOpacity)
      formData.append('minPinDistance', minPinDistance)
      
      // Tilføj crop koordinater
      if (cropArea) {
        formData.append('cropX', cropArea.x)
        formData.append('cropY', cropArea.y)
        formData.append('cropWidth', cropArea.width)
        formData.append('cropHeight', cropArea.height)
      }

      const response = await axios.post('/api/preview/stringart', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        timeout: 120000
      })

      // Hent stats fra header hvis tilgængelig
      const statsHeader = response.headers['x-stringart-stats']
      if (statsHeader) {
        try {
          setPreviewStats(JSON.parse(statsHeader))
        } catch (e) {}
      }

      const imageUrl = URL.createObjectURL(response.data)
      setProcessedPreview(imageUrl)
    } catch (err) {
      console.error('Preview fejl:', err)
      setError('Kunne ikke generere preview: ' + (err.response?.data?.error || err.message))
    } finally {
      setPreviewLoading(false)
    }
  }

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
      formData.append('size', size)
      formData.append('numPins', numPins)
      formData.append('numLines', numLines)
      formData.append('lineOpacity', lineOpacity)
      formData.append('minPinDistance', minPinDistance)
      
      if (cropArea) {
        formData.append('cropX', cropArea.x)
        formData.append('cropY', cropArea.y)
        formData.append('cropWidth', cropArea.width)
        formData.append('cropHeight', cropArea.height)
      }

      const response = await axios.post('/api/convert/stringart', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000
      })

      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Der opstod en fejl ved konvertering')
    } finally {
      setLoading(false)
    }
  }

  // Eksporter JSON med instruktioner
  const handleExportJson = async () => {
    if (!file) {
      setError('Vælg venligst et billede')
      return
    }

    setExportingJson(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('size', size)
      formData.append('numPins', numPins)
      formData.append('numLines', numLines)
      formData.append('lineOpacity', lineOpacity)
      formData.append('minPinDistance', minPinDistance)
      
      if (cropArea) {
        formData.append('cropX', cropArea.x)
        formData.append('cropY', cropArea.y)
        formData.append('cropWidth', cropArea.width)
        formData.append('cropHeight', cropArea.height)
      }

      const response = await axios.post('/api/export/stringart-json', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000
      })

      // Download filen
      window.open(response.data.downloadUrl, '_blank')
    } catch (err) {
      setError(err.response?.data?.error || 'Der opstod en fejl ved eksport')
    } finally {
      setExportingJson(false)
    }
  }

  // Åbn interaktiv guide
  const openGuide = async () => {
    if (!file) {
      setError('Vælg venligst et billede')
      return
    }

    setPreviewLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('size', size)
      formData.append('numPins', numPins)
      formData.append('numLines', Math.min(numLines, 3000))
      formData.append('minPinDistance', minPinDistance)
      
      if (cropArea) {
        formData.append('cropX', cropArea.x)
        formData.append('cropY', cropArea.y)
        formData.append('cropWidth', cropArea.width)
        formData.append('cropHeight', cropArea.height)
      }

      const response = await axios.post('/api/stringart/guide-data', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000
      })

      setGuideData({
        sequence: response.data.sequence,
        pins: response.data.pins,
        totalLines: response.data.totalLines
      })
      setShowGuide(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Kunne ikke generere guide data')
    } finally {
      setPreviewLoading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setOriginalPreview(null)
    setProcessedPreview(null)
    setPreviewStats(null)
    setResult(null)
    setError(null)
    setCropArea(null)
    setCropMode(false)
    setGuideData(null)
  }

  const sizeConfig = SIZE_PRESETS[size]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-400" />
            String Art Generator
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Konverter billeder til string art mønster for laser/CNC gravering
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Indstillinger */}
      {showSettings && (
        <div className="bg-slate-700/50 rounded-xl p-4 space-y-4">
          
          {/* Størrelse valg */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Størrelse / Format</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {Object.entries(SIZE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setSize(key)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    size === key
                      ? 'bg-orange-600 text-white ring-2 ring-orange-400 shadow-lg'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <span className="text-center leading-tight">{preset.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-orange-400 mt-2">
              {sizeConfig?.icon} {sizeConfig?.name} - {sizeConfig?.width}x{sizeConfig?.height}mm 
              {sizeConfig?.shape === 'circle' ? ' (cirkulær)' : sizeConfig?.shape === 'square' ? ' (kvadratisk)' : ' (rektangulær)'}
            </p>
          </div>

          {/* Kvalitets presets */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Kvalitet / Detalje</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyQualityPreset(key)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    quality === key
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {QUALITY_PRESETS[quality]?.description}
            </p>
          </div>

          {/* Avancerede indstillinger */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
            >
              {showAdvanced ? '▼' : '▶'} Avancerede indstillinger
            </button>
            
            {showAdvanced && (
              <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-800/50 rounded-lg p-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Antal søm: {numPins}
                  </label>
                  <input
                    type="range"
                    value={numPins}
                    onChange={(e) => setNumPins(parseInt(e.target.value))}
                    min="100"
                    max="400"
                    step="10"
                    className="w-full accent-orange-500"
                  />
                  <p className="text-xs text-slate-500">Flere søm = finere detalje</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Antal linjer: {numLines}
                  </label>
                  <input
                    type="range"
                    value={numLines}
                    onChange={(e) => setNumLines(parseInt(e.target.value))}
                    min="1000"
                    max="10000"
                    step="500"
                    className="w-full accent-orange-500"
                  />
                  <p className="text-xs text-slate-500">Flere linjer = mørkere</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Linje-opacity: {(lineOpacity * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    value={lineOpacity}
                    onChange={(e) => setLineOpacity(parseFloat(e.target.value))}
                    min="0.02"
                    max="0.3"
                    step="0.01"
                    className="w-full accent-orange-500"
                  />
                  <p className="text-xs text-slate-500">Lavere = mere overlap</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Min. søm-afstand: {minPinDistance}
                  </label>
                  <input
                    type="range"
                    value={minPinDistance}
                    onChange={(e) => setMinPinDistance(parseInt(e.target.value))}
                    min="5"
                    max="30"
                    className="w-full accent-orange-500"
                  />
                  <p className="text-xs text-slate-500">Højere = tydeligere linjer</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dropzone */}
      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          {isDragActive ? (
            <p className="text-orange-400">Slip billedet her...</p>
          ) : (
            <>
              <p className="text-slate-300">Træk og slip et billede her</p>
              <p className="text-slate-500 text-sm mt-1">eller klik for at vælge</p>
              <p className="text-slate-600 text-xs mt-4">
                Portrætter og billeder med høj kontrast giver bedst resultat
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
                <span className="text-sm font-medium text-slate-300">Original</span>
                <div className="flex gap-2">
                  {cropArea && (
                    <button
                      onClick={clearCrop}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                    >
                      Nulstil crop
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
                      Beskæret
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
            
            {/* String Art preview */}
            <div className="bg-slate-900 rounded-xl p-4 border border-orange-700/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-orange-300">String Art Preview</span>
                </div>
                {previewLoading && (
                  <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                )}
              </div>
              <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden">
                {processedPreview ? (
                  <img
                    src={processedPreview}
                    alt="String Art preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : previewLoading ? (
                  <div className="text-slate-600 flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Beregner string art...</span>
                    <span className="text-xs text-slate-400">Dette kan tage 10-30 sekunder</span>
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm text-center p-4">
                    Klik "Generer Preview" for at se resultatet
                  </div>
                )}
              </div>
              {previewStats && (
                <p className="text-center text-orange-400/70 text-xs mt-2">
                  {previewStats.numPins} søm • {previewStats.numLines} linjer • {previewStats.totalTime?.toFixed(1)}s
                </p>
              )}
            </div>
          </div>
          
          {/* Preview knap */}
          <button
            onClick={generatePreview}
            disabled={previewLoading}
            className="mt-3 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${previewLoading ? 'animate-spin' : ''}`} />
            {previewLoading ? 'Genererer preview...' : 'Generer Preview'}
          </button>
        </div>
      )}

      {/* Info boks */}
      <div className="bg-orange-900/30 border border-orange-700/50 rounded-xl p-4">
        <h3 className="text-orange-300 font-medium mb-2">💡 Tips til bedste resultat</h3>
        <ul className="text-sm text-orange-200/80 space-y-1">
          <li>• Brug billeder med høj kontrast (portrætter virker godt)</li>
          <li>• Ansigter bør fylde det meste af billedet</li>
          <li>• Simpel baggrund giver renere resultat</li>
          <li>• DXF filen indeholder lag: FRAME (ramme), PINS (søm), STRINGS (linjer)</li>
        </ul>
      </div>

      {/* Konverter knapper */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={handleConvert}
          disabled={loading || exportingJson || !file}
          className="py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Genererer...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              DXF til Laser
            </>
          )}
        </button>
        
        <button
          onClick={handleExportJson}
          disabled={loading || exportingJson || !file}
          className="py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {exportingJson ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Eksporterer...
            </>
          ) : (
            <>
              <FileJson className="w-5 h-5" />
              Instruktioner
            </>
          )}
        </button>
        
        <button
          onClick={openGuide}
          disabled={loading || exportingJson || previewLoading || !file}
          className="py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <PlayCircle className="w-5 h-5" />
          Interaktiv Guide
        </button>
      </div>

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
              <p className="text-green-200 font-medium">String Art DXF genereret!</p>
              <p className="text-green-300/70 text-sm">{result.filename}</p>
              {result.stats && (
                <p className="text-green-400/60 text-xs mt-1">
                  {result.stats.numPins} søm • {result.stats.numLines} linjer • {result.stats.totalTime?.toFixed(1)}s
                </p>
              )}
            </div>
            <a
              href={result.downloadUrl}
              download
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download DXF
            </a>
          </div>
        </div>
      )}

      {/* Interaktiv guide modal */}
      {showGuide && guideData && (
        <StringArtGuide
          sequence={guideData.sequence}
          pins={guideData.pins}
          totalLines={guideData.totalLines}
          onClose={() => setShowGuide(false)}
        />
      )}
    </div>
  )
}
