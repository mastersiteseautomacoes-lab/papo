# Papo: a stack (como o app foi construído)

Este documento explica **com quê** o Papo foi feito, **como cada parte funciona** e **por que** escolhemos cada ferramenta. Foi escrito para quem não é programador, mas tem os detalhes técnicos para quem quiser continuar o projeto.
Complementa o `PROJETO-PAPO.md` (o que fizemos, como instalar e usar). Versão do app: **0.6.0**.

---

## 1. Resposta rápida

**Não usamos Java nem Python.** O Papo inteiro é feito com **TypeScript/JavaScript** (a mesma linguagem no app, no servidor e na interface), mais **HTML e CSS** para a aparência, e **SQL** para o banco de dados.

| Linguagem | Para que serve no Papo | Onde está |
|---|---|---|
| **TypeScript** | Interface (telas) e servidor. É JavaScript com "verificação de erros" | `src/`, `server/` |
| **JavaScript** | App desktop (Electron) e programas de áudio que rodam dentro do navegador | `electron/`, `public/worklets/` |
| **HTML** | Estrutura da tela inicial (Hospedar/Entrar) e da página base | `index.html`, `electron/launcher.html` |
| **CSS** | Visual: cores, tamanhos, temas, animações | `src/styles/` |
| **SQL** | Conversar com o banco de dados (criar tabelas, buscar e gravar dados) | `server/db.ts`, `server/index.ts` |
| **YAML** | Configuração do servidor de voz (gerada pelo app) | `%APPDATA%\Papo\livekit.yaml` |

**Por que uma linguagem só?** Quem aprende TypeScript consegue mexer em tudo. Os tipos (formato dos dados) são compartilhados, então um erro de digitação é pego antes de o app rodar.

O projeto tem cerca de **3.900 linhas de código** escritas por nós, mais as bibliotecas prontas.

---

## 2. As peças e o que cada uma faz

Imagine o Papo como um restaurante:

| Peça do restaurante | No Papo | Ferramenta |
|---|---|---|
| **Salão** (o que o cliente vê) | Telas, botões, chat | **React** + **CSS** |
| **Garçom** (leva e traz pedidos) | Comunicação entre telas e servidor | **HTTP** (pedidos normais) e **WebSocket** (conversa ao vivo) |
| **Cozinha** (onde as regras acontecem) | Servidor do Papo | **Node.js** + **Express** |
| **Estoque / livro de registros** | Contas, canais e mensagens | **SQLite** |
| **Linha de telefone de voz** | Voz, vídeo e tela | **LiveKit** (WebRTC) |
| **Porta privada do restaurante** | Só convidados chegam | **Tailscale** |
| **Embalagem para entrega** | O app que se instala no Windows | **Electron** |

### Ferramentas e versões

| Ferramenta | Versão | Função |
|---|---|---|
| **Node.js** | 24 | Roda o servidor (dentro do app, quem fornece é o Electron) |
| **TypeScript** | 6.0 | A linguagem, com checagem de tipos |
| **React** | 19 | Monta as telas a partir de "componentes" |
| **Vite** | 8 | Empacota a interface para produção e roda o modo de desenvolvimento |
| **Express** | 5 | Servidor web: recebe pedidos HTTP |
| **ws** | 8 | WebSocket: conexão aberta para mensagens em tempo real |
| **SQLite** (`node:sqlite`) | 3.50 | Banco de dados em um único arquivo, embutido no Node |
| **Electron** | 44 | Transforma a página web em programa de Windows (traz o Chromium e o Node dentro) |
| **electron-builder** | 26 | Gera o instalador `.exe` |
| **esbuild** | 0.28 | Junta o código do servidor em um único arquivo (`build/server.cjs`) |
| **LiveKit** | servidor 1.13.10; SDKs 2.x | Servidor e biblioteca de voz, vídeo e tela |
| **lucide-react** | 1.x | Ícones |
| **RNNoise / GTCRN** (`@sapphi-red/web-noise-suppressor`) | 0.4 | Filtros de ruído do microfone |
| **http-proxy** | 1.x | Encaminha `/lk` para o servidor de voz pela mesma porta |
| **tsx** | 4 | Roda TypeScript direto, para desenvolver |

