# Papo: a stack (como foi construído)

Este documento explica **com quê** o Papo é feito, **como cada parte funciona** e **por que** escolhemos cada ferramenta. Foi escrito para quem não é programador, mas tem os detalhes técnicos para quem quiser continuar o projeto.
Complementa a [visão geral](visao-geral.md) (o que é) e o guia de [publicação na VPS](deploy-vps.md) (como colocar no ar). Versão: **0.7.0**.

---

## 1. Resposta rápida

**Não usamos Java nem Python.** O Papo inteiro é feito com **TypeScript/JavaScript** (a mesma linguagem na interface e no servidor), mais **HTML e CSS** para a aparência e **SQL** para o banco de dados.

| Linguagem | Para que serve no Papo | Onde está |
|---|---|---|
| **TypeScript** | Interface (telas) e servidor. É JavaScript com "verificação de erros" | `src/`, `server/` |
| **JavaScript** | Programas de áudio que rodam dentro do navegador (AudioWorklets) | `public/worklets/` |
| **HTML** | Página base | `index.html` |
| **CSS** | Visual: cores, tamanhos, animações | `src/styles/` |
| **SQL** | Conversar com o banco de dados (criar tabelas, buscar e gravar dados) | `server/db.ts`, `server/index.ts` |
| **YAML** | Publicação com Docker e a imagem no GitHub | `deploy/`, `.github/workflows/` |

**Por que uma linguagem só?** Quem aprende TypeScript consegue mexer em tudo, e os tipos (formato dos dados) pegam erros de digitação antes de o código rodar.

---

## 2. As peças e o que cada uma faz

Imagine o Papo como um restaurante:

| Peça do restaurante | No Papo | Ferramenta |
|---|---|---|
| **Salão** (o que o cliente vê) | Telas, botões, a sala | **React** + **CSS** |
| **Garçom** (leva e traz pedidos) | Comunicação entre a tela e o servidor | **HTTP** |
| **Cozinha** (onde as regras acontecem) | Servidor do Papo | **Node.js** + **Express** |
| **Livro de registros** | Contas e sessões | **SQLite** |
| **Linha de telefone de voz** | Voz, vídeo e tela | **LiveKit** (WebRTC) |
| **Porta de entrada** | HTTPS e o endereço público | **Traefik** (EasyPanel) ou **Caddy** |
| **Embalagem para entrega** | O servidor e o LiveKit em contêineres | **Docker** |

### Ferramentas e versões

| Ferramenta | Versão | Função |
|---|---|---|
| **Node.js** | 24 | Roda o servidor |
| **TypeScript** | 6.0 | A linguagem, com checagem de tipos |
| **React** | 19 | Monta as telas a partir de "componentes" |
| **Vite** | 8 | Empacota a interface para produção e roda o modo de desenvolvimento |
| **Express** | 5 | Servidor web: recebe pedidos HTTP |
| **SQLite** (`node:sqlite`) | embutido no Node | Banco de dados em um único arquivo |
| **esbuild** | 0.28 | Junta o código do servidor em um único arquivo (`build/server.cjs`) |
| **LiveKit** | servidor 1.13.10; SDKs 2.x | Servidor e bibliotecas de voz, vídeo e tela |
| **lucide-react** | 1.x | Ícones |
| **RNNoise / GTCRN** (`@sapphi-red/web-noise-suppressor`) | 0.4 | Filtros de ruído do microfone |
| **http-proxy** | 1.x | Encaminha `/lk` para o servidor de voz pela mesma porta |
| **tsx** | 4 | Roda TypeScript direto, para desenvolver |
| **oxlint** | 1.x | Confere o estilo do código (`npm run lint`) |

Como o servidor vai em um arquivo único, todas essas bibliotecas ficam em `devDependencies`: o que roda em produção já está empacotado.

---

## 3. A interface (front-end)

**React** divide a tela em **componentes**, como peças de Lego. Cada peça mostra dados e reage a cliques.

