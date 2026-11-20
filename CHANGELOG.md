# Changelog

Todas as mudanças importantes do Papo. A versão vem de `version` no `package.json`.

## Em desenvolvimento (branch `companheiro-discord`)

A `main` e a tag `chat-completo-v0.6.2` seguem como o chat completo. Esta branch transforma o Papo num companheiro do Discord ([plano](docs/plano-companheiro-discord.md)).

### Fase 2: sessões por link (sem Discord)
- **Criar e entrar:** uma conta cria a sessão e recebe um link (`/j/abcd-efgh-jkmn`) e um código de 12 caracteres (alfabeto sem i, l, o, 0 e 1). Quem tem o link entra só com um nome, pelo navegador (inclusive no celular) ou colando o link no app de Windows. Página `/s` para criar ou entrar com código; ícone de link na lateral do chat.
- **Servidor:** tabela `link_sessions` e rotas `POST /api/sessions`, `GET /api/sessions/:código`, `POST /api/sessions/:código/token` e `DELETE /api/sessions/:código`. Sala do LiveKit `s-<código>`. Validade de 12 h, no máximo 3 sessões ativas por conta, nome de convidado de 1 a 24 caracteres, só o criador encerra, e o passe do convidado não dá acesso a nenhuma conta nem ao chat.
- **Interface:** o gancho de voz passou a entrar também em sessões (sem WebSocket do Papo e com o microfone desligado ao entrar). O contador de pessoas e a volta à tela de entrada quando a sessão é encerrada funcionam em tempo real.
- **App de Windows:** o campo "Entrar" da tela inicial aceita o endereço do servidor ou o link completo de uma sessão.
- **Compose do EasyPanel:** `pull_policy: always` no serviço do Papo, para um redeploy baixar a imagem nova (a tag `companheiro-discord` não muda).
- **Testado localmente** (servidor + LiveKit do PC, navegador do app e app de Windows): criar, consultar, entrar como convidado e como conta, 2 pessoas na sala, encerrar derrubando o convidado, link com traços e em maiúsculas, limite de 3 sessões. **Publicada na VPS (2026-11-20):** o deploy baixou a imagem nova (o LiveKit seguiu rodando, sem ser recriado) e o servidor público responde com as rotas e a interface novas (401 ao criar sem conta, 404 para código inexistente, páginas `/s` e `/j/…` do app novo). **Ainda falta** um teste com compartilhamento de tela real entre dois computadores usando uma sessão por link.

### Fase 1: servidor público
- **`deploy/`:** `docker-compose.yml`, `Dockerfile`, `Caddyfile` e `livekit.yaml` para rodar o Papo numa VPS, com HTTPS automático e sem Tailscale. Guia em [docs/deploy-vps.md](docs/deploy-vps.md). Ainda não testado numa VPS real.
- **`TRUST_PROXY`:** o servidor lê o IP real de quem chega por trás de um proxy, para o limite de tentativas valer por pessoa.
- **`PAPO_SETUP_CODE`:** em servidor público, a primeira conta (a dona) só é criada com esse código, para um estranho não chegar antes.
- Texto da tela de registro ajustado para o código de configuração.
- **EasyPanel:** `deploy/docker-compose.easypanel.yml` (Papo e LiveKit, sem Caddy, com limites de processador e memória) para VPS que já têm o EasyPanel ocupando as portas 80 e 443. Guia com os dois caminhos em [docs/deploy-vps.md](docs/deploy-vps.md).
- **Imagem pronta:** workflow `.github/workflows/papo-image.yml` compila a imagem do servidor no GitHub e publica no ghcr.io, para a VPS não precisar compilar.
- Plano atualizado: sessões por link passam a vir antes do bot; LiveKit na própria VPS.
- **Executado numa VPS com EasyPanel (2026-11-20):** imagem baixada, contêineres do Papo e do LiveKit no ar, HTTPS válido, proxy `/lk` até o LiveKit, primeira conta protegida pelo código de configuração e porta TCP 7881 aberta. Ainda falta provar a mídia UDP e o vídeo entre dois PCs. O guia registra os passos que funcionaram (Source por Git com Build Path `/deploy`, "Create .env file" ligado, domínio na porta 38080 e novo deploy).

