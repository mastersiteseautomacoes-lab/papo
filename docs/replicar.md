# Ter o seu próprio Papo

Passo a passo para quem chegou ao repositório e quer **o seu servidor**, do zero, sem depender do nosso. O projeto tem licença [MIT](../LICENSE): você pode copiar, modificar e usar como quiser, mantendo o aviso de autoria.

Resumo: uma **cópia (fork)** do repositório no seu GitHub gera a imagem Docker sozinha; uma **VPS** com Docker baixa essa imagem e sobe o Papo junto com o LiveKit; um **domínio com HTTPS** fecha o conjunto.

## O que você precisa

| Item | Para quê | Custo |
|---|---|---|
| Conta no GitHub | Guardar a sua cópia e compilar a imagem (Actions) | grátis |
| VPS com Docker e IP público | Rodar o Papo e o LiveKit | o único custo (veja [custos](seguranca.md#custos)) |
| Domínio ou endereço com HTTPS | Microfone, câmera e tela só funcionam em HTTPS | grátis (EasyPanel dá um endereço) ou um domínio seu |
| Portas livres na VPS: 80, 443, **7881 TCP**, **7882 UDP** | Site e mídia | |

## Passo a passo

1. **Copie o repositório.** Na página do projeto no GitHub, clique em **Fork**. A sua cópia vai se chamar `seu-usuario/papo`.
2. **Gere a imagem.** Na sua cópia, abra a aba **Actions**, ative os workflows se o GitHub pedir e rode **Imagem do servidor do Papo** (botão *Run workflow*), ou envie qualquer mudança para a `main`. Ao terminar, existe `ghcr.io/seu-usuario/papo-server:main`.
3. **Torne a imagem pública.** No GitHub: seu perfil → **Packages** → `papo-server` → **Package settings** → **Change visibility** → **Public**. Sem isso, a VPS não consegue baixá-la (a alternativa é cadastrar um token de leitura no seu painel).
4. **Escolha o caminho de publicação** em [deploy-vps.md](deploy-vps.md):
   - **Caminho A, EasyPanel** (imagem pronta, a VPS não compila nada): use o seu repositório como fonte Git e, além das três variáveis obrigatórias, defina `PAPO_IMAGE=ghcr.io/seu-usuario/papo-server`.
   - **Caminho B, VPS limpa com Caddy** (compila na própria VPS, precisa de ~1,5 GB de memória livre): clone a sua cópia e rode `docker compose up -d --build` em `deploy/`.
5. **Crie os segredos.** Três valores seus, nunca no Git: `PAPO_SETUP_CODE` (convite da primeira conta), `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET`. O guia mostra como gerar valores aleatórios.
6. **Libere as portas** no firewall da VPS e do provedor (80, 443, 7881/TCP e 7882/UDP).
7. **Crie a primeira conta.** Abra o seu endereço e clique em **Entrar na conta** (ou em **Criar uma sessão**). Na tela de login, escolha **Precisa de uma conta? Registre-se**, preencha o nome e a senha e, em **Código de convite**, digite o seu `PAPO_SETUP_CODE`. Essa conta é a dona: o menu com o nome dela mostra o **código de convite** para criar as outras contas.
8. **Teste.** `https://seu-endereço/api/health` deve responder `{"papo":true}`. Depois siga o [teste de aceite](deploy-vps.md#teste-de-aceite): crie uma sessão, entre por outro aparelho e compartilhe a tela.

## Quer só rodar no seu computador?

Para desenvolver ou experimentar, não precisa de VPS: veja [desenvolvimento.md](desenvolvimento.md). Voz, vídeo e tela precisam de um LiveKit local (o guia explica como baixar e iniciar).

## Atualizar a sua cópia

Para trazer as novidades do projeto original: no GitHub, na sua cópia, **Sync fork**. O envio para a `main` gera a imagem nova; depois reimplante o serviço na VPS. O banco fica num volume e não é tocado.

## Fica a seu cargo

- **Segredos e banco:** são seus. Faça backup do volume `papo_data` ([deploy-vps.md](deploy-vps.md#atualizar-e-cuidar)).
- **Nome, logo e endereço:** troque à vontade (`public/logo.png`, `docs/assets/`, os textos do README). O Papo não usa o Discord nem marcas de terceiros.
- **Sem garantia:** a licença MIT é "como está". Leia [seguranca.md](seguranca.md) para saber o que o servidor protege e o que ainda não existe.

## Se travar

[solucao-de-problemas.md](solucao-de-problemas.md) e a seção "Se algo não funcionar" de [deploy-vps.md](deploy-vps.md). Se o EasyPanel disser `Failed to sync changes`, veja [as branches do projeto](desenvolvimento.md#branches).
