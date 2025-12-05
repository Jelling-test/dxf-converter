import { useState } from 'react'
import axios from 'axios'
import { Tag, Download, Loader2, RefreshCw, Settings } from 'lucide-react'

const SHAPE_OPTIONS = [
  { id: 'rectangle', label: 'Rektangel', icon: '▭' },
  { id: 'rounded', label: 'Afrundet', icon: '▢' },
  { id: 'oval', label: 'Oval', icon: '⬭' },
  { id: 'badge', label: 'Badge', icon: '⬡' },
]

const HOLE_OPTIONS = [
  { id: 'none', label: 'Ingen huller' },
  { id: 'left', label: 'Venstre' },
  { id: 'right', label: 'Højre' },
  { id: 'both', label: 'Begge sider' },
  { id: 'top', label: 'Top' },
  { id: 'lanyard', label: 'Lanyard (top center)' },
]

export default function NameTagGenerator() {
  const [text, setText] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [width, setWidth] = useState(80) // mm
  const [height, setHeight] = useState(30) // mm
  const [shape, setShape] = useState('rounded')
  const [holePosition, setHolePosition] = useState('left')
  const [holeSize, setHoleSize] = useState(3) // mm
  const [fontSize, setFontSize] = useState(10) // mm
  const [subtitleSize, setSubtitleSize] = useState(5) // mm
  const [borderWidth, setBorderWidth] = useState(1) // mm
  
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const generatePreview = async () => {
    if (!text.trim()) {
      setError('Indtast venligst en tekst')
      return
    }
    
    setPreviewLoading(true)
    setError(null)
    
    try {
      const response = await axios.post('/api/preview/nametag', {
        text: text.trim(),
        subtitle: subtitle.trim(),
        width,
        height,
        shape,
        holePosition,
        holeSize,
        fontSize,
        subtitleSize,
        borderWidth
      }, {
        responseType: 'blob'
      })

      setPreview(URL.createObjectURL(response.data))
    } catch (err) {
      setError(err.response?.data?.error || 'Kunne ikke generere preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConvert = async () => {
    if (!text.trim()) {
      setError('Indtast venligst en tekst')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await axios.post('/api/convert/nametag', {
        text: text.trim(),
        subtitle: subtitle.trim(),
        width,
        height,
        shape,
        holePosition,
        holeSize,
        fontSize,
        subtitleSize,
        borderWidth
      })

      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Der opstod en fejl')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Tag className="w-5 h-5 text-teal-400" />
          Navneskilt Generator
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Lav personlige navneskilte til laser-skæring/gravering
        </p>
      </div>

      {/* Tekst input */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Navn / Hovedtekst</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Peter Hansen"
            className="w-full px-4 py-3 bg-slate-700 text-white text-lg rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-400 mb-1">Undertekst (valgfri)</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Direktør"
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Indstillinger */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Størrelse & Form
        </h3>

        {/* Størrelse */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Bredde (mm)</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 50)}
              min="30"
              max="200"
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Højde (mm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 20)}
              min="15"
              max="100"
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Hurtig størrelse */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Hurtig størrelse</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { w: 60, h: 25, label: 'Lille' },
              { w: 80, h: 30, label: 'Medium' },
              { w: 100, h: 35, label: 'Stor' },
              { w: 90, h: 55, label: 'ID kort' },
            ].map((size) => (
              <button
                key={`${size.w}x${size.h}`}
                onClick={() => { setWidth(size.w); setHeight(size.h); }}
                className={`p-2 rounded-lg border transition-all text-sm ${
                  width === size.w && height === size.h
                    ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {size.label}
                <span className="block text-xs text-slate-500">{size.w}x{size.h}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Form</label>
          <div className="grid grid-cols-4 gap-2">
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setShape(opt.id)}
                className={`p-2 rounded-lg border-2 transition-all ${
                  shape === opt.id
                    ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-xl block">{opt.icon}</span>
                <span className="text-xs">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Huller */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Ophængshuller</label>
          <select
            value={holePosition}
            onChange={(e) => setHolePosition(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
          >
            {HOLE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        {holePosition !== 'none' && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Hul diameter (mm): {holeSize}</label>
            <input
              type="range"
              value={holeSize}
              onChange={(e) => setHoleSize(parseInt(e.target.value))}
              min="2"
              max="6"
              step="0.5"
              className="w-full"
            />
          </div>
        )}

        {/* Skrift størrelse */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Tekst størrelse (mm): {fontSize}</label>
            <input
              type="range"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              min="5"
              max="25"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Undertekst (mm): {subtitleSize}</label>
            <input
              type="range"
              value={subtitleSize}
              onChange={(e) => setSubtitleSize(parseInt(e.target.value))}
              min="3"
              max="15"
              className="w-full"
            />
          </div>
        </div>

        {/* Preview info */}
        <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-400">
          <p><strong>Størrelse:</strong> {width} x {height} mm ({(width/10).toFixed(1)} x {(height/10).toFixed(1)} cm)</p>
          <p><strong>Tekst:</strong> "{text || '...'}" {subtitle && `/ "${subtitle}"`}</p>
        </div>

        {/* Preview knap */}
        <button
          onClick={generatePreview}
          disabled={!text.trim() || previewLoading}
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

      {/* Preview */}
      {preview && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Preview</h3>
          <div className="flex justify-center bg-white p-4 rounded-lg">
            <img src={preview} alt="Navneskilt Preview" className="max-w-full" />
          </div>
        </div>
      )}

      {/* Konverter knap */}
      <button
        onClick={handleConvert}
        disabled={loading || !text.trim()}
        className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Genererer...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Download DXF
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
              <p className="text-green-300 font-medium">Navneskilt DXF genereret!</p>
              <p className="text-green-300/70 text-sm">{result.filename}</p>
              <p className="text-green-400/60 text-xs mt-1">
                {result.width} x {result.height} mm
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
      <div className="bg-teal-900/30 border border-teal-700/50 rounded-xl p-4">
        <h3 className="text-teal-300 font-medium mb-2">💡 Tips</h3>
        <ul className="text-sm text-teal-200/80 space-y-1">
          <li>• Brug akryl, træ eller metal til navneskilte</li>
          <li>• DXF har lag: FRAME (skær), TEXT (gravér), HOLES (skær)</li>
          <li>• Skær ramme og huller, gravér derefter teksten</li>
          <li>• Tilføj snor eller nål gennem hullet</li>
        </ul>
      </div>
    </div>
  )
}
