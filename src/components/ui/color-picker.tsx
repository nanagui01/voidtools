
import { useRef, useCallback, useEffect } from "react"

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0")
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`
}

function hexToHsv(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 1]
  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return [h, s, v]
}

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  onChangeEnd?: (color: string) => void
}

export function ColorPicker({ value, onChange, onChangeEnd }: ColorPickerProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const hueThumbRef = useRef<HTMLDivElement>(null)
  const areaContainerRef = useRef<HTMLDivElement>(null)
  const draggingArea = useRef(false)
  const draggingHue = useRef(false)
  const hsvRef = useRef<[number, number, number]>(hexToHsv(value))
  const rafId = useRef(0)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onChangeEndRef = useRef(onChangeEnd)
  onChangeEndRef.current = onChangeEnd

  const updateThumbs = useCallback(() => {
    const [h, s, v] = hsvRef.current
    if (thumbRef.current) {
      thumbRef.current.style.left = `${s * 100}%`
      thumbRef.current.style.top = `${(1 - v) * 100}%`
    }
    if (hueThumbRef.current) {
      const pureHue = hsvToHex(h, 1, 1)
      hueThumbRef.current.style.left = `${(h / 360) * 100}%`
      hueThumbRef.current.style.backgroundColor = pureHue
    }
    if (areaContainerRef.current) {
      const pureHue = hsvToHex(h, 1, 1)
      areaContainerRef.current.style.background =
        `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`
    }
  }, [])

  useEffect(() => {
    const current = hsvToHex(hsvRef.current[0], hsvRef.current[1], hsvRef.current[2])
    if (current.toLowerCase() !== value.toLowerCase()) {
      hsvRef.current = hexToHsv(value)
      updateThumbs()
    }
  }, [value, updateThumbs])

  const scheduleEmit = useCallback(() => {
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      const [h, s, v] = hsvRef.current
      onChangeRef.current(hsvToHex(h, s, v))
    })
  }, [])

  const handleArea = useCallback((e: MouseEvent | React.MouseEvent) => {
    const el = areaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    hsvRef.current = [hsvRef.current[0], x, 1 - y]
    updateThumbs()
    scheduleEmit()
  }, [updateThumbs, scheduleEmit])

  const handleHue = useCallback((e: MouseEvent | React.MouseEvent) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    hsvRef.current = [x * 360, hsvRef.current[1], hsvRef.current[2]]
    updateThumbs()
    scheduleEmit()
  }, [updateThumbs, scheduleEmit])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingArea.current) handleArea(e)
      else if (draggingHue.current) handleHue(e)
    }
    const onUp = () => {
      if (draggingArea.current || draggingHue.current) {
        const [h, s, v] = hsvRef.current
        onChangeEndRef.current?.(hsvToHex(h, s, v))
      }
      draggingArea.current = false
      draggingHue.current = false
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      cancelAnimationFrame(rafId.current)
    }
  }, [handleArea, handleHue])

  const [h, s, v] = hsvRef.current
  const pureHue = hsvToHex(h, 1, 1)

  return (
    <div className="w-full max-w-[240px] space-y-3">
      <div
        ref={(el) => { areaRef.current = el; areaContainerRef.current = el }}
        className="relative h-36 cursor-crosshair rounded-lg select-none"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})` }}
        onMouseDown={(e) => { draggingArea.current = true; handleArea(e) }}
      >
        <div
          ref={thumbRef}
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
        />
      </div>

      <div
        ref={hueRef}
        className="relative h-3 cursor-pointer rounded-full select-none"
        style={{ background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)" }}
        onMouseDown={(e) => { draggingHue.current = true; handleHue(e) }}
      >
        <div
          ref={hueThumbRef}
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{ left: `${(h / 360) * 100}%`, backgroundColor: pureHue }}
        />
      </div>
    </div>
  )
}
