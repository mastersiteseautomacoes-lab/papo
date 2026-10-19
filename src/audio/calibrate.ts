import { buildGraph } from './pipeline'
import { DEFAULT_AUDIO, type AudioSettings, type Engine } from './settings'

export const SR = 48000

export interface PhaseDef {
  id: 'silence' | 'speech' | 'breath' | 'mouse' | 'keys' | 'mixed'
  prompt: string
  seconds: number
}

export const PHASES: PhaseDef[] = [
  { id: 'silence', prompt: 'Fique em silêncio, sem se mexer', seconds: 5 },
  { id: 'speech', prompt: 'Fale normalmente, em voz alta (leia qualquer coisa)', seconds: 8 },
  { id: 'breath', prompt: 'Respire forte perto do microfone, sem falar', seconds: 6 },
  { id: 'mouse', prompt: 'Clique no mouse várias vezes, sem falar', seconds: 5 },
  { id: 'keys', prompt: 'Digite no teclado, sem falar', seconds: 6 },
  { id: 'mixed', prompt: 'Fale enquanto digita e clica', seconds: 8 },
]

const PREPARE_S = 3 // contagem antes de cada fase (não entra na análise)

export interface Recording {
  samples: Float32Array
  ranges: { id: PhaseDef['id']; start: number; end: number }[]
}

export interface Progress {
  phase: number
  stage: 'prepare' | 'record' | 'done'
  left: number
  prompt: string
}

/** Grava o microfone SEM nenhum tratamento, seguindo as fases. */
export async function recordRaw(onProgress: (p: Progress) => void, signal?: AbortSignal, deviceId = ''): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1, sampleRate: SR,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  })
  const ctx = new AudioContext({ sampleRate: SR })
  try {
    await ctx.audioWorklet.addModule('/worklets/recorder.js')
    await ctx.audioWorklet.addModule('/worklets/mono.js')
    const src = ctx.createMediaStreamSource(stream)
    // grava o canal que tem sinal (alguns microfones saem só pelo lado direito ou esquerdo)
    const mono = new AudioWorkletNode(ctx, 'papo-mono', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete',
    })
    const rec = new AudioWorkletNode(ctx, 'papo-recorder', { numberOfOutputs: 0 })
    const chunks: Float32Array[] = []
    let total = 0
    rec.port.onmessage = (e) => { chunks.push(e.data as Float32Array); total += (e.data as Float32Array).length }
    src.connect(mono)
    mono.connect(rec)
    if (ctx.state === 'suspended') await ctx.resume()

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const ranges: Recording['ranges'] = []
    for (let i = 0; i < PHASES.length; i++) {
      const ph = PHASES[i]
      for (let s = PREPARE_S; s > 0; s--) {
        if (signal?.aborted) throw new Error('cancelado')
        onProgress({ phase: i, stage: 'prepare', left: s, prompt: ph.prompt })
        await sleep(1000)
      }
      const start = total
      for (let s = ph.seconds; s > 0; s--) {
        if (signal?.aborted) throw new Error('cancelado')
        onProgress({ phase: i, stage: 'record', left: s, prompt: ph.prompt })
        await sleep(1000)
      }
      ranges.push({ id: ph.id, start, end: total })
    }
    onProgress({ phase: PHASES.length, stage: 'done', left: 0, prompt: '' })
    const samples = new Float32Array(total)
    let o = 0
    for (const c of chunks) { samples.set(c, o); o += c.length }
    return { samples, ranges }
  } finally {
    stream.getTracks().forEach((t) => t.stop())
    await ctx.close().catch(() => {})
  }
}

// ---------- análise ----------