| Arquivo | O que faz |
|---|---|
| `src/App.tsx` | Escolhe a tela pelo endereço: `/j/<código>` abre a sessão; qualquer outro endereço abre o início |
| `src/Home.tsx` | Início: as 12 caixas do código (digitar, apagar, colar o código ou o link), **Entrar**, **Criar uma sessão** e o menu da conta |
| `src/Session.tsx` | A sessão: pede o nome, cabeçalho (código, pessoas, **Convidar**, **Áudio**, **Encerrar**), palco e controles |
| `src/VoiceRoom.tsx` | Os blocos de vídeo, "Sua tela está no ar", selo **NO AR**, ampliar e tela cheia |
| `src/voice.ts` | Entrar na sala, microfone, câmera, tela, volumes (usa o LiveKit) |
| `src/Login.tsx` | Entrar na conta e registrar |
| `src/api.ts` | Fala com o servidor (pedidos HTTP) e guarda o token de login |
| `src/AudioSettings.tsx`, `src/VolumeMenu.tsx`, `src/VolumePanel.tsx` | Configurações do microfone, menu de volume de uma pessoa e painel "Volumes" com todas |
| `src/audio/*` | Cadeia de tratamento do microfone (veja a seção 7) |

- **Estado:** os dados da tela (quem está na sala, quais vídeos aparecem) ficam em variáveis de estado do React. Quando algo muda, a tela se redesenha sozinha.
- **Ícones:** lucide (traço linear). **Fonte:** Inter.
- **Vite** monta tudo em `dist/` (HTML, JS e CSS prontos), que o servidor entrega a quem abre o endereço.
- **Compartilhar tela:** captura de 1920×1080 a 30 quadros por segundo e `restrictOwnAudio`, que tira o áudio do próprio Papo da captura (acaba o eco). O áudio da tela não recebe cancelamento de eco, supressão de ruído nem ganho automático.
- **Como a tela é enviada (modos Jogo e Texto, `SCREEN_MODES` em `src/voice.ts`):** o padrão do LiveKit para tela é 1080p a **15 quadros** e 2,5 Mbps, e isso limitava a transmissão mesmo com a captura a 30. O Papo define o envio explicitamente: **Jogo** = 30 quadros, 5 Mbps, VP8, dica de conteúdo "movimento" e prioridade para a fluidez (o VP8 pesa pouco no computador de quem joga); **Texto** = 30 quadros, 4 Mbps, VP9, dica "detalhe" e prioridade para a nitidez (o VP9 comprime melhor e a imagem quase parada custa pouco). O modo escolhido fica no `localStorage` e vale ao começar a compartilhar.
- **Vídeo inteiro em qualquer janela:** o vídeo preenche o bloco por posicionamento absoluto com `object-fit: contain`, sem influenciar o tamanho do bloco. Assim, em janelas largas, a altura do vídeo não passa do bloco nem é cortada.

---

## 4. O design system

**Design system** é um conjunto de regras visuais reutilizáveis (cores, espaços, tamanhos), para que tudo pareça do mesmo "app". Em vez de escrever `#2b2d31` em cem lugares, damos um **nome** à cor e usamos o nome.

O Papo usa uma **estrutura em 3 camadas** (`src/styles/tokens.css`):

1. **Primitivas** (valores crus): `--neutral-90`, `--blurple-500`, `--space-2`, `--radius-md`.
2. **Semânticas** (o *significado*): `--background-base`, `--text-default`, `--text-muted`, `--border-subtle`, `--brand`.
3. **De componente**: nomes específicos de uma peça.

O tema é uma **classe** na tag `<html>` (`theme-dark`, `theme-darker`, `theme-midnight`, `theme-light`). A interface atual usa só o **escuro** (`theme-dark`): os outros temas continuam definidos em `tokens.css`, mas não há seletor na tela. Escalas de espaço, de raios e sombras também vêm dos tokens. Os valores foram **estimados a olho**, e não lidos do código de nenhum outro produto.

---

## 5. O servidor (back-end)

Arquivos: `server/index.ts` (rotas e proxy), `server/db.ts` (banco), `server/auth.ts` (senhas, sessões de login e limite de tentativas). Só **HTTP** (pedido e resposta): não há WebSocket do Papo. O único WebSocket que passa por ele é o do LiveKit, no proxy `/lk`.

### Rotas

