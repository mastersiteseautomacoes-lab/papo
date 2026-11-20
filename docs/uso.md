# Usando o dia a dia

> **Esta versão (branch `companheiro-discord`) é só de sessões:** compartilhar tela, câmera e áudio. O chat de texto, os servidores e os canais saíram da interface. Eles continuam na tag `chat-completo-v0.6.2` e na branch `main`; a seção "Versão com chat completo", no fim, vale só para aquela versão.

## Sessões

- **Tela inicial:** 12 caixas para o **código da sessão** (3 grupos de 4, como `abcd-efgh-jkmn`). Dá para digitar, apagar com Backspace ou **colar** o código ou o link inteiro (o botão **Colar** ou Ctrl+V numa caixa). **Entrar** abre a sessão. Não precisa de conta.
- **Criar uma sessão:** botão **Criar uma sessão**. Precisa de uma conta; sem conta, o botão leva ao login. Aparece o link (`…/j/abcd-efgh-jkmn`) e o código, e você já pode entrar. A sessão vale **12 horas**, cada conta pode ter até **3 ativas**, e só quem criou vê o botão **Encerrar**, que derruba todo mundo e invalida o link.
- **Entrar por link:** quem recebe o link abre no navegador (computador, celular ou tablet) ou cola no campo de endereço do app de Windows, escolhe um nome e entra, **sem criar conta**. Quem tem o código entra e pode transmitir: compartilhe só com quem você quer por perto.
- **Convidar:** o botão **Convidar** no cabeçalho copia o link da sessão.
- **Conta:** o menu com o seu nome (canto superior direito da tela inicial) mostra o **código de convite** para criar novas contas (só para o dono) e o botão **Sair**. Quem tem conta pode criar sessões.

### Dentro da sessão

- **Cabeçalho:** código da sessão, quantas pessoas estão na sala, **Convidar**, **Áudio** (configurações do microfone) e, para o criador, **Encerrar**. A seta à esquerda volta ao início e tira você da sessão.
- **Controles:** microfone (começa **desligado**), ensurdecer, câmera, **Compartilhar tela** / **Parar tela** e sair. No celular e no tablet o botão de compartilhar não aparece, porque esses aparelhos só assistem.
- **Quando você transmite:** a barra mostra o selo **NO AR** com a resolução e os quadros por segundo. A sua própria tela fica **escondida** ("Sua tela está no ar"), para não aparecer a tela dentro dela mesma; use **Ver minha tela** para conferir.
- **Quando outra pessoa transmite:** a tela dela aparece grande, **inteira**, em qualquer tamanho de janela (com faixas pretas se a janela não for 16:9). Passando o mouse no bloco: **ampliar** na sala e **tela cheia** (também com duplo clique).
- **Volume (só para você):** ícone de volume no bloco da pessoa ou botão direito nele: de 0 a **200%** (começa em 100%), com opção de silenciar. A **transmissão de tela** tem uma barrinha própria, no canto do bloco da tela. Voz e tela têm volumes separados, então dá para abaixar o vídeo sem deixar de ouvir quem fala. Os volumes ficam salvos. **Ensurdecer** zera tudo e, ao voltar, restaura os volumes escolhidos.
- **Áudio e microfone:** o botão **Áudio** abre as configurações (microfone, supressão de ruído, portão de ruído, ganho e calibração). Veja [audio.md](audio.md).

## App de Windows e servidor

- **Hospedar:** abrir o Papo, **Hospedar agora**, deixar o PC ligado. Fechar a janela só a **esconde na bandeja** (perto do relógio) e o servidor segue no ar. Para encerrar: botão direito no ícone da bandeja, **Sair**. (Com o servidor público na VPS, ninguém precisa hospedar: veja [deploy-vps.md](deploy-vps.md).)
- **Impedir que o PC suspenda** enquanto o grupo usa: Configurações do Windows, Sistema, Energia, "Suspender" como **Nunca** (na tomada).
- **Firewall do Windows:** na primeira vez que hospedar, o Windows pergunta se pode liberar o `livekit-server.exe`. Clique em **Permitir** (redes privadas e públicas). Sem isso, a voz não chega aos amigos.
- **Amigos:** na tela inicial do app (Hospedar / Entrar), no cartão **Amigos**, digite o nome e o endereço do servidor do amigo e clique em **Adicionar**. A bolinha verde significa "servidor no ar". **Entrar** abre o servidor dele, **Remover** tira da lista e **Atualizar** confere na hora. A lista fica no `config.json` do app (só neste computador). A notificação do Windows só aparece quando um servidor que estava fora do ar volta; o primeiro teste de cada vez que o app abre é silencioso. "No ar" quer dizer que o servidor responde, não que a pessoa está na frente do computador. Só funciona no app instalado.
- **Trocar de servidor:** na tela inicial de um servidor, o botão **← Trocar de servidor** (canto superior esquerdo, só no app instalado) ou `Ctrl+Shift+H` em qualquer tela voltam a Hospedar / Entrar.
- **Atualizar o app:** feche o Papo e rode o novo `.exe` por cima (sem desinstalar). Os dados ficam em `%APPDATA%\Papo` e não são tocados. Quem só entra pelo navegador não precisa reinstalar para ver a interface nova.

## Versão com chat completo (tag `chat-completo-v0.6.2`)

- **Voz:** clique numa sala de voz. Botões: microfone, ensurdecer, câmera, compartilhar tela, sair. O painel "Voz conectada" na lateral esquerda tem câmera, tela e sair.
- **Dono do servidor:** engrenagem em cada canal (renomear/excluir), menu no nome do servidor (convidar, criar canal, renomear, excluir; excluir pede para digitar o nome). Para **remover um membro**: passe o mouse sobre ele na lista e clique no ícone de remover, ou clique com o botão direito nele. Se ele estiver numa sala de voz, é desconectado na hora. Ele pode voltar se ainda tiver o código de convite.
- **Qualquer membro:** clique no nome do servidor, no topo, e em **Sair do servidor**. O dono não pode sair: precisa **excluir** o servidor (ou ele continua existindo).
