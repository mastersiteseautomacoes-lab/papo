# Estado atual e roadmap

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