/** Roda o filtro de ruído (sem portão) sobre a gravação, mais rápido que em tempo real. */
export async function denoiseOffline(samples: Float32Array, engine: Engine): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, samples.length, SR)
  const buf = ctx.createBuffer(1, samples.length, SR)
  buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const g = await buildGraph(ctx, src, { ...DEFAULT_AUDIO, gateOn: false, lookMs: 0 }, { engine })
  g.output.connect(ctx.destination)
  src.start()
  // O WebAssembly do filtro carrega dentro do worklet de forma assíncrona. Numa renderização offline
  // (mais rápida que o tempo real) o áudio acabaria antes de ele ficar pronto, e sairia silêncio.
  // Por isso pausamos logo no começo e esperamos o filtro iniciar.
  const ready = ctx.suspend(0.02).then(async () => {
    await new Promise((r) => setTimeout(r, 800))
    await ctx.resume()
  })
  const [out] = await Promise.all([ctx.startRendering(), ready])
  return out.getChannelData(0).slice()
}

/**
 * Mesma lógica do public/worklets/gate.js (mantenha as duas em sincronia).
 * Serve para testar vários limites rapidamente sem renderizar de novo.
 */
export function simulateGate(x: Float32Array, cfg: Pick<AudioSettings, 'openDb' | 'hysteresisDb' | 'holdMs' | 'minOpenMs' | 'lookMs'>): Float32Array {
  const out = new Float32Array(x.length)
  const B = 128
  const blockMs = (B / SR) * 1000
  const openLin = 10 ** (cfg.openDb / 20)
  const closeLin = 10 ** ((cfg.openDb - cfg.hysteresisDb) / 20)
  const look = Math.round((cfg.lookMs / 1000) * SR)
  const attack = 1 - Math.exp(-1 / (SR * 0.003))
  const release = 1 - Math.exp(-1 / (SR * 0.09))
  let open = false, above = 0, hold = 0, gain = 0
  for (let b = 0; b + B <= x.length; b += B) {
    let sq = 0
    for (let i = 0; i < B; i++) sq += x[b + i] * x[b + i]
    const rms = Math.sqrt(sq / B)
    if (!open) {
      if (rms > openLin) { above += blockMs; if (above >= cfg.minOpenMs) { open = true; above = 0; hold = cfg.holdMs } } else above = 0
    } else if (rms > closeLin) hold = cfg.holdMs
    else { hold -= blockMs; if (hold <= 0) open = false }
    const target = open ? 1 : 0
    const coef = target > gain ? attack : release
    for (let i = 0; i < B; i++) {
      gain += (target - gain) * coef
      const j = b + i - look
      out[b + i] = (j >= 0 ? x[j] : 0) * gain
    }
  }
  return out
}

const FRAME = Math.round(SR * 0.05)

function frameDb(x: Float32Array, from: number, to: number): number[] {
  const res: number[] = []
  for (let s = from; s + FRAME <= to; s += FRAME) {
    let sq = 0
    for (let i = 0; i < FRAME; i++) sq += x[s + i] * x[s + i]
    res.push(10 * Math.log10(sq / FRAME + 1e-12))
  }
  return res
}

