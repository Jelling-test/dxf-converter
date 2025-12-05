import { useState } from 'react'
import { FileImage, Type, FileText, Download, Settings, Layers, Hash, Sparkles } from 'lucide-react'
import ImageConverter from './components/ImageConverter'
import TextConverter from './components/TextConverter'
import BatchConverter from './components/BatchConverter'
import StringArtConverter from './components/StringArtConverter'

function App() {
  const [activeTab, setActiveTab] = useState('text')

  const tabs = [
    { id: 'text', label: 'Tekst', icon: Type, description: 'Konverter tekst til DXF' },
    { id: 'image', label: 'Billede', icon: FileImage, description: 'Konverter billeder til DXF' },
    { id: 'stringart', label: 'String Art', icon: Sparkles, description: 'Lav string art mønster' },
    { id: 'batch', label: 'Batch/Numre', icon: Hash, description: 'Generer flere DXF filer' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">DXF Konverter</h1>
              <p className="text-sm text-slate-400">Tekst & Billeder til DXF filer</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6">
          {activeTab === 'text' && <TextConverter />}
          {activeTab === 'image' && <ImageConverter />}
          {activeTab === 'stringart' && <StringArtConverter />}
          {activeTab === 'batch' && <BatchConverter />}
        </div>

        {/* Info Section */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <Type className="w-8 h-8 text-blue-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Tekst til DXF</h3>
            <p className="text-sm text-slate-400">Single-stroke font optimeret til CNC og laser</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <FileImage className="w-8 h-8 text-purple-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Billede til DXF</h3>
            <p className="text-sm text-slate-400">Vektoriserer billeder automatisk</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <Sparkles className="w-8 h-8 text-orange-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">String Art</h3>
            <p className="text-sm text-slate-400">Billede til string art mønster</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-12 py-6 text-center text-slate-500 text-sm">
        DXF Konverter - Lokal applikation
      </footer>
    </div>
  )
}

export default App
