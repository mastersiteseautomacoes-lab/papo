# Servidor público do Papo na VPS (fase 1)

Guia para colocar o Papo numa VPS, com HTTPS, para os amigos entrarem **sem Tailscale**. Faz parte do [plano do companheiro do Discord](plano-companheiro-discord.md).

Há dois caminhos. Use o **A** se a VPS já tem o **EasyPanel** (ele ocupa as portas 80 e 443). Use o **B** numa VPS limpa.

> **Estado (2026-11-20):** o **caminho A foi executado de verdade** numa VPS com EasyPanel 2.38 e funciona até o HTTPS.
>
> **Verificado na VPS:**
> - a imagem gerada pelo GitHub é baixada e os contêineres do Papo e do LiveKit sobem;
> - `https://<endereço>/api/health` responde `{"papo":true}`, com certificado válido, vindo da internet;
> - o proxy `/lk` chega ao LiveKit (responde "OK");
> - a criação da primeira conta é recusada sem o código de configuração (403);
> - a porta de mídia **TCP 7881** está aberta para a internet.
>
> **Ainda não verificado:**
> - a mídia **UDP 7882** (um teste simples de STUN ficou sem resposta, o que é inconclusivo);
> - o vídeo e a tela passando entre dois PCs em redes diferentes (o teste de aceite abaixo);
> - o consumo de processador e memória durante uma call, e o efeito nos outros serviços da VPS.
>
> O caminho B (VPS limpa com Caddy) continua sem teste.

## O que sobe

| Peça | Faz | Portas abertas para a internet |
|---|---|---|
| Proxy HTTPS (EasyPanel/Traefik no caminho A, Caddy no B) | Certificado e entrega do site e da API | 80 e 443 |
| `papo` | Interface, API, WebSocket e proxy `/lk` | nenhuma (só o proxy fala com ele) |
| `livekit` | Voz, vídeo e tela | 7881 (TCP) e 7882 (UDP) |

---

## Caminho A: VPS com EasyPanel (compartilhada com outros serviços)

Arquivo: [`deploy/docker-compose.easypanel.yml`](../deploy/docker-compose.easypanel.yml). Sem Caddy, com imagem pronta e **limites de recursos** para não atrapalhar os outros serviços (n8n e afins).

### A1. Antes de começar
- **Não compile na VPS.** Numa máquina de 1 núcleo e ~4 GB já em uso, o build (`npm ci` e `vite build`) pode estourar a memória e derrubar os outros serviços. Por isso a imagem é compilada pelo GitHub (workflow `.github/workflows/papo-image.yml`).
- **Portas 7881 (TCP) e 7882 (UDP) livres.** Pelo console da VPS: `ss -tulpn | grep -E ':7881|:7882'` não deve mostrar nada.
- **Firewall:** se a VPS tem firewall ativo (no painel do provedor ou no sistema), libere TCP 7881 e UDP 7882, além do 80 e do 443 que o EasyPanel já usa.
- **Projeto separado.** Crie um projeto novo ("papo") e não mexa nos serviços existentes.

### A2. Gerar a imagem
1. Envie a branch `companheiro-discord` ao GitHub. O workflow roda sozinho (aba **Actions** do repositório) e publica `ghcr.io/<dono>/papo-server:companheiro-discord`.
2. Confirme que o pacote é **público**: na primeira publicação ele pode nascer privado (em GitHub → seu perfil → **Packages** → `papo-server` → **Package settings** → **Change visibility** → **Public**). No nosso teste ele já saiu público e o EasyPanel baixou a imagem sem login. A alternativa é cadastrar um registro no EasyPanel com um token somente leitura, que vale só para você.

### A3. Criar o serviço no EasyPanel
Passos executados de verdade, no EasyPanel 2.38:

