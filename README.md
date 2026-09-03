# Luna faz um

Site oficial de confirmação de presença para a festa de 1 ano da Luna.

## Acessos

- Convite público: `/`
- Convite individual: `/?convite=<chave-aleatoria>`
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

## Convites por família

1. Entre em `/confirmacoes` com um dos e-mails autorizados.
2. Use **Cadastrar uma família**, incluindo o responsável e todos os nomes
   convidados. O responsável já entra como adulto; os demais podem ser adultos
   ou crianças.
3. Ou importe CSV UTF-8, com estas colunas e uma pessoa por linha:
   `familia;responsavel;nome;tipo`. Inclua também o responsável entre as pessoas
   e use `adulto` ou `crianca` no tipo. O modelo vazio fica disponível no painel.
4. Revise a prévia e importe. Limite por arquivo: 25 famílias / 100 pessoas.
   Famílias já cadastradas com o mesmo nome são ignoradas, nunca sobrescritas.
   Para corrigir uma lista já criada, desative o convite anterior e cadastre uma
   identificação distinta; as respostas antigas permanecem guardadas.
5. Copie o link individual e envie somente ao responsável. O link é uma chave
   de acesso: quem o receber pode ver e responder por aquela família, sem login.
   Não é uma verificação de identidade. Troque o link caso ele seja encaminhado
   indevidamente; isso invalida a chave anterior sem apagar as respostas.

Cada pessoa começa como **pendente**. O responsável escolhe **vai** ou **não vai**
para cada nome. Pode atualizar a resposta no mesmo link. Não existe campo de
quantidade nem endpoint público para criar pessoas. O servidor valida o conjunto
exato de membros e rejeita pessoas extras, repetidas e de outra família. Respostas
simultâneas usam revisão otimista e transação, sem gravação parcial.

Os registros em `rsvps` anteriores à mudança são preservados e podem ser
exportados no painel. Não são somados aos novos totais, pois não identificam cada
acompanhante; essas famílias devem receber um convite nominal para reconfirmar.
Convites desativados também ficam fora dos totais ativos.

## Banco e validação

O esquema é mantido em `db/schema.ts`. Execute `npm run db:generate` após mudanças,
inspecione o SQL e mantenha os arquivos de migração antigos intactos. O Sites
aplica as migrações antes da publicação; não há criação de tabelas em requisições.

`npm test` compila o site e testa o Worker de produção com D1 isolado e temporário:
autorização, convites inválidos, adulteração da lista, concorrência, persistência,
revogação, exportação e preservação dos registros antigos. Os convidados de teste
nunca são inseridos no banco publicado. `npx tsc --noEmit` verifica os tipos.