| Rota | Quem usa | O que faz |
|---|---|---|
| `GET /api/health` | Teste de saúde do Docker | Sem login e sem dados: responde `{"papo":true}` |
| `POST /api/register` | Quem cria conta | Primeira conta: exige `PAPO_SETUP_CODE`, se definido. As outras: exigem o código de convite da dona. Nome de usuário de 2 a 24 caracteres, senha com 8 ou mais |
| `POST /api/login`, `POST /api/logout` | Contas | Entrar (devolve o token) e sair (apaga o token) |
| `GET /api/me` | Contas | Nome de quem está logado e, só para a dona, o código de convite |
| `POST /api/sessions` | Contas | Cria a sessão: sorteia 12 caracteres (alfabeto sem `i`, `l`, `o`, `0` e `1`), validade de 12 horas, no máximo 3 ativas por conta |
| `GET /api/sessions/:código` | Qualquer um com o código | Confere se a sessão existe e quantas pessoas estão nela |
| `POST /api/sessions/:código/token` | Qualquer um com o código | Entrega o passe do LiveKit para a sala `s-<código>`. Quem tem conta entra com o nome da conta; os outros, com um nome de 1 a 24 caracteres. O passe vale até 6 horas ou até a sessão expirar |
| `DELETE /api/sessions/:código` | Só quem criou | Encerra a sessão e apaga a sala no LiveKit |
| `/lk/*` | Navegador | Proxy para o LiveKit (HTTP e WebSocket) |

O código chega com traços, em maiúsculas ou sem traços: o servidor normaliza antes de procurar.

### Login e segurança

- **Senhas** nunca são guardadas: guardamos um **hash** (impressão digital irreversível) calculado com **scrypt** e um "sal" aleatório por usuário.
- **Token de login:** ao logar, o servidor cria um token aleatório de 64 caracteres, que a tela guarda e envia em cada pedido. "Sair" apaga o token no servidor.
- **Limites por IP:** 10 tentativas por minuto para entrar e registrar e para criar sessões, 30 para pedir passe e 60 para consultar uma sessão. Atrás de um proxy, `TRUST_PROXY` faz o servidor ler o IP real de cada pessoa.
- **Primeira conta protegida:** com `PAPO_SETUP_CODE` definido, um estranho não vira o dono se chegar primeiro.
- **Consultas SQL com parâmetros** (`?`), nunca texto concatenado.
- **Convidado:** o passe dele vale só para a sala da sessão. Ele não tem conta nem acesso a nada além dela.

---

## 6. O banco de dados

**O que é:** um "caderno organizado" onde o programa guarda o que precisa sobreviver quando ele é fechado. Usamos o **SQLite**: o banco inteiro é **um único arquivo** (`papo.db`), sem programa de banco separado, embutido no Node (`node:sqlite`).

**Onde fica:** na VPS, no volume do Docker `papo_data` (`/data/papo.db`). Aparecem também `papo.db-wal` e `papo.db-shm`, arquivos de apoio do modo WAL (mais rápido e seguro). **Para fazer backup, copie a pasta `data` inteira.**

### Tabelas

| Tabela | O que guarda | Colunas principais |
|---|---|---|
| `users` | Contas | `id`, `username` (único, sem diferenciar maiúsculas), `password_hash`, `color`, `created_at` |
| `sessions` | Logins ativos (os tokens) | `token`, `user_id`, `created_at` |
| `servers` | O registro da dona, que guarda o **código de convite** para criar contas | `id`, `name`, `owner_id`, `invite_code` |
| `members` | Quem foi aceito com o convite de qual registro | `server_id`, `user_id`, `role` |
| `link_sessions` | As sessões por código | `code`, `creator_id`, `created_at`, `expires_at`, `ended_at` |

```
users ──< sessions
  ├──< members >── servers
  └──< link_sessions
```

> **Nome herdado:** `servers` e `members` vêm do chat antigo. Foram mantidas para que um banco antigo continue funcionando sem nenhuma alteração. As tabelas `channels` e `messages` (do chat) **não são mais criadas nem lidas**; se existirem num banco antigo, ficam intactas.

### Regras de proteção

