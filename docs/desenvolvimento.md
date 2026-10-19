# Desenvolvimento e instalador

## Gerar um instalador novo

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

## Tamanhos

| O que | Tamanho |
|---|---|
| Instalador (o que se envia) | ~120 MB |
| App instalado | ~426 MB (a maior parte é o Electron; LiveKit ocupa 55 MB) |
| Dados do servidor | cresce com as mensagens (16 MB no início) |
