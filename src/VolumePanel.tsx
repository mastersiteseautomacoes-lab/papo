import { Track, type Participant } from 'livekit-client'
import { Volume2, VolumeX } from 'lucide-react'
import { MAX_VOLUME, defaultVolume, volumeOf, type AudioSource, type VoiceState } from './voice'

interface Props {
  voice: VoiceState
  onClose: () => void
}

function Row({ label, src, voice, p }: { label: string; src: AudioSource; voice: VoiceState; p: Participant }) {
  const s = volumeOf(voice.volumes, p.identity, src)
  const pct = s.muted ? 0 : Math.round(s.vol * 100)
  const set = (patch: Partial<typeof s>) => voice.setVolume(p.identity, src, patch)
  return (
    <div className="vp-row">
      <span className="vp-label" title={label}>{label}</span>
      <button className="icon-btn" title={s.muted ? 'Voltar a ouvir' : 'Silenciar para mim'} onClick={() => set({ muted: !s.muted })}>
        {s.muted || s.vol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <input
        type="range" min={0} max={MAX_VOLUME * 100} step={5} value={pct}
        onChange={(e) => set({ vol: Number(e.target.value) / 100, muted: false })}
        aria-label={label}
      />
      <span className="volume-pct">{pct}%</span>
      <button className="link small" onClick={() => set(defaultVolume(src))} title="Voltar ao volume padrão">Padrão</button>
    </div>
  )
}

/** Volume de cada pessoa (voz) e de cada tela compartilhada (som do computador dela), só para você. */
export default function VolumePanel({ voice, onClose }: Props) {
  const others = voice.room ? [...voice.room.remoteParticipants.values()] : []
  return (
    <div className="overlay clear" onClick={onClose}>
      <div className="vol-panel" onClick={(e) => e.stopPropagation()}>
        <div className="volume-title">
          <strong>Volumes</strong>
          <small>Só para você: ninguém mais ouve a diferença</small>
        </div>
        {others.length === 0 && <p className="muted">Ninguém mais entrou na sessão ainda.</p>}
        {others.map((p) => {
          const name = p.name || 'Convidado'
          const hasScreenAudio = !!p.getTrackPublication(Track.Source.ScreenShareAudio)
          return (
            <div className="vp-person" key={p.identity}>
              <Row label={name} src="mic" voice={voice} p={p} />
              {hasScreenAudio && <Row label={`Tela de ${name}`} src="screen" voice={voice} p={p} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