- **Chaves estrangeiras com `ON DELETE CASCADE`:** apagar uma conta apaga os logins e as sessões dela.
- **`UNIQUE`** no nome de usuário e no código de convite; o código da sessão é a chave primária.
- **Limpeza:** sessões vencidas há mais de 7 dias são apagadas de hora em hora.
- **Tempo:** as datas são guardadas como números (milissegundos).

### O que NÃO fica no banco

- **Volumes** que cada pessoa escolheu, **ajustes de áudio** e o **token de login** ficam no `localStorage` do navegador de cada pessoa.
- **Áudio e vídeo** não são gravados em lugar nenhum: passam ao vivo e somem.

---

## 7. Tratamento do microfone

Tudo roda **dentro do computador de quem fala**, antes de enviar (`src/audio/` e `public/worklets/`). Os programas que processam áudio em tempo real chamam-se **AudioWorklets** (por isso estão em JavaScript puro).

Cadeia, na ordem:

1. **Seleção de canal** (`mono.js`): alguns microfones (como o fone KZ) saem só pelo lado direito ou esquerdo. O Papo escolhe o canal que tem sinal (e corrige canais com fase invertida).
2. **Ganho de entrada** (0 a +40 dB): ajuda microfones fracos.
3. **Filtro passa-altas (80 Hz):** corta batidas de mesa e a parte grave da respiração.
4. **Filtro de ruído neural:** **RNNoise** ou **GTCRN** (redes neurais treinadas para separar voz de ruído; removem teclado, mouse, ventilador).
5. **Portão de ruído próprio** (`gate.js`): só deixa passar o que parece voz. Ignora sons curtos (clique e tecla), usa um atraso de 40 ms para não cortar o começo das palavras e abre e fecha de forma suave, sem estalo.
6. **Limitador:** impede estourar (distorcer) quando o ganho é alto.

A **calibração** grava você em etapas guiadas, roda a gravação por cada filtro e recomenda filtro, limite e ganho. Não há inteligência artificial "na nuvem": tudo é local.

---

## 8. Voz, vídeo e tela (LiveKit e WebRTC)

**WebRTC** é a tecnologia dos navegadores para chamadas em tempo real. Para vários participantes, usa-se um **SFU** (um "centro de distribuição"): cada pessoa envia o áudio e o vídeo **uma vez** ao servidor, e ele repassa a todos. O **LiveKit** é esse servidor, aberto e gratuito.

Fluxo:

1. Você entra numa sessão. A tela pede um **passe** ao Papo (`/api/sessions/:código/token`). O Papo confere que a sessão existe e assina um passe só para a sala `s-<código>`.
2. A tela conecta no LiveKit pelo caminho `/lk` do próprio Papo (o `http-proxy` encaminha para o LiveKit, que não é publicado para a internet na porta de sinalização). Assim a sinalização usa o mesmo endereço e o mesmo HTTPS.
3. O **áudio e o vídeo** seguem por outro caminho, direto ao LiveKit, nas portas **UDP 7882** (principal) e **TCP 7881** (reserva, para redes que bloqueiam UDP). O LiveKit descobre o IP público da VPS e o anuncia aos navegadores.
4. O contador de pessoas da sessão vem do próprio LiveKit.

**Por que o navegador exige HTTPS:** microfone, câmera e tela só são liberados em páginas seguras. O proxy da VPS entrega o HTTPS com certificado válido.

**Volume:** com a opção `webAudioMix`, cada voz passa por um "botão de volume" (GainNode) do navegador. Isso permite ir até 200% e ter um volume separado para a voz e para o áudio da tela de cada pessoa. O padrão é 100% para a voz e 50% para o áudio da tela (`defaultVolume` em `src/voice.ts`).

**Economia de banda:** o cliente usa `adaptiveStream` e `dynacast`, que reduzem a qualidade enviada quando ninguém está vendo.

---

## 9. De código a servidor no ar (build e publicação)

```
 src/ (React/TS)  ──vite build──►  dist/              (interface pronta)
 server/ (TS)     ──esbuild──────► build/server.cjs   (servidor em 1 arquivo)
 deploy/Dockerfile ──GitHub Actions──► ghcr.io/<dono>/papo-server:main
                                              │
                         VPS (EasyPanel ou Docker): papo + livekit
```

