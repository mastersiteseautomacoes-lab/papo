# Papo: documentação do projeto

Chat de texto, voz, vídeo e compartilhamento de tela, no estilo do Discord, feito para uso pessoal entre amigos.
Versão atual do app: **0.6.0** (instalador `Papo Setup 0.6.0.exe`, ~120 MB).

---

## 1. Objetivo

Recriar a experiência do Discord para **uso pessoal, entre amigos**, com estas exigências:

- Layout fiel ao Discord (servidores, canais, chat, lista de membros, temas, densidade).
- Texto em tempo real, **voz, câmera e compartilhamento de tela**.
- Funcionar **sem pagar nada** e **sem depender de um único computador ligado o tempo todo**: qualquer amigo com Windows pode "hospedar".
- Acesso privado, só para quem você convida (via Tailscale).
- App instalável (`.exe`), e também acessível pelo navegador (para quem usa Mac).

Não usa a API nem os servidores do Discord. É um sistema próprio. O nome, a logo e as fontes **não** são do Discord.

---

## 2. Como surgiu (resumo do que fizemos)

1. **Análise do Discord:** olhamos o app desktop em uso (screenshots) e comparamos com os tokens de CSS: colunas, hierarquia, tema escuro, estados de hover, menus de contexto, painel flutuante de canais.
2. **Front-end fiel:** React + Vite + TypeScript, com tokens de design em 3 camadas (primitivas, semânticas, de componente), 4 temas (escuro, mais escuro, meia-noite, claro) e 3 densidades.
3. **Backend de texto:** servidor Node com WebSocket, banco SQLite, login com convite, servidores, canais, mensagens salvas, presença online e "digitando…".
4. **Acesso privado com Tailscale:** o servidor roda no PC e é publicado só dentro da rede Tailscale, com HTTPS.
5. **App instalável (Electron):** tela inicial com **Hospedar** e **Entrar**. Hospedar liga o servidor embutido e roda o `tailscale serve` sozinho.
6. **Ícone e logo** do Papo aplicados no instalador, janela, bandeja e telas.
7. **Voz, vídeo e tela (LiveKit):** servidor de mídia open source embutido no app, salas de voz, câmera, compartilhamento de tela.
8. **Bandeja do sistema:** fechar a janela enquanto hospeda só a esconde; o servidor continua no ar.
9. **Melhorias de design:** painel de voz na lateral, sala que se adapta a janelas pequenas, botões de ampliar e tela cheia nos blocos, remoção do botão Threads.
10. **Gestão:** renomear e excluir canais, salas de voz e servidores (só o dono); **remover membros** (só o dono) e **sair de um servidor** (qualquer membro). Retiramos as ações da mensagem (reagir, responder, encaminhar, mais) e o botão de presente, que não seriam usados.
11. **Tratamento de áudio:** filtros de ruído (RNNoise e GTCRN), portão de ruído próprio, ganho de entrada, escolha de microfone, seleção automática de canal (fones que saem só por um lado) e assistente de calibração.
12. **Amigos (0.6.0):** na tela inicial (Hospedar / Entrar), uma lista de servidores de amigos. O app confere de 30 em 30 segundos quais estão no ar e avisa com uma notificação do Windows quando um servidor volta a ficar online (também com a janela escondida na bandeja). O servidor ganhou a rota `/api/health`, sem login e sem dados, que só responde `{"papo":true}`.
13. **Seta "Início" (0.6.0):** na tela de login de um servidor há uma seta no canto superior esquerdo que volta à tela de Hospedar / Entrar, para trocar de servidor. Só existe no app instalado. Atalho: `Ctrl+Shift+H`.

---

## 3. Como funciona (visão geral)

```
 Amigo (app Papo ou navegador)
        │  HTTPS (Tailscale)
        ▼
 https://NOME-DO-PC.tailXXXX.ts.net   ← publicado por "tailscale serve" (só dentro da rede Tailscale)
        │
        ▼
 Servidor do Papo (Node, porta 38080 local)
   ├─ Interface (React)   ├─ API + WebSocket (texto, presença)
   ├─ Banco SQLite        └─ Proxy /lk  ──►  LiveKit (voz, vídeo e tela)
                                              portas 7880 (local), 7881 TCP e 7882 UDP
```

- **Quem hospeda** roda o servidor no próprio PC. Contas, canais e mensagens ficam **no PC do anfitrião**.
- **Quem entra** só se conecta ao endereço do anfitrião. Não precisa instalar nada de programação.
- A **mídia** (áudio e vídeo) passa direto pelo Tailscale, entre os PCs.

### Limites importantes