const pct = (a: number[], p: number) => {
  if (!a.length) return -120
  const s = [...a].sort((u, v) => u - v)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

/** janela útil da fase: tira o tempo de reação no começo e uma folga no fim */
const usable = (r: Recording['ranges'][number]) => ({ from: r.start + Math.round(SR * 1.0), to: r.end - Math.round(SR * 0.2) })

export interface PhaseStat {
  /** % dos quadros de 50 ms em que algo passou para os outros (quanto menor, melhor nas fases de ruído) */
  passPct: number
  /** nível médio (dB) do que passou */
  passDb: number
}

export interface EvalResult {
  engine: Engine
  openDb: number
  minOpenMs: number
  /** fases de ruído: quanto vazou */
  noise: Record<'silence' | 'breath' | 'mouse' | 'keys', PhaseStat>
  /** fala: % dos quadros com voz que continuaram passando */
  speechKept: number
  mixedKept: number
  /** pior caso entre respiração/mouse/teclado */
  worstNoisePct: number
}

const PASS_DB = -60

function evaluate(raw: Float32Array, den: Float32Array, rec: Recording, engine: Engine, openDb: number, minOpenMs: number, baseline: boolean): EvalResult {
  const cfg = { openDb, hysteresisDb: 6, holdMs: 150, minOpenMs, lookMs: 40 }
  const out = baseline ? den : simulateGate(den, cfg)
  const get = (id: PhaseDef['id']) => rec.ranges.find((r) => r.id === id)!
  const noiseStat = (id: 'silence' | 'breath' | 'mouse' | 'keys'): PhaseStat => {
    const { from, to } = usable(get(id))
    const db = frameDb(out, from, to)
    const passed = db.filter((d) => d > PASS_DB)
    return { passPct: db.length ? (100 * passed.length) / db.length : 0, passDb: passed.length ? passed.reduce((a, b) => a + b, 0) / passed.length : -120 }
  }
  const silence = get('silence')
  const floor = pct(frameDb(raw, silence.start + SR, silence.end - Math.round(SR * 0.2)), 95)
  const voicedThreshold = Math.max(floor + 14, -52) // quadros em que o microfone cru está claramente "falando"
  const kept = (id: 'speech' | 'mixed') => {
    const { from, to } = usable(get(id))
    const rawDb = frameDb(raw, from, to)
    const outDb = frameDb(out, from, to)
    let voiced = 0, ok = 0
    for (let i = 0; i < rawDb.length; i++) if (rawDb[i] > voicedThreshold) { voiced++; if (outDb[i] > PASS_DB) ok++ }
    return voiced ? (100 * ok) / voiced : 0
  }
  const noise = { silence: noiseStat('silence'), breath: noiseStat('breath'), mouse: noiseStat('mouse'), keys: noiseStat('keys') }
  return {
    engine, openDb, minOpenMs, noise,
    speechKept: kept('speech'), mixedKept: kept('mixed'),
    worstNoisePct: Math.max(noise.breath.passPct, noise.mouse.passPct, noise.keys.passPct),
  }
}

export interface Analysis {
  /** sem nenhum filtro (referência) */
  baseline: EvalResult
  /** melhor configuração por filtro */
  perEngine: Partial<Record<Engine, EvalResult>>
  best: EvalResult
  rawFloorDb: number
  durationS: number
  /** ganho de entrada aplicado na análise (dB) */
  gainDb: number
}

/** Frases curtas faladas em voz alta no começo de cada etapa (você não precisa olhar a tela). */
export const SPOKEN: Record<PhaseDef['id'], string> = {
  silence: 'Silêncio',
  speech: 'Fale em voz alta',
  breath: 'Respire forte',
  mouse: 'Clique no mouse',
  keys: 'Digite no teclado',
  mixed: 'Fale e digite',
}

export function speak(text: string) {
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-BR'
    u.rate = 1.15
    speechSynthesis.speak(u)
  } catch { /* sem síntese de voz */ }
}

/** Confere se a gravação tem voz: a fala precisa estar bem acima do silêncio. */
export function checkVoiceDetected(rec: Recording): { ok: boolean; silenceDb: number; speechDb: number } {
  const dbOf = (id: 'silence' | 'speech') => {
    const r = rec.ranges.find((x) => x.id === id)!
    const { from, to } = usable(r)
    return pct(frameDb(rec.samples, from, to), 90)
  }
  const silenceDb = dbOf('silence')
  const speechDb = dbOf('speech')
  return { ok: speechDb - silenceDb >= 8, silenceDb, speechDb }
}

/** Ganho (dB) para a fala ficar num nível bom (p90 dos quadros de 50 ms ≈ −22 dBFS). */
export function recommendGain(rec: Recording): number {
  const sp = rec.ranges.find((r) => r.id === 'speech')!
  const { from, to } = usable(sp)
  const p90 = pct(frameDb(rec.samples, from, to), 90)
  return Math.max(0, Math.min(40, Math.round(-22 - p90)))
}

