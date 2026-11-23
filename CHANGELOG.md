# Changelog

Todas as mudanças importantes do Papo. A versão vem de `version` no `package.json`.

## Não lançado

### Repositório aberto para quem quiser copiar
- **Licença MIT** (`LICENSE`): antes o projeto dizia "todos os direitos reservados", o que impedia outras pessoas de usá-lo. `package.json` ganhou `license` e `repository`.
- **Novo guia [docs/replicar.md](docs/replicar.md):** do fork à VPS no ar, com a conta dona, as portas e os testes.
- **`PAPO_IMAGE`** no `docker-compose.easypanel.yml`: quem copia o projeto aponta para a própria imagem, sem editar o arquivo. Sem a variável, o comportamento é o mesmo de antes.
- **Workflow `verificar.yml`:** lint, tipos do servidor e build a cada envio e a cada pull request (selo no README).
- **`CONTRIBUTING.md`** com as regras do projeto e como enviar uma mudança.
- **Branches documentadas:** a `companheiro-discord` precisa continuar no GitHub (sem ela o deploy do EasyPanel falhou com `Failed to sync changes`); explicado em `docs/desenvolvimento.md` e no `CLAUDE.md`.
- README, `docs/README.md` e `docs/estrutura.md` atualizados.

### Volume
- **Painel "Volumes"** na barra de baixo (ao lado de "Ver minha tela"): lista cada pessoa da sessão com uma barrinha para a **voz** e, quando ela compartilha a tela com som, outra para o **áudio da tela**. É só para você, vai de 0 a 200%, tem silenciar e "Padrão", e funciona também no celular (os controles do bloco só apareciam ao passar o mouse).
- **O áudio da tela agora começa em 50%** (a voz continua em 100%): o som do computador de quem transmite chegava alto demais. Quem já ajustou o volume de alguém mantém o que escolheu.
- A **barrinha de volume da transmissão** no bloco da tela fica sempre visível (antes só aparecia ao passar o mouse). O botão direito e o ícone do bloco continuam abrindo o menu de volume.

## 0.7.0 (2026-11-20): o Papo vira só de sessões, no navegador

O Papo passou a ser um **companheiro de chamadas**: só sessões (tela, câmera e áudio) com um código de 12 letras, num servidor público numa VPS, usado pelo navegador. O chat completo e o app de Windows foram **removidos**; o código antigo continua na tag `chat-completo-v0.6.2`. Plano: [docs/plano-companheiro-discord.md](docs/plano-companheiro-discord.md).

### Removido
- **App de Windows (Electron):** `electron/`, `assets/`, `iniciar.bat`, o script `dist:win`, a hospedagem no PC com Tailscale e a lista de Amigos. O instalador `Papo Setup 0.6.2.exe` deixa de ser distribuído (o link do Google Drive saiu do README).
- **Chat no servidor:** rotas e WebSocket de servidores, canais, mensagens, presença e voz por canal. O servidor ficou com **contas e sessões**. As tabelas `channels` e `messages` não são mais criadas nem lidas; um banco antigo abre normalmente, sem nenhuma alteração (testado com o servidor da 0.6.2).
- **Dependências:** `electron`, `electron-builder`, `ws` e `@types/ws` (o servidor continua em um arquivo só, `build/server.cjs`).
- **Documentação do produto antigo:** `docs/instalacao.md`, `docs/rodar-pelo-codigo.md` e a captura da sala de voz com o chat (que mostrava nomes reais).

### Mudou
- **README e `docs/` reescritos** para o produto novo, com capturas de tela novas (nomes de exemplo e uma tela de teste gerada).
- **Publicação:** o workflow que gera a imagem Docker agora roda na `main`, e o `docker-compose.easypanel.yml` usa a tag `main` por padrão. No EasyPanel, a **Source** deve apontar para a branch `main`.
- `vite.config.ts` sem o proxy `/ws` (o servidor não tem mais WebSocket do Papo).
- CSS enxugado: saíram os estilos do chat e do app de Windows (verificado com 27 conferências visuais).

