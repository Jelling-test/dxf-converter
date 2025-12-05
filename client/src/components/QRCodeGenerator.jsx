import { useState } from 'react'
import axios from 'axios'
import { QrCode, Download, Loader2, Link, Type, Wifi, MapPin, RefreshCw } from 'lucide-react'

const QR_TYPES = [
  { id: 'url', name: 'URL / Webadresse', icon: Link, placeholder: 'https://example.com', description: 'Åbner en hjemmeside' },
  { id: 'text', name: 'Tekst', icon: Type, placeholder: 'Din tekst her...', description: 'Viser teksten' },
  { id: 'wifi', name: 'WiFi Netværk', icon: Wifi, placeholder: '', description: 'Forbinder til WiFi' },
  { id: 'geo', name: 'GPS Lokation', icon: MapPin, placeholder: '55.6761, 12.5683', description: 'Åbner kort' },
]

const SIZE_OPTIONS = [
  { value: 30, label: '30mm (lille)' },
  { value: 50, label: '50mm (medium)' },
  { value: 80, label: '80mm (stor)' },
  { value: 100, label: '100mm (ekstra stor)' },
]

export default function QRCodeGenerator() {
  const [selectedType, setSelectedType] = useState('url')
  const [inputData, setInputData] = useState('')
  const [wifiData, setWifiData] = useState({ ssid: '', password: '', encryption: 'WPA' })
  const [size, setSize] = useState(50)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const getDataForType = () => {
    switch (selectedType) {
      case 'wifi':
        return JSON.stringify(wifiData)
      default:
        return inputData
    }
  }

  const generatePreview = async () => {
    const data = getDataForType()
    if (!data || (selectedType === 'wifi' && !wifiData.ssid)) {
      setError('Indtast venligst data')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await axios.post('/api/preview/qrcode', {
        type: selectedType,
        data: data,
        size: 400
      }, {
        responseType: 'blob'
      })

      const imageUrl = URL.createObjectURL(response.data)
      setPreview(imageUrl)
    } catch (err) {
      setError(err.response?.data?.error || 'Kunne ikke generere QR-kode')
    } finally {
      setLoading(false)
    }
  }

  const handleConvert = async () => {
    const data = getDataForType()
    if (!data || (selectedType === 'wifi' && !wifiData.ssid)) {
      setError('Indtast venligst data')
      return
    }

    setConverting(true)
    setError(null)

    try {
      const response = await axios.post('/api/convert/qrcode', {
        type: selectedType,
        data: data,
        size: size
      })

      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Kunne ikke konvertere QR-kode')
    } finally {
      setConverting(false)
    }
  }

  const currentType = QR_TYPES.find(t => t.id === selectedType)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-orange-400" />
            QR-kode Generator
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Generer QR-koder til laser/CNC gravering
          </p>
        </div>
      </div>

      {/* Type vælger */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QR_TYPES.map((type) => {
          const Icon = type.icon
          return (
            <button
              key={type.id}
              onClick={() => {
                setSelectedType(type.id)
                setPreview(null)
                setResult(null)
              }}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedType === type.id
                  ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs block">{type.name}</span>
            </button>
          )
        })}
      </div>

      {/* Input baseret på type */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 text-slate-300">
          {currentType && <currentType.icon className="w-4 h-4" />}
          <span className="font-medium">{currentType?.name}</span>
          <span className="text-slate-500 text-sm">- {currentType?.description}</span>
        </div>

        {selectedType === 'wifi' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Netværksnavn (SSID)</label>
              <input
                type="text"
                value={wifiData.ssid}
                onChange={(e) => setWifiData({ ...wifiData, ssid: e.target.value })}
                placeholder="Mit WiFi netværk"
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Adgangskode</label>
              <input
                type="text"
                value={wifiData.password}
                onChange={(e) => setWifiData({ ...wifiData, password: e.target.value })}
                placeholder="password123"
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Sikkerhed</label>
              <select
                value={wifiData.encryption}
                onChange={(e) => setWifiData({ ...wifiData, encryption: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
              >
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">Åbent netværk</option>
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              {selectedType === 'url' ? 'Webadresse' : selectedType === 'geo' ? 'Koordinater (lat, lng)' : 'Tekst'}
            </label>
            <input
              type="text"
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              placeholder={currentType?.placeholder}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
            />
            {selectedType === 'geo' && (
              <p className="text-xs text-slate-500 mt-1">
                Eksempel: 55.6761, 12.5683 (København)
              </p>
            )}
          </div>
        )}

        {/* Størrelse vælger */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">DXF størrelse</label>
          <select
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
          >
            {SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Preview knap */}
        <button
          onClick={generatePreview}
          disabled={loading}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {loading ? 'Genererer...' : 'Generer Preview'}
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-orange-400" />
            Preview - Scan med din telefon!
          </h3>
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg">
              <img 
                src={preview} 
                alt="QR Code Preview" 
                className="max-w-[300px] w-full"
              />
            </div>
          </div>
          <p className="text-center text-slate-400 text-sm mt-2">
            Scan QR-koden med din telefons kamera for at teste den
          </p>
        </div>
      )}

      {/* Konverter knap */}
      <button
        onClick={handleConvert}
        disabled={converting || loading}
        className="w-full py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {converting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Konverterer...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Download DXF ({size}mm)
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
              <p className="text-green-300 font-medium">QR-kode DXF genereret!</p>
              <p className="text-green-300/70 text-sm">{result.filename}</p>
              <p className="text-green-400/60 text-xs mt-1">
                {result.moduleCount}x{result.moduleCount} moduler • {result.size}mm
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

      {/* Info */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4">
        <h3 className="text-blue-300 font-medium mb-2">💡 Tips</h3>
        <ul className="text-sm text-blue-200/80 space-y-1">
          <li>• Større QR-koder er nemmere at scanne</li>
          <li>• URL'er skal starte med http:// eller https://</li>
          <li>• WiFi QR-koder virker på de fleste smartphones</li>
          <li>• DXF filen har lag: FRAME (ramme) og QR_MODULES (koden)</li>
        </ul>
      </div>
    </div>
  )
}
