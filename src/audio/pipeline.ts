import { loadRnnoise, loadGtcrn, RnnoiseWorkletNode, GtcrnWorkletNode } from '@sapphi-red/web-noise-suppressor'
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'
import gtcrnWorkletUrl from '@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?url'
import gtcrnWasmUrl from '@sapphi-red/web-noise-suppressor/gtcrn.wasm?url'
import type { AudioSettings, Engine } from './settings'

export interface Meter {
  /** nível na entrada do portão (já depois do filtro de ruído), 0..1 */
  inRms: number
  /** nível que realmente sai para os outros */
  outRms: number
  inPeak: number
  open: boolean
}

export interface Graph {
  /** microfone já reduzido a um canal (antes de ganho e filtros) */
  mono: AudioNode
  output: AudioNode
  setSettings: (s: AudioSettings) => void
  dispose: () => void
}

let rnnoiseBin: Promise<ArrayBuffer> | null = null
let gtcrnBin: Promise<ArrayBuffer> | null = null

function gateOptions(s: AudioSettings, report: boolean) {
  return {
    enabled: s.gateOn, openDb: s.openDb, hysteresisDb: s.hysteresisDb,
    holdMs: s.holdMs, minOpenMs: s.minOpenMs, lookMs: s.lookMs, report,
  }
}

/**
 * Monta: entrada → passa-altas (80 Hz) → filtro de ruído (RNNoise/GTCRN) → portão.
 * Funciona tanto com AudioContext (ao vivo) quanto OfflineAudioContext (calibração).
 */
export async function buildGraph(
  ctx: BaseAudioContext,
  input: AudioNode,
  settings: AudioSettings,
  opts: { engine?: Engine; onMeter?: (m: Meter) => void } = {},
): Promise<Graph> {
  const engine = opts.engine ?? settings.engine
  await ctx.audioWorklet.addModule('/worklets/gate.js')
  await ctx.audioWorklet.addModule('/worklets/mono.js')

  // microfones que só saem por um lado (esquerdo ou direito): escolhe o canal com sinal
  const mono = new AudioWorkletNode(ctx, 'papo-mono', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete',
  })
  input.connect(mono)

  // ganho de entrada: microfones fracos (fones simples) chegam muito baixos
  const pre = ctx.createGain()
  pre.gain.value = 10 ** (settings.inputGainDb / 20)
  mono.connect(pre)

  // corta batidas de mesa e a parte grave da respiração
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 80
  hp.Q.value = 0.7
  pre.connect(hp)

  let last: AudioNode = hp
  let denoise: RnnoiseWorkletNode | GtcrnWorkletNode | null = null
  if (engine === 'rnnoise') {
    rnnoiseBin ??= loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl })
    const [bin] = await Promise.all([rnnoiseBin, ctx.audioWorklet.addModule(rnnoiseWorkletUrl)])
    denoise = new RnnoiseWorkletNode(ctx as AudioContext, { maxChannels: 1, wasmBinary: bin })
  } else if (engine === 'gtcrn') {
    gtcrnBin ??= loadGtcrn({ url: gtcrnWasmUrl })
    const [bin] = await Promise.all([gtcrnBin, ctx.audioWorklet.addModule(gtcrnWorkletUrl)])
    denoise = new GtcrnWorkletNode(ctx as AudioContext, { maxChannels: 1, wasmBinary: bin })
  }
  if (denoise) { last.connect(denoise); last = denoise }

  const gate = new AudioWorkletNode(ctx, 'papo-gate', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    processorOptions: gateOptions(settings, !!opts.onMeter),
  })
  if (opts.onMeter) gate.port.onmessage = (e) => opts.onMeter!(e.data as Meter)
  last.connect(gate)

  return {
    mono,
    output: gate,
    setSettings: (s) => {
      pre.gain.value = 10 ** (s.inputGainDb / 20)
      gate.port.postMessage(gateOptions(s, !!opts.onMeter))
    },
    dispose: () => {
      try { input.disconnect(mono) } catch { /* já desconectado */ }
      try { mono.disconnect() } catch { /* ignora */ }
      try { denoise?.destroy() } catch { /* ignora */ }
      gate.port.onmessage = null
      try { gate.disconnect() } catch { /* ignora */ }
    },
  }
}