---

## 3. A interface (front-end)

**React** divide a tela em **componentes**, como peças de Lego: `App` (a tela principal), `Login`, `VoiceRoom` (sala de voz), `AudioSettings` (configurações de áudio), `VolumeMenu` (volume), e assim por diante. Cada peça mostra dados e reage a cliques.

- **Estado:** os dados da tela (lista de servidores, mensagens, quem está na sala) ficam em variáveis de estado do React. Quando o servidor manda uma novidade, o estado muda e a tela se redesenha sozinha.
- **Ícones:** biblioteca lucide (traço linear, parecido com o estilo do Discord).
- **Fonte:** Inter (a "gg sans" do Discord é propriedade deles e não foi usada).
- **Vite** monta tudo em uma pasta `dist/` com arquivos prontos (HTML, JS, CSS). Esse `dist/` é o que o servidor entrega a quem abre o endereço.

### Arquivos principais

| Arquivo | O que faz |
|---|---|
| `src/App.tsx` | Tela principal: trilho de servidores, canais, chat, membros, menus, diálogos |
| `src/api.ts` | Fala com o servidor (pedidos HTTP) e mantém o WebSocket com reconexão automática |
| `src/voice.ts` | Entrar na sala de voz, microfone, câmera, tela, volumes (usa LiveKit) |
| `src/VoiceRoom.tsx` | Os blocos de vídeo, ampliar, tela cheia, barrinha de volume |
| `src/AudioSettings.tsx` | Tela de áudio: medidor, filtros, ganho, calibração |
| `src/audio/*` | Cadeia de tratamento do microfone (seção 7) |

---

## 4. O design system

**Design system** é um conjunto de regras visuais reutilizáveis (cores, espaços, tamanhos), para que tudo pareça do mesmo "app". Em vez de escrever `#2b2d31` em cem lugares, damos um **nome** à cor e usamos o nome. Se mudar a cor, muda em todo lugar.

O Papo copiou a **estrutura em 3 camadas** que vimos no CSS do Discord (`src/styles/tokens.css`):

1. **Primitivas** (valores crus): `--neutral-90`, `--blurple-500`, `--space-2` (8 px), `--radius-md` (12 px). São a paleta bruta.
2. **Semânticas** (o *significado*): `--background-base`, `--text-default`, `--text-muted`, `--border-subtle`, `--brand`. Cada tema aponta esses nomes para cores diferentes.
3. **De componente**: nomes específicos de uma peça (ex.: `--chip-bg`, `--control-bg`).

### Temas e densidade

O tema é uma **classe** colocada na tag `<html>`. Trocar de tema só troca essa classe, e as variáveis do tema mudam sozinhas:

| Classe | Resultado |
|---|---|
| `theme-dark` | Escuro (padrão) |
| `theme-darker` | Mais escuro |
| `theme-midnight` | Preto puro nos fundos |
| `theme-light` | Claro |
| `density-default` / `density-cozy` / `density-compact` | Espaço entre mensagens e altura dos canais |

A escolha fica salva no navegador/app e é aplicada logo ao abrir (por isso não há "piscada" branca).

### Como o visual foi montado

- **Escala de espaço** (4, 8, 12, 16, 24, 32 px), **escala de raios** (4, 8, 12, 16 px) e **sombras** (`low`, `high`, `ledge`), como no Discord.
- **Estados:** hover, seleção, ativo e desabilitado usam as mesmas variáveis (`--background-hover`, `--background-active`), então ficam consistentes.
- **Layout:** CSS Grid divide a tela em 3 grandes colunas (servidores, canais, chat); o chat tem mais duas: mensagens e membros. A sala de voz calcula o maior tamanho 16:9 que cabe, por isso encolhe junto com a janela.
- **Janelas pequenas:** consultas `@media` escondem a lista de membros e encolhem o painel de canais.

