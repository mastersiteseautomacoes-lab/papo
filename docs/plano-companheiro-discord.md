# Plano: Papo como companheiro do Discord

Rascunho de planejamento, escrito em 2026-11-20 depois de analisar a Telinha. Nada aqui foi implementado.

## 1. O que queremos

Transformar o Papo num **companheiro do Discord**, do mesmo jeito que a Telinha: a voz e o texto continuam no Discord, e o Papo cuida de **tela, webcam e áudio de qualidade**, com entrada automática pela call.

Decisões já tomadas:

- **Escopo:** companheiro do Discord. Sem chat de texto próprio.
- **Servidor:** uma VPS alugada, ligada o tempo todo, com domínio e HTTPS.
- **Para o usuário final:** baixar **só o Papo**. Sem Tailscale, sem "Hospedar", sem endereço para copiar.

## 2. Como vai funcionar

```
 Discord (voz e texto, como hoje)
     │  eventos de "quem está em qual canal de voz"
     ▼
 Bot do Papo (dentro do servidor do Discord)
     │
     ▼
 Servidor do Papo, na VPS (domínio + HTTPS)
   ├─ API: login com Discord, descoberta da call, emissão de passe (token)
   ├─ LiveKit: recebe a tela/webcam/áudio e distribui aos espectadores
   └─ Página para assistir pelo navegador (link)
     ▲
     │  HTTPS + WebRTC
 App do Papo (Windows)
   login com Discord → "em que call eu estou?" → entra na sessão → compartilha
```

Entrada automática (mesma ideia da Telinha):

1. O bot enxerga em qual canal de voz cada pessoa está.
2. O app, logado com a conta do Discord, pergunta ao servidor "em que call eu estou?".
3. O servidor confirma com o bot e entrega um passe para a sala daquele canal. Só quem **está** no canal recebe o passe.
4. Quem não usa o Discord entra por **link** ou **código** de sessão.

## 3. O que o Papo já tem e reaproveita

| Peça | Onde está | Uso no novo Papo |
|---|---|---|
| Passe do LiveKit por sala | `server/index.ts` (`/api/voice/token`, sala `ch-<id>`) | Passa a emitir o passe para a sala do canal do Discord |
| Servidor Node + rate limit | `server/index.ts`, `server/auth.ts` | Base da API pública |
| Captura de tela e câmera | `src/voice.ts` | Mantém, com a correção do eco (`restrictOwnAudio`) |
| Filtros de microfone e calibração | `src/audio/` | Mantém |
| Tela de sala com ampliar e tela cheia | `src/VoiceRoom.tsx` | Vira a tela da sessão |
| App Electron, bandeja, tela inicial | `electron/` | Mantém; a tela inicial muda |
| Página web servida pelo servidor | `dist/` | Base da página "assistir" |

## 4. O que é novo

1. **Aplicativo e bot no Discord Developer Portal** (você cria; o token do bot **nunca** vai para o Git).
2. **Bot** (sugestão: Node + `discord.js`, mesma linguagem do servidor) que acompanha `voiceStateUpdate` e guarda "quem está em qual canal".
3. **Login com Discord** (OAuth2, escopo `identify`: nome e avatar, o mesmo acesso mínimo que a Telinha pede).
4. **Descoberta da call:** rota que diz em qual sala a pessoa deve estar, e um canal em tempo real para o app reagir quando ela entra ou sai da call.
5. **Salas por link ou código** (12 caracteres aleatórios, com validade) para quem não está no Discord.
6. **Servidor público:** domínio, HTTPS, firewall, proxy e LiveKit com as portas de mídia abertas.
7. **Página "assistir"** no navegador, só para ver (sem instalar).
8. **Tela inicial nova no app** e seletor de tela em galeria, com escolha de qualidade e de fonte de áudio (ver fase 4).
9. **Operação:** backup, monitoramento, limites e atualização do servidor.

## 5. Fases

