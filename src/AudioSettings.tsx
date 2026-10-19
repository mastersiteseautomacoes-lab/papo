import { useEffect, useRef, useState } from 'react'
import { Mic, X } from 'lucide-react'
import {
  DEFAULT_AUDIO, captureConstraints, getAudioSettings, setAudioSettings, subscribeAudioSettings,
  type AudioSettings as Settings, type Engine,
} from './audio/settings'
import { buildGraph, type Graph, type Meter } from './audio/pipeline'
import * as CAL from './audio/calibrate'
import { PHASES, SPOKEN, analyze, checkVoiceDetected, describe, recordRaw, speak, type Analysis, type Progress } from './audio/calibrate'

// gancho de depuração (localStorage papo.debug = 1)
try { if (localStorage.getItem('papo.debug') === '1') Object.assign(window, { __papoCalLib: CAL }) } catch { /* sem storage */ }

const dbOf = (lin: number) => 20 * Math.log10(lin + 1e-9)
const pctOf = (db: number) => Math.max(0, Math.min(100, ((db + 80) / 80) * 100))

function useSettings() {
  const [s, set] = useState<Settings>(getAudioSettings())
  useEffect(() => subscribeAudioSettings(set), [])
  return s
}

const ENGINES: { id: Engine; title: string; text: string }[] = [
  { id: 'rnnoise', title: 'Forte (RNNoise)', text: 'Remove teclado, mouse, ventilador e a maior parte da respiração.' },
  { id: 'gtcrn', title: 'Forte (GTCRN)', text: 'Rede neural mais nova; costuma ir melhor em ruídos que mudam o tempo todo.' },
  { id: 'off', title: 'Só o do navegador', text: 'O tratamento simples de antes (mais ruído passa).' },
]

/** Teste do microfone: mostra o nível e quando o portão abre, e deixa você se ouvir. */
function useMicTest(active: boolean, listen: boolean, s: Settings) {
  const [meter, setMeter] = useState<Meter | null>(null)
  const [rawDb, setRawDb] = useState(-100)
  const [silentWarn, setSilentWarn] = useState(false)
  const [error, setError] = useState('')
  const graphRef = useRef<Graph | null>(null)
  const monitorRef = useRef<GainNode | null>(null)
  const sRef = useRef(s)
  sRef.current = s

  useEffect(() => {
    if (!active) { setMeter(null); return }
    let cancelled = false
    let ctx: AudioContext | null = null
    let stream: MediaStream | null = null
    let poll = 0
    setError('')
    setSilentWarn(false)
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: captureConstraints(s.engine) })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        ctx = new AudioContext({ sampleRate: 48000 })
        const src = ctx.createMediaStreamSource(stream)
        // nível cru do microfone, antes de qualquer filtro (para saber se ele está captando algo)
        const an = ctx.createAnalyser()
        an.fftSize = 2048
        const buf = new Float32Array(an.fftSize)
        let maxDb = -120
        const t0 = performance.now()
        poll = window.setInterval(() => {
          an.getFloatTimeDomainData(buf)
          let sq = 0
          for (const v of buf) sq += v * v
          const db = 10 * Math.log10(sq / buf.length + 1e-12)
          maxDb = Math.max(maxDb, db)
          setRawDb(db)
          if (performance.now() - t0 > 6000) setSilentWarn(maxDb < -58)
        }, 100)
        const g = await buildGraph(ctx, src, sRef.current, { onMeter: setMeter })
        g.mono.connect(an) // o nível "cru" é medido depois de escolher o canal com sinal
        const monitor = ctx.createGain()
        monitor.gain.value = 0
        g.output.connect(monitor)
        monitor.connect(ctx.destination)
        graphRef.current = g
        monitorRef.current = monitor
        if (ctx.state === 'suspended') await ctx.resume()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não consegui abrir o microfone')
      }
    })()
    return () => {
      cancelled = true
      window.clearInterval(poll)
      graphRef.current?.dispose()
      graphRef.current = null
      monitorRef.current = null
      stream?.getTracks().forEach((t) => t.stop())
      ctx?.close().catch(() => {})
    }
    // refaz o teste quando o filtro muda; os limites são aplicados ao vivo (abaixo)
  }, [active, s.engine, s.deviceId])

  useEffect(() => { graphRef.current?.setSettings(s) }, [s])
  useEffect(() => { if (monitorRef.current) monitorRef.current.gain.value = listen ? 1 : 0 }, [listen, active])
  return { meter, error, rawDb, silentWarn }
}

