export type Engine = 'off' | 'rnnoise' | 'gtcrn'

export interface AudioSettings {
  /** microfone escolhido ('' = padrão do Windows) */
  deviceId: string
  /** ganho fixo na entrada (dB). Microfones fracos, como o de fones simples, precisam de ganho */
  inputGainDb: number
  /** ganho automático do navegador (sobe tudo, inclusive ruído; deixe desligado se o filtro estiver ligado) */
  autoGain: boolean
  /** 'off' usa só o tratamento do navegador (como antes) */
  engine: Engine
  /** portão de ruído: só deixa passar o que parece voz */
  gateOn: boolean
  /** nível (dB) a partir do qual o som é considerado voz */
  openDb: number
  /** diferença (dB) entre abrir e fechar o portão */
  hysteresisDb: number
  /** tempo que o portão fica aberto depois da última voz */
  holdMs: number
  /** o som precisa durar isso para abrir o portão (ignora cliques/teclas) */
  minOpenMs: number
  /** atraso interno para não cortar o começo das palavras */
  lookMs: number
}

export const DEFAULT_AUDIO: AudioSettings = {
  deviceId: '',
  inputGainDb: 0,
  autoGain: false,
  engine: 'rnnoise',
  gateOn: true,
  openDb: -45,
  hysteresisDb: 6,
  holdMs: 150,
  minOpenMs: 25,
  lookMs: 40,
}

const KEY = 'papo.audio'
let current: AudioSettings = load()
const listeners = new Set<(s: AudioSettings) => void>()

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_AUDIO, ...JSON.parse(raw) }
  } catch { /* sem storage */ }
  return { ...DEFAULT_AUDIO }
}

export const getAudioSettings = () => current

export function setAudioSettings(patch: Partial<AudioSettings>) {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* sem storage */ }
  listeners.forEach((l) => l(current))
}

export function subscribeAudioSettings(fn: (s: AudioSettings) => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Restrições de captura do microfone para cada modo. */
export function captureConstraints(engine: Engine, deviceId = getAudioSettings().deviceId): {
  echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean; channelCount: number; sampleRate: number
  deviceId?: { exact: string }
} {
  const processed = engine !== 'off'
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: true, // continua ligado: evita eco se você usa caixa de som
    noiseSuppression: !processed, // nossos filtros fazem esse trabalho
    autoGainControl: !processed || getAudioSettings().autoGain, // ganho automático "sobe" respiração e ruído no silêncio
    channelCount: 1,
    sampleRate: 48000,
  }
}
