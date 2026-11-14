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

## Publicar o instalador (Google Drive)

O instalador não vai para o Git (120 MB, e `release/` está no `.gitignore`). Quem chega ao repositório baixa pelo link do README, que aponta para um arquivo no Google Drive:

https://drive.google.com/file/d/14uMZQNLMUCT5LvVCjzy4Lr2iVAL-xOqV/view

Ao lançar uma versão nova:

1. Gere o instalador (`npm run dist:win`).
2. No Drive, clique com o botão direito no arquivo → **Gerenciar versões** → **Enviar nova versão** e escolha o novo `.exe`. Assim o link continua o mesmo. (Se criar um arquivo novo, troque o link no `README.md` e em [instalacao.md](instalacao.md).)
3. Confira que o acesso segue como "Qualquer pessoa com o link" e que o nome do arquivo no Drive mostra a versão certa.
4. Atualize o número de versão nos documentos (README, [instalacao.md](instalacao.md) e [CHANGELOG](../CHANGELOG.md)).

## Tamanhos

| O que | Tamanho |
|---|---|
| Instalador (o que se envia) | ~120 MB |
| App instalado | ~426 MB (a maior parte é o Electron; LiveKit ocupa 55 MB) |
| Dados do servidor | cresce com as mensagens (16 MB no início) |
