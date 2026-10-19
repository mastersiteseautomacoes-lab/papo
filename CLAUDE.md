# CLAUDE.md

Guia para quem programa no Papo, inclusive agentes como o Claude Code. Para entender o produto, comece pelo [README](README.md) e por [docs/](docs/README.md).

## O que é

Chat estilo Discord (texto, voz, vídeo, tela) para uso pessoal entre amigos. Servidor Node no PC de quem hospeda, acesso privado pelo Tailscale, app de Windows em Electron. Não usa a API do Discord, e nome, logo e fontes não são do Discord.

## Comandos

```bash
npm install
npm run dev:server     # servidor com recarga (porta 3000)
npm run dev            # interface em http://localhost:5173
npm run build          # tsc -b + vite build  -> dist/
npm run build:server   # esbuild -> build/server.cjs
npm run typecheck:server
npm run lint           # oxlint
npm run app            # build + servidor + abre o Electron
npm run dist:win       # gera release/Papo Setup X.Y.Z.exe
```

Teste sem mexer no Tailscale: `PAPO_SKIP_TAILSCALE=1`. Dois anfitriões na mesma máquina: `PAPO_LK_PORT=7990`.

## Mapa

| Caminho | O que é |
|---|---|
| `src/` | Interface React. `App.tsx` (tela principal), `Login.tsx`, `VoiceRoom.tsx`, `voice.ts`, `api.ts`, `audio/`, `styles/` |
| `server/` | `index.ts` (rotas, WebSocket, proxy `/lk`), `db.ts` (SQLite), `auth.ts` (scrypt, sessões, limites) |
| `electron/` | `main.cjs` (janela, bandeja, servidor, LiveKit, Tailscale, amigos), `preload.cjs`, `launcher.*` |
| `public/worklets/` | AudioWorklets em JavaScript puro (portão, seletor de canal, gravador) |
| `docs/` | Documentação por assunto |

Mapa completo: [docs/estrutura.md](docs/estrutura.md). Como foi construído: [docs/arquitetura.md](docs/arquitetura.md).

## Regras do projeto

- **Linguagem:** TypeScript no `src/` e no `server/`. JavaScript puro no `electron/` e nos worklets. A interface e os textos para o usuário são em **português do Brasil**.
- **Estilo visual:** use os tokens de `src/styles/tokens.css` (primitivas, semânticas, de componente), nunca cores soltas. Os temas são classes no `<html>`.
- **Servidor:** escuta só em `127.0.0.1`. Quem expõe é o `tailscale serve`, **nunca `tailscale funnel`**.
- **Segurança do Electron:** só a tela inicial (`launcher.html`) usa as funções do `preload.cjs`. A exceção é `papo:home`, que a página do servidor aberto pode chamar e que só volta ao início. Novas funções exigem checar de onde vem o pedido (`fromLauncher`).
- **Mensagens e SQL:** texto de mensagem é exibido como texto puro. Consultas usam parâmetros (`?`), nunca texto concatenado.
- **Segredos:** `config.json` e `livekit.yaml` contêm a chave do servidor de voz e não vão para o Git. Não escreva endereços `.ts.net` reais, senhas nem chaves em arquivos do repositório.
- **Não vão para o Git:** `node_modules/`, `dist/`, `build/`, `release/`, `vendor/` (o `livekit-server.exe`) e `data/` (o banco).
- **Documentação junto com a mudança:** ao mudar comportamento, atualize o `docs/` correspondente e o [CHANGELOG](CHANGELOG.md) na mesma alteração.
- **Versão:** o número vem de `version` no `package.json`; ao subir, atualize o CHANGELOG, o README e os nomes `Papo Setup X.Y.Z.exe` nos documentos.
- **Limite conhecido:** `node:sqlite` ainda é experimental no Node.
