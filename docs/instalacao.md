# Instalação e envio aos amigos

## Antes de tudo (só você, uma vez)

1. Instale o Papo (`Papo Setup 0.6.0.exe`) e o **Tailscale** (tailscale.com/download), entrando com uma conta **pessoal e duradoura** (Google, Microsoft, Apple ou GitHub).
2. No painel do Tailscale (login.tailscale.com), aba **DNS**, ative **HTTPS Certificates**. Sem isso o navegador bloqueia microfone, câmera e tela.
3. Abra o Papo e clique em **Hospedar agora**. Anote o endereço que aparece (ex.: `https://nome-do-pc.tailXXXX.ts.net`).
4. Clique em **Abrir o Papo** e **Registre a sua conta primeiro**. A primeira conta vira a **dona** do servidor.
5. Pegue o **código de convite**: dentro do servidor, ícone de convidar (pessoa com "+") no topo do painel de canais.

## Mensagem pronta para mandar ao amigo (Windows)

> Oi! Para usar o Papo:
> 1. Baixe e instale o arquivo que te mandei (`Papo Setup 0.6.0.exe`). Se o Windows avisar que é desconhecido, clique em **Mais informações** e depois em **Executar assim mesmo**.
> 2. Instale o **Tailscale** (tailscale.com/download) e entre com a sua conta (Google, Microsoft, Apple ou GitHub).
> 3. Abra o link de **compartilhamento** que te mandei e clique para **aceitar**.
> 4. Abra o Papo, clique em **Entrar**, cole este endereço: `https://NOME-DO-PC.tailXXXX.ts.net` e clique em Entrar.
> 5. Clique em **Registrar**, escolha usuário e senha (mínimo 8 caracteres) e cole o código de convite: `CODIGO`.

## Compartilhar o seu PC com cada amigo (Tailscale)

O compartilhamento dá ao amigo acesso a **um único computador seu**, sem expor o resto da sua rede.

1. Abra **login.tailscale.com/admin/machines**.
2. Na linha do seu PC, clique nos **três pontinhos (⋯)** e depois em **Share…**.
3. Clique em **Copy share link** e envie o link só para aquele amigo (quem aceitar primeiro fica com o acesso).
4. O amigo, já com o Tailscale instalado e logado, abre o link e clica para **aceitar**.
5. Para cancelar, o mesmo menu permite remover o compartilhamento.

## Amigo com Mac (ou sem instalar nada)

O Papo funciona no **navegador** (Chrome recomendado):

1. Instalar o **Tailscale para Mac** e entrar com a conta dele.
2. Aceitar o link de compartilhamento.
3. Abrir `https://NOME-DO-PC.tailXXXX.ts.net` no Chrome, registrar com o código de convite e usar (texto, voz, câmera e tela funcionam).
4. Opcional: no Chrome, menu ⋮, **Transmitir, salvar e compartilhar**, **Instalar página como aplicativo**.

Quem usa Mac **não consegue hospedar**.

## Sem você: outro amigo hospeda

Qualquer amigo com Windows pode hospedar:

1. Instala o Papo e o Tailscale, abre o Papo e clica em **Hospedar agora**.
2. **Compartilha o PC dele** no Tailscale com os demais (passo 5.3, feito por ele).
3. Passa o endereço dele aos outros, que usam **Entrar** (ou o navegador).

Lembre que é um **servidor novo**, com histórico e contas próprios.
