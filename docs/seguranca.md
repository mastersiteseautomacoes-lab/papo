# Segurança, privacidade e custos

## Segurança e privacidade

- O servidor escuta só em `127.0.0.1`. Quem o expõe é o `tailscale serve`, **somente dentro da rede Tailscale** ("tailnet only"). Nunca use `tailscale funnel`.
- O registro exige o **código de convite**. Senhas são guardadas com hash (scrypt), com limite de tentativas e de mensagens.
- O app só abre endereços `https://` (ou localhost e IPs do Tailscale) e só libera microfone, câmera e tela para o servidor aberto.
- Não compartilhe `config.json` nem `livekit.yaml` (chaves do servidor de voz).

## Custos

Tudo gratuito: Tailscale (plano pessoal), LiveKit (open source, licença Apache 2.0, roda no seu PC), RNNoise e GTCRN (licença MIT). Confira os limites atuais do plano gratuito do Tailscale em tailscale.com/pricing.
