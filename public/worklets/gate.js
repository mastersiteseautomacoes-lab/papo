// Portão de ruído do Papo (AudioWorklet).
// - decide "voz" quando o nível passa do limite por pelo menos minOpenMs (ignora cliques e teclas curtos);
// - atrasa o áudio em lookMs para que o início da palavra não seja cortado;
// - abre/fecha com rampa suave (sem estalos) e mantém aberto por holdMs depois da última voz.
class PapoGate extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.cfg = {
      enabled: true, openDb: -45, hysteresisDb: 6, holdMs: 150, minOpenMs: 25, lookMs: 40, attackMs: 3, releaseMs: 90,
      ...(options.processorOptions || {}),
    }
    this.delay = new Float32Array(Math.ceil(sampleRate * 0.25))
    this.w = 0
    this.open = false
    this.aboveMs = 0
    this.holdLeftMs = 0
    this.gain = 0
    this.acc = { n: 0, inSq: 0, outSq: 0, inPeak: 0 }
    this.reportEvery = Math.round(sampleRate * 0.05)
    this.report = options.processorOptions?.report !== false
    this.port.onmessage = (e) => { Object.assign(this.cfg, e.data) }
  }

  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0]
    const out = outputs[0] && outputs[0][0]
    if (!out) return true
    const n = out.length
    if (!inp) { out.fill(0); return true }

    const c = this.cfg
    let sq = 0
    for (let i = 0; i < n; i++) sq += inp[i] * inp[i]
    const rms = Math.sqrt(sq / n)
    const blockMs = (n / sampleRate) * 1000
    const openLin = Math.pow(10, c.openDb / 20)
    const closeLin = Math.pow(10, (c.openDb - c.hysteresisDb) / 20)

    if (!c.enabled) {
      this.open = true
    } else if (!this.open) {
      if (rms > openLin) {
        this.aboveMs += blockMs
        if (this.aboveMs >= c.minOpenMs) { this.open = true; this.aboveMs = 0; this.holdLeftMs = c.holdMs }
      } else this.aboveMs = 0
    } else if (rms > closeLin) {
      this.holdLeftMs = c.holdMs
    } else {
      this.holdLeftMs -= blockMs
      if (this.holdLeftMs <= 0) this.open = false
    }

    const target = this.open ? 1 : 0
    const coef = 1 - Math.exp(-1 / (sampleRate * ((target > this.gain ? c.attackMs : c.releaseMs) / 1000)))
    const look = c.enabled ? Math.min(this.delay.length - 1, Math.round((c.lookMs / 1000) * sampleRate)) : 0
    const len = this.delay.length
    let outSq = 0
    let peak = 0
    for (let i = 0; i < n; i++) {
      this.delay[this.w] = inp[i]
      const x = this.delay[(this.w - look + len) % len]
      this.w = (this.w + 1) % len
      this.gain += (target - this.gain) * coef
      const y = x * this.gain
      out[i] = y
      outSq += y * y
      const a = Math.abs(inp[i]); if (a > peak) peak = a
    }

    if (this.report) {
      const a = this.acc
      a.n += n; a.inSq += sq; a.outSq += outSq; if (peak > a.inPeak) a.inPeak = peak
      if (a.n >= this.reportEvery) {
        this.port.postMessage({ inRms: Math.sqrt(a.inSq / a.n), outRms: Math.sqrt(a.outSq / a.n), inPeak: a.inPeak, open: this.open })
        this.acc = { n: 0, inSq: 0, outSq: 0, inPeak: 0 }
      }
    }
    return true
  }
}
registerProcessor('papo-gate', PapoGate)