1. **Projeto novo** ("papo") e, nele, **Serviço → Compose**, com o nome `papo`.
2. Aba **Source** → botão **Git** (não cole o YAML: o editor de código do painel não aceita preenchimento simples). Preencha:
   - **Repository URL:** `https://github.com/<dono>/papo.git`
   - **Branch:** `companheiro-discord`
   - **Build Path:** `/deploy`
   - **Docker Compose File:** `docker-compose.easypanel.yml`

   Salve. O `Build Path` precisa ser `/deploy` porque o EasyPanel grava o arquivo `.env` na pasta do build path, e o Docker Compose procura o `.env` ao lado do arquivo compose. Com `/` o deploy falha.
3. Aba **Environment**: preencha as três variáveis e **marque a caixa "Create .env file"**. Sem essa caixa, o compose não enxerga as variáveis e o deploy falha com `required variable ... is missing a value`. Salve.

   | Variável | Valor |
   |---|---|
   | `PAPO_SETUP_CODE` | um código seu, longo (é o "convite" da primeira conta, a dona) |
   | `LIVEKIT_API_KEY` | uma chave inventada por você |
   | `LIVEKIT_API_SECRET` | um segredo longo inventado por você |

   Gerar valores aleatórios no PowerShell do seu PC (rode uma vez para cada valor):

   ```powershell
   $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
   ```

   **Não coloque esses valores em arquivo do projeto nem no Git.**
4. Clique em **Deploy** e abra o log: deve terminar em `Success`, com os contêineres `papo` e `livekit` iniciados. Antes do deploy, o painel pode mostrar o aviso "Some issues were found in your Docker Compose configuration": é uma pré-verificação que não enxerga o `.env`; o que vale é o log do deploy.
5. Aba **Domains**: o EasyPanel já cria um endereço gratuito com HTTPS (`<serviço>-<projeto>.<id>.easypanel.host`). Edite-o: **Port** `38080`, **Compose Service** `papo`, protocolo HTTP. Salve e **faça Deploy de novo**. Antes desse segundo deploy o endereço responde 502.
6. Teste: `https://<endereço>/api/health` deve mostrar `{"papo":true}`.

### A4. Cuidar dos outros serviços
- Os limites do compose (`0,30` núcleo e 300 MB para o Papo; `0,70` núcleo e 600 MB para o LiveKit) são **valores iniciais, ainda não medidos**. Durante a primeira call de teste, olhe o painel do EasyPanel (processador e memória) e confira se o n8n continua respondendo.
- Faça o primeiro teste num horário em que as automações não estejam em pico.
- Se o vídeo engasgar quando outro serviço dispara (por exemplo uma coleta de dados), o gargalo é o núcleo único: a saída é uma VPS só para o Papo.

### A5. Teste de aceite
Veja a seção "Teste de aceite" mais abaixo.

---

## Caminho B: VPS limpa (sem EasyPanel), com Caddy

Arquivo: [`deploy/docker-compose.yml`](../deploy/docker-compose.yml). Inclui o Caddy, que obtém o certificado HTTPS sozinho. **Este caminho compila a imagem na própria VPS**, então ela precisa de memória livre para o build (cerca de 1,5 GB ou mais).