- **Cada anfitrião tem o seu próprio servidor** e histórico. Se o Bruno hospedar numa noite e você em outra, são servidores diferentes, com contas separadas.
- O servidor só existe **enquanto o Papo está aberto, em "Hospedar", num PC ligado**.
- **Só Windows pode hospedar** (não existe versão para Mac ainda). Mac **entra** normalmente pelo navegador.
- A banda de **upload do anfitrião** limita transmissões de tela para várias pessoas.

---

## 4. Onde estão os arquivos

### No seu PC (desenvolvimento): `C:\Dev\Papo`

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
| `LEIAME.md` | Guia curto de uso |
| `PROJETO-PAPO.md` | Este documento |
| `STACK-PAPO.md` | Como o app foi construído: linguagens, design system, banco de dados, voz, build |

### No PC de quem instalou o app

| O que | Onde |
|---|---|
| Programa | `C:\Program Files\Papo` (ou a pasta escolhida na instalação) |
| **Dados do servidor** (contas, canais, mensagens) | `%APPDATA%\Papo\data\papo.db` (normalmente `C:\Users\SEU_USUARIO\AppData\Roaming\Papo\data`) |
| Configurações do app | `%APPDATA%\Papo\config.json` e `livekit.yaml` (contêm a chave interna do servidor de voz: **não compartilhe**) |
| Configurações de áudio | Guardadas no próprio app (por servidor ao qual a pessoa se conecta) |

**Backup:** copie a pasta `%APPDATA%\Papo\data` para outro lugar de vez em quando (pendrive, nuvem). Só importa para quem hospeda.

---

## 5. Passo a passo: enviar o app aos amigos

### 5.1 Antes de tudo (só você, uma vez)

1. Instale o Papo (`Papo Setup 0.6.0.exe`) e o **Tailscale** (tailscale.com/download), entrando com uma conta **pessoal e duradoura** (Google, Microsoft, Apple ou GitHub).
2. No painel do Tailscale (login.tailscale.com), aba **DNS**, ative **HTTPS Certificates**. Sem isso o navegador bloqueia microfone, câmera e tela.
3. Abra o Papo e clique em **Hospedar agora**. Anote o endereço que aparece (ex.: `https://nome-do-pc.tailXXXX.ts.net`).
4. Clique em **Abrir o Papo** e **Registre a sua conta primeiro**. A primeira conta vira a **dona** do servidor.
5. Pegue o **código de convite**: dentro do servidor, ícone de convidar (pessoa com "+") no topo do painel de canais.

### 5.2 Mensagem pronta para mandar ao amigo (Windows)

> Oi! Para usar o Papo:
> 1. Baixe e instale o arquivo que te mandei (`Papo Setup 0.6.0.exe`). Se o Windows avisar que é desconhecido, clique em **Mais informações** e depois em **Executar assim mesmo**.
> 2. Instale o **Tailscale** (tailscale.com/download) e entre com a sua conta (Google, Microsoft, Apple ou GitHub).
> 3. Abra o link de **compartilhamento** que te mandei e clique para **aceitar**.
> 4. Abra o Papo, clique em **Entrar**, cole este endereço: `https://NOME-DO-PC.tailXXXX.ts.net` e clique em Entrar.
> 5. Clique em **Registrar**, escolha usuário e senha (mínimo 8 caracteres) e cole o código de convite: `CODIGO`.

### 5.3 Compartilhar o seu PC com cada amigo (Tailscale)

O compartilhamento dá ao amigo acesso a **um único computador seu**, sem expor o resto da sua rede.

1. Abra **login.tailscale.com/admin/machines**.
2. Na linha do seu PC, clique nos **três pontinhos (⋯)** e depois em **Share…**.
3. Clique em **Copy share link** e envie o link só para aquele amigo (quem aceitar primeiro fica com o acesso).
4. O amigo, já com o Tailscale instalado e logado, abre o link e clica para **aceitar**.
5. Para cancelar, o mesmo menu permite remover o compartilhamento.

### 5.4 Amigo com Mac (ou sem instalar nada)

O Papo funciona no **navegador** (Chrome recomendado):

1. Instalar o **Tailscale para Mac** e entrar com a conta dele.
2. Aceitar o link de compartilhamento.
3. Abrir `https://NOME-DO-PC.tailXXXX.ts.net` no Chrome, registrar com o código de convite e usar (texto, voz, câmera e tela funcionam).
4. Opcional: no Chrome, menu ⋮, **Transmitir, salvar e compartilhar**, **Instalar página como aplicativo**.

Quem usa Mac **não consegue hospedar**.

### 5.5 Sem você: outro amigo hospeda

Qualquer amigo com Windows pode hospedar:

1. Instala o Papo e o Tailscale, abre o Papo e clica em **Hospedar agora**.
2. **Compartilha o PC dele** no Tailscale com os demais (passo 5.3, feito por ele).
3. Passa o endereço dele aos outros, que usam **Entrar** (ou o navegador).

