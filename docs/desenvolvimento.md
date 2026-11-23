# Desenvolvimento

## Pré-requisitos

- **Node.js 24** (o servidor usa `node:sqlite`, que vem embutido).
- Para testar a **voz, o vídeo e a tela** no seu PC: um servidor **LiveKit** local (veja abaixo). Sem ele, o Papo abre, cria contas e sessões, mas a sala não conecta.

## Rodar pelo código

```bash
npm install
npm run dev:server     # servidor com recarga (http://127.0.0.1:3000)
npm run dev            # interface com recarga (http://localhost:5173), já aponta para o servidor
```

Para ver o resultado final, como na VPS:

```bash
npm run build          # tsc -b + vite build  -> dist/
npm run server         # entrega dist/ em http://127.0.0.1:3000
```

Outros comandos: `npm run build:server` (gera `build/server.cjs`), `npm run typecheck:server` e `npm run lint` (oxlint).

O **primeiro usuário** que se registra vira o dono. Sem `PAPO_SETUP_CODE` definido, o campo "Código de convite" pode ficar vazio nessa primeira conta. As outras contas usam o código de convite que o dono vê no menu com o próprio nome.

## Servidor LiveKit local

Baixe o `livekit-server` da versão **1.13.10** em github.com/livekit/livekit/releases (no Windows, o arquivo `livekit_<versão>_windows_amd64.zip`) e coloque o `livekit-server.exe` na pasta `vendor/` (ela não vai para o Git). No Mac ou no Linux, use o binário da sua plataforma ou a imagem `livekit/livekit-server:v1.13.10` do Docker.

Inicie o LiveKit e o Papo **com as mesmas chaves** (valores de teste, inventados por você):

```bash
# Terminal 1: LiveKit (a configuração inteira vem de variáveis de ambiente)
LIVEKIT_KEYS="chavetest: segredotestesegredotestesegredoteste12" \
LIVEKIT_CONFIG=$'port: 7880\nbind_addresses:\n - 127.0.0.1\nrtc:\n tcp_port: 7881\n udp_port: 7882\nlogging:\n level: error\n' \
./vendor/livekit-server.exe

# Terminal 2: Papo (as mesmas chaves)
LIVEKIT_API_KEY=chavetest LIVEKIT_API_SECRET=segredotestesegredotestesegredoteste12 npm run dev:server
```

No PowerShell, o equivalente do terminal 1 é:

```powershell
$env:LIVEKIT_KEYS = "chavetest: segredotestesegredotestesegredoteste12"
$env:LIVEKIT_CONFIG = "port: 7880`nbind_addresses:`n - 127.0.0.1`nrtc:`n tcp_port: 7881`n udp_port: 7882`n"
.\vendor\livekit-server.exe
```

O Papo procura o LiveKit em `LIVEKIT_TARGET` (padrão `http://127.0.0.1:7880`). Para ter **dois LiveKit na mesma máquina**, mude as três portas na configuração e ajuste `LIVEKIT_TARGET`.

> Os valores acima são só de teste local. Os da VPS são outros e **não vão para o Git**.

## Variáveis de ambiente do servidor

| Variável | Para quê | Padrão |
|---|---|---|
| `PORT`, `HOST` | Onde o servidor escuta | `3000`, `127.0.0.1` (na imagem Docker: `38080`, `0.0.0.0`) |
| `DB_FILE` | Arquivo do banco | `data/papo.db` |
| `DIST_DIR` | Pasta da interface compilada | `dist` |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Chaves do LiveKit. Sem elas, voz e sessões ficam desligadas | (vazio) |
| `LIVEKIT_TARGET` | Endereço interno do LiveKit | `http://127.0.0.1:7880` |
| `PAPO_SETUP_CODE` | Código exigido para criar a **primeira** conta | (vazio) |
| `TRUST_PROXY` | Em quem confiar para ler o IP real (por trás de um proxy, `uniquelocal`) | (vazio) |

## Testar

Não há suíte de testes automática. Os testes feitos até agora foram roteiros em Node que sobem o servidor e o LiveKit locais e conferem a API (criar e entrar na sessão, limites, encerramento) e, com um Chrome sem janela, a interface (uma tela falsa de 1920×1080 publicada como compartilhamento de tela, em vários tamanhos de janela). Antes de abrir um PR: `npm run lint`, `npm run build` e `npm run typecheck:server`. O GitHub repete essas conferências a cada envio e a cada PR (workflow `.github/workflows/verificar.yml`).

## Lançar uma versão nova

1. Mude `version` em `package.json` e atualize o [CHANGELOG](../CHANGELOG.md), o README e os documentos que citam o número.
2. Envie para a `main`. O GitHub gera sozinho a imagem `ghcr.io/<dono>/papo-server:main` (aba **Actions**).
3. No EasyPanel, **reimplante** o serviço `papo`: o compose usa `pull_policy: always`, então ele baixa a imagem nova. O banco (volume `papo_data`) não é tocado.
4. Marque a versão com uma tag (`git tag vX.Y.Z` e `git push origin vX.Y.Z`).

## Branches

| Branch | O que é |
|---|---|
| `main` | A versão atual. Tudo o que vai ao ar sai daqui: o envio gera a imagem Docker e o EasyPanel acompanha esta branch. |
| `companheiro-discord` | **Não apague.** É uma cópia da `main` (de `a9ee3a8`, não precisa acompanhá-la). O clone do EasyPanel da instância do autor foi feito nela; quando ela foi apagada, o deploy passou a falhar com `Failed to sync changes` e voltou ao recriá-la. Não use para trabalhar: abra o seu trabalho a partir da `main`. |

Se você tem o seu próprio servidor, o mesmo cuidado vale: não apague a branch que foi usada ao criar o serviço no EasyPanel.

## Tags do Git

| Tag | O que é |
|---|---|
| `chat-completo-v0.6.2` | O Papo antigo (chat completo, app de Windows, hospedagem com Tailscale), congelado |
| `v0.7.0` | A primeira versão só de sessões, no navegador |
