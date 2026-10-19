# Áudio e microfone

Menu da engrenagem do seu usuário, **Áudio e microfone**:

- **Microfone:** escolha do dispositivo.
- **Supressão de ruído:** *Forte (RNNoise)*, *Forte (GTCRN)* ou *Só o do navegador*.
- **Portão de ruído:** só transmite quando parece voz; ajustes de sensibilidade e "ignorar sons curtos" (cliques e teclas).
- **Ganho de entrada:** 0 a +40 dB, para microfones fracos (fones simples).
- **Teste do microfone:** medidor ao vivo (nível cru, nível depois do filtro, portão aberto/fechado) e opção de se ouvir (use fones).
- **Calibração (1 minuto):** o app grava silêncio, fala, respiração, mouse, teclado e fala+teclado, e recomenda filtro, limite e ganho. Fala as instruções em voz alta.

**Caso real (fone KZ no jack da placa-mãe):** o microfone entrega o som só no canal direito. O Papo agora escolhe automaticamente o canal com sinal. Se a calibração disser que não detectou voz, confira o microfone escolhido, se está mudo e o volume de entrada do Windows (Configurações, Sistema, Som, Entrada).

> Como a cadeia de áudio funciona por dentro: [arquitetura.md](arquitetura.md#8-tratamento-do-microfone).