Os valores de cor e medidas foram **estimados a olho** a partir dos screenshots do Discord, e não lidos do código dele. São parecidos, mas não idênticos.

---

## 5. O servidor (back-end)

Arquivos: `server/index.ts` (rotas e WebSocket), `server/db.ts` (banco), `server/auth.ts` (login e senhas).

### Dois jeitos de conversar

1. **HTTP (pedido e resposta):** a tela pergunta, o servidor responde, e a conversa acaba. Usado para login, carregar dados, criar canais, renomear, excluir. Rotas principais:
   - `POST /api/register` e `/api/login`, `GET /api/bootstrap` (carrega tudo de uma vez)
   - `GET /api/channels/:id/messages` (histórico)
   - `POST /api/servers`, `/api/servers/join` (criar e entrar por convite), `PATCH`/`DELETE /api/servers/:id`
   - `POST /api/servers/:id/channels`, `PATCH`/`DELETE /api/channels/:id`
   - `DELETE /api/servers/:id/members/:uid` (remover membro ou sair)
   - `POST /api/voice/token` (permissão para entrar numa sala de voz)
   - `GET /api/health` (sem login: responde `{"papo":true}`; a lista de amigos do app usa para ver se o servidor está no ar)
2. **WebSocket (conexão aberta):** fica ligada o tempo todo, e o servidor "empurra" novidades na hora, sem a tela perguntar. Usado para mensagens novas, "fulano está digitando…", quem está online, quem entrou numa sala de voz e avisos de atualização.

### Eventos do WebSocket

| Quem manda | Evento | Significado |
|---|---|---|
| Tela → servidor | `message`, `typing`, `voice-join`, `voice-leave` | Enviei mensagem, estou digitando, entrei/saí da sala de voz |
| Servidor → tela | `message`, `typing`, `presence`, `voice`, `refresh`, `removed` | Chegou mensagem, alguém digita, alguém ficou on/offline, mudou quem está na sala, recarregue os dados, você foi removido |

### Caminho de uma mensagem

1. Você digita e aperta Enter. A tela manda `{t:'message', channelId, text}` pelo WebSocket.
2. O servidor confere: você está logado? É membro desse servidor? Não está mandando mensagens demais (máx. 8 a cada 5 s)? O texto tem até 2000 caracteres?
3. Grava na tabela `messages` do banco.
4. Envia a mensagem pronta, pelo WebSocket, a **todos os membros do servidor que estão online**.
5. Cada tela recebe, atualiza o estado, e a mensagem aparece.

### Login e segurança

- **Senhas** nunca são guardadas: guardamos um **hash** (impressão digital irreversível) calculado com **scrypt** e um "sal" aleatório por usuário.
- **Sessão:** ao logar, o servidor cria um **token** aleatório de 64 caracteres. A tela guarda o token e o envia em cada pedido. "Sair" apaga o token no servidor.
- **Convite:** para registrar é preciso o código de convite de um servidor (a exceção é a primeira conta, que vira dona).
- **Limites:** poucas tentativas de login por minuto; só o dono edita canais e servidores; todo pedido confere se você é membro antes de ler algo.
- O texto das mensagens é mostrado como **texto puro**: se alguém escrever HTML, ele aparece escrito, e não executa.

---

## 6. O banco de dados

**O que é:** um banco de dados é um "caderno organizado" onde o programa guarda coisas que precisam sobreviver quando ele é fechado. Aqui usamos o **SQLite**: o banco inteiro é **um único arquivo** (`papo.db`) no PC de quem hospeda. Não há programa de banco separado para instalar, e vem embutido no Node (`node:sqlite`).