/** lista de microfones (os nomes só aparecem depois da permissão) */
function useMicDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
        tmp.getTracks().forEach((t) => t.stop())
      } catch { /* sem permissão: lista sem nomes */ }
      const all = await navigator.mediaDevices.enumerateDevices()
      if (alive) setDevices(all.filter((d) => d.kind === 'audioinput'))
    }
    void load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => { alive = false; navigator.mediaDevices.removeEventListener('devicechange', load) }
  }, [])
  return devices
}

export default function AudioSettings({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const [testing, setTesting] = useState(false)
  const [listen, setListen] = useState(false)
  const { meter, error, rawDb, silentWarn } = useMicTest(testing, listen, s)
  const devices = useMicDevices()

  const [cal, setCal] = useState<'idle' | 'recording' | 'analyzing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [step, setStep] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)
  const [calError, setCalError] = useState('')
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  async function calibrate() {
    setTesting(false)
    setResult(null)
    setCalError('')
    setCal('recording')
    abort.current = new AbortController()
    try {
      let lastSpoken = -1
      const rec = await recordRaw((p) => {
        setProgress(p)
        if (p.stage === 'prepare' && p.left === 3 && p.phase !== lastSpoken && p.phase < PHASES.length) {
          lastSpoken = p.phase
          speak(SPOKEN[PHASES[p.phase].id])
        }
      }, abort.current.signal, s.deviceId)
      try { if (localStorage.getItem('papo.debug') === '1') Object.assign(window, { __papoRec: rec }) } catch { /* sem storage */ }
      const v = checkVoiceDetected(rec)
      if (!v.ok) {
        throw new Error(
          `Não detectei a sua voz: o silêncio ficou em ${v.silenceDb.toFixed(0)} dB e a fala em ${v.speechDb.toFixed(0)} dB (precisa ser pelo menos 8 dB mais alta). ` +
          'Confira se o microfone certo está escolhido, se não está mudo e o volume de entrada do Windows, e tente de novo.',
        )
      }
      setCal('analyzing')
      const res = await analyze(rec, setStep)
      setResult(res)
      setCal('done')
      try {
        if (localStorage.getItem('papo.debug') === '1') Object.assign(window, { __papoCal: res, __papoRec: rec })
      } catch { /* sem storage */ }
    } catch (e) {
      setCalError(e instanceof Error ? e.message : 'Erro na calibração')
      setCal('error')
    }
  }

  const apply = (r: { engine: Engine; openDb: number; minOpenMs: number }, gainDb: number) =>
    setAudioSettings({ engine: r.engine, openDb: r.openDb, minOpenMs: r.minOpenMs, gateOn: true, inputGainDb: gainDb })

  const inDb = meter ? dbOf(meter.inRms) : -80
  const outDb = meter ? dbOf(meter.outRms) : -80
  const phase = progress && progress.phase < PHASES.length ? PHASES[progress.phase] : null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog wide" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Áudio e microfone</h2>
          <button className="icon-btn" title="Fechar" onClick={onClose}><X size={18} /></button>
        </div>

        <section className="aset">
          <h3>Microfone</h3>
          <select value={s.deviceId} onChange={(e) => setAudioSettings({ deviceId: e.target.value })}>
            <option value="">Padrão do Windows</option>
            {devices.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications').map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microfone'}</option>
            ))}
          </select>
        </section>

        <section className="aset">
          <h3>Volume do microfone</h3>
          <label className="slider">
            <span>Ganho de entrada: <strong>{s.inputGainDb > 0 ? '+' : ''}{s.inputGainDb} dB</strong> <small>(fones simples costumam precisar de +15 a +30 dB)</small></span>
            <input type="range" min={0} max={40} step={1} value={s.inputGainDb} onChange={(e) => setAudioSettings({ inputGainDb: Number(e.target.value) })} />
          </label>
          <label className="switch">
            <input type="checkbox" checked={s.autoGain} onChange={(e) => setAudioSettings({ autoGain: e.target.checked })} />
            <span>Ganho automático do navegador <small>(também sobe respiração e ruído; só ligue se o ganho acima não bastar)</small></span>
          </label>
        </section>

        <section className="aset">
          <h3>Supressão de ruído</h3>
          <div className="radios">
            {ENGINES.map((e) => (
              <label key={e.id} className={`radio ${s.engine === e.id ? 'sel' : ''}`}>
                <input type="radio" name="engine" checked={s.engine === e.id} onChange={() => setAudioSettings({ engine: e.id })} />
                <span><strong>{e.title}</strong><small>{e.text}</small></span>
              </label>
            ))}
          </div>
        </section>

        <section className="aset">
          <h3>Portão de ruído</h3>
          <label className="switch">
            <input type="checkbox" checked={s.gateOn} onChange={(e) => setAudioSettings({ gateOn: e.target.checked })} />
            <span>Só transmitir quando eu estiver falando</span>
          </label>
          <label className="slider">
            <span>Sensibilidade: <strong>{s.openDb} dB</strong> <small>(mais à esquerda = pega sons mais baixos)</small></span>
            <input type="range" min={-70} max={-20} step={1} value={s.openDb} disabled={!s.gateOn}
              onChange={(e) => setAudioSettings({ openDb: Number(e.target.value) })} />
          </label>
          <label className="slider">
            <span>Ignorar sons mais curtos que: <strong>{s.minOpenMs} ms</strong> <small>(cliques e teclas duram menos que isso)</small></span>
            <input type="range" min={10} max={120} step={5} value={s.minOpenMs} disabled={!s.gateOn}
              onChange={(e) => setAudioSettings({ minOpenMs: Number(e.target.value) })} />
          </label>
        </section>

        <section className="aset">
          <h3>Teste</h3>
          <div className="row">
            <button className={testing ? 'danger-btn' : 'primary'} onClick={() => setTesting((t) => !t)}>
              <Mic size={16} /> {testing ? 'Parar teste' : 'Testar meu microfone'}
            </button>
            <label className="switch inline">
              <input type="checkbox" checked={listen} onChange={(e) => setListen(e.target.checked)} />
              <span>Me ouvir <small>(use fones, senão dá eco)</small></span>
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          {testing && silentWarn && (
            <p className="form-error">Não estou ouvindo nada neste microfone. Escolha outro na lista acima, ou confira o volume de entrada em Configurações do Windows &gt; Sistema &gt; Som &gt; Entrada.</p>
          )}
          {testing && (
            <div className="meter" aria-label="Nível do microfone">
              <div className="bar"><div className={`fill ${meter?.open ? 'open' : ''}`} style={{ width: `${pctOf(inDb)}%` }} /></div>
              <div className="mark" style={{ left: `${pctOf(s.openDb)}%` }} title="limite do portão" />
              <div className="meter-text">
                <span>microfone cru {rawDb.toFixed(0)} dB · após filtro {inDb.toFixed(0)} dB</span>
                <span className={meter?.open ? 'tx' : ''}>{meter?.open ? 'TRANSMITINDO' : 'silêncio (portão fechado)'}</span>
                <span>saída {outDb.toFixed(0)} dB</span>
              </div>
            </div>
          )}
        </section>

        <section className="aset">
          <h3>Calibrar com a sua voz</h3>
          <p className="muted">
            Dura cerca de 1 minuto: você faz silêncio, fala, respira forte, clica e digita, e o Papo escolhe o melhor filtro e limite para o seu microfone.
          </p>
          {cal === 'idle' || cal === 'done' || cal === 'error' ? (
            <button className="primary" onClick={calibrate}>{cal === 'idle' ? 'Começar calibração' : 'Calibrar de novo'}</button>
          ) : null}
          {cal === 'recording' && progress && (
            <div className="cal-prompt">
              {phase && <small>Etapa {progress.phase + 1} de {PHASES.length}</small>}
              <strong>{progress.stage === 'prepare' ? `Prepare-se… ${progress.left}` : progress.prompt}</strong>
              {progress.stage === 'record' && <span className="count">{progress.left}s</span>}
              {progress.stage === 'prepare' && <small>Próximo: {progress.prompt}</small>}
              <button className="link" onClick={() => { abort.current?.abort(); setCal('idle') }}>Cancelar</button>
            </div>
          )}
          {cal === 'analyzing' && <p className="muted">{step || 'Analisando…'}</p>}
          {cal === 'error' && <p className="form-error">{calError}</p>}
          {cal === 'done' && result && (
            <div className="cal-result">
              <p><strong>Recomendado:</strong> {describe(result.best)} | ganho de entrada +{result.gainDb} dB</p>
              <p className="muted">Sem nenhum filtro vazaria: respiração {result.baseline.noise.breath.passPct.toFixed(0)}%, mouse {result.baseline.noise.mouse.passPct.toFixed(0)}%, teclado {result.baseline.noise.keys.passPct.toFixed(0)}%.</p>
              <details>
                <summary>Comparar os filtros</summary>
                <ul>{(Object.values(result.perEngine)).map((r) => r && <li key={r.engine}>{describe(r)}</li>)}</ul>
              </details>
              <button className="primary" onClick={() => apply(result.best, result.gainDb)}>Aplicar recomendado</button>
            </div>
          )}
        </section>

        <div className="dialog-actions split">
          <button className="link" onClick={() => setAudioSettings({ ...DEFAULT_AUDIO })}>Restaurar padrão</button>
          <span className="spacer" />
          <button className="primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
