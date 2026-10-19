# Visão geral

Chat de texto, voz, vídeo e compartilhamento de tela, no estilo do Discord, feito para uso pessoal entre amigos.

## Objetivo

Recriar a experiência do Discord para **uso pessoal, entre amigos**, com estas exigências:

- Layout fiel ao Discord (servidores, canais, chat, lista de membros, temas, densidade).
- Texto em tempo real, **voz, câmera e compartilhamento de tela**.
- Funcionar **sem pagar nada** e **sem depender de um único computador ligado o tempo todo**: qualquer amigo com Windows pode "hospedar".
- Acesso privado, só para quem você convida (via Tailscale).
- App instalável (`.exe`), e também acessível pelo navegador (para quem usa Mac).

Não usa a API nem os servidores do Discord. É um sistema próprio. O nome, a logo e as fontes **não** são do Discord.

## Como surgiu

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

## Como funciona

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

## Limites importantes

- **Cada anfitrião tem o seu próprio servidor** e histórico. Se o Bruno hospedar numa noite e você em outra, são servidores diferentes, com contas separadas.
- O servidor só existe **enquanto o Papo está aberto, em "Hospedar", num PC ligado**.
- **Só Windows pode hospedar** (não existe versão para Mac ainda). Mac **entra** normalmente pelo navegador.
- A banda de **upload do anfitrião** limita transmissões de tela para várias pessoas.
