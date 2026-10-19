import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Track, type Participant } from 'livekit-client'
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, PhoneOff, Headphones, HeadphoneOff, Maximize, Minimize, ZoomIn, ZoomOut, Volume2, VolumeX } from 'lucide-react'
import type { Member } from './api'
import { MAX_VOLUME, type AudioSource, type VoiceState, type VolumeSetting } from './voice'
import type { VolumeTarget } from './VolumeMenu'

interface Props {
  voice: VoiceState
  channelName: string
  memberById: (id: number) => Member | undefined
  /** abre o menu de volume de uma pessoa (ou da tela dela) */
  onVolumeMenu: (t: VolumeTarget) => void
}

const GAP = 8
const RATIO = 16 / 9

interface TileProps {
  p: Participant
  source: Track.Source
  member?: Member
  style?: CSSProperties
  focused?: boolean
  onToggleFocus?: () => void
  /** volume escolhido para este áudio (só em blocos de outras pessoas) */
  volume?: VolumeSetting
  onVolume?: (patch: Partial<VolumeSetting>) => void
  onVolumeMenu?: (x: number, y: number) => void
}

function Tile({ p, source, member, style, focused, onToggleFocus, volume, onVolume, onVolumeMenu }: TileProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === boxRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else boxRef.current?.requestFullscreen().catch(() => {})
  }
  const pub = p.getTrackPublication(source)
  const track = pub?.track && !pub.isMuted ? pub.track : null
  const isScreen = source === Track.Source.ScreenShare

  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])

  const name = member?.name ?? p.name ?? 'Convidado'
  const color = member?.color ?? '#949ba4'
  return (
    <div ref={boxRef} style={style} onDoubleClick={toggleFull} onContextMenu={(e) => { if (onVolumeMenu) { e.preventDefault(); onVolumeMenu(e.clientX, e.clientY) } }} className={`tile ${isScreen ? 'screen' : ''} ${!isScreen && p.isSpeaking ? 'speaking' : ''}`}>
      {track ? (
        <video ref={ref} autoPlay playsInline muted className={isScreen ? 'contain' : p.isLocal ? 'mirror' : ''} />
      ) : (
        <span className="avatar big" style={{ background: color }}>{name[0]?.toUpperCase()}</span>
      )}
      {isScreen && volume && onVolume && (
        <div className="tile-volume" onDoubleClick={(e) => e.stopPropagation()}>
          <button onClick={() => onVolume({ muted: !volume.muted })} title={volume.muted ? 'Ativar o som' : 'Silenciar'}>
            {volume.muted || volume.vol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range" min={0} max={MAX_VOLUME * 100} step={5} value={volume.muted ? 0 : Math.round(volume.vol * 100)}
            onChange={(e) => onVolume({ vol: Number(e.target.value) / 100, muted: false })}
            aria-label="Volume da transmissão"
          />
          <span>{volume.muted ? 0 : Math.round(volume.vol * 100)}%</span>
        </div>
      )}
      <div className="tile-tools">
        {!isScreen && volume && onVolumeMenu && (
          <button onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onVolumeMenu(r.left, r.bottom + 4) }} title="Volume desta pessoa">
            {volume.muted || volume.vol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
        {onToggleFocus && (
          <button onClick={(e) => { e.stopPropagation(); onToggleFocus() }} title={focused ? 'Reduzir' : 'Ampliar na sala'}>
            {focused ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); toggleFull() }} title={full ? 'Sair da tela cheia' : 'Tela cheia'}>
          {full ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
      <div className="tile-label">
        {!isScreen && !p.isMicrophoneEnabled && <MicOff size={14} />}
        <span>{isScreen ? `Tela de ${name}` : name}{p.isLocal && !isScreen ? ' (você)' : ''}</span>
      </div>
    </div>
  )
}

/** Maior ladrilho 16:9 que cabe na área, para n participantes. */
function bestGrid(n: number, W: number, H: number) {
  let best = 0
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const tw = (W - GAP * (cols - 1)) / cols
    const th = (H - GAP * (rows - 1)) / rows
    best = Math.max(best, Math.min(tw, th * RATIO))
  }
  const w = Math.max(0, Math.floor(best))
  return { w, h: Math.floor(w / RATIO) }
}

function Stage({ voice, memberById, onVolumeMenu }: { voice: VoiceState; memberById: Props['memberById']; onVolumeMenu: Props['onVolumeMenu'] }) {
  const room = voice.room!
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const participants: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()]
  const member = (p: Participant) => memberById(Number(p.identity))
  const nameOf = (p: Participant) => member(p)?.name ?? p.name ?? 'Convidado'
  const volOf = (p: Participant, src: AudioSource): VolumeSetting => voice.volumes[`${p.identity}:${src}`] ?? { vol: 1, muted: false }
  /** props de volume do bloco: voz nos blocos de câmera, áudio da tela nos blocos de tela; nada no seu próprio */
  const volProps = (p: Participant, source: Track.Source) => {
    if (p.isLocal) return {}
    const src: AudioSource = source === Track.Source.ScreenShare ? 'screen' : 'mic'
    if (src === 'screen' && !p.getTrackPublication(Track.Source.ScreenShareAudio)) return {} // a tela veio sem áudio
    return {
      volume: volOf(p, src),
      onVolume: (patch: Partial<VolumeSetting>) => voice.setVolume(p.identity, src, patch),
      onVolumeMenu: (x: number, y: number) => onVolumeMenu({ identity: p.identity, src, name: nameOf(p), x, y }),
    }
  }
  const [focusKey, setFocusKey] = useState<string | null>(null)

  type Item = { key: string; p: Participant; source: Track.Source }
  const screens: Item[] = participants
    .filter((p) => p.getTrackPublication(Track.Source.ScreenShare)?.track)
    .map((p) => ({ key: `${p.identity}:screen`, p, source: Track.Source.ScreenShare }))
  const cams: Item[] = participants.map((p) => ({ key: `${p.identity}:cam`, p, source: Track.Source.Camera }))
  const all = [...screens, ...cams]
  // o bloco ampliado (ou a primeira tela compartilhada) vira o principal; o resto vai para a faixa
  const main = all.find((x) => x.key === focusKey) ?? screens[0]
  const hasMain = !!main

  let content = null
  if (box.w > 0 && box.h > 0) {
    if (main) {
      const stripH = Math.max(64, Math.min(140, Math.floor(box.h * 0.22)))
      const tileStyle: CSSProperties = { width: Math.floor(stripH * RATIO), height: stripH, flex: 'none' }
      content = (
        <div className="stage">
          <div className="stage-main">
            <Tile p={main.p} source={main.source} member={member(main.p)} style={{ width: '100%', height: '100%' }}
              focused={focusKey === main.key} onToggleFocus={() => setFocusKey(focusKey === main.key ? null : main.key)}
              {...volProps(main.p, main.source)} />
          </div>
          <div className="strip" style={{ height: stripH }}>
            {all.filter((x) => x.key !== main.key).map((x) => (
              <Tile key={x.key} p={x.p} source={x.source} member={member(x.p)} style={tileStyle}
                onToggleFocus={() => setFocusKey(x.key)} {...volProps(x.p, x.source)} />
            ))}
          </div>
        </div>
      )
    } else {
      const { w, h } = bestGrid(cams.length, box.w, box.h)
      content = cams.map((x) => (
        <Tile key={x.key} p={x.p} source={x.source} member={member(x.p)} style={{ width: w, height: h }}
          onToggleFocus={() => setFocusKey(x.key)} {...volProps(x.p, x.source)} />
      ))
    }
  }

  return <div className={`tiles ${hasMain ? 'with-screen' : ''}`} ref={ref}>{content}</div>
}

