# Estrutura do repositório

Onde fica cada coisa, como as pastas se conversam e o que **não** está no Git.

## Mapa

```
Papo/
├── src/                  Interface (React + TypeScript)
│   ├── App.tsx             tela principal: servidores, canais, chat, membros
│   ├── Login.tsx           login e registro (com a seta "Início" no app instalado)
│   ├── VoiceRoom.tsx       sala de voz: blocos de vídeo, ampliar, tela cheia
│   ├── voice.ts            entrar na sala, microfone, câmera, tela, volumes (LiveKit)
│   ├── api.ts              pedidos HTTP + WebSocket com reconexão
│   ├── AudioSettings.tsx   tela de áudio e calibração
│   ├── audio/              cadeia de tratamento do microfone
│   └── styles/             tokens.css (design tokens e temas) e app.css
├── server/               Servidor (Node + Express + WebSocket + SQLite)
│   ├── index.ts            rotas HTTP, WebSocket, proxy /lk, /api/health
│   ├── db.ts               tabelas e consultas
│   └── auth.ts             senhas (scrypt), sessões, limite de tentativas
├── electron/             App de Windows
│   ├── main.cjs            janela, bandeja, servidor e LiveKit embutidos, Tailscale, lista de amigos
│   ├── preload.cjs         ponte segura para a tela inicial
│   └── launcher.*          tela inicial: Hospedar, Entrar e Amigos
├── public/               logos e worklets de áudio (portão, seletor de canal, gravador)
├── assets/               ícones do app (icon.png, icon.ico)
├── docs/                 documentação (veja docs/README.md)
├── iniciar.bat           atalho para rodar o servidor pelo código
└── package.json          scripts, dependências e configuração do instalador
```

## Como as partes se conversam

```
 launcher (HTML) ──IPC──► main.cjs ──fork──► server/index.ts ──proxy /lk──► livekit-server
                              │                    ▲
                              └─ tailscale serve ──┘      navegador/janela ─► React (src/)
```

1. O usuário abre o app. `main.cjs` mostra a tela inicial (`launcher.html`).
2. Em **Hospedar**, `main.cjs` sobe o LiveKit, depois o servidor (`build/server.cjs`) e publica com `tailscale serve`.
3. A interface React (`dist/`) é entregue pelo próprio servidor. Ela fala com ele por HTTP e WebSocket.
4. Voz, vídeo e tela passam pelo LiveKit; o servidor apenas emite o passe (`/api/voice/token`) e faz o proxy em `/lk`.

Detalhes de cada peça: [arquitetura.md](arquitetura.md).

## O que não está no Git

Está no `.gitignore` e é gerado ou baixado à parte:

| Pasta | Por quê |
|---|---|
| `node_modules/` | dependências: `npm install` |
| `dist/` e `build/` | interface e servidor compilados: `npm run build` e `npm run build:server` |
| `release/` | instalador gerado: `npm run dist:win` |
| `vendor/` | `livekit-server.exe`, baixado de github.com/livekit/livekit/releases (veja [desenvolvimento.md](desenvolvimento.md)) |
| `data/` | banco do modo de desenvolvimento, com contas e mensagens |

## Onde ficam os arquivos

### No computador de quem desenvolve

| Pasta/arquivo | O que é |
|---|---|
| `src/` | Interface (React). `App.tsx`, `VoiceRoom.tsx`, `voice.ts`, `AudioSettings.tsx`, `Login.tsx`, `api.ts` |
| `src/audio/` | Tratamento de áudio: `pipeline.ts`, `MicProcessor.ts`, `settings.ts`, `calibrate.ts` |
| `src/styles/` | `tokens.css` (design tokens e temas) e `app.css` |
| `server/` | Servidor Node: `index.ts`, `db.ts`, `auth.ts` |
| `electron/` | App desktop: `main.cjs`, `preload.cjs`, `launcher.html/js/css` (tela Hospedar/Entrar) |
| `public/` | Logos e `worklets/` (portão de ruído, seletor de canal, gravador) |
| `assets/` | Ícones do app (`icon.png`, `icon.ico`) |
| `vendor/livekit-server.exe` | Servidor de voz (LiveKit 1.13.10). Não vai para o git |
| `release/` | Instalador gerado: `Papo Setup 0.6.0.exe` |
| `data/` | Banco do modo de desenvolvimento (não é o do app instalado) |

### No PC de quem instalou o app

| O que | Onde |
|---|---|
| Programa | `C:\Program Files\Papo` (ou a pasta escolhida na instalação) |
| **Dados do servidor** (contas, canais, mensagens) | `%APPDATA%\Papo\data\papo.db` (normalmente `C:\Users\SEU_USUARIO\AppData\Roaming\Papo\data`) |
| Configurações do app | `%APPDATA%\Papo\config.json` e `livekit.yaml` (contêm a chave interna do servidor de voz: **não compartilhe**) |
| Configurações de áudio | Guardadas no próprio app (por servidor ao qual a pessoa se conecta) |

**Backup:** copie a pasta `%APPDATA%\Papo\data` para outro lugar de vez em quando (pendrive, nuvem). Só importa para quem hospeda.
