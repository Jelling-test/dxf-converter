import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { FileImage, Download, Loader2, Settings, Upload, X } from 'lucide-react'

export default function ImageConverter() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [threshold, setThreshold] = useState(128)
  const [scale, setScale] = useState(1)
  const [invert, setInvert] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setResult(null)
      setError(null)
    }
  }, [])

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
    setPreview(null)
    setResult(null)
    setError(null)
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
        <div className="bg-slate-700/50 rounded-xl p-4 grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Threshold ({threshold})
            </label>
            <input
              type="range"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              min="0"
              max="255"
              className="w-full accent-purple-500"
            />
            <p className="text-xs text-slate-500 mt-1">Sort/hvid grænse</p>
          </div>
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
            <p className="text-xs text-slate-500 mt-1">Output størrelse</p>
          </div>
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
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 mx-auto rounded-lg"
            />
            <p className="text-center text-slate-400 text-sm mt-2">{file.name}</p>
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