**Onde fica:** `%APPDATA%\Papo\data\papo.db` (no app instalado). Também aparecem `papo.db-wal` e `papo.db-shm`: são arquivos de apoio do modo WAL, que deixa o banco mais rápido e seguro. **Para fazer backup, copie a pasta `data` inteira** com o Papo fechado.

### Tabelas (as "planilhas" do banco)

Cada tabela é como uma planilha: colunas fixas e uma linha para cada registro.

| Tabela | O que guarda | Colunas principais |
|---|---|---|
| `users` | Contas | `id`, `username` (único), `password_hash`, `color`, `created_at` |
| `sessions` | Logins ativos | `token`, `user_id`, `created_at` |
| `servers` | Servidores | `id`, `name`, `color`, `owner_id` (dono), `invite_code` |
| `members` | Quem está em qual servidor | `server_id`, `user_id`, `role` (`owner` ou `member`) |
| `channels` | Canais de texto e de voz | `id`, `server_id`, `category`, `name`, `kind` (`text`/`voice`), `position` |
| `messages` | Mensagens | `id`, `channel_id`, `user_id`, `text`, `created_at` |

### Como se relacionam

```
users ──< members >── servers ──< channels ──< messages >── users
  └──< sessions
```

- `members` liga pessoas a servidores (uma pessoa pode estar em vários, e um servidor tem várias pessoas).
- Um canal pertence a **um** servidor; uma mensagem pertence a **um** canal e tem **um** autor.

### Regras de proteção

- **Chaves estrangeiras com `ON DELETE CASCADE`:** se você exclui um servidor, o banco apaga sozinho os canais, as mensagens e as participações dele. Se exclui um canal, apaga as mensagens. Ninguém precisa lembrar de limpar.
- **`UNIQUE` no nome de usuário** (sem diferenciar maiúsculas) e no código de convite.
- **Índice** em `messages(channel_id, id)`: faz o histórico abrir rápido mesmo com muitas mensagens.
- **`CHECK`:** `kind` só aceita `text` ou `voice`.
- **Tempo:** as datas são guardadas como números (milissegundos), e a tela as formata ("Hoje às 21:40").

### Exemplo de SQL (o que o servidor faz por baixo)

```sql
-- gravar uma mensagem
INSERT INTO messages (channel_id, user_id, text, created_at) VALUES (?, ?, ?, ?);

-- carregar as últimas 50 mensagens de um canal
SELECT id FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT 50;
```

Os pontos de interrogação são preenchidos pelo código (isso protege contra "SQL injection", um ataque clássico).

### O que NÃO fica no banco

- **Volumes** que cada pessoa escolheu, **tema**, **densidade**, **ajustes de áudio** e o **token de login**: ficam no `localStorage` do navegador/app de cada pessoa (só no computador dela).
- **Áudio e vídeo** não são gravados em lugar nenhum: passam ao vivo e somem.
- Quem é dono do banco é **quem hospeda**: por isso cada anfitrião tem um histórico próprio.

---

## 7. Voz, vídeo e tela (LiveKit e WebRTC)

**WebRTC** é a tecnologia dos navegadores para chamadas em tempo real. Para vários participantes, usa-se um **SFU** (um "centro de distribuição"): cada pessoa envia o áudio e o vídeo **uma vez** ao servidor, e ele repassa a todos. O **LiveKit** é esse servidor, aberto e gratuito.

Fluxo:

1. Você clica numa sala de voz. A tela pede um **token** ao Papo (`/api/voice/token`). O Papo confere que você é membro e assina um passe válido por 6 horas, só para aquela sala.
2. A tela conecta no LiveKit pelo caminho `/lk` do próprio Papo (o `http-proxy` encaminha para o LiveKit, que escuta só no computador). Assim tudo usa a mesma porta e o mesmo HTTPS do Tailscale.
3. O **áudio e o vídeo** em si seguem por outro caminho, direto pelo Tailscale, nas portas **TCP 7881** e **UDP 7882** do anfitrião. O LiveKit anuncia o IP do Tailscale do anfitrião para os clientes saberem onde chegar.
4. O Papo também avisa por WebSocket quem entrou e saiu de cada sala (por isso aparece embaixo do nome da sala, para quem não está nela).