export default function VoiceRoom({ voice, channelName, memberById, onVolumeMenu }: Props) {
  if (voice.status === 'connecting' || !voice.room) {
    return <div className="voice-room"><div className="voice-wait">Conectando à sala <strong>{channelName}</strong>…</div></div>
  }
  return (
    <div className="voice-room">
      <Stage voice={voice} memberById={memberById} onVolumeMenu={onVolumeMenu} />
      <div className="voice-controls">
        <button className={`vc ${voice.micOn ? '' : 'off'}`} onClick={voice.toggleMic} title={voice.micOn ? 'Silenciar microfone' : 'Ligar microfone'}>
          {voice.micOn ? <Mic size={22} /> : <MicOff size={22} />}
        </button>
        <button className={`vc ${voice.deafened ? 'off' : ''}`} onClick={voice.toggleDeafen} title={voice.deafened ? 'Voltar a ouvir' : 'Ensurdecer'}>
          {voice.deafened ? <HeadphoneOff size={22} /> : <Headphones size={22} />}
        </button>
        <button className={`vc ${voice.camOn ? 'on' : ''}`} onClick={voice.toggleCamera} title={voice.camOn ? 'Desligar câmera' : 'Ligar câmera'}>
          {voice.camOn ? <Video size={22} /> : <VideoOff size={22} />}
        </button>
        <button className={`vc ${voice.sharing ? 'on' : ''}`} onClick={voice.toggleScreen} title={voice.sharing ? 'Parar de compartilhar' : 'Compartilhar tela'}>
          {voice.sharing ? <MonitorOff size={22} /> : <MonitorUp size={22} />}
        </button>
        <button className="vc hangup" onClick={voice.leave} title="Sair da sala"><PhoneOff size={22} /></button>
      </div>
    </div>
  )
}
