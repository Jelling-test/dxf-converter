import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Puzzle, Download, Loader2, Upload, X, RefreshCw, Settings } from 'lucide-react'

const SIZE_PRESETS = [
  { value: '100x100', label: '10 x 10 cm', width: 100, height: 100 },
  { value: '150x150', label: '15 x 15 cm', width: 150, height: 150 },
  { value: '200x200', label: '20 x 20 cm', width: 200, height: 200 },
  { value: '200x150', label: '20 x 15 cm', width: 200, height: 150 },
  { value: '300x200', label: '30 x 20 cm', width: 300, height: 200 },
  { value: 'custom', label: 'Brugerdefineret', width: 0, height: 0 },
]

const PIECE_PRESETS = [
  { cols: 3, rows: 3, label: '3 x 3 (9 brikker)' },
  { cols: 4, rows: 4, label: '4 x 4 (16 brikker)' },
  { cols: 5, rows: 4, label: '5 x 4 (20 brikker)' },
  { cols: 6, rows: 5, label: '6 x 5 (30 brikker)' },
  { cols: 8, rows: 6, label: '8 x 6 (48 brikker)' },
  { cols: 10, rows: 8, label: '10 x 8 (80 brikker)' },
]

export default function PuzzleGenerator() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [puzzlePreview, setPuzzlePreview] = useState(null)
  
  const [sizePreset, setSizePreset] = useState('150x150')
  const [customWidth, setCustomWidth] = useState(150)
  const [customHeight, setCustomHeight] = useState(150)
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(4)
  const [tabStyle, setTabStyle] = useState('classic') // classic, rounded, straight
  
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (file) {
      setFile(file)
      setPreview(URL.createObjectURL(file))
      setPuzzlePreview(null)
      setResult(null)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    multiple: false
  })

  const getSize = () => {
    if (sizePreset === 'custom') {
      return { width: customWidth, height: customHeight }
    }
    const preset = SIZE_PRESETS.find(p => p.value === sizePreset)
    return { width: preset.width, height: preset.height }
  }

  const generatePreview = async () => {
    if (!file) return
    
    setPreviewLoading(true)
    setError(null)
    
    try {
      const { width, height } = getSize()
      const formData = new FormData()
      formData.append('image', file)
      formData.append('width', width)
      formData.append('height', height)
      formData.append('cols', cols)
      formData.append('rows', rows)
      formData.append('tabStyle', tabStyle)
      formData.append('previewOnly', 'true')

      const response = await axios.post('/api/preview/puzzle', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      })

      setPuzzlePreview(URL.createObjectURL(response.data))
    } catch (err) {
      setError(err.response?.data?.error || 'Kunne ikke generere preview')
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

    try {
      const { width, height } = getSize()
      const formData = new FormData()
      formData.append('image', file)
      formData.append('width', width)
      formData.append('height', height)
      formData.append('cols', cols)
      formData.append('rows', rows)
      formData.append('tabStyle', tabStyle)

      const response = await axios.post('/api/convert/puzzle', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Der opstod en fejl')
    } finally {
      setLoading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setPuzzlePreview(null)
    setResult(null)
    setError(null)
  }

  const { width, height } = getSize()
  const totalPieces = cols * rows

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Puzzle className="w-5 h-5 text-purple-400" />
          Puzzle Generator
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Lav puslespil fra billeder til laser-skæring
        </p>
      </div>

      {/* Upload */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
        <p className="text-slate-300">
          {isDragActive ? 'Slip billedet her...' : 'Træk et billede hertil, eller klik for at vælge'}
        </p>
        <p className="text-sm text-slate-500 mt-1">PNG, JPG, JPEG, GIF, WEBP</p>
      </div>

      {/* Preview af originalt billede */}
      {preview && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-300 font-medium">Valgt billede</span>
            <button onClick={clearFile} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
        </div>
      )}

      {/* Indstillinger */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Indstillinger
        </h3>

        {/* Størrelse */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Puzzle størrelse</label>
          <select
            value={sizePreset}
            onChange={(e) => setSizePreset(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
          >
            {SIZE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
        </div>

        {/* Custom størrelse */}
        {sizePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bredde (mm)</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(parseInt(e.target.value) || 100)}
                min="50"
                max="500"
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Højde (mm)</label>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(parseInt(e.target.value) || 100)}
                min="50"
                max="500"
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Antal brikker */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Antal brikker</label>
          <select
            value={`${cols}x${rows}`}
            onChange={(e) => {
              const preset = PIECE_PRESETS.find(p => `${p.cols}x${p.rows}` === e.target.value)
              if (preset) {
                setCols(preset.cols)
                setRows(preset.rows)
              }
            }}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
          >
            {PIECE_PRESETS.map((preset) => (
              <option key={`${preset.cols}x${preset.rows}`} value={`${preset.cols}x${preset.rows}`}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Brik stil */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Brik-stil</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'classic', label: 'Klassisk', desc: 'Standard puzzle-form' },
              { id: 'rounded', label: 'Afrundet', desc: 'Bløde kanter' },
              { id: 'straight', label: 'Lige', desc: 'Rektangulære brikker' },
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => setTabStyle(style.id)}
                className={`p-2 rounded-lg border-2 transition-all ${
                  tabStyle === style.id
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-sm">{style.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-400">
          <p><strong>Størrelse:</strong> {width} x {height} mm</p>
          <p><strong>Brikker:</strong> {cols} x {rows} = {totalPieces} stk</p>
          <p><strong>Brik-størrelse:</strong> ca. {Math.round(width/cols)} x {Math.round(height/rows)} mm</p>
        </div>

        {/* Preview knap */}
        <button
          onClick={generatePreview}
          disabled={!file || previewLoading}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {previewLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {previewLoading ? 'Genererer...' : 'Generer Preview'}
        </button>
      </div>

      {/* Puzzle preview */}
      {puzzlePreview && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Puzzle Preview</h3>
          <div className="flex justify-center">
            <img src={puzzlePreview} alt="Puzzle Preview" className="max-w-full rounded-lg border border-slate-600" />
          </div>
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
            Genererer...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Download Puzzle DXF
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
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 font-medium">Puzzle DXF genereret!</p>
              <p className="text-green-300/70 text-sm">{result.filename}</p>
              <p className="text-green-400/60 text-xs mt-1">
                {result.cols} x {result.rows} brikker • {result.width} x {result.height} mm
              </p>
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

      {/* Tips */}
      <div className="bg-purple-900/30 border border-purple-700/50 rounded-xl p-4">
        <h3 className="text-purple-300 font-medium mb-2">💡 Tips</h3>
        <ul className="text-sm text-purple-200/80 space-y-1">
          <li>• Vælg billeder med god kontrast</li>
          <li>• Større brikker er nemmere at samle</li>
          <li>• DXF filen har lag: FRAME (ramme), PIECES (brikker), IMAGE (gravering)</li>
          <li>• Skær PIECES først, gravér IMAGE bagefter</li>
        </ul>
      </div>
    </div>
  )
}
