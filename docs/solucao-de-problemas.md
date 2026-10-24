# Solução de problemas

| Sintoma | O que verificar |
|---|---|
| Amigo não abre o endereço ("não é possível acessar o site") | No Mac o Tailscale **não abre sozinho** ao ligar: abra-o manualmente ou ligue "Launch at login" nas configurações dele. Sem o Tailscale conectado, nenhum endereço `.ts.net` resolve. Tailscale ligado nos dois PCs? Ele **aceitou** o compartilhamento? O Papo do anfitrião está aberto em Hospedar? O endereço está completo, com `https://`? |
| "Código de convite inválido" | Use o código do ícone de convidar, copiado completo. |
| Aviso amarelo em "Hospedar" | Ele diz o que falta. Costuma ser o HTTPS do Tailscale (aba DNS do painel) ou o Tailscale desconectado. |
| Voz não conecta, ou só funciona no seu PC | O Firewall bloqueou o `livekit-server.exe`: permita nas redes privadas e públicas. Há outro Papo aberto no mesmo PC (portas 7880 e 7881 ocupadas)? |
| Amigo aparece "fora do ar" na lista, ou o app avisa que não conseguiu abrir | Passe o mouse em "fora do ar" ou leia a linha amarela: ela diz o motivo. **Não achei esse endereço:** Tailscale desligado neste PC ou compartilhamento não aceito. **Sem resposta:** o anfitrião não está em Hospedar (ou o PC dele está desligado ou suspenso). **Conexão recusada:** o PC dele responde, mas o Papo não está publicado (ele precisa clicar em Hospedar de novo). Para testar fora do app, abra `https://ENDEREÇO/api/health` no navegador: deve mostrar `{"papo":true}`. |
| Microfone "não capta" | Veja [Áudio e microfone](audio.md). |
| Servidor caiu | PC desligado, em suspensão, ou o Papo foi fechado pelo "Sair". As contas e mensagens continuam salvas; hospede de novo. |
