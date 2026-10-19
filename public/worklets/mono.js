// Junta o microfone em um único canal escolhendo o que tem sinal.
// Alguns microfones (fones simples ligados na placa-mãe) saem só pelo canal direito ou só pelo esquerdo;
// ler "o primeiro canal" ou fazer a média perde a voz. Aqui o canal mais forte ganha, com mistura suave.
class PapoMono extends AudioWorkletProcessor {
  constructor() {
    super()
    this.eL = 0
    this.eR = 0
    this.w = 0.5 // peso do canal direito
    this.x = 0 // correlação cruzada suavizada (detecta canais com fase invertida)
    this.sign = 1
  }

  process(inputs, outputs) {
    const inp = inputs[0] || []
    const out = outputs[0] && outputs[0][0]
    if (!out) return true
    const L = inp[0]
    const R = inp[1]
    if (!L) { out.fill(0); return true }
    if (!R) { out.set(L); return true }
    const n = out.length
    let sl = 0, sr = 0, sx = 0
    for (let i = 0; i < n; i++) { sl += L[i] * L[i]; sr += R[i] * R[i]; sx += L[i] * R[i] }
    sl /= n; sr /= n; sx /= n
    this.x += (sx - this.x) * 0.02
    // energia com subida rápida e descida lenta: a voz aparece no canal certo já no primeiro bloco
    this.eL = sl > this.eL ? sl : this.eL + (sl - this.eL) * 0.01
    this.eR = sr > this.eR ? sr : this.eR + (sr - this.eR) * 0.01
    const total = this.eL + this.eR
    // canais com fase invertida se cancelariam ao somar: inverte o direito
    const norm = Math.sqrt(this.eL * this.eR) + 1e-20
    if (total > 1e-12) this.sign = this.x < -0.3 * norm ? -1 : this.x > 0.1 * norm ? 1 : this.sign
    let target = 0.5
    if (total > 1e-14) {
      const r = this.eR / total
      target = (r * r) / (r * r + (1 - r) * (1 - r)) // acentua o canal dominante
    }
    const w0 = this.w
    for (let i = 0; i < n; i++) {
      const w = w0 + ((target - w0) * (i + 1)) / n
      out[i] = L[i] * (1 - w) + R[i] * this.sign * w
    }
    this.w = target
    return true
  }
}
registerProcessor('papo-mono', PapoMono)
