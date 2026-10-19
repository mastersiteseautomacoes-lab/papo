# Changelog

Todas as mudanças importantes do Papo. A versão vem de `version` no `package.json`.

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
