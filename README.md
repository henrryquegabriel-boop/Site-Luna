# Luna faz um

Convite de aniversário com confirmação nominal, fechada e de envio único por família.

## Acessos

- Apresentação do convite: `/` (sem formulário quando não há token).
- Convite individual: `/?token=<chave-aleatoria>` ou `/rsvp?token=<chave-aleatoria>`.
- Links anteriores com `?convite=` continuam compatíveis.
- Administração: `/confirmacoes`.

O acesso público permanece suspenso no Sites durante a preparação. Salvar código
ou importar a base local não publica o site nem copia dados para o banco online.

A administração exige autenticação do ChatGPT e os e-mails autorizados nas
variáveis `ADMIN_EMAIL` / `ADMIN_EMAILS`: `henrryquegabriel@gmail.com` e
`thenizexavier@gmail.com`. As credenciais existentes são preservadas. Os headers
de identidade são confiáveis somente atrás do gateway do Sites, que os controla;
não exponha o servidor local diretamente à internet.

## Confirmação por família

1. O responsável abre seu link exclusivo. O servidor valida a chave, a ativação
   do convite e se já houve uma resposta antes de criar qualquer formulário.
2. Aparecem somente os nomes cadastrados. O responsável marca **vai** ou **não
   vai** para cada pessoa, incluindo ele mesmo, e confere o resumo antes de enviar.
3. Uma transação grava todas as escolhas e muda o convite de **Pendente** para
   **Confirmado**. Mesmo dois envios simultâneos não substituem a primeira resposta.
4. Novas visitas mostram apenas o comprovante, sem formulário no HTML ou nos
   dados enviados ao cliente. A API também recusa novos envios, independentemente
   de alterações pelo Inspecionar Elemento.
5. Depois do envio, apenas os administradores podem corrigir as presenças pelo
   painel. As correções registram autor, horário, escolhas anteriores e novas,
   e não reabrem o formulário dos convidados.

Quando todos respondem que não irão, a resposta também é definitiva; o comprovante
informa que a **resposta foi registrada**, sem afirmar incorretamente que irão.
O painel diferencia pessoas que vão, que não vão e pendentes, além do status da
resposta da família. Atualiza a cada 30 segundos enquanto estiver visível e permite
atualização manual, busca, filtro e exportação.

Não existem campos públicos de quantidade ou de inclusão/alteração de nomes.
O servidor compara os identificadores recebidos com a lista exata daquela família
e rejeita nomes extras, membros repetidos, ausentes ou pertencentes a outro convite.

## Cadastro e importação

Na administração, cadastre os nomes ou importe CSV UTF-8 com uma pessoa por linha:
`familia;responsavel;nome;tipo`. O modelo vazio está disponível no painel.

- A coluna `responsavel` identifica quem recebe o link; **não cria uma pessoa**.
- Inclua o responsável uma única vez entre os nomes, como na planilha original.
  Apelidos diferentes entre as colunas não criam vagas adicionais.
- Tipos aceitos: `adulto`, `crianca`, `crianca_menor5` e `nao_informado`.
- Limites por arquivo: 100 famílias / 300 pessoas; até 30 pessoas por família.
- Confira a prévia nominal e a quantidade de lugares antes de importar.
- Famílias existentes com a mesma identificação são ignoradas, sem substituir
  nomes, tokens ou respostas. Use identificações distintas para homônimos.
- Novas famílias e seus membros começam pendentes, independentemente de letras
  de RSVP existentes na planilha original.

A base recebida foi conciliada em 49 famílias e 114 pessoas: 91 adultos, 14 crianças,
7 crianças menores de 5 anos e 2 faixas não informadas. Os CSVs, a conciliação da
planilha e o banco local ficam em pastas privadas ignoradas pelo Git; nunca dentro
de `public`, assets, código do cliente ou migrações publicadas.

Os registros antigos em `rsvps` são preservados e continuam exportáveis, separados
dos novos totais nominais. Eles não confirmam automaticamente as novas famílias.
Convites desativados também ficam fora dos totais ativos.

## Estrutura do banco

Cloudflare D1 é o banco persistente, acessado somente pelo servidor. As tabelas
`invitation_families` e `invitation_members` guardam famílias e nomes, e a visão
`guest_invitations` disponibiliza os campos solicitados:

| Campo | Origem |
| --- | --- |
| `ID_Convidado` | Identificador aleatório da família |
| `Nome_Chefe_Familia` | Responsável pelo convite |
| `Token_Unico` | Chave aleatória exclusiva de 256 bits |
| `Limite_Acompanhantes` | Quantidade de nomes menos um, sem duplicar o responsável |
| `Status_Confirmacao` | Pendente antes do primeiro envio; Confirmado após o registro |

O limite e o status são derivados dos registros reais, não de valores enviados
pelo navegador. `invitation_corrections` mantém a auditoria das correções dos pais.

O token funciona como uma chave: quem o possuir poderá responder por aquela
família enquanto pendente. Ele **não comprova identidade**. Envie-o apenas ao
responsável; o painel permite revogar ou trocar um link vazado, sem apagar
respostas ou liberar um segundo envio. Não se promete segurança absoluta.

As páginas privadas usam `no-store`, `noindex` e uma política de referência que
não envia o token aos serviços externos. Dados são validados no servidor e usados
em consultas parametrizadas. Importações e confirmações usam transações do
[D1](https://developers.cloudflare.com/d1/worker-api/d1-database/), respeitando seus
[limites de consultas e parâmetros](https://developers.cloudflare.com/d1/platform/limits/).

## Desenvolvimento e validação

Requisitos: Node.js 22.13 ou superior.

```bash
npm install
npm run build
node scripts/prepare-local-guests.mjs "caminho/convidados-para-importar.csv"
npm run dev
npm run lint
npx tsc --noEmit
npm test
```

O preparador usa exclusivamente o D1 local em `.wrangler/state/v3`, aplica as
migrações versionadas e importa a lista sem sobrescrever famílias já existentes.
Não acessa o banco remoto, não publica e não imprime tokens. O resumo de conciliação
fica em `outputs/local-guest-import-summary.json`. Repetir a importação mantém
links e respostas. A importação online deverá ser feita pelo painel autorizado
após uma publicação futura; só então os links online deverão ser distribuídos.

O esquema fica em `db/schema.ts`. Use `npm run db:generate`, inspecione o SQL e
nunca reescreva migrações aplicadas. O Sites aplica novas migrações na publicação;
requisições de convidados não criam ou alteram tabelas.

`npm test` compila e verifica o Worker de produção em D1 isolado e temporário:
autorização, renderização no servidor, excesso e adulteração de convidados,
reenvio, concorrência, correções administrativas, revogação, importação máxima,
exportação e preservação de dados anteriores. Não envia respostas de teste por
famílias reais. A aparência, os efeitos e as imagens incorporadas são preservados.