Lembre que é um **servidor novo**, com histórico e contas próprios.

---

## 6. Usando o dia a dia

- **Hospedar:** abrir o Papo, **Hospedar agora**, deixar o PC ligado. Fechar a janela só a **esconde na bandeja** (perto do relógio) e o servidor segue no ar. Para encerrar: botão direito no ícone da bandeja, **Sair**.
- **Impedir que o PC suspenda** enquanto o grupo usa: Configurações do Windows, Sistema, Energia, "Suspender" como **Nunca** (na tomada).
- **Firewall do Windows:** na primeira vez que hospedar, o Windows pergunta se pode liberar o `livekit-server.exe`. Clique em **Permitir** (redes privadas e públicas). Sem isso, a voz não chega aos amigos.
- **Voz:** clique numa sala de voz. Botões: microfone, ensurdecer, câmera, compartilhar tela, sair. O painel "Voz conectada" na lateral esquerda tem câmera, tela e sair.
- **Tela compartilhada:** o outro participante pode **ampliar** (lupa) ou usar **tela cheia** (passando o mouse no bloco ou com duplo clique).
- **Volume (só para você):** clique numa pessoa na lista da sala (ou use o ícone de volume no bloco dela, ou o botão direito) e ajuste de 0 a **200%** (começa em 100%), com opção de silenciar. A **transmissão de tela** tem uma barrinha própria, estilo YouTube, no canto do bloco da tela (passe o mouse). Voz e tela têm volumes separados, então dá para abaixar o vídeo do YouTube sem deixar de ouvir quem fala. Os volumes ficam salvos para a próxima vez. **Ensurdecer** zera tudo e, ao voltar, restaura os volumes escolhidos.
- **Dono do servidor:** engrenagem em cada canal (renomear/excluir), menu no nome do servidor (convidar, criar canal, renomear, excluir; excluir pede para digitar o nome). Para **remover um membro**: passe o mouse sobre ele na lista e clique no ícone de remover, ou clique com o botão direito nele. Se ele estiver numa sala de voz, é desconectado na hora. Ele pode voltar se ainda tiver o código de convite.
- **Qualquer membro:** clique no nome do servidor, no topo, e em **Sair do servidor**. O dono não pode sair: precisa **excluir** o servidor (ou ele continua existindo).
- **Amigos:** na tela inicial, no cartão **Amigos**, digite o nome e o endereço do servidor do amigo (`https://….ts.net`) e clique em **Adicionar**. A bolinha verde significa "servidor no ar". **Entrar** abre o servidor dele, **Remover** tira da lista e **Atualizar** confere na hora. A lista fica no `config.json` do app (só neste computador). A notificação do Windows só aparece quando um servidor que estava fora do ar volta; o primeiro teste de cada vez que o app abre é silencioso. "No ar" quer dizer que o servidor responde, não que a pessoa está na frente do computador. Só funciona no app instalado (não no navegador).
- **Trocar de servidor:** na tela de login de um servidor, use a seta **← Início** no canto superior esquerdo (ou `Ctrl+Shift+H` em qualquer tela) para voltar a Hospedar / Entrar.
- **Atualizar o app:** feche o Papo e rode o novo `.exe` por cima (sem desinstalar). Os dados ficam em `%APPDATA%\Papo` e não são tocados. Quem só entra não precisa reinstalar para ver a interface nova.

---

## 7. Áudio e microfone

Menu da engrenagem do seu usuário, **Áudio e microfone**:

- **Microfone:** escolha do dispositivo.
- **Supressão de ruído:** *Forte (RNNoise)*, *Forte (GTCRN)* ou *Só o do navegador*.
- **Portão de ruído:** só transmite quando parece voz; ajustes de sensibilidade e "ignorar sons curtos" (cliques e teclas).
- **Ganho de entrada:** 0 a +40 dB, para microfones fracos (fones simples).
- **Teste do microfone:** medidor ao vivo (nível cru, nível depois do filtro, portão aberto/fechado) e opção de se ouvir (use fones).
- **Calibração (1 minuto):** o app grava silêncio, fala, respiração, mouse, teclado e fala+teclado, e recomenda filtro, limite e ganho. Fala as instruções em voz alta.

**Caso real (fone KZ no jack da placa-mãe):** o microfone entrega o som só no canal direito. O Papo agora escolhe automaticamente o canal com sinal. Se a calibração disser que não detectou voz, confira o microfone escolhido, se está mudo e o volume de entrada do Windows (Configurações, Sistema, Som, Entrada).

---

## 8. Gerar um instalador novo (desenvolvedor)

