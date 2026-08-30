# Luna faz um

Site oficial de confirmação de presença para a festa de 1 ano da Luna.

## Acessos

- Convite público: `/`
- Administração: `/confirmacoes`

A área administrativa exige autenticação e permite acesso apenas a
`henrryquegabriel@gmail.com` e `thenizexavier@gmail.com`.

## Desenvolvimento

Requisitos: Node.js 22.13 ou superior.

```bash
npm install
npm run dev
npm run build
npm test
```

O projeto utiliza React, vinext, Cloudflare D1 e Drizzle. As imagens principais do convite são incorporadas diretamente ao código para evitar dependências externas.

## Hospedagem

O projeto está associado ao Sites, usa Cloudflare D1 no binding `DB` para
registrar as confirmações e protege a rota administrativa com autenticação do
ChatGPT e lista explícita de administradores.
