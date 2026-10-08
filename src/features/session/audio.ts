// The rest-timer sound: one <audio> element carrying a short generated tone,
// unlocked by playing it silently on the first tick (browsers only allow
// audio after a user gesture). No vibration dependence: iOS has none.

let element: HTMLAudioElement | null = null
let unlocked = false

/** A 0.6 s two-note tone as a WAV data URL, built once; no asset to ship. */
function toneDataUrl(): string {
  const rate = 22050
  const seconds = 0.6
  const n = Math.floor(rate * seconds)
  const bytes = new Uint8Array(44 + n * 2)
  const view = new DataView(bytes.buffer)
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i)
  }
  str(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    const freq = t < 0.3 ? 880 : 1175
    const env = t < 0.3 ? Math.min(1, t * 40) * (1 - (t / 0.3) * 0.6) : Math.min(1, (t - 0.3) * 40) * (1 - (t - 0.3) / 0.3)
    const v = Math.sin(2 * Math.PI * freq * t) * env * 0.5
    view.setInt16(44 + i * 2, Math.round(v * 32767), true)
  }
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `data:audio/wav;base64,${btoa(bin)}`
}

function el(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null
  if (!element) {
    element = document.createElement('audio')
    element.src = toneDataUrl()
    element.preload = 'auto'
  }
  return element
}

/** Call from the first set-complete tap. Plays muted once so later plays are allowed. */
export function unlockAudio(): void {
  if (unlocked) return
  const a = el()
  if (!a) return
  a.muted = true
  const p = a.play()
  if (p && typeof p.then === 'function') {
    p.then(() => {
      a.pause()
      a.currentTime = 0
      a.muted = false
      unlocked = true
    }).catch(() => {
      a.muted = false
    })
  } else {
    a.muted = false
    unlocked = true
  }
}

export function playTimerEnd(): void {
  const a = el()
  if (!a) return
  a.currentTime = 0
  const p = a.play()
  if (p && typeof p.catch === 'function') p.catch(() => undefined)
}