```bash
cd C:\Dev\Papo
npm install              # só na primeira vez
npm run dist:win         # gera release\Papo Setup X.Y.Z.exe
```

- Para mudar o número da versão, edite `version` em `package.json`.
- O `livekit-server.exe` precisa estar em `vendor/` (baixar de github.com/livekit/livekit/releases, arquivo `livekit_<versão>_windows_amd64.zip`).
- Testar sem instalar: `npm run app`. Servidor e interface em modo de desenvolvimento: `npm run dev:server` e `npm run dev`.
- Teste sem mexer no Tailscale: variável `PAPO_SKIP_TAILSCALE=1`. Para rodar dois anfitriões na mesma máquina: `PAPO_LK_PORT=7990` (usa as portas 7990 a 7992).

O instalador **não é assinado digitalmente**: o Windows mostra um aviso (SmartScreen). Clique em **Mais informações**, **Executar assim mesmo**.

---

## 9. Tamanhos

| O que | Tamanho |
|---|---|
| Instalador (o que se envia) | ~120 MB |
| App instalado | ~426 MB (a maior parte é o Electron; LiveKit ocupa 55 MB) |
| Dados do servidor | cresce com as mensagens (16 MB no início) |

---

## 10. Solução de problemas

| Sintoma | O que verificar |
|---|---|
| Amigo não abre o endereço ("não é possível acessar o site") | No Mac o Tailscale **não abre sozinho** ao ligar: abra-o manualmente ou ligue "Launch at login" nas configurações dele. Sem o Tailscale conectado, nenhum endereço `.ts.net` resolve. Tailscale ligado nos dois PCs? Ele **aceitou** o compartilhamento? O Papo do anfitrião está aberto em Hospedar? O endereço está completo, com `https://`? |
| "Código de convite inválido" | Use o código do ícone de convidar, copiado completo. |
| Aviso amarelo em "Hospedar" | Ele diz o que falta. Costuma ser o HTTPS do Tailscale (aba DNS do painel) ou o Tailscale desconectado. |
| Voz não conecta, ou só funciona no seu PC | O Firewall bloqueou o `livekit-server.exe`: permita nas redes privadas e públicas. Há outro Papo aberto no mesmo PC (portas 7880 e 7881 ocupadas)? |
| Microfone "não capta" | Veja a seção 7. |
| Servidor caiu | PC desligado, em suspensão, ou o Papo foi fechado pelo "Sair". As contas e mensagens continuam salvas; hospede de novo. |

---

## 11. Segurança e privacidade

- O servidor escuta só em `127.0.0.1`. Quem o expõe é o `tailscale serve`, **somente dentro da rede Tailscale** ("tailnet only"). Nunca use `tailscale funnel`.
- O registro exige o **código de convite**. Senhas são guardadas com hash (scrypt), com limite de tentativas e de mensagens.
- O app só abre endereços `https://` (ou localhost e IPs do Tailscale) e só libera microfone, câmera e tela para o servidor aberto.
- Não compartilhe `config.json` nem `livekit.yaml` (chaves do servidor de voz).

---

## 12. Custos

Tudo gratuito: Tailscale (plano pessoal), LiveKit (open source, licença Apache 2.0, roda no seu PC), RNNoise e GTCRN (licença MIT). Confira os limites atuais do plano gratuito do Tailscale em tailscale.com/pricing.

---

## 13. Estado atual e pendências

**Testado:** texto em tempo real, convites, presença, renomear e excluir, voz e vídeo entre dois apps na mesma máquina, compartilhamento de tela (como faixa de vídeo), bandeja, instalador, layout em janelas pequenas, seleção de canal do microfone. Acesso de um Mac pelo navegador ao servidor hospedado no PC, pelo Tailscale (funcionou depois de abrir o Tailscale no Mac).

**Ainda não confirmado em uso real:**
- A **lista de Amigos** e a **seta Início** (0.6.0): o código compilou e o `/api/health` respondeu, mas a tela ainda não foi usada na prática, e a notificação precisa de outro servidor de amigo para ser testada.
- Voz, vídeo e tela **entre PCs diferentes pela rede do Tailscale** (a mídia usa o IP do Tailscale e as portas 7881/7882).
- Câmera real e captura de tela real (o menu de escolha de tela/janela no app desktop).
- Calibração do áudio com a sua voz real depois da correção do canal.

**Ideias futuras:**
- Atualização automática (com `electron-updater` e GitHub Releases), em vez de reinstalar por cima.
- Versão para Mac (para poder hospedar), o que exige gerar o `.dmg` num Mac ou na nuvem.
- Servidor sempre ligado (VPS pequena ou PC velho) para ter histórico único sem depender do PC de ninguém.
- Mensagens diretas, anexos, reações e emojis (hoje os botões existem na tela, mas são só visuais).
