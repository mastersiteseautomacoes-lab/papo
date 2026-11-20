# CLAUDE.md

Guia para quem programa no Papo, inclusive agentes como o Claude Code. Para entender o produto, comece pelo [README](README.md) e por [docs/](docs/README.md).

## O que é

Companheiro para chamadas de voz (como as do Discord): **sessões** em que amigos compartilham tela, câmera e áudio entrando com um código de 12 letras (ou um link), só pelo navegador. Servidor Node numa VPS com HTTPS (EasyPanel), LiveKit na própria VPS para a mídia. Não usa a API do Discord (por enquanto), e nome, logo e fontes não são do Discord. O chat completo e o app de Windows (Electron) saíram na 0.7.0 e estão na tag `chat-completo-v0.6.2`.

## Comandos

```bash
npm install
npm run dev:server     # servidor com recarga (porta 3000)
npm run dev            # interface em http://localhost:5173 (proxy para o servidor)
npm run build          # tsc -b + vite build  -> dist/
npm run build:server   # esbuild -> build/server.cjs
npm run typecheck:server
npm run lint           # oxlint
npm run server         # sobe o servidor (entrega o dist/ já compilado)
```

Para testar voz, vídeo e tela localmente é preciso um LiveKit local e as variáveis `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`: veja [docs/desenvolvimento.md](docs/desenvolvimento.md). Não há suíte de testes automática.

## Mapa

| Caminho | O que é |
|---|---|
| `src/` | Interface React. `Home.tsx` (início: código de 12 letras, criar sessão), `Session.tsx` (sessão em `/j/<código>`), `VoiceRoom.tsx` (sala), `Login.tsx`, `voice.ts`, `api.ts`, `audio/`, `styles/` |
| `server/` | `index.ts` (rotas, proxy `/lk`), `db.ts` (SQLite), `auth.ts` (scrypt, sessões de login, limites) |
| `public/worklets/` | AudioWorklets em JavaScript puro (portão, seletor de canal, gravador) |
| `deploy/` | `Dockerfile`, `docker-compose.easypanel.yml` (caminho principal), `docker-compose.yml` + `Caddyfile` (VPS limpa), `livekit.yaml` |
| `.github/workflows/` | Gera a imagem `ghcr.io/<dono>/papo-server` a cada mudança na `main` |
| `docs/` | Documentação por assunto |

Mapa completo: [docs/estrutura.md](docs/estrutura.md). Como foi construído: [docs/arquitetura.md](docs/arquitetura.md). Plano e fases: [docs/plano-companheiro-discord.md](docs/plano-companheiro-discord.md).

## Regras do projeto

- **Linguagem:** TypeScript no `src/` e no `server/`. JavaScript puro nos worklets. A interface e os textos para o usuário são em **português do Brasil**.
- **Estilo visual:** use os tokens de `src/styles/tokens.css` (primitivas, semânticas, de componente), nunca cores soltas. Os temas são classes no `<html>`; a interface usa só o escuro.
- **Servidor:** por padrão escuta só em `127.0.0.1`. Na imagem Docker escuta em `0.0.0.0` **atrás do proxy HTTPS** (Traefik/Caddy), com `TRUST_PROXY` definido. O sinal do LiveKit (porta 7880) **não é publicado**: o navegador chega nele pelo `/lk` do Papo. Só 80, 443, 7881/TCP e 7882/UDP ficam abertas.
- **Sessões e contas:** quem tem conta cria sessões; entrar numa sessão só precisa do código e de um nome. A primeira conta exige `PAPO_SETUP_CODE`. As tabelas `servers` e `members` guardam só o código de convite da dona (nome herdado do chat); `channels` e `messages` não são mais criadas nem lidas, mas **nunca apague nem altere** um banco existente.
- **Mensagens e SQL:** nomes e textos são exibidos como texto puro. Consultas usam parâmetros (`?`), nunca texto concatenado.
- **Segredos:** `PAPO_SETUP_CODE`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` ficam nas variáveis do serviço (EasyPanel) ou num `.env` fora do Git. Não escreva o endereço real da VPS, senhas nem chaves em arquivos do repositório.
- **Não vão para o Git:** `node_modules/`, `dist/`, `build/`, `release/`, `vendor/` (o `livekit-server.exe`), `data/` (o banco) e `.env`.
- **Documentação junto com a mudança:** ao mudar comportamento, atualize o `docs/` correspondente e o [CHANGELOG](CHANGELOG.md) na mesma alteração.
- **Versão:** o número vem de `version` no `package.json`; ao subir, atualize o CHANGELOG, o README e os documentos que citam a versão, e marque a tag (`vX.Y.Z`).
- **Publicar:** enviar à `main` gera a imagem no GitHub; depois, reimplante o serviço `papo` no EasyPanel. Veja [docs/deploy-vps.md](docs/deploy-vps.md) e [docs/desenvolvimento.md](docs/desenvolvimento.md).
- **Limite conhecido:** `node:sqlite` ainda é experimental no Node.
- **Licenças:** outros produtos só servem de inspiração de ideia: **não copie código, textos, desenhos nem marca**.