1. **VPS:** Linux (Ubuntu 24.04 serve), IP público fixo, franquia de tráfego que cubra o uso (conta em [plano-companheiro-discord.md](plano-companheiro-discord.md#6-custos-e-banda)) e região perto dos amigos.
2. **Domínio:** um registro **A** apontando para o IP da VPS (pode ser um nome gratuito, como DuckDNS ou sslip.io).
3. **Firewall:** libere 22 (SSH), 80 e 443 (TCP e UDP), 7881 (TCP) e 7882 (UDP). Por exemplo, com `ufw`:

   ```bash
   sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
   sudo ufw allow 7881/tcp && sudo ufw allow 7882/udp && sudo ufw enable
   ```
4. **Docker:** instale o Docker Engine (docs.docker.com/engine/install) e confirme com `docker compose version`.
5. **Projeto e configuração:**

   ```bash
   git clone --branch companheiro-discord https://github.com/mastersiteseautomacoes-lab/papo.git
   cd papo/deploy
   cp .env.example .env
   nano .env        # domínio, código de configuração, chave e segredo do LiveKit
   docker compose up -d --build
   docker compose logs -f
   ```

   Valores aleatórios para o `.env`: `openssl rand -hex 16` (código), `openssl rand -hex 8` (chave) e `openssl rand -hex 32` (segredo). O `.env` guarda segredos e **não vai para o Git**.

---

## Teste de aceite (a fase 1 só termina aqui)

1. No navegador, abra `https://seu-endereço/api/health`. Deve mostrar `{"papo":true}` com o cadeado do HTTPS.
2. Abra `https://seu-endereço`, clique em **Registrar** e crie a **primeira conta**: o campo "Código de convite" recebe o `PAPO_SETUP_CODE`. Essa conta vira a dona. Sem o código certo, a criação é recusada.
3. No ícone de convidar, pegue o código de convite e crie a conta de um amigo em **outro computador, em outra rede, sem Tailscale**.
4. Entrem na mesma sala de voz e compartilhem a tela de um para o outro.
5. Repita com um dos dois no **celular com dados móveis** (rede diferente e mais restrita).

Se o passo 4 mostra a tela dos dois lados, a fase 1 está validada. O app de Windows também funciona: em **Entrar**, cole `https://seu-endereço`.

## Atualizar e cuidar

- **Caminho A:** envie as mudanças à branch; o workflow gera a imagem nova; no EasyPanel, **reimplante** o serviço (ele baixa a imagem atualizada).
- **Caminho B:** `cd papo && git pull && cd deploy && docker compose up -d --build`.
- **Backup:** o banco fica no volume `papo_data` (`/data/papo.db`). Copie-o de vez em quando; no EasyPanel, use a função de backup de volumes, se a sua versão tiver, ou o console do serviço.
- **Logs:** pelo painel do EasyPanel (caminho A) ou `docker compose logs papo` e `docker compose logs livekit` (caminho B).

## Se algo não funcionar

| Sintoma | O que verificar |
|---|---|
| O site não abre ou o certificado falha | O nome aponta para o IP certo? As portas 80 e 443 estão liberadas? Nos logs do proxy (Traefik ou Caddy) aparece o motivo |
| O EasyPanel não consegue baixar a imagem | O pacote `papo-server` no GitHub está **Público**? O workflow terminou com sucesso na aba Actions? |
| O deploy falha com `required variable ... is missing a value` | Marque **Create .env file** na aba Environment e confira se o **Build Path** é `/deploy` (passos A3.2 e A3.3) |
| O endereço do EasyPanel responde **502** | O domínio precisa apontar para o serviço `papo` na porta `38080`, e é preciso **fazer Deploy de novo** depois de salvar o domínio (A3.5) |
| Entra na sala, mas a tela não aparece para o outro | Portas 7881/TCP e 7882/UDP liberadas e livres? Logs do `livekit`. Se ele anunciar o IP errado, ajuste `rtc` na configuração (por exemplo `node_ip`) |
| O EasyPanel não deixa publicar a porta UDP | A documentação do EasyPanel não detalha a escolha de protocolo; se a porta UDP não for publicada, o plano B é o LiveKit Cloud para testes (plano gratuito limitado) |
| "Muitas tentativas" para todo mundo | `TRUST_PROXY` precisa estar definido no serviço `papo` (já está no compose) |
| O primeiro registro é recusado | O código do campo "Código de convite" precisa ser exatamente o `PAPO_SETUP_CODE` |
| O n8n ou outro serviço ficou lento | Reduza os limites de processador do Papo e do LiveKit, ou use uma VPS só para o Papo |

## Pontos de atenção

- Quem abre o endereço vê a tela de login; o acesso a servidores e canais depende do código de convite.
- Esta fase mantém o login por usuário e senha do Papo atual. As sessões por link, o login com Discord e o bot vêm nas próximas fases.