- `npm run build` gera a interface; `npm run build:server`, o servidor.
- A imagem do servidor (`deploy/Dockerfile`) é compilada **pelo GitHub** a cada mudança na `main` (workflow `.github/workflows/papo-image.yml`) e publicada no `ghcr.io`. A VPS só baixa a imagem pronta: compilar lá gastaria memória e processador dos outros serviços.
- O `docker-compose.easypanel.yml` sobe o `papo` e o `livekit` (com limites de processador e memória). O `docker-compose.yml` é a variante para uma VPS limpa, com Caddy. Guia: [deploy-vps.md](deploy-vps.md).

---

## 10. Rede e privacidade

- **Abertas para a internet:** 80 e 443 (proxy HTTPS), **7881 TCP** e **7882 UDP** (mídia). O servidor do Papo e o sinal do LiveKit (porta 7880) ficam só na rede interna do Docker.
- O servidor do Papo vê **quem entra e quando** (nome e código da sessão), mas **não recebe nem grava** o vídeo ou o áudio, que vão ao LiveKit.
- Quem tem o código entra: por isso o código é longo e aleatório, vale 12 horas e pode ser invalidado por quem criou a sessão.

---

## 11. Glossário

| Termo | Significado simples |
|---|---|
| **Front-end** | A parte que você vê e clica (telas) |
| **Back-end / servidor** | A parte que guarda dados e aplica as regras |
| **Componente** | Uma peça reutilizável da tela (um botão, uma lista, uma sala) |
| **API** | O "cardápio" de pedidos que o servidor aceita |
| **HTTP** | Pedido e resposta, uma vez |
| **Token** | Chave temporária. O de login prova quem você é; o passe do LiveKit deixa você entrar numa sala |
| **Hash** | Impressão digital de uma senha, que não dá para reverter |
| **Banco de dados / SQLite** | Caderno organizado que sobrevive ao fechar o programa; o SQLite cabe num único arquivo |
| **Cascade** | Apagar um registro apaga automaticamente os que dependem dele |
| **WebRTC** | Tecnologia de chamada de voz e vídeo do navegador |
| **SFU** | Servidor que recebe o áudio e o vídeo de cada um e distribui a todos (o LiveKit) |
| **Design token** | Um nome dado a uma cor ou medida, para reutilizar |
| **Build** | Transformar o código-fonte em arquivos prontos para uso |
| **Proxy** | Intermediário que repassa um pedido para outro lugar |
| **Contêiner / Docker** | Pacote que leva o programa e o que ele precisa, para rodar igual em qualquer servidor |
| **AudioWorklet** | Pequeno programa que processa áudio em tempo real no navegador |

---

## 12. Por que essas escolhas

| Decisão | Motivo |
|---|---|
| **Tudo em TypeScript** | Uma linguagem só, tipos compartilhados, menos erros |
| **React + Vite** | Padrão do mercado, rápido, muita documentação |
| **SQLite em vez de PostgreSQL/MySQL** | Um arquivo só e nada para instalar. Para um grupo pequeno basta; se o uso crescer muito, troca-se por um banco maior |
| **Express** | Simples, estável, suficiente para dezenas de pessoas |
| **LiveKit em vez de montar WebRTC à mão** | Voz, vídeo e tela com qualidade, gratuito e de código aberto |
| **LiveKit na própria VPS** | O plano gratuito do LiveKit Cloud tem só 50 GB por mês (um corte duro) e não tem região no Brasil |
| **Imagem compilada no GitHub** | A VPS é compartilhada e pequena: compilar nela poderia derrubar os outros serviços |
| **Só navegador, sem app instalado** | Quem assiste ou transmite não instala nada; uma versão só para manter |
| **Sem a API do Discord (por enquanto)** | O Papo é independente. A integração com o Discord (login e bot) vem nas próximas fases e usa só o acesso mínimo |

### Limites conhecidos da stack

- **SQLite** aguenta bem um grupo pequeno; não foi feito para milhares de usuários simultâneos.
- **O servidor é central:** se a VPS cair, as sessões caem.
- **A banda de saída** da VPS limita espectadores e qualidade (veja [custos](seguranca.md#custos)).
- **O servidor usa `node:sqlite`**, que o Node ainda marca como experimental. Funciona bem, mas pode mudar em versões futuras do Node.
