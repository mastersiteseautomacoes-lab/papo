# Plano: Papo como companheiro do Discord

Plano escrito em 2026-11-20, depois de analisar um produto parecido. **Estado:** as fases 0, 1 e 2 estão prontas e no ar (versão 0.7.0); as fases 3 a 6 ainda não foram feitas.

## 1. O que queremos

Transformar o Papo num **companheiro do Discord**: a voz e o texto continuam no Discord, e o Papo cuida de **tela, webcam e áudio de qualidade**, com entrada automática pela call.

Decisões já tomadas:

- **Escopo:** companheiro do Discord. Sem chat de texto próprio.
- **Servidor:** uma VPS alugada, ligada o tempo todo, com HTTPS.
- **Para o usuário final:** **só o navegador**. Sem Tailscale, sem instalar programa, sem "Hospedar".
- **Quem não usa o Discord** entra por **link** ou **código** de sessão.

## 2. Como vai funcionar

```
 Discord (voz e texto, como hoje)
     │  eventos de "quem está em qual canal de voz"            ← fase 4
     ▼
 Bot do Papo (dentro do servidor do Discord)                     ← fase 4
     │
     ▼
 Servidor do Papo, na VPS (HTTPS)                                ← pronto
   ├─ API: contas, sessões, emissão de passe (token)
   ├─ LiveKit: recebe a tela/webcam/áudio e distribui aos espectadores
   └─ A própria página assiste e transmite, pelo navegador
     ▲
     │  HTTPS + WebRTC
 Navegador
   login com Discord → "em que call eu estou?" → entra na sessão → compartilha   ← fases 3 e 4
```

Entrada automática (fases 3 e 4):

1. O bot enxerga em qual canal de voz cada pessoa está.
2. O navegador, logado com a conta do Discord, pergunta ao servidor "em que call eu estou?".
3. O servidor confirma com o bot e entrega um passe para a sala daquele canal. Só quem **está** no canal recebe o passe.
4. Quem não usa o Discord entra por **link** ou **código** (já funciona).

## 3. O que já existe e o que falta

| Peça | Estado |
|---|---|
| Servidor Node + limite de tentativas | Pronto (`server/index.ts`, `server/auth.ts`) |
| Passe do LiveKit por sala | Pronto, por sessão (sala `s-<código>`) |
| Captura de tela e câmera, com a correção do eco (`restrictOwnAudio`) | Pronto (`src/voice.ts`) |
| Filtros de microfone e calibração | Pronto (`src/audio/`) |
| Sala com vídeo inteiro, ampliar e tela cheia | Pronto (`src/VoiceRoom.tsx`) |
| Servidor público com HTTPS e LiveKit na VPS | Pronto ([deploy-vps.md](deploy-vps.md)) |
| Sessões por código e link, sem conta | Pronto |
| Aplicativo e bot no Discord Developer Portal | **Falta** (você cria; o token do bot **nunca** vai para o Git) |
| Login com Discord (OAuth2, escopo `identify`) | **Falta** |
| Bot (sugestão: Node + `discord.js`) que acompanha `voiceStateUpdate` | **Falta** |
| Descoberta da call (rota + canal em tempo real) | **Falta** |
| Qualidade e fonte de áudio escolhidas pelo usuário | **Falta** |
| Operação: backup, monitoramento, limites | **Falta** |

## 4. Fases

Cada fase termina com algo que dá para testar e mostrar.

**Ordem revisada em 2026-11-20:** as **sessões por link** vieram antes do bot, porque entregam algo que funciona de ponta a ponta sem depender do Discord. E o **LiveKit ficou na própria VPS**: o plano gratuito do LiveKit Cloud tem só 50 GB por mês (um corte duro) e não tem região no Brasil. A nuvem fica como plano B para testes.

### Fase 0: preparação — feita
- **VPS:** uma VPS da Hostinger com EasyPanel, Ubuntu 24.04, 1 núcleo e ~3,8 GB, 4 TB de tráfego por mês. É **compartilhada** com outros serviços (n8n e afins), então a instalação usa imagem pronta e limites de recursos.
- **Nome para o HTTPS:** o endereço gratuito do EasyPanel basta; domínio próprio é opcional.

### Fase 1: servidor público — feita e validada em 2026-11-20
- Imagem do servidor compilada pelo GitHub; no EasyPanel, um projeto "papo" com o servidor e o LiveKit (`deploy/docker-compose.easypanel.yml`). Guia: [deploy-vps.md](deploy-vps.md).
- Portas de mídia do LiveKit: TCP 7881 e UDP 7882.
- **Pronto quando:** dois PCs em casas diferentes, **sem Tailscale**, entram numa sala e um vê a tela do outro, sem derrubar o n8n. (Os dois PCs viram a tela um do outro; o consumo da VPS numa call longa ainda não foi medido.)

### Fase 2: sessões por link (sem Discord) — feita
- Criar uma sessão, compartilhar a tela e gerar um link e um código de 12 caracteres.
- Entrar por link ou código, com um nome (convidado), pelo navegador, inclusive no celular.
- **Pronto quando:** uma pessoa cria a sessão, outra abre o link e assiste. **Confirmado em uso real em 2026-11-20.**