## 0.6.2 (2026-10-24)

### Corrigido
- **Eco ao compartilhar a tela:** o áudio da transmissão incluía tudo o que o computador tocava, inclusive a voz dos amigos na chamada, que voltava para eles com atraso. Agora o áudio da tela exclui o que o próprio Papo toca (`restrictOwnAudio`) e continua levando o som de outros programas, como um vídeo ou uma música. Medido no Electron 44: sem a opção o tom tocado pelo app entrou na captura, com a opção não entrou.
- O áudio da tela não passa mais por cancelamento de eco, supressão de ruído nem ganho automático, que pioravam música e vídeo.

## 0.6.1 (2026-10-24)

Correção encontrada no primeiro teste entre dois computadores: um amigo salvou o servidor de outro, a lista mostrou "fora do ar" sem explicar e, ao clicar em Entrar, a janela ficou preta.

### Corrigido
- **Tela preta ao entrar:** agora o app confere se o servidor responde antes de abrir. Se não responde, a tela inicial mostra o motivo. Se a página falhar durante o carregamento, o app volta ao início com a explicação, em vez de ficar preto.
- **"Fora do ar" sem explicação:** cada amigo fora do ar mostra o motivo (endereço não encontrado, sem resposta, conexão recusada, falha de HTTPS). O teste usa a mesma rede do navegador do app (proxy e certificados do Windows).
- O botão **Entrar** mostra "Conectando…" enquanto confere.

## 0.6.0 (2026-10-19)

### Novo
- **Amigos:** na tela inicial (Hospedar / Entrar), uma lista de servidores de amigos. O app confere de 30 em 30 segundos quais estão no ar e mostra uma notificação do Windows quando um servidor volta a ficar online, mesmo com a janela escondida na bandeja.
- **Seta "Início":** na tela de login de um servidor, uma seta no canto superior esquerdo volta à tela de Hospedar / Entrar, para trocar de servidor. Só aparece no app instalado. O atalho `Ctrl+Shift+H` continua valendo.
- **`GET /api/health`:** rota do servidor, sem login e sem dados, que responde `{"papo":true}`. A lista de Amigos usa para saber se o servidor está no ar.

### Documentação
- Documentação reorganizada em `docs/`, dividida por assunto, com um novo `README.md` na raiz.
- Correção das portas no guia (3000 no modo de desenvolvimento, 38080 no app instalado).

## 0.5.0 e anteriores

O histórico abaixo não foi separado por versão. Está na ordem em que as coisas foram feitas.

- Front-end fiel ao Discord (React + Vite + TypeScript), com tokens de design em 3 camadas, 4 temas e 3 densidades.
- Servidor de texto: Node, WebSocket, SQLite, login com convite, servidores, canais, mensagens salvas, presença e "digitando…".
- Acesso privado com Tailscale (`tailscale serve`, só dentro da rede).
- App instalável em Electron, com **Hospedar** e **Entrar**.
- Ícone e logo do Papo no instalador, na janela, na bandeja e nas telas.
- Voz, vídeo e compartilhamento de tela com LiveKit embutido.
- Bandeja do sistema: fechar a janela enquanto hospeda só a esconde.
- Painel de voz na lateral, sala de voz que se adapta a janelas pequenas, botões de ampliar e tela cheia.
- Gestão: renomear e excluir canais, salas e servidores (só o dono); remover membros (só o dono); sair de um servidor (qualquer membro).
- Tratamento de áudio: filtros de ruído (RNNoise e GTCRN), portão de ruído, ganho de entrada, escolha de microfone, seleção automática de canal e assistente de calibração.
