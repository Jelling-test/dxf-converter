import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Hash, Download, Loader2, Settings, Upload, X, FileText, List } from 'lucide-react'

export default function BatchConverter() {
  const [mode, setMode] = useState('range') // 'range', 'file', 'manual'
  const [file, setFile] = useState(null)
  const [rangeStart, setRangeStart] = useState(1)
  const [rangeEnd, setRangeEnd] = useState(100)
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [separator, setSeparator] = useState('\\n')
  const [manualItems, setManualItems] = useState('')
  const [fontSize, setFontSize] = useState(10)
  const [fontHeight, setFontHeight] = useState(10)
  const [spacing, setSpacing] = useState(2)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.txt', '.csv'],
    },
    multiple: false
  })

  const handleConvert = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('prefix', prefix)
      formData.append('suffix', suffix)
      formData.append('fontSize', fontSize)
      formData.append('fontHeight', fontHeight)
      formData.append('spacing', spacing)

      if (mode === 'range') {
        formData.append('generateRange', 'true')
        formData.append('rangeStart', rangeStart)
        formData.append('rangeEnd', rangeEnd)
      } else if (mode === 'file' && file) {
        formData.append('file', file)
        formData.append('separator', separator === '\\n' ? '\n' : separator)
      } else if (mode === 'manual') {
        const items = manualItems.split('\n').filter(item => item.trim())
        formData.append('items', JSON.stringify(items))
      }

      const response = await axios.post('/api/convert/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Der opstod en fejl ved konvertering')
    } finally {
      setLoading(false)
    }
  }

  const getItemCount = () => {
    if (mode === 'range') {
      return Math.max(0, rangeEnd - rangeStart + 1)
    } else if (mode === 'manual') {
      return manualItems.split('\n').filter(item => item.trim()).length
    }
    return '?'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Hash className="w-5 h-5 text-green-400" />
            Batch / Nummer Generering
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Generer flere DXF filer på én gang (f.eks. husnumre 1-100)
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('range')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            mode === 'range'
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Hash className="w-4 h-4 inline mr-2" />
          Nummer Range
        </button>
        <button
          onClick={() => setMode('file')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            mode === 'file'
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Fra Fil
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <List className="w-4 h-4 inline mr-2" />
          Manuel Liste
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
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
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
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
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
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>
      )}

      {/* Prefix/Suffix */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Prefix (før nummer)</label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="F.eks. 'Nr. '"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Suffix (efter nummer)</label>
          <input
            type="text"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            placeholder="F.eks. 'A'"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Mode-specifik input */}
      {mode === 'range' && (
        <div className="bg-slate-700/50 rounded-xl p-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Start nummer</label>
              <input
                type="number"
                value={rangeStart}
                onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                min="0"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Slut nummer</label>
              <input
                type="number"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(parseInt(e.target.value) || 100)}
                min="0"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-3">
            Preview: {prefix}{rangeStart}{suffix}, {prefix}{rangeStart + 1}{suffix}, ... {prefix}{rangeEnd}{suffix}
          </p>
        </div>
      )}

      {mode === 'file' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Separator i fil</label>
            <select
              value={separator}
              onChange={(e) => setSeparator(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
            >
              <option value="\n">Ny linje (én pr. linje)</option>
              <option value=",">Komma (,)</option>
              <option value=";">Semikolon (;)</option>
              <option value="\t">Tab</option>
            </select>
          </div>
          
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              {isDragActive ? (
                <p className="text-green-400">Slip filen her...</p>
              ) : (
                <>
                  <p className="text-slate-300">Træk og slip en tekstfil her</p>
                  <p className="text-slate-500 text-sm mt-1">eller klik for at vælge</p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-green-400" />
                <span className="text-white">{file.name}</span>
              </div>
              <button
                onClick={() => setFile(null)}
                className="p-2 text-slate-400 hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div>
          <label className="block text-sm text-slate-300 mb-1">
            Indtast elementer (ét pr. linje)
          </label>
          <textarea
            value={manualItems}
            onChange={(e) => setManualItems(e.target.value)}
            placeholder="Element 1&#10;Element 2&#10;Element 3"
            rows={6}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none font-mono"
          />
        </div>
      )}

      {/* Info */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 flex items-center justify-between">
        <span className="text-slate-400">Antal DXF filer der genereres:</span>
        <span className="text-2xl font-bold text-green-400">{getItemCount()}</span>
      </div>

      {/* Konverter knap */}
      <button
        onClick={handleConvert}
        disabled={loading || (mode === 'file' && !file) || (mode === 'manual' && !manualItems.trim())}
        className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Genererer {getItemCount()} filer...
          </>
        ) : (
          <>
            <Hash className="w-5 h-5" />
            Generer DXF filer
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
              <p className="text-green-200 font-medium">{result.count} DXF filer genereret!</p>
              <p className="text-green-300/70 text-sm">Downloadet som ZIP: {result.filename}</p>
            </div>
            <a
              href={result.downloadUrl}
              download
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download ZIP
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
