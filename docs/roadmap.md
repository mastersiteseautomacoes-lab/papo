# Estado atual e roadmap

## Pronto e testado (versão 0.7.0)

- **Servidor público na VPS** (EasyPanel, imagem do GitHub): HTTPS válido, proxy `/lk`, primeira conta protegida pelo código de configuração, mídia nas portas 7881 (TCP) e 7882 (UDP). Dois computadores em redes diferentes, sem Tailscale, viram a tela um do outro.
- **Sessões por código ou link:** criar, consultar, entrar como convidado e com conta, contar pessoas, encerrar, validade de 12 horas, limite de 3 por conta, link com traços e em maiúsculas.
- **Interface só de sessões:** tela inicial com as 12 caixas, sessão com "Sua tela está no ar", selo NO AR e vídeo inteiro em qualquer tamanho de janela (testado em 5 tamanhos, do celular ao ultralargo).
- **Áudio da tela sem eco** (`restrictOwnAudio`) e tratamento do microfone (filtros de ruído, portão, ganho, calibração).
- **Uso real (2026-11-20):** o dono criou uma sessão na VPS e transmitiu a tela de verdade para outro computador, e a tela chegou inteira.
- **Compatibilidade:** o servidor enxuto abre um banco do servidor antigo sem alterá-lo.

## Ainda não confirmado em uso real

- Consumo de processador e memória da VPS durante uma call longa, e o efeito nos outros serviços dela.
- Câmera real e a captura de áudio da tela em Safari e Firefox.

## Próximas fases

O plano completo está em [plano-companheiro-discord.md](plano-companheiro-discord.md).

1. **Login com Discord** (fase 3): entrar com a conta do Discord (escopo `identify`: nome e avatar, o mínimo), sem senha do Papo.
2. **Bot e entrada automática** (fase 4): um bot no servidor do Discord sabe quem está em qual canal de voz; quem entra na call recebe o link da sessão sozinho, e sair da call encerra.
3. **Tela e áudio melhores** (fase 5): perfis de qualidade (1080p 60, 1080p 30, 720p 60), escolha da fonte de áudio (sem a voz do Discord) e, se valer a pena, a escolha de tela em galeria.
4. **Operação** (fase 6): criptografia de ponta a ponta, backups, monitoramento da banda, limite de espectadores por sessão, expulsar pessoa da sessão.

## Ideias futuras

- **Atualização automática do banco** e rotina de backup do volume da VPS.
- **Aplicativo instalável**, só se o navegador não bastar (hoje o app de Windows antigo está na tag `chat-completo-v0.6.2`).
- **Limpar as tabelas herdadas** do chat (`channels`, `messages`) num banco antigo, se um dia fizer sentido (hoje elas ficam intactas e não são lidas).
