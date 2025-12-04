import { useState } from 'react'
import axios from 'axios'
import { Type, Download, Loader2, Settings } from 'lucide-react'

export default function TextConverter() {
  const [text, setText] = useState('')
  const [fontSize, setFontSize] = useState(10)
  const [fontHeight, setFontHeight] = useState(10)
  const [spacing, setSpacing] = useState(2)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const handleConvert = async () => {
    if (!text.trim()) {
      setError('Indtast venligst noget tekst')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await axios.post('/api/convert/text', {
        text,
        fontSize,
        fontHeight,
        spacing
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Type className="w-5 h-5 text-blue-400" />
            Tekst til DXF
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Indtast tekst og konverter til DXF format med single-stroke font
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Indstillinger */}
      {showSettings && (
        <div className="bg-slate-700/50 rounded-xl p-4 grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Font størrelse</label>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(parseFloat(e.target.value) || 10)}
              min="1"
              max="100"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Font højde (mm)</label>
            <input
              type="number"
              value={fontHeight}
              onChange={(e) => setFontHeight(parseFloat(e.target.value) || 10)}
              min="1"
              max="500"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Bogstav afstand (mm)</label>
            <input
              type="number"
              value={spacing}
              onChange={(e) => setSpacing(parseFloat(e.target.value) || 2)}
              min="0"
              max="50"
              step="0.5"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Tekstfelt */}
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Indtast din tekst her..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
        />
        <div className="text-right text-sm text-slate-500 mt-1">
          {text.length} tegn
        </div>
      </div>

      {/* Konverter knap */}
      <button
        onClick={handleConvert}
        disabled={loading || !text.trim()}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Konverterer...
          </>
        ) : (
          <>
            <Type className="w-5 h-5" />
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

      {/* Preview tekst */}
      {text && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
          <p className="text-sm text-slate-400 mb-2">Preview:</p>
          <div className="font-mono text-2xl text-white tracking-wider">
            {text}
          </div>
        </div>
      )}
    </div>
  )
}
