// Grava o microfone cru (mono, Float32) para a calibração.
class PapoRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) this.port.postMessage(ch.slice(0))
    return true
  }
}
registerProcessor('papo-recorder', PapoRecorder)