### Interface só de sessões (no ar desde 2026-11-20)
- **Corrigido: vídeo cortado ao alargar a janela.** O bloco do vídeo era um `grid` de altura automática com o vídeo em `height: 100%`: numa janela larga, a altura natural do vídeo (16:9 na largura toda) passava da do bloco e o excesso era cortado embaixo (a barra de tarefas sumia). O vídeo agora preenche o bloco por posicionamento absoluto e a tela aparece inteira em qualquer tamanho.
- **Nova tela inicial** (`/`): 12 caixas para o código (digitar, apagar, colar o código ou o link), **Entrar**, **Colar**, **Criar uma sessão** e o menu da conta (nome, código de convite da dona, sair).
- **Sessão no estilo de um companheiro de chamada (só a organização, sem copiar marca, desenhos nem código):** cabeçalho com código, nº de pessoas, **Convidar**, **Áudio** e **Encerrar**; a **sua tela fica escondida** ("Sua tela está no ar") com **Ver minha tela** (acaba o espelho infinito); selo **NO AR** com resolução e quadros por segundo; botões **Compartilhar tela** / **Parar tela**.
- **Áudio e microfone** (supressão de ruído, portão, calibração) dentro da sessão, pelo botão **Áudio**.
- **Celular e tablet:** o botão de compartilhar tela não aparece (esses aparelhos só assistem); a faixa de pessoas rola sem esconder o começo; os 12 campos do código cabem na tela.
- **Testado** com um Chrome sem janela e uma tela falsa 1920×1080 com marcas nos quatro cantos: em 5 tamanhos de janela (1280×720, 1900×600, 1000×900, 800×1000 e 390×844) o vídeo cabe no bloco, usa `contain`, a barra de controles fica visível e a página não rola. **Confirmado em uso real** pelo dono, com compartilhamento de tela de verdade entre dois computadores.

### Sessões por código ou link (fase 2)
- **Criar e entrar:** uma conta cria a sessão e recebe um link (`/j/abcd-efgh-jkmn`) e um código de 12 caracteres (alfabeto sem i, l, o, 0 e 1). Quem tem o link entra só com um nome, pelo navegador (inclusive no celular).
- **Servidor:** tabela `link_sessions` e rotas `POST /api/sessions`, `GET /api/sessions/:código`, `POST /api/sessions/:código/token` e `DELETE /api/sessions/:código`. Sala do LiveKit `s-<código>`. Validade de 12 h, no máximo 3 sessões ativas por conta, nome de convidado de 1 a 24 caracteres, só o criador encerra, e o passe do convidado não dá acesso a nenhuma conta.
- **Compose do EasyPanel:** `pull_policy: always` no serviço do Papo, para um redeploy baixar a imagem nova (a tag não muda).

### Servidor público na VPS (fase 1)
- **`deploy/`:** `docker-compose.yml`, `Dockerfile`, `Caddyfile` e `livekit.yaml` para rodar o Papo numa VPS, com HTTPS automático e sem Tailscale. Guia em [docs/deploy-vps.md](docs/deploy-vps.md).
- **`TRUST_PROXY`:** o servidor lê o IP real de quem chega por trás de um proxy, para o limite de tentativas valer por pessoa.
- **`PAPO_SETUP_CODE`:** em servidor público, a primeira conta (a dona) só é criada com esse código, para um estranho não chegar antes.
- **EasyPanel:** `deploy/docker-compose.easypanel.yml` (Papo e LiveKit, sem Caddy, com limites de processador e memória) para VPS que já têm o EasyPanel ocupando as portas 80 e 443.
- **Imagem pronta:** workflow `.github/workflows/papo-image.yml` compila a imagem do servidor no GitHub e publica no ghcr.io, para a VPS não precisar compilar.
- **Executado numa VPS com EasyPanel:** imagem baixada, contêineres do Papo e do LiveKit no ar, HTTPS válido, proxy `/lk` até o LiveKit, primeira conta protegida pelo código de configuração e mídia entre dois computadores em redes diferentes. O guia registra os passos que funcionaram (Source por Git com Build Path `/deploy`, "Create .env file" ligado, domínio na porta 38080 e novo deploy).

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
