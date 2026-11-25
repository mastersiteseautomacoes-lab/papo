import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import * as LK from 'livekit-client'
import { Room, RoomEvent, Track, type LocalAudioTrack, type RemoteAudioTrack, type RemoteTrack } from 'livekit-client'
import { api } from './api'
import { MicProcessor } from './audio/MicProcessor'
import { captureConstraints, getAudioSettings, subscribeAudioSettings } from './audio/settings'

export type VoiceStatus = 'idle' | 'connecting' | 'connected'

/** 'mic' = a voz da pessoa; 'screen' = o áudio da tela que ela compartilha */
export type AudioSource = 'mic' | 'screen'
export interface VolumeSetting { vol: number; muted: boolean }
export const MAX_VOLUME = 2 // 200%, como no Discord

/** Volume inicial: a voz começa em 100%; o áudio de uma tela compartilhada chega alto (é o som do computador de
 *  quem transmite), então começa em 50%. Cada pessoa ajusta e o Papo lembra. */
export const defaultVolume = (src: AudioSource): VolumeSetting => ({ vol: src === 'screen' ? 0.5 : 1, muted: false })
export const volumeOf = (volumes: Record<string, VolumeSetting>, identity: string, src: AudioSource): VolumeSetting =>
  volumes[`${identity}:${src}`] ?? defaultVolume(src)

/** Como a tela é enviada. Sem isto o LiveKit usa o padrão dele para tela: 1080p a **15 quadros** e 2,5 Mbps.
 *  - Jogo: 30 quadros e 5 Mbps, priorizando a fluidez (VP8, que pesa pouco no computador de quem joga).
 *  - Texto: 30 quadros e 4 Mbps, priorizando a nitidez (VP9 comprime melhor e a imagem quase parada custa pouco). */
export type ScreenMode = 'game' | 'text'
export const SCREEN_MODES = {
  game: { label: 'Jogo', hint: 'motion', codec: 'vp8', maxBitrate: 5_000_000, degradation: 'maintain-framerate' },
  text: { label: 'Texto', hint: 'detail', codec: 'vp9', maxBitrate: 4_000_000, degradation: 'maintain-resolution' },
} as const
const MODE_KEY = 'papo.screenMode'
function loadScreenMode(): ScreenMode {
  try { return localStorage.getItem(MODE_KEY) === 'text' ? 'text' : 'game' } catch { return 'game' }
}

const VOL_KEY = 'papo.volumes'
const volKey = (identity: string, src: AudioSource) => `${identity}:${src}`

function loadVolumes(): Record<string, VolumeSetting> {
  try { return JSON.parse(localStorage.getItem(VOL_KEY) || '{}') } catch { return {} }
}

interface Options {
  onError: (message: string) => void
  /** liga o microfone ao entrar (padrão: sim). Nas sessões começa desligado: quem só assiste não precisa dele. */
  micOnJoin?: boolean
}

const EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.ConnectionStateChanged,
] as const

