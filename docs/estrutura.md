# Estrutura do repositório

Onde fica cada coisa, como as pastas se conversam e o que **não** está no Git.

## Mapa

```
Papo/
├── src/                  Interface (React + TypeScript)
│   ├── App.tsx             escolhe a tela: início (/) ou sessão (/j/<código>)
│   ├── Home.tsx            início: 12 caixas do código, criar sessão, menu da conta
│   ├── Session.tsx         sessão: nome, cabeçalho, convidar, encerrar
│   ├── Login.tsx           entrar na conta e registrar
│   ├── VoiceRoom.tsx       sala: blocos de vídeo, "Sua tela está no ar", controles, selo NO AR
│   ├── voice.ts            entrar na sala, microfone, câmera, tela, volumes (LiveKit)
│   ├── api.ts              pedidos HTTP e token de login
│   ├── AudioSettings.tsx   tela de áudio e calibração
│   ├── VolumeMenu.tsx      volume de uma pessoa (botão direito / ícone no bloco)
│   ├── VolumePanel.tsx     painel "Volumes": voz e tela de todo mundo
│   ├── audio/              cadeia de tratamento do microfone
│   └── styles/             tokens.css (design tokens) e app.css
├── server/               Servidor (Node + Express + SQLite)
│   ├── index.ts            rotas HTTP, proxy /lk, /api/health, arquivos da interface
│   ├── db.ts               tabelas
│   └── auth.ts             senhas (scrypt), sessões de login, limite de tentativas
├── public/               logo e worklets de áudio (portão, seletor de canal, gravador)
├── deploy/               Dockerfile e arquivos de publicação (EasyPanel e VPS limpa)
├── .github/workflows/    gera a imagem Docker do servidor
├── docs/                 documentação (veja docs/README.md)
└── package.json          scripts e dependências
```

## Como as partes se conversam

```
 navegador ──HTTPS──► proxy da VPS ──► papo (server/index.ts) ──proxy /lk──► livekit
                                         │  └─ entrega a interface (dist/)       ▲
                                         └─ banco SQLite (volume /data)          │
 navegador ───────────── mídia: UDP 7882 / TCP 7881 ─────────────────────────────┘
```

1. O navegador abre o endereço. O servidor entrega a interface React (`dist/`).
2. A interface fala com o servidor por HTTP (contas e sessões) e pede um **passe** para a sala.
3. Com o passe, o navegador conecta no LiveKit: a sinalização passa pelo `/lk` do Papo, e a mídia vai direto às portas 7882 (UDP) e 7881 (TCP).

Detalhes de cada peça: [arquitetura.md](arquitetura.md).

## O que não está no Git

Está no `.gitignore` e é gerado ou baixado à parte:

| Pasta | Por quê |
|---|---|
| `node_modules/` | dependências: `npm install` |
| `dist/` e `build/` | interface e servidor compilados: `npm run build` e `npm run build:server` |
| `vendor/` | `livekit-server.exe`, só para testar a voz no seu PC (veja [desenvolvimento.md](desenvolvimento.md)) |
| `data/` | banco do modo de desenvolvimento, com as contas e as sessões |
| `.env` | segredos da publicação (código de configuração, chave e segredo do LiveKit) |

## Onde ficam os dados

| O que | Onde |
|---|---|
| Banco do servidor publicado (contas, sessões) | Volume `papo_data` do Docker na VPS (`/data/papo.db`) |
| Banco do modo de desenvolvimento | `data/papo.db` na pasta do projeto |
| Segredos da publicação | Variáveis de ambiente do serviço (no EasyPanel, aba **Environment**). Não ficam em arquivo do repositório |
| Volumes, ajustes de áudio e token de login | `localStorage` do navegador de cada pessoa |

**Backup:** copie o banco da VPS de vez em quando (veja [deploy-vps.md](deploy-vps.md#atualizar-e-cuidar)).