Cada fase termina com algo que dá para testar e mostrar.

**Ordem revisada em 2026-11-20:** as **sessões por link** vêm antes do bot, porque entregam algo que funciona de ponta a ponta sem depender do Discord. E o **LiveKit fica na própria VPS**: o plano gratuito do LiveKit Cloud tem só 50 GB por mês (um corte duro) e não tem região no Brasil. A nuvem fica como plano B para testes.

### Fase 0: preparação
- **VPS:** escolhida (uma VPS da Hostinger com EasyPanel, com Ubuntu 24.04, 1 núcleo e ~3,8 GB, 4 TB de tráfego por mês). É **compartilhada** com outros serviços (n8n e afins), então a instalação usa imagem pronta e limites de recursos.
- **Nome para o HTTPS:** um nome gratuito basta (endereço automático do EasyPanel, nome do provedor ou sslip.io). Domínio próprio é opcional.
- **Discord:** o aplicativo e o bot no Discord Developer Portal só são necessários na fase 4 (o token fica só com você, nunca no Git).
- **Pronto quando:** a branch `companheiro-discord` e a tag `chat-completo-v0.6.2` existem (feito).

### Fase 1: servidor público (resolve a dor principal) — validada em 2026-11-20 (dois PCs em redes diferentes, sem Tailscale)
- Imagem do servidor compilada pelo GitHub; no EasyPanel, um projeto "papo" com o servidor e o LiveKit (arquivo `deploy/docker-compose.easypanel.yml`), sem Caddy. Guia: [deploy-vps.md](deploy-vps.md).
- Portas de mídia do LiveKit: TCP 7881 e UDP 7882.
- **Pronto quando:** dois PCs em casas diferentes, **sem Tailscale**, abrem o app, entram numa sala e um vê a tela do outro, sem derrubar o n8n.

### Fase 2: sessões por link (sem Discord) — implementada, testada localmente e publicada na VPS; falta o teste com tela real entre dois computadores
- Criar uma sessão, compartilhar a tela e gerar um link e um código de 12 caracteres, como o "Criar sessão" da Telinha.
- Entrar por link ou código, com um nome (convidado), pelo app ou pelo navegador, inclusive no celular.
- **Pronto quando:** uma pessoa cria a sessão no app, outra abre o link no celular e assiste.

### Fase 3: login com Discord
- OAuth2 `identify` (nome e avatar, o mesmo acesso mínimo que a Telinha pede).
- **Pronto quando:** abrir o app, entrar com o Discord e aparecer com nome e avatar.

### Fase 4: bot e entrada automática
- Bot no servidor de teste (o "servidor de Acir"), com o mínimo de permissões (ver canais e o estado de voz).
- O servidor guarda quem está em qual canal; rota de descoberta e canal em tempo real; passe só para quem o bot confirma que está no canal.
- **Pronto quando:** entrar na call no Discord faz o app abrir a sessão sozinho, e sair da call encerra.

### Fase 5: tela e áudio (o que aprendemos da Telinha)
- Seletor de tela em galeria (janelas e telas ao vivo, dentro do app).
- Qualidade: 1080p 60 fps, 1080p 30 fps (padrão) e 720p 60 fps.
- Fonte de áudio: da janela, de um aplicativo, do desktop ou nenhum. O Discord e o Papo ficam sempre de fora (hoje o Papo exclui o próprio áudio; excluir o Discord exige captura por aplicativo).
- **Pronto quando:** uma transmissão em 1080p 60 sem eco, com o som do jogo e sem a voz da call.

### Fase 6: criptografia e operação
- Criptografia de ponta a ponta (a do LiveKit, com troca de chaves entre os participantes).
- Backups, monitoramento da banda e do consumo, limites por sala, atualização automática do app, política de privacidade simples e como remover o bot de um servidor.

## 6. Custos e banda

A parte cara é a **banda de saída** do servidor: o LiveKit recebe a transmissão uma vez e envia uma cópia para cada espectador.

