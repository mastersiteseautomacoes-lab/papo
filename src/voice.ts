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

const VOL_KEY = 'papo.volumes'
const volKey = (identity: string, src: AudioSource) => `${identity}:${src}`

function loadVolumes(): Record<string, VolumeSetting> {
  try { return JSON.parse(localStorage.getItem(VOL_KEY) || '{}') } catch { return {} }
}

interface Options {
  /** envia um evento pelo WebSocket do Papo (presença na sala) */
  send: (payload: unknown) => void
  onError: (message: string) => void
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

/** Sala de voz/vídeo/tela usando o LiveKit. Uma sala por vez. */
export function useVoice({ send, onError }: Options) {
  const [channelId, setChannelId] = useState<number | null>(null)
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
        const s = volRef.current[volKey(p.identity, src)] ?? { vol: 1, muted: false }
        t.setVolume(deafRef.current || s.muted ? 0 : s.vol)
      })
    })
  }, [])

  const setVolume = useCallback((identity: string, src: AudioSource, patch: Partial<VolumeSetting>) => {
    setVolumes((cur) => {
      const k = volKey(identity, src)
      const base: VolumeSetting = cur[k] ?? { vol: 1, muted: false }
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
    setChannelId(null)
    setStatus('idle')
    send({ t: 'voice-leave' })
  }, [send])

  const join = useCallback(async (id: number) => {
    if (joining.current) return
    joining.current = true
    try {
      if (roomRef.current) leave()
      setChannelId(id)
      setStatus('connecting')
      const { token } = await api.voiceToken(id)
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
      send({ t: 'voice-join', channelId: id })
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
        await applyMic()
      } catch {
        onError('Sem acesso ao microfone: você entrou só ouvindo. Libere o microfone nas permissões do app ou do navegador.')
      }
      rerender()
    } catch (e) {
      roomRef.current?.disconnect()
      roomRef.current = null
      clearAudio()
      setChannelId(null)
      setStatus('idle')
      onError(e instanceof Error && e.message ? `Não foi possível entrar na sala: ${e.message}` : 'Não foi possível entrar na sala de voz.')
    } finally {
      joining.current = false
    }
  }, [applyMic, applyVolumes, leave, onError, send])

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

  const toggleScreen = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    if (!lp) return
    try {
      await lp.setScreenShareEnabled(!lp.isScreenShareEnabled, {
        audio: true,
        contentHint: 'detail',
        resolution: { width: 1920, height: 1080, frameRate: 30 },
      })
    } catch (e) {
      // cancelar o seletor de tela não é erro
      if (!(e instanceof Error) || !/permission|denied|abort|cancel/i.test(`${e.name} ${e.message}`)) onError('Não consegui compartilhar a tela.')
    }
    rerender()
  }, [onError])

  /** Reenvia a presença na sala (ex.: depois que o WebSocket do Papo reconecta). */
  const resync = useCallback(() => {
    if (roomRef.current && channelId) send({ t: 'voice-join', channelId })
  }, [channelId, send])

  const room = roomRef.current
  const lp = room?.localParticipant
  return {
    channelId, status, room, deafened,
    micOn: !!lp?.isMicrophoneEnabled,
    camOn: !!lp?.isCameraEnabled,
    sharing: !!lp?.isScreenShareEnabled,
    volumes, setVolume,
    join, leave, resync, toggleMic, toggleDeafen, toggleCamera, toggleScreen,
  }
}

export type VoiceState = ReturnType<typeof useVoice>
