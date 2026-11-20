# Servidor público do Papo na VPS (fase 1)

Guia para colocar o Papo numa VPS com domínio e HTTPS, para os amigos entrarem **sem Tailscale**. Faz parte do [plano do companheiro do Discord](plano-companheiro-discord.md).

> **Estado:** os arquivos desta pasta ainda **não foram testados numa VPS real**. O que foi verificado: o código do servidor (código de configuração da primeira conta e limite de tentativas por IP atrás de proxy) e a sintaxe do `docker-compose.yml`. O que **falta verificar**: o build da imagem, o certificado HTTPS e a mídia do LiveKit passando entre dois PCs pela internet. O teste do passo 7 é justamente isso.

## O que sobe

Três contêineres, definidos em [`deploy/docker-compose.yml`](../deploy/docker-compose.yml):

| Contêiner | Faz | Portas abertas para a internet |
|---|---|---|
| `caddy` | HTTPS automático e entrega o site e a API | 80, 443 (TCP e UDP) |
| `papo` | Interface, API, WebSocket e proxy `/lk` | nenhuma (só o Caddy fala com ele) |
| `livekit` | Voz, vídeo e tela | 7881 (TCP) e 7882 (UDP) |

## Passo a passo

### 1. Contratar a VPS
- Linux (Ubuntu 24.04 serve), com IP público fixo e **franquia de tráfego mensal** que cubra o uso (veja a conta em [plano-companheiro-discord.md](plano-companheiro-discord.md#6-custos-e-banda)).
- Região o mais perto possível dos seus amigos, por causa da latência.
- 2 vCPUs e 2 a 4 GB de memória devem bastar para um grupo pequeno (estimativa, a confirmar no teste).

### 2. Domínio
Aponte um nome (ex.: `papo.seudominio.com`) para o IP da VPS com um registro **A** no painel de DNS. Espere propagar antes de subir, senão o certificado falha.

### 3. Firewall da VPS
Libere: **22** (SSH), **80** e **443** (TCP e UDP), **7881** (TCP) e **7882** (UDP). Feche o resto. No Ubuntu, por exemplo, com `ufw`:

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw allow 7881/tcp && sudo ufw allow 7882/udp && sudo ufw enable
```

Alguns provedores têm também um firewall no painel; as mesmas portas precisam estar liberadas lá.

### 4. Instalar Docker na VPS
Siga a instalação oficial do Docker Engine para o seu Linux (docs.docker.com/engine/install) e confirme com `docker compose version`.

### 5. Baixar o projeto
```bash
git clone --branch companheiro-discord https://github.com/mastersiteseautomacoes-lab/papo.git
cd papo/deploy
```

### 6. Configurar e subir
```bash
cp .env.example .env
nano .env        # preencha domínio, código de configuração, chave e segredo do LiveKit
docker compose up -d --build
docker compose logs -f    # Ctrl+C sai dos logs; os serviços continuam rodando
```

Gerar valores aleatórios para o `.env`:

```bash
openssl rand -hex 16   # PAPO_SETUP_CODE
openssl rand -hex 8    # LIVEKIT_API_KEY
openssl rand -hex 32   # LIVEKIT_API_SECRET
```

O arquivo `.env` guarda segredos e **não vai para o Git**. Se a tag da imagem do LiveKit não existir, descomente `LIVEKIT_VERSION` no `.env` e use `latest`.

### 7. Teste de aceite (a fase 1 só termina aqui)
1. No navegador, abra `https://seu-dominio/api/health`. Deve mostrar `{"papo":true}` com o cadeado do HTTPS.
2. Abra `https://seu-dominio`, clique em **Registrar** e crie a **primeira conta**: o campo "Código de convite" recebe o `PAPO_SETUP_CODE`. Essa conta vira a dona do servidor. Sem o código certo, a criação é recusada.
3. No ícone de convidar, pegue o código de convite e crie a conta de um amigo em **outro computador, em outra rede, sem Tailscale**.
4. Entrem na mesma sala de voz e compartilhem a tela de um para o outro.
5. Repita com um dos dois no **celular com dados móveis** (rede diferente, mais restrita).

Se o passo 4 mostra a tela dos dois lados, a fase 1 está validada.

## Atualizar e cuidar

```bash
cd papo && git pull
cd deploy && docker compose up -d --build
```

- **Backup:** o banco fica no volume `papo_data`. Copie-o de vez em quando:
  `docker run --rm -v papo_papo_data:/data -v "$PWD":/backup alpine tar czf /backup/papo-data.tgz -C /data .`
- **Logs:** `docker compose logs papo`, `docker compose logs livekit`.
- **Parar tudo:** `docker compose down` (os dados continuam no volume).

## Se algo não funcionar

| Sintoma | O que verificar |
|---|---|
| O site não abre ou o certificado falha | O registro A aponta para o IP certo? As portas 80 e 443 estão liberadas (VPS e painel)? `docker compose logs caddy` |
| Entra na sala, mas a tela não aparece para o outro | Portas 7881/TCP e 7882/UDP liberadas? `docker compose logs livekit`. Se o LiveKit anunciar o IP errado, é preciso ajustar `rtc` no `livekit.yaml` (por exemplo `node_ip`) ou usar rede do host |
| "Muitas tentativas" para todo mundo | `TRUST_PROXY` precisa estar definido no serviço `papo` (já está no compose) |
| O primeiro registro é recusado | O código do campo "Código de convite" precisa ser exatamente o `PAPO_SETUP_CODE` |

## Pontos de atenção

- **Cada pessoa que abre o endereço vê a tela de login.** O acesso a servidores e canais continua dependendo do código de convite.
- Esta fase mantém o login por usuário e senha do Papo atual. O login com Discord e o bot vêm nas fases 2 e 3.
- O app de Windows já funciona com esse servidor: em **Entrar**, cole `https://seu-dominio`.
