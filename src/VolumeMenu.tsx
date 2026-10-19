import { Volume2, VolumeX } from 'lucide-react'
import { MAX_VOLUME, type AudioSource, type VolumeSetting } from './voice'

export interface VolumeTarget {
  identity: string
  src: AudioSource
  name: string
  x: number
  y: number
}

interface Props {
  target: VolumeTarget
  setting: VolumeSetting
  onChange: (patch: Partial<VolumeSetting>) => void
  onClose: () => void
}

/** Volume só para você: 0 a 200% (começa em 100%). */
export default function VolumeMenu({ target, setting, onChange, onClose }: Props) {
  const pct = Math.round(setting.vol * 100)
  // mantém o menu dentro da janela
  const left = Math.max(8, Math.min(target.x, window.innerWidth - 268))
  const top = Math.max(8, Math.min(target.y, window.innerHeight - 150))
  return (
    <div className="overlay clear" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div className="volume-menu" style={{ left, top }} onClick={(e) => e.stopPropagation()}>
        <div className="volume-title">
          <strong>{target.src === 'screen' ? `Áudio da tela de ${target.name}` : target.name}</strong>
          <small>{target.src === 'screen' ? 'Volume só para você' : 'Volume do usuário (só para você)'}</small>
        </div>
        <div className="volume-row">
          <button className="icon-btn" title={setting.muted ? 'Voltar a ouvir' : 'Silenciar para mim'} onClick={() => onChange({ muted: !setting.muted })}>
            {setting.muted || setting.vol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range" min={0} max={MAX_VOLUME * 100} step={5} value={setting.muted ? 0 : pct}
            onChange={(e) => onChange({ vol: Number(e.target.value) / 100, muted: false })}
            aria-label="Volume"
          />
          <span className="volume-pct">{setting.muted ? 0 : pct}%</span>
        </div>
        <button className="link small" onClick={() => onChange({ vol: 1, muted: false })}>Restaurar 100%</button>
      </div>
    </div>
  )
}