export async function analyze(rec0: Recording, onStep?: (msg: string) => void, gainDb = recommendGain(rec0)): Promise<Analysis> {
  // aplica o ganho na gravação para testar como o filtro vai se comportar com ele
  const g = 10 ** (gainDb / 20)
  const scaled = new Float32Array(rec0.samples.length)
  for (let i = 0; i < scaled.length; i++) scaled[i] = rec0.samples[i] * g
  const rec: Recording = { samples: scaled, ranges: rec0.ranges }
  const silence = rec.ranges.find((r) => r.id === 'silence')!
  const rawFloor = pct(frameDb(rec.samples, silence.start + SR, silence.end - Math.round(SR * 0.2)), 95)
  const baseline = evaluate(rec.samples, rec.samples, rec, 'off', -100, 0, true)

  const perEngine: Analysis['perEngine'] = {}
  for (const engine of ['off', 'rnnoise', 'gtcrn'] as Engine[]) {
    onStep?.(`Analisando o filtro "${engine === 'off' ? 'só portão' : engine}"…`)
    const den = engine === 'off' ? rec.samples : await denoiseOffline(rec.samples, engine)
    const cands: EvalResult[] = []
    for (let openDb = -64; openDb <= -26; openDb += 2) {
      for (const minOpenMs of [25, 45, 70]) cands.push(evaluate(rec.samples, den, rec, engine, openDb, minOpenMs, false))
    }
    const retention = (r: EvalResult) => Math.min(r.speechKept, r.mixedKept)
    const feasible = cands.filter((r) => retention(r) >= 92)
    let best: EvalResult
    if (feasible.length) {
      // entre os que preservam a voz: os que menos deixam vazar ruído; e, desses, o do MEIO da faixa
      // (nem tão sensível que pegue ruído quando o ambiente mudar, nem tão duro que corte a voz)
      const minWorst = Math.min(...feasible.map((r) => r.worstNoisePct))
      const tied = feasible.filter((r) => r.worstNoisePct <= minWorst + 1)
      const dbs = [...new Set(tied.map((r) => r.openDb))].sort((a, b) => a - b)
      const mid = dbs[Math.floor((dbs.length - 1) / 2)]
      const atMid = tied.filter((r) => r.openDb === mid)
      best = atMid.reduce((a, b) => (retention(b) > retention(a) ? b : a))
    } else {
      best = cands.reduce((a, b) => (retention(b) > retention(a) || (retention(b) === retention(a) && b.worstNoisePct < a.worstNoisePct) ? b : a))
    }
    perEngine[engine] = best!
  }
  const entries = Object.values(perEngine) as EvalResult[]
  const retention = (e: EvalResult) => Math.min(e.speechKept, e.mixedKept)
  const good = entries.filter((e) => retention(e) >= 92)
  // 1º preservar a voz; entre os que preservam, o que menos deixa vazar ruído
  const best = good.length
    ? good.reduce((a, b) => (b.worstNoisePct < a.worstNoisePct ? b : a))
    : entries.reduce((a, b) => (retention(b) > retention(a) ? b : a))
  return { baseline, perEngine, best, rawFloorDb: rawFloor, durationS: rec.samples.length / SR, gainDb }
}

export function describe(r: EvalResult): string {
  const n = r.noise
  return `${r.engine === 'off' ? 'só portão' : r.engine} | limite ${r.openDb} dB, mín ${r.minOpenMs} ms | vazamento: respiração ${n.breath.passPct.toFixed(0)}%, mouse ${n.mouse.passPct.toFixed(0)}%, teclado ${n.keys.passPct.toFixed(0)}% | voz mantida: ${r.speechKept.toFixed(0)}% (falando+digitando ${r.mixedKept.toFixed(0)}%)`
}