### Fase 3: login com Discord
- OAuth2 `identify` (nome e avatar, o acesso mínimo).
- **Pronto quando:** abrir o Papo, entrar com o Discord e aparecer com nome e avatar.

### Fase 4: bot e entrada automática
- Bot no servidor de teste, com o mínimo de permissões (ver canais e o estado de voz).
- O servidor guarda quem está em qual canal; rota de descoberta e canal em tempo real; passe só para quem o bot confirma que está no canal.
- **Pronto quando:** entrar na call no Discord faz o Papo abrir a sessão sozinho, e sair da call encerra.

### Fase 5: tela e áudio
- Qualidade: 1080p 60 fps, 1080p 30 fps (padrão) e 720p 60 fps.
- Fonte de áudio: da janela, do aplicativo, do desktop ou nenhum. O Discord e o Papo ficam sempre de fora. Hoje o Papo exclui o **próprio** áudio, mas o do Discord entra se a tela inteira for compartilhada com som; excluí-lo exige captura por aplicativo, que o navegador não oferece. Se isso pesar, é o caso para um aplicativo instalável (ideia futura no [roadmap](roadmap.md)).
- O seletor de tela em galeria (janelas ao vivo dentro da página) depende dessa decisão: no navegador, quem escolhe é o próprio navegador.
- **Pronto quando:** uma transmissão em 1080p 60 sem eco, com o som do jogo e sem a voz da call.

### Fase 6: criptografia e operação
- Criptografia de ponta a ponta (a do LiveKit, com troca de chaves entre os participantes).
- Backups, monitoramento da banda e do consumo, limites de espectadores por sessão, expulsar pessoa da sessão, política de privacidade simples e como remover o bot de um servidor.

## 5. Custos e banda

A parte cara é a **banda de saída** do servidor: o LiveKit recebe a transmissão uma vez e envia uma cópia para cada espectador.

Conta de exemplo (estimativa, depende da cena e do bitrate escolhido):

- 1080p 60 fps: cerca de 6 Mbps por espectador.
- 1 transmissor + 4 espectadores = 24 Mbps de saída, ou cerca de **11 GB por hora**.
- 3 horas por dia, todo dia = cerca de **1 TB por mês**.

Por isso, ao escolher a VPS, a **franquia de tráfego mensal** pesa mais que o processador. O LiveKit só repassa a mídia (não recodifica), então uma VPS pequena (poucos vCPUs e 2 a 4 GB de memória) deve bastar para um grupo pequeno. **Confirme preços, franquia e região no site de cada provedor**; os valores mudam.

Alternativa para reduzir operação: o **LiveKit Cloud** (o mesmo software, hospedado por eles). Tem custo por uso e limites no plano gratuito, a confirmar no site deles. Dá menos trabalho de infraestrutura, mas gera dependência de terceiro.

## 6. Riscos

| Risco | O que fazer |
|---|---|
| **Banda e custo** crescem com o uso | Limitar espectadores e qualidade por sala; monitorar; começar com a franquia certa |
| **Rede restrita** de alguns usuários bloqueia UDP | A porta TCP 7881 já está aberta como reserva; testar em redes diferentes |
| **Salas por link são públicas** para quem tem o código | Código longo e aleatório, validade, botão de encerrar sessão; falta expulsar pessoa |
| **Privacidade:** o servidor vê quem entra e quando | Dizer isso claramente aos usuários; registrar o mínimo; sem gravar vídeo |
| **Regras do Discord para bots** | Pedir só as permissões necessárias; ler as regras e os limites de bots não verificados na documentação oficial do Discord antes de divulgar |
| **Licença do produto que serviu de inspiração** (código só para leitura, não é open source) | Usar só como referência de ideia; **não copiar código, textos nem marca** |
| **Manutenção de um servidor** (atualizações, segurança, backup) | Começar simples (um compose), automatizar atualizações e backups na fase 6 |
| **Servidor central é ponto único de falha** | Aceitável para o grupo; documentar como restaurar |

## 7. O Papo antigo

O Papo até a 0.6.2 era um chat completo (texto, canais, salas de voz, membros, app de Windows, hospedagem no PC com Tailscale). Esse código está congelado na tag **`chat-completo-v0.6.2`** e **não recebe mais mudanças**. Na 0.7.0 a `main` passou a ser só o companheiro: o chat e o app de Windows foram removidos, e o servidor mantém só contas e sessões (um banco antigo continua abrindo, sem alteração).

## 8. Decisões em aberto

- Nome do produto e domínio próprio.
- Criptografia de ponta a ponta já nas primeiras versões ou depois da fase 4.
- Se o login por usuário e senha continua depois do login com Discord (hoje é o que dá acesso a criar sessões).
- Se vale um aplicativo instalável para capturar o áudio por aplicativo (fase 5).

## 9. Próximos passos

1. Fase 3: criar o aplicativo no Discord Developer Portal (só você, com a sua conta) e implementar o login com `identify`.
2. Fase 4: criar o bot (token só nas variáveis do serviço, nunca no Git), instalá-lo no servidor de teste e ligar a entrada automática.
3. Medir o consumo de processador e memória da VPS numa call longa e ajustar os limites do compose.