/** Sessão de voz, vídeo e tela usando o LiveKit. Uma sessão por vez. */
export function useVoice({ onError, micOnJoin = true }: Options) {
  const [sessionCode, setSessionCode] = useState<string | null>(null)
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [deafened, setDeafened] = useState(false)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const roomRef = useRef<Room | null>(null)
  const audioEls = useRef(new Set<HTMLMediaElement>())
  const deafRef = useRef(false)
  // volume só para você, por pessoa e por tipo de áudio (voz / tela); lembrado entre sessões
  const [volumes, setVolumes] = useState<Record<string, VolumeSetting>>(loadVolumes)
  const volRef = useRef(volumes)
  volRef.current = volumes

  /** aplica o volume escolhido (e o "ensurdecer") em todo áudio que está chegando */
  const applyVolumes = useCallback((roomArg?: Room) => {
    const room = roomArg ?? roomRef.current
    if (!room) return
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        const t = pub.track as RemoteAudioTrack | undefined
        if (!t) return
        const src: AudioSource = pub.source === Track.Source.ScreenShareAudio ? 'screen' : 'mic'
        const s = volumeOf(volRef.current, p.identity, src)
        t.setVolume(deafRef.current || s.muted ? 0 : s.vol)
      })
    })
  }, [])

  const setVolume = useCallback((identity: string, src: AudioSource, patch: Partial<VolumeSetting>) => {
    setVolumes((cur) => {
      const k = volKey(identity, src)
      const base: VolumeSetting = cur[k] ?? defaultVolume(src)
      const next = { ...cur, [k]: { ...base, ...patch } }
      volRef.current = next
      try { localStorage.setItem(VOL_KEY, JSON.stringify(next)) } catch { /* sem storage */ }
      return next
    })
    window.setTimeout(applyVolumes, 0)
  }, [applyVolumes])
  const joining = useRef(false)
  const procRef = useRef<MicProcessor | null>(null)
  const appliedEngine = useRef<string | null>(null)

  /** Liga (ou troca) o filtro de ruído no microfone que está publicado na sala. */
  const applyMic = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    const track = lp?.getTrackPublication(Track.Source.Microphone)?.audioTrack as LocalAudioTrack | undefined
    if (!track) return
    const s = getAudioSettings()
    try {
      if (track.getProcessor()) await track.stopProcessor()
      procRef.current = null
      await track.restartTrack(captureConstraints(s.engine))
      if (s.engine !== 'off') {
        const p = new MicProcessor(s)
        await track.setProcessor(p)
        procRef.current = p
      }
      appliedEngine.current = `${s.engine}|${s.deviceId}`
    } catch {
      onError('Não consegui ligar o filtro de ruído; seguindo sem ele.')
    }
  }, [onError])

  useEffect(() => subscribeAudioSettings((s) => {
    if (!roomRef.current) return
    if (`${s.engine}|${s.deviceId}` !== appliedEngine.current) void applyMic()
    else procRef.current?.update(s)
  }), [applyMic])

  const clearAudio = () => {
    audioEls.current.forEach((el) => el.remove())
    audioEls.current.clear()
  }

  const leave = useCallback(() => {
    const room = roomRef.current
    roomRef.current = null
    room?.disconnect()
    clearAudio()
    deafRef.current = false
    procRef.current = null
    appliedEngine.current = null
    setDeafened(false)
    setSessionCode(null)
    setStatus('idle')
  }, [])

  /** Conecta numa sala do LiveKit. `getToken` pede o passe; `enter` marca o destino. */
  const connect = useCallback(async (getToken: () => Promise<string>, enter: () => void) => {
    if (joining.current) return
    joining.current = true
    try {
      if (roomRef.current) leave()
      enter()
      setStatus('connecting')
      const token = await getToken()
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        webAudioMix: true, // permite volume acima de 100% e controle por pessoa
        audioCaptureDefaults: captureConstraints(getAudioSettings().engine),
        videoCaptureDefaults: { resolution: { width: 1280, height: 720, frameRate: 30 } },
      })
      // gancho de depuração: localStorage.setItem('papo.debug','1') expõe a sala no console
      try { if (localStorage.getItem('papo.debug') === '1') Object.assign(window, { __papoRoom: room, __papoLK: LK }) } catch { /* sem storage */ }
      for (const ev of EVENTS) room.on(ev, rerender)
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return
        const el = track.attach()
        el.style.display = 'none'
        document.body.appendChild(el)
        audioEls.current.add(el)
        applyVolumes(room) // a sala ainda não está em roomRef durante a conexão
      })
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => { el.remove(); audioEls.current.delete(el) })
      })
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) leave()
      })
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      await room.connect(`${proto}://${location.host}/lk`, token)
      roomRef.current = room
      room.startAudio().catch(() => { /* o navegador libera ao primeiro clique */ })
      applyVolumes(room) // vozes que já estavam na sala quando você entrou
      setStatus('connected')
      if (micOnJoin) {
        try {
          await room.localParticipant.setMicrophoneEnabled(true)
          await applyMic()
        } catch {
          onError('Sem acesso ao microfone: você entrou só ouvindo. Libere o microfone nas permissões do app ou do navegador.')
        }
      }
      rerender()
    } catch (e) {
      roomRef.current?.disconnect()
      roomRef.current = null
      clearAudio()
      setSessionCode(null)
      setStatus('idle')
      onError(e instanceof Error && e.message ? `Não foi possível entrar na sessão: ${e.message}` : 'Não foi possível entrar na sessão.')
    } finally {
      joining.current = false
    }
  }, [applyMic, applyVolumes, leave, micOnJoin, onError])

  /** Entra numa sessão: com conta usa o nome dela; sem conta, o nome escolhido. */
  const joinSession = useCallback((code: string, name?: string) => connect(
    async () => (await api.sessionToken(code, name)).token,
    () => setSessionCode(code),
  ), [connect])

  // sair ao fechar a aba/janela
  useEffect(() => () => { roomRef.current?.disconnect() }, [])

  const toggleMic = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    if (!lp) return
    if (deafRef.current) { // desligar o "ensurdecer" ao reabrir o microfone
      deafRef.current = false
      setDeafened(false)
      applyVolumes()
    }
    try { await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled) } catch { onError('Não consegui acessar o microfone.') }
    rerender()
  }, [applyVolumes, onError])

  const toggleDeafen = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    if (!lp) return
    const next = !deafRef.current
    deafRef.current = next
    setDeafened(next)
    applyVolumes()
    if (next && lp.isMicrophoneEnabled) await lp.setMicrophoneEnabled(false)
    rerender()
  }, [applyVolumes])

  const toggleCamera = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    if (!lp) return
    try { await lp.setCameraEnabled(!lp.isCameraEnabled) } catch { onError('Não consegui acessar a câmera.') }
    rerender()
  }, [onError])

  // modo da transmissão (jogo ou texto), lembrado entre sessões; vale na próxima vez que compartilhar
  const [screenMode, setScreenModeState] = useState<ScreenMode>(loadScreenMode)
  const setScreenMode = useCallback((m: ScreenMode) => {
    setScreenModeState(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* sem storage */ }
  }, [])

  const toggleScreen = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    if (!lp) return
    const mode = SCREEN_MODES[screenMode]
    try {
      await lp.setScreenShareEnabled(!lp.isScreenShareEnabled, {
        // restrictOwnAudio tira do áudio da tela tudo o que o próprio Papo toca (a voz dos amigos);
        // sem isso, o amigo se ouvia de volta na transmissão. Os filtros de voz ficam desligados
        // porque estragam música e vídeo.
        audio: { restrictOwnAudio: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        contentHint: mode.hint,
        resolution: { width: 1920, height: 1080, frameRate: 30 },
      }, {
        videoCodec: mode.codec,
        screenShareEncoding: { maxBitrate: mode.maxBitrate, maxFramerate: 30 },
        degradationPreference: mode.degradation,
      })
    } catch (e) {
      // cancelar o seletor de tela não é erro
      if (!(e instanceof Error) || !/permission|denied|abort|cancel/i.test(`${e.name} ${e.message}`)) onError('Não consegui compartilhar a tela.')
    }
    rerender()
  }, [onError, screenMode])

  const room = roomRef.current
  const lp = room?.localParticipant
  return {
    sessionCode, status, room, deafened,
    micOn: !!lp?.isMicrophoneEnabled,
    camOn: !!lp?.isCameraEnabled,
    sharing: !!lp?.isScreenShareEnabled,
    volumes, setVolume, screenMode, setScreenMode,
    joinSession, leave, toggleMic, toggleDeafen, toggleCamera, toggleScreen,
  }
}

export type VoiceState = ReturnType<typeof useVoice>
