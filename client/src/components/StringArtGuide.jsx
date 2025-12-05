import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, X, Download, Settings, RotateCcw } from 'lucide-react'

export default function StringArtGuide({ 
  sequence, // Array af søm-numre i rækkefølge
  pins,     // Array af pin-positioner {x, y, id}
  totalLines,
  onClose 
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1000) // ms mellem steps
  const [showSettings, setShowSettings] = useState(false)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)

  // Gem progress i localStorage
  const storageKey = `stringart-progress-${totalLines}`
  
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = parseInt(saved)
      if (!isNaN(parsed) && parsed < sequence.length - 1) {
        setCurrentStep(parsed)
      }
    }
  }, [storageKey, sequence.length])

  useEffect(() => {
    localStorage.setItem(storageKey, currentStep.toString())
  }, [currentStep, storageKey])

  // Auto-play
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= sequence.length - 2) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, speed)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, speed, sequence.length])

  // Tegn canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pins || pins.length === 0) return

    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const padding = 40
    const scale = (size - padding * 2) / Math.max(
      Math.max(...pins.map(p => p.x)) - Math.min(...pins.map(p => p.x)),
      Math.max(...pins.map(p => p.y)) - Math.min(...pins.map(p => p.y))
    )
    
    const minX = Math.min(...pins.map(p => p.x))
    const minY = Math.min(...pins.map(p => p.y))
    
    const toCanvas = (pin) => ({
      x: padding + (pin.x - minX) * scale,
      y: size - padding - (pin.y - minY) * scale
    })

    // Clear
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, size, size)

    // Tegn ramme (cirkel)
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(size/2, size/2, (size - padding*2) / 2, 0, Math.PI * 2)
    ctx.stroke()

    // Tegn allerede tegnede linjer (grå)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < currentStep; i++) {
      const from = pins[sequence[i]]
      const to = pins[sequence[i + 1]]
      if (from && to) {
        const p1 = toCanvas(from)
        const p2 = toCanvas(to)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }

    // Tegn aktuel linje (orange)
    if (currentStep < sequence.length - 1) {
      const from = pins[sequence[currentStep]]
      const to = pins[sequence[currentStep + 1]]
      if (from && to) {
        const p1 = toCanvas(from)
        const p2 = toCanvas(to)
        ctx.strokeStyle = '#f97316'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }

    // Tegn søm
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i]
      const p = toCanvas(pin)
      
      // Bestem farve baseret på status
      const isFrom = sequence[currentStep] === i
      const isTo = sequence[currentStep + 1] === i
      
      ctx.beginPath()
      ctx.arc(p.x, p.y, isFrom || isTo ? 6 : 3, 0, Math.PI * 2)
      
      if (isFrom) {
        ctx.fillStyle = '#22c55e' // Grøn = fra
      } else if (isTo) {
        ctx.fillStyle = '#f97316' // Orange = til
      } else {
        ctx.fillStyle = '#64748b'
      }
      ctx.fill()

      // Søm-nummer for aktive søm
      if (isFrom || isTo) {
        ctx.fillStyle = 'white'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(i.toString(), p.x, p.y - 12)
      }
    }
  }, [currentStep, pins, sequence])

  const goToStep = (step) => {
    setCurrentStep(Math.max(0, Math.min(step, sequence.length - 2)))
  }

  const handleJumpInput = (e) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value)) {
      goToStep(value - 1)
    }
  }

  const reset = () => {
    setCurrentStep(0)
    setIsPlaying(false)
    localStorage.removeItem(storageKey)
  }

  const downloadInstructions = () => {
    let text = `String Art Vejledning\n`
    text += `=====================\n\n`
    text += `Antal søm: ${pins.length}\n`
    text += `Antal linjer: ${sequence.length - 1}\n\n`
    text += `Instruktioner:\n`
    text += `--------------\n\n`
    
    for (let i = 0; i < sequence.length - 1; i++) {
      text += `${i + 1}. Søm ${sequence[i]} → Søm ${sequence[i + 1]}\n`
    }
    
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'string-art-instruktioner.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!sequence || sequence.length < 2) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-slate-800 p-6 rounded-lg">
          <p className="text-white">Ingen sekvens tilgængelig. Generer først et preview.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-orange-600 text-white rounded">
            Luk
          </button>
        </div>
      </div>
    )
  }

  const progress = ((currentStep + 1) / (sequence.length - 1)) * 100
  const fromPin = sequence[currentStep]
  const toPin = sequence[currentStep + 1]

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white">String Art Vejledning</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-slate-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={downloadInstructions}
            className="p-2 text-slate-400 hover:text-white"
            title="Download instruktioner"
          >
            <Download className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <label className="text-sm text-slate-300 block mb-2">
            Hastighed: {(speed / 1000).toFixed(1)}s per linje
          </label>
          <input
            type="range"
            min="200"
            max="5000"
            step="100"
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value))}
            className="w-full max-w-xs"
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            width={500}
            height={500}
            className="bg-slate-900 rounded-lg shadow-xl max-w-full max-h-full"
          />
        </div>

        {/* Info panel */}
        <div className="lg:w-80 p-4 bg-slate-800 border-t lg:border-t-0 lg:border-l border-slate-700">
          {/* Aktuel instruktion */}
          <div className="bg-slate-900 rounded-lg p-6 mb-4 text-center">
            <p className="text-slate-400 text-sm mb-2">Linje {currentStep + 1} af {sequence.length - 1}</p>
            <div className="flex items-center justify-center gap-4 text-3xl font-bold">
              <span className="text-green-500">{fromPin}</span>
              <span className="text-slate-500">→</span>
              <span className="text-orange-500">{toPin}</span>
            </div>
            <p className="text-slate-500 text-sm mt-2">
              Fra søm <span className="text-green-400">{fromPin}</span> til søm <span className="text-orange-400">{toPin}</span>
            </p>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-slate-400 mb-1">
              <span>Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Jump to */}
          <div className="mb-4">
            <label className="text-sm text-slate-400 block mb-1">Gå til linje:</label>
            <input
              type="number"
              min="1"
              max={sequence.length - 1}
              value={currentStep + 1}
              onChange={handleJumpInput}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded"
            />
          </div>

          {/* Reset */}
          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded mb-4"
          >
            <RotateCcw className="w-4 h-4" />
            Start forfra
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex items-center justify-center gap-2">
          {/* Skip to start */}
          <button
            onClick={() => goToStep(0)}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Back 10 */}
          <button
            onClick={() => goToStep(currentStep - 10)}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
            title="-10"
          >
            <ChevronLeft className="w-5 h-5" />
            <ChevronLeft className="w-5 h-5 -ml-3" />
          </button>

          {/* Back 1 */}
          <button
            onClick={() => goToStep(currentStep - 1)}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-4 bg-orange-600 hover:bg-orange-500 text-white rounded-full"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          {/* Forward 1 */}
          <button
            onClick={() => goToStep(currentStep + 1)}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Forward 10 */}
          <button
            onClick={() => goToStep(currentStep + 10)}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
            title="+10"
          >
            <ChevronRight className="w-5 h-5" />
            <ChevronRight className="w-5 h-5 -ml-3" />
          </button>

          {/* Skip to end */}
          <button
            onClick={() => goToStep(sequence.length - 2)}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
