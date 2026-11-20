# Solução de problemas

| Sintoma | O que verificar |
|---|---|
| "Sessão não encontrada ou encerrada" | O código foi digitado certo? Ele tem 12 letras e números (sem `i`, `l`, `o`, `0` e `1`). A sessão vale 12 horas e pode ter sido encerrada por quem a criou: peça um link novo. |
| O código colado não é aceito | Cole o código (`abcd-efgh-jkmn`) ou o link inteiro. Espaços e traços não atrapalham. Se o texto tiver letras trocadas por números parecidos, digite à mão. |
| O botão **Compartilhar tela** não aparece | Celular e tablet só assistem: o navegador deles não compartilha a tela. Use um computador. Se for um computador, abra o endereço em **HTTPS** (em `http://` o navegador esconde a captura de tela). |
| O navegador não pede para escolher a tela | Confira se o navegador tem permissão de compartilhar tela (no Windows, em Configurações, Privacidade; no Mac, em Privacidade e segurança, Gravação de tela). |
| Entra na sessão, mas não vê nem ouve ninguém | Peça para confirmar que a pessoa está **transmitindo** (selo NO AR). Confira se você não está **ensurdecido** e o volume dela (menu de volume no bloco). Se for só com algumas redes, veja a linha de portas de mídia abaixo. |
| Funciona num computador, mas a tela não chega a quem está em outra rede | As portas de mídia **UDP 7882** e **TCP 7881** da VPS precisam estar liberadas no firewall e livres (veja [deploy-vps.md](deploy-vps.md)). Em redes que bloqueiam UDP, o vídeo usa a TCP 7881. |
| Ao compartilhar a tela, alguém se ouve de volta (eco) | O áudio da tela já exclui a voz da chamada do Papo. Se o eco continuar, é o **som da chamada de outro programa** (o Discord, por exemplo) entrando na captura: ao escolher a tela, compartilhe uma **janela** ou **aba** em vez de tela inteira, ou use fones. Quem só assiste não causa eco. |
| Microfone "não capta" | Veja [Áudio e microfone](audio.md). |
| O vídeo trava ou perde qualidade | O **envio** (upload) de quem transmite é o que mais pesa. Feche outras abas pesadas, use cabo de rede se puder e confira o selo NO AR (resolução e quadros por segundo). |
| "Muitas tentativas" | O limite é por IP. Espere um minuto. Se acontecer para todo mundo, o servidor não está lendo o IP real: confira `TRUST_PROXY` no serviço `papo`. |
| "Código de convite inválido" ao criar a conta | Use o código do menu da **dona** do servidor (menu com o nome dela, na tela inicial). A primeira conta usa o código de configuração (`PAPO_SETUP_CODE`). |
| O servidor não abre (502 ou tela de erro) | Veja a tabela de [deploy-vps.md](deploy-vps.md#se-algo-não-funcionar) (domínio na porta 38080, imagem baixada, contêineres no ar). |