**Por que o navegador exige HTTPS:** microfone, câmera e tela só são liberados em páginas seguras. O `tailscale serve` entrega o HTTPS com certificado válido.

**Volume:** com a opção `webAudioMix`, cada voz passa por um "botão de volume" (GainNode) do navegador. Isso permite ir até 200% e ter um volume separado para a voz e para o áudio da tela de cada pessoa.

---

## 8. Tratamento do microfone

Tudo roda **dentro do computador de quem fala**, antes de enviar (`src/audio/` e `public/worklets/`). Os programas que processam áudio em tempo real chamam-se **AudioWorklets** (por isso estão em JavaScript puro).

Cadeia, na ordem:

1. **Seleção de canal** (`mono.js`): alguns microfones (como o fone KZ) saem só pelo lado direito ou esquerdo. O Papo escolhe o canal que tem sinal (e corrige canais com fase invertida).
2. **Ganho de entrada** (0 a +40 dB): ajuda microfones fracos.
3. **Filtro passa-altas (80 Hz):** corta batidas de mesa e a parte grave da respiração.
4. **Filtro de ruído neural:** **RNNoise** ou **GTCRN** (redes neurais treinadas para separar voz de ruído; removem teclado, mouse, ventilador).
5. **Portão de ruído próprio** (`gate.js`): só deixa passar o que parece voz. Ignora sons curtos (clique e tecla), usa um atraso de 40 ms para não cortar o começo das palavras e abre e fecha de forma suave, sem estalo.
6. **Limitador:** impede estourar (distorcer) quando o ganho é alto.

A **calibração** grava você em etapas guiadas, roda a gravação por cada filtro e recomenda filtro, limite e ganho. Não tem inteligência artificial "na nuvem": tudo é local.

---

## 9. O app desktop (Electron)

**Electron** é um navegador (Chromium) e o Node.js embutidos em um programa. Por isso o app instalado tem ~426 MB: leva um navegador junto. É a mesma técnica de Discord, Slack e VS Code.

Arquivos em `electron/`:

- `main.cjs`: o "cérebro" do app. Cria a janela, o ícone da bandeja, sobe o servidor e o LiveKit como processos filhos, roda o `tailscale serve`, controla o fechamento e escolhe o que compartilhar na tela.
- `launcher.html/js/css`: a tela inicial (**Hospedar** ou **Entrar**).
- `preload.cjs`: uma ponte estreita e segura entre a tela inicial e o `main.cjs`. **Só a tela inicial** pode usá-la, com uma exceção: a página do servidor aberto pode pedir `papo:home` (a seta "Início" do login), que apenas volta à tela inicial.
- **Amigos:** o `main.cjs` guarda a lista em `config.json`, consulta `/api/health` de cada endereço a cada 30 s (do lado do app, sem CORS) e dispara a notificação do Windows quando um servidor volta ao ar.

**Modo Hospedar** (o app faz tudo sozinho): acha o IP do Tailscale, sobe o LiveKit (com chaves aleatórias guardadas em `config.json`), sobe o servidor do Papo, roda `tailscale serve` apontando para ele e mostra o endereço. Ao sair, desfaz tudo.

**Modo Entrar:** abre o endereço do anfitrião na própria janela. O app só aceita `https://`, localhost ou IPs do Tailscale.

---

## 10. De código a instalador (build)

```
 src/ (React/TS)  ──vite build──►  dist/              (interface pronta)
 server/ (TS)     ──esbuild──────► build/server.cjs   (servidor em 1 arquivo)
 electron/ + dist/ + build/ + vendor/livekit-server.exe + assets/
                  ──electron-builder──►  release/Papo Setup X.Y.Z.exe
```