Conta de exemplo (estimativa, depende da cena e do bitrate escolhido):

- 1080p 60 fps: cerca de 6 Mbps por espectador.
- 1 transmissor + 4 espectadores = 24 Mbps de saída, ou cerca de **11 GB por hora**.
- 3 horas por dia, todo dia = cerca de **1 TB por mês**.

Por isso, ao escolher a VPS, a **franquia de tráfego mensal** pesa mais que CPU. O LiveKit só repassa a mídia (não recodifica), então uma VPS pequena (poucos vCPUs e 2 a 4 GB de memória) deve bastar para um grupo pequeno. **Confirme preços, franquia e região no site de cada provedor**; eu não fixei valores aqui porque mudam.

Alternativa para reduzir operação: usar o **LiveKit Cloud** (o mesmo software, hospedado por eles) em vez de rodar o seu. Tem custo por uso e limites no plano gratuito, a confirmar no site deles. Dá menos trabalho de infraestrutura, mas gera dependência de terceiro.

## 7. Riscos

| Risco | O que fazer |
|---|---|
| **Banda e custo** crescem com o uso | Limitar espectadores e qualidade por sala; monitorar; começar com a franquia certa |
| **Rede restrita** de alguns usuários bloqueia UDP | Ativar TURN/TCP do LiveKit e testar em redes diferentes |
| **Salas por link são públicas** | Código longo e aleatório, validade, botão de encerrar sessão e de expulsar |
| **Privacidade:** o servidor vê quem entra e quando | Dizer isso claramente aos usuários; registrar o mínimo; sem gravar vídeo |
| **Regras do Discord para bots** | Pedir só as permissões necessárias; ler as regras e os limites de bots não verificados na documentação oficial do Discord antes de divulgar |
| **Licença da Telinha** (só leitura, não é open source) | Usar só como referência de ideia e de arquitetura; **não copiar código nem textos** |
| **Manutenção de um servidor** (atualizações, segurança, backup) | Começar simples (um compose), automatizar atualizações e backups na fase 6 |
| **Servidor central é ponto único de falha** | Aceitável para o grupo; documentar como restaurar |

## 8. O que acontece com o Papo atual

O Papo de hoje é um chat completo (texto, canais, salas de voz, membros, hospedagem no PC com Tailscale). Como escolhemos o modelo de companheiro, esse código **fica de fora** do novo produto. Opções:

1. **Congelar na versão 0.6.2** com uma tag no Git (`chat-completo-v0.6.2`) e seguir o novo produto numa **branch própria** (`companheiro-discord`). A `main` continua com o chat completo até o novo produto estar pronto; só então a branch é juntada à `main` (por um pull request). **Escolhido e já feito.** Nada se perde e o instalador antigo continua válido.
2. **Manter os dois modos** no mesmo app. Mais trabalho e mais coisa para manter.

## 9. Decisões em aberto

- Nome do produto e domínio.
- (Decidido) VPS: a da Hostinger com EasyPanel, compartilhada. Se a call engasgar quando outros serviços disparam, a saída é uma VPS só para o Papo.
- (Decidido) LiveKit na própria VPS; o LiveKit Cloud fica como plano B de teste.
- Criptografia de ponta a ponta já na primeira versão, ou depois.
- Destino do chat atual (seção 8).
- Se o login por usuário e senha do Papo atual continua existindo para algum caso.
- Se entrar por link (sem Discord) vale já na primeira versão.

## 10. Próximos passos

1. Fase 1: publicar a branch para o GitHub gerar a imagem, tornar o pacote público e criar o serviço no EasyPanel ([deploy-vps.md](deploy-vps.md)).
2. Teste de aceite da fase 1: dois PCs em redes diferentes, sem Tailscale, vendo a tela um do outro, olhando o consumo do n8n durante a call.
3. Só depois: fase 2 (sessões por link), fase 3 (login com Discord) e fase 4 (bot).
