import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client'
import { buildGraph, type Graph, type Meter } from './pipeline'
import type { AudioSettings } from './settings'

/** Processador de microfone para o LiveKit: tudo que sai do app passa por aqui. */
export class MicProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = 'papo-mic'
  processedTrack?: MediaStreamTrack
  private ctx?: AudioContext
  private graph?: Graph
  private src?: MediaStreamAudioSourceNode
  private settings: AudioSettings
  private onMeter?: (m: Meter) => void

  constructor(settings: AudioSettings, onMeter?: (m: Meter) => void) {
    this.settings = settings
    this.onMeter = onMeter
  }

  async init(opts: AudioProcessorOptions) {
    // contexto próprio a 48 kHz: os filtros de ruído exigem essa taxa
    this.ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
    this.src = this.ctx.createMediaStreamSource(new MediaStream([opts.track]))
    this.graph = await buildGraph(this.ctx, this.src, this.settings, { onMeter: this.onMeter })
    // limitador: com ganho alto, picos não podem estourar (distorcer)
    const limiter = this.ctx.createDynamicsCompressor()
    limiter.threshold.value = -3
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.1
    const dest = this.ctx.createMediaStreamDestination()
    this.graph.output.connect(limiter)
    limiter.connect(dest)
    this.processedTrack = dest.stream.getAudioTracks()[0]
    if (this.ctx.state === 'suspended') await this.ctx.resume()
  }

  async restart(opts: AudioProcessorOptions) {
    await this.destroy()
    await this.init(opts)
  }

  async destroy() {
    this.graph?.dispose()
    this.graph = undefined
    this.processedTrack?.stop()
    this.processedTrack = undefined
    try { this.src?.disconnect() } catch { /* ignora */ }
    await this.ctx?.close().catch(() => {})
    this.ctx = undefined
  }

  /** muda limite do portão etc. sem reiniciar */
  update(s: AudioSettings) {
    this.settings = s
    this.graph?.setSettings(s)
  }
}
