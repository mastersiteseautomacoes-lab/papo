# Como contribuir

Obrigado pelo interesse no Papo! Este é um projeto pessoal, mas aceita ideias, correções e melhorias.

## Antes de começar

- **Entenda o projeto:** [README](README.md) e [docs/visao-geral.md](docs/visao-geral.md). Mapa das pastas: [docs/estrutura.md](docs/estrutura.md).
- **Rodar pelo código:** [docs/desenvolvimento.md](docs/desenvolvimento.md) (Node 24; a voz precisa de um LiveKit local).
- **Ter o seu próprio servidor:** [docs/replicar.md](docs/replicar.md).

## Enviar uma mudança

1. Faça um **fork** e crie uma branch a partir da `main` (não use a `companheiro-discord`, que é só uma cópia de segurança; veja [as branches](docs/desenvolvimento.md#branches)).
2. Faça a mudança. Regras do projeto:
   - TypeScript no `src/` e no `server/`; JavaScript puro nos worklets de áudio (`public/worklets/`).
   - A interface e os textos para o usuário são em **português do Brasil**.
   - Cores e espaços vêm dos tokens de `src/styles/tokens.css`, nunca valores soltos.
   - Nomes e textos são exibidos como texto puro; consultas ao banco usam parâmetros (`?`).
   - **Nunca** coloque segredos, senhas, chaves nem o endereço de um servidor real no repositório.
   - Não copie código, textos, desenhos nem marca de outros produtos.
3. Confira antes de enviar:

   ```bash
   npm run lint
   npm run typecheck:server
   npm run build
   ```

   O GitHub repete essas conferências no seu pull request.
4. Atualize a **documentação** (`docs/`) e o [CHANGELOG](CHANGELOG.md) na mesma mudança, se o comportamento mudou.
5. Abra o **pull request** contando o que mudou e por quê. Se for visual, anexe uma captura de tela.

## Encontrou um problema?

Abra uma *issue* com o que você fez, o que esperava e o que aconteceu (navegador e sistema ajudam). Para falhas de segurança, **não** publique os detalhes na issue: descreva só que existe um problema e combine o envio em particular.

## Licença

Ao contribuir, você concorda que a sua contribuição fica sob a [licença MIT](LICENSE) do projeto.
