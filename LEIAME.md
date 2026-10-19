# Papo

Chat estilo Discord para uso pessoal. Texto em tempo real já funciona; voz e vídeo (LiveKit) são a próxima etapa.

## Rodar no seu PC

```
npm install
npm run build
npm run server        # ou dê dois cliques em iniciar.bat
```

Abra http://127.0.0.1:3000 (nesse modo de desenvolvimento a porta é a 3000; no app instalado, em **Hospedar**, o servidor usa a 38080). **O primeiro usuário a se registrar vira dono** e o servidor "Nosso Servidor" é criado.
Para convidar amigos, clique no ícone de convidar no topo do painel de canais e mande o código.

Para desenvolver (recarrega sozinho): `npm run dev:server` e, em outro terminal, `npm run dev` (http://localhost:5173).

## Deixar os amigos acessarem (Tailscale)

1. Instale o Tailscale no seu PC (tailscale.com/download) e entre com uma conta.
2. No painel de administração do Tailscale (login.tailscale.com), em **DNS**, ative **HTTPS Certificates**. Sem HTTPS o navegador bloqueia microfone, câmera e compartilhamento de tela.
3. Com o Papo rodando, publique-o só dentro da sua rede Tailscale:
   ```
   tailscale serve --bg 3000
   ```
   O comando mostra o endereço, algo como `https://seu-pc.tailXXXX.ts.net`. Use `tailscale serve status` para rever e `tailscale serve reset` para desligar. Se a sintaxe mudar na sua versão, veja `tailscale serve --help`.
4. No painel do Tailscale, na página **Machines**, abra o menu do seu PC e use **Share…** para convidar cada amigo. Eles instalam o Tailscale, aceitam o compartilhamento e abrem o endereço acima.
5. Cada amigo clica em **Registrar** e usa o código de convite.

Não use `tailscale funnel`: ele publica na internet aberta e não é necessário aqui.

## Segurança

- O servidor escuta só em `127.0.0.1`; quem expõe é o `tailscale serve`.
- Registro exige o código de convite. Senhas são guardadas com scrypt. Há limite de tentativas de login e de mensagens.
- Faça backup da pasta `data/` (banco SQLite). Ela não vai para o git.
- O token de sessão fica no navegador de cada pessoa; "Sair" invalida a sessão no servidor.

## Estrutura

- `server/`: Node + Express + WebSocket (`ws`) + SQLite (`node:sqlite`).
- `src/`: front-end React. Tokens de design em `src/styles/tokens.css`.

## App instalável (Windows)

`npm run dist:win` gera `release/Papo Setup 0.6.0.exe` (o número vem de `version` no `package.json`). Mande esse arquivo para os amigos.
O instalador não é assinado digitalmente, então o Windows mostra um aviso do SmartScreen: clique em "Mais informações" e depois em "Executar assim mesmo".

Ao abrir o app há duas opções:

- **Hospedar:** liga o servidor no seu computador e roda `tailscale serve` sozinho. Mostra o endereço `https://….ts.net` para você mandar aos amigos. Ao fechar o app, o servidor e a publicação são desligados. Os dados ficam em `%APPDATA%\Papo\data`.
- **Entrar:** cole o endereço de quem está hospedando. Pré-requisito: Tailscale ligado e computador do anfitrião compartilhado com você.

Cada anfitrião tem o seu próprio banco (contas e mensagens). Para ter um histórico único, hospede sempre no mesmo computador.
Para testar sem instalar: `npm run app`.

## Voz, vídeo e compartilhamento de tela (LiveKit)

O app embute o `livekit-server` (pasta `vendor/`, não vai para o git; baixe de github.com/livekit/livekit/releases, arquivo `livekit_<versão>_windows_amd64.zip`, e coloque `livekit-server.exe` em `vendor/`).
Ao clicar em **Hospedar**, o app sobe o LiveKit junto com o servidor. Clique numa sala de voz para entrar; há botões de microfone, ensurdecer, câmera, compartilhar tela e sair.

- O navegador chega ao LiveKit pelo caminho `/lk` do próprio Papo (mesma porta, mesmo HTTPS do Tailscale).
- A mídia (áudio/vídeo) passa direto pelo Tailscale, nas portas **TCP 7881** e **UDP 7882** do anfitrião. Na primeira vez o Firewall do Windows pergunta se pode liberar o `livekit-server.exe`: permita.
- Fechar a janela do app enquanto hospeda só a esconde na bandeja (perto do relógio); o servidor segue no ar. Para encerrar: botão direito no ícone, **Sair**.
- Teste local sem mexer no Tailscale: defina `PAPO_SKIP_TAILSCALE=1`.