- `npm run build` → interface; `npm run build:server` → servidor; `npm run dist:win` → tudo + instalador (NSIS).
- Dependências de desenvolvimento (React, Vite etc.) **não vão no instalador**: o que roda já está empacotado nos arquivos prontos. Por isso a pasta `node_modules` (613 MB) não é enviada.
- `vendor/livekit-server.exe` (55 MB) é um programa externo, baixado do repositório oficial do LiveKit (com conferência do hash SHA-256) e embutido no instalador.

---

## 11. Rede e privacidade (Tailscale)

- O servidor do Papo escuta **só em 127.0.0.1** (o próprio computador). Ninguém de fora o alcança diretamente.
- O **Tailscale** cria uma rede privada criptografada entre os computadores que você autoriza. O `tailscale serve` publica o Papo **somente dentro dessa rede** (modo "tailnet only") com HTTPS.
- O **compartilhamento** do PC dá a cada amigo acesso a esse computador, e nada mais.

---

## 12. Glossário

| Termo | Significado simples |
|---|---|
| **Front-end** | A parte que você vê e clica (telas) |
| **Back-end / servidor** | A parte que guarda dados e aplica as regras |
| **Componente** | Uma peça reutilizável da tela (um botão, uma lista, uma sala) |
| **API** | O "cardápio" de pedidos que o servidor aceita |
| **HTTP** | Pedido e resposta, uma vez |
| **WebSocket** | Linha aberta para novidades em tempo real |
| **Token** | Chave temporária que prova que você já fez login |
| **Hash** | Impressão digital de uma senha, que não dá para reverter |
| **Banco de dados** | Caderno organizado que sobrevive ao fechar o programa |
| **SQLite** | Banco de dados em um único arquivo |
| **SQL** | A linguagem para pedir coisas ao banco |
| **Cascade** | Apagar um registro apaga automaticamente os que dependem dele |
| **WebRTC** | Tecnologia de chamada de voz/vídeo do navegador |
| **SFU** | Servidor que recebe o áudio/vídeo de cada um e distribui a todos |
| **Design token** | Um nome dado a uma cor ou medida, para reutilizar |
| **Electron** | Navegador + Node em forma de programa instalável |
| **Build** | Transformar o código-fonte em arquivos prontos para uso |
| **Proxy** | Intermediário que repassa um pedido para outro lugar |
| **AudioWorklet** | Pequeno programa que processa áudio em tempo real no navegador |

---

## 13. Por que essas escolhas

| Decisão | Motivo |
|---|---|
| **Tudo em TypeScript** | Uma linguagem só, tipos compartilhados, menos erros |
| **React + Vite** | Padrão do mercado, rápido, muita documentação |
| **SQLite em vez de PostgreSQL/MySQL** | Sem instalar nada, um arquivo só, ótimo para um grupo pequeno. Se um dia o grupo crescer muito, troca-se por um banco maior |
| **Express + ws** | Simples, estáveis, o suficiente para dezenas de pessoas |
| **LiveKit em vez de montar WebRTC à mão** | Voz, vídeo e tela com qualidade, gratuito e open source |
| **Tailscale em vez de abrir portas no roteador** | Privado, HTTPS pronto, sem expor nada à internet |
| **Electron** | Reaproveita a mesma interface web em um app instalável |
| **Sem Discord API** | Evita violar os termos de uso do Discord; o Papo é um sistema independente |

### Limites conhecidos da stack

- **SQLite** aguenta bem um grupo pequeno; não foi feito para milhares de usuários simultâneos.
- **O anfitrião é o servidor:** se o PC dele desliga, o Papo cai (ver o `PROJETO-PAPO.md`).
- **Electron é pesado** (cerca de 426 MB instalado).
- **O servidor embutido usa `node:sqlite`**, que o Node ainda marca como experimental. Funciona bem, mas pode mudar em versões futuras do Node.
