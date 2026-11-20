# Visão geral

O Papo é um site para **compartilhar tela, câmera e áudio com quem tem o código da sessão**, feito para uso entre amigos, como companheiro de uma chamada de voz (do Discord, por exemplo).

## Objetivo

- Transmitir a tela com **qualidade** e **sem eco**, e mostrá-la **inteira** para quem assiste.
- **Zero instalação** para quem assiste e para quem transmite: basta o navegador (computador, e celular só para assistir).
- Entrar com um **código de 12 letras e números** (ou um link), sem criar conta.
- **Seu servidor, seus dados:** roda numa VPS sua, com HTTPS, sem depender de terceiros para a mídia.
- Custo baixo: uma VPS pequena e software livre.

Não usa a API nem os servidores do Discord. O nome, a logo e as fontes **não** são do Discord.

## Como surgiu

1. **Chat completo (até a 0.6.2):** o Papo nasceu como um clone do Discord para uso pessoal: texto, canais, voz, vídeo e tela, hospedado no PC de um amigo e acessado pelo Tailscale, com app de Windows (Electron). Esse código está na tag `chat-completo-v0.6.2`.
2. **Análise de um produto parecido:** olhamos como outro projeto de amigos resolvia só a parte de transmitir tela, câmera e áudio, entrando com um código. A ideia (não o código nem a marca) inspirou o rumo novo.
3. **Companheiro de chamada (0.7.0):** o chat e o app de Windows saíram. O Papo ficou só com **sessões**, num servidor público numa VPS, que qualquer um abre no navegador. Os próximos passos são o login com a conta do Discord e um bot que abre a sessão sozinho ([roadmap](roadmap.md)).

## Como funciona

```
 Navegador (computador ou celular)
        │  HTTPS
        ▼
 https://seu-endereço         ← proxy HTTPS da VPS (EasyPanel/Traefik ou Caddy)
        │
        ▼
 Servidor do Papo (Node, contêiner "papo")
   ├─ Interface (React)         ├─ API: contas e sessões
   ├─ Banco SQLite              └─ Proxy /lk ──► LiveKit (contêiner "livekit")
                                                   mídia: portas 7881 (TCP) e 7882 (UDP)
```

- **Quem cria** a sessão tem uma conta no servidor. O servidor sorteia o código de 12 caracteres e cria uma sala no LiveKit (`s-<código>`).
- **Quem entra** só informa o código e um nome. O servidor confere se a sessão existe e não expirou e entrega um **passe** (válido só para aquela sala).
- A **mídia** vai do navegador de quem transmite para o LiveKit, e de lá para cada espectador. O servidor do Papo não vê nem grava o vídeo.

## Limites importantes

- **O servidor é central:** se a VPS ou o Docker caírem, as sessões caem. As contas e os códigos ativos ficam no banco e voltam quando o servidor volta.
- **A banda de saída da VPS** limita a quantidade de espectadores e a qualidade: cada espectador recebe uma cópia da transmissão (veja [custos](seguranca.md#custos)).
- **Só computadores transmitem a tela.** Celular e tablet entram, assistem, ouvem e falam, mas o navegador deles não compartilha a tela.
- **Quem tem o código entra e pode transmitir:** compartilhe só com quem você quer por perto. A sessão expira em 12 horas e o criador pode encerrá-la.
- **Contas:** só quem tem conta cria sessões. A primeira conta (a dona) exige o código de configuração do servidor; as outras exigem o código de convite da dona.
