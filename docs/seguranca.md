# Segurança, privacidade e custos

## Segurança e privacidade

- **Quem entra numa sessão** precisa do **código**: 12 caracteres sorteados (31 símbolos em 12 posições, cerca de 7,9 × 10¹⁷ combinações), com validade de 12 horas. Quem criou a sessão pode encerrá-la a qualquer momento, o que derruba todo mundo e invalida o código.
- **Convidados** entram só com um nome. O passe deles vale apenas para a sala daquela sessão: não dá acesso a contas nem a nada além dela.
- **Contas:** quem tem conta cria sessões. A criação de contas exige o **código de convite da dona**. A **primeira** conta só é criada com o `PAPO_SETUP_CODE`, para um estranho não virar dono se chegar antes de você.
- **Senhas** são guardadas com hash (scrypt), nunca em texto. Há **limite de tentativas** por IP para entrar, registrar, criar sessões e pedir passe.
- **O servidor do Papo** escuta só na rede interna do Docker: quem fala com a internet é o proxy HTTPS (EasyPanel/Traefik ou Caddy). Abertas para fora: 80, 443, **7881 (TCP)** e **7882 (UDP)** da mídia.
- **O que o servidor vê:** quem entra e quando (nome e código). O vídeo e o áudio passam pelo LiveKit e **não são gravados**.
- **Segredos:** `PAPO_SETUP_CODE`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` ficam nas variáveis de ambiente do serviço, **nunca no Git**. O `.env` está no `.gitignore`.
- **Texto e SQL:** nomes são exibidos como texto puro (nada de HTML executado), e as consultas ao banco usam parâmetros.
- **Navegador:** microfone, câmera e tela só funcionam em HTTPS, e o navegador pede permissão a cada pessoa.

**O que ainda não existe:** criptografia de ponta a ponta (hoje a mídia é criptografada no trajeto, mas o LiveKit do servidor a enxerga), expulsar uma pessoa de dentro da sessão e um limite de espectadores por sessão. Estão no [roadmap](roadmap.md).

## Custos

O software é todo gratuito (LiveKit sob licença Apache 2.0; RNNoise e GTCRN sob MIT). O que se paga é a **VPS**.

A parte que pesa é a **banda de saída**: o LiveKit recebe a transmissão uma vez e envia uma cópia para cada espectador. Estimativa (depende da cena e da qualidade):

- 1080p a 30 quadros por segundo: **4 a 5 Mbps por espectador** nos modos Jogo (5) e Texto (4) do Papo.
- Um transmissor e 4 espectadores por 3 horas, todo dia: na ordem de **centenas de GB por mês**.

Por isso, ao escolher a VPS, a **franquia de tráfego mensal** pesa mais que o processador. O LiveKit só repassa a mídia (não recodifica), então uma VPS pequena basta para um grupo pequeno. Veja a conta completa no [plano](plano-companheiro-discord.md#5-custos-e-banda) e confirme preços e franquia no site do provedor.
