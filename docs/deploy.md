# Deploy

O monolito é **uma imagem Docker e um Postgres**. Não há RabbitMQ, Adminer nem cinco serviços: um contêiner atende todas as rotas que o frontend usa.

```text
Navegador ──https──► Next (BFF) ──https──► API do monolito (este repo) ──► Postgres gerenciado
```

Este guia não escolhe o provedor nem cria contas: serve para qualquer plataforma que rode uma imagem Docker a partir do repositório (Render, Railway, Fly.io, Google Cloud Run, Azure Container Apps, uma VPS etc.) com um Postgres gerenciado (o do próprio provedor, Neon, Supabase, RDS...). Não há arquivo de configuração de provedor no repositório: o `Dockerfile` basta.

## A imagem de produção

`docker build --target production` gera uma imagem com Node 24 Alpine, só as dependências de runtime (mais o Prisma CLI, para as migrations) e o `dist/`:

- **Migrations ao subir**: o comando do contêiner é `npx prisma migrate deploy && exec node dist/main.js`. Com um Postgres vazio, cria todas as tabelas; com um já atualizado, não faz nada. Se a migration falhar, o contêiner sai com erro e a API não sobe.
- **Usuário sem root**: roda como `node`.
- **Healthcheck**: `HEALTHCHECK` do Docker em `GET /health` (faz `SELECT 1` no banco), na porta de `PORT`. No provedor, configure o health check HTTP também em `/health`.
- **Porta**: `PORT` (padrão `3100`). Plataformas que injetam `PORT` (Render, Railway, Cloud Run) funcionam sem ajuste.
- O seed **não** roda na imagem (ver [Dados](#dados)).
- Tamanho: cerca de 700 MB, quase tudo do Prisma CLI. É o preço de aplicar as migrations no próprio contêiner, sem um passo de release separado; enxugar fica para quando incomodar.

Teste local, apontando para o Postgres do Compose (`docker compose up -d postgres`) num banco vazio:

```bash
docker build --target production -t lucroai-backend .
docker compose exec postgres createdb -U lucroai lucroai_prod_local   # banco vazio, só para o teste

docker run --rm -p 3110:3110 \
  -e PORT=3110 \
  -e DATABASE_URL="postgresql://lucroai:lucroai@host.docker.internal:55640/lucroai_prod_local?schema=public" \
  -e JWT_SECRET="exemplo-ficticio-com-mais-de-32-caracteres-0000"   -e CADASTRO_EMPRESA_TOKEN="exemplo-ficticio-com-64-caracteres-0000000000000000000000000000" \
  lucroai-backend

curl http://localhost:3110/health        # {"status":"ok",...}
```

No Linux sem Docker Desktop, troque `host.docker.internal` pelo IP do host ou use `--network host`.

## Variáveis de produção

| Variável | Obrigatória | Valor |
| --- | --- | --- |
| `DATABASE_URL` | sim | URL do Postgres gerenciado: `postgresql://<usuario>:<senha>@<host>:5432/<banco>?schema=public`. Se o provedor exigir TLS, acrescente `&sslmode=require`. |
| `JWT_SECRET` | sim | Segredo **forte e aleatório**, com no mínimo 32 caracteres (a API não sobe sem ele em produção). Gere com `openssl rand -base64 48`. Trocar o valor derruba as sessões abertas (os tokens duram 4 h). |
| `CADASTRO_EMPRESA_TOKEN` | sim | Token exigido no campo `token_cadastro` de `POST /auth/empresa` (BE-36), com no mínimo 64 caracteres (a API não sobe sem ele em produção). Gere com `openssl rand -hex 32` (64 caracteres hex, 256 bits) e entregue só a quem pode criar uma empresa. Para trocar, gere outro, atualize o segredo no provedor e reinicie o serviço: o token antigo deixa de valer na hora, e as contas e sessões já criadas não são afetadas. |
| `PORT` | não | Porta HTTP. Padrão `3100`; use a que o provedor indicar. |
| `NODE_ENV` | não | A imagem já define `production`. |

Segredos só no painel do provedor (variáveis secretas), nunca em arquivo do repositório: ele é público.

## Publicar num provedor de containers

Os passos variam de nome entre provedores, mas são sempre estes:

1. **Postgres gerenciado**: crie uma instância Postgres 17 (16 também serve) e copie a URL de conexão. Use a URL interna/privada quando a API e o banco estão no mesmo provedor.
2. **Serviço web a partir do repositório** `victorschmidt21/lucroai-backend`, branch `main`, usando o `Dockerfile` com **target `production`** (no Fly, `fly launch` gera o `fly.toml`; em Render/Railway, escolha "Docker" e informe o target se o painel pedir, ou faça o build e publique a imagem num registry).
3. **Variáveis**: `DATABASE_URL`, `JWT_SECRET` e `CADASTRO_EMPRESA_TOKEN` como segredos; `PORT` só se o provedor não injetar.
4. **Health check HTTP**: caminho `/health`, esperando `200`.
5. **https**: use o domínio https do provedor ou um domínio próprio (registro `CNAME` no DNS apontando para o que o provedor indicar). O frontend em produção recusa URL `http`.
6. **Deploy**: o primeiro deploy aplica as migrations no banco vazio. Confira os logs (`All migrations have been successfully applied` / `No pending migrations to apply`) e `curl https://<api>/health`.
7. **Instâncias**: uma basta. Com mais de uma, as migrations rodam em cada uma ao subir; o Prisma usa um lock no banco, então é seguro, só mais lento.

Rollback: volte para o deploy anterior no painel do provedor. As migrations não são desfeitas sozinhas; uma migration nova precisa ser compatível com a versão anterior da API (só aditiva) para o rollback ser seguro.

O que **não** deve ficar público: o Postgres. A API pode ser pública (todas as rotas, menos `/health`, `/auth/login`, `/auth/empresa` e o Swagger em `/docs`, exigem JWT). Não existe rota `/internal` no monolito.

## Dados

- **O seed recria o ambiente de demonstração.** Ele não roda dentro da imagem (precisa das dependências de desenvolvimento e recusa `NODE_ENV=production`). Para uma base de demonstração, rode da sua máquina, com o repositório clonado e `npm install` feito, apontando para o banco publicado:

  ```bash
  DATABASE_URL="<url do Postgres publicado>" npm run db:seed
  ```

  Ele cria a Padaria Pão Feliz com o login `joao@padariapaofeliz.com.br` / `123456`. Numa base com clientes reais, **não rode o seed** (ou troque essa senha): o login é público neste repositório.
- **Migração dos dados dos microsserviços**: o monolito começa com um banco novo. Se existir uma base em uso nos 5 microsserviços (`lucroai_auth`, `lucroai_catalog`, `lucroai_recipe`, `lucroai_operations`, `lucroai_sales`), levar esses dados para o banco único precisa de **uma issue própria** (script de migração com remapeamento de ids e conferência dos saldos), que não faz parte da BE-16.

## Corte no frontend

O monolito atende todas as rotas dos 5 serviços, com o mesmo contrato. Para trocar, basta apontar as 5 variáveis do frontend para **a mesma URL** (https, sem barra no fim):

| Variável do frontend | Valor |
| --- | --- |
| `AUTH_API_URL` | `https://<api do monolito>` |
| `CATALOG_API_URL` | `https://<api do monolito>` |
| `RECIPE_API_URL` | `https://<api do monolito>` |
| `OPERATIONS_API_URL` | `https://<api do monolito>` |
| `SALES_API_URL` | `https://<api do monolito>` |

Depois, faça **Redeploy** do frontend. O `GET /api/health` do frontend consulta `/docs-json` em cada URL: o monolito o expõe (Swagger), então os cinco aparecem `reachable: true`. A troca por uma variável única (`API_URL`) fica na issue [FE-39 do frontend](https://github.com/victorschmidt21/lucroai-frontend/issues/39).

Localmente, o mesmo vale no `.env.local` do frontend: as cinco variáveis com `http://localhost:3100`.

## Checklist de corte

- [ ] Postgres gerenciado criado; `DATABASE_URL` copiada.
- [ ] `JWT_SECRET` gerado (`openssl rand -base64 48`) e cadastrado como segredo.
- [ ] `CADASTRO_EMPRESA_TOKEN` gerado (`openssl rand -hex 32`) e cadastrado como segredo.
- [ ] Serviço criado com o `Dockerfile` (target `production`), health check em `/health` e https.
- [ ] Primeiro deploy no ar: logs mostram as migrations aplicadas e `GET https://<api>/health` responde `200`.
- [ ] Dados: seed rodado da máquina local (demonstração) **ou** issue de migração dos dados dos microsserviços concluída (base em uso).
- [ ] `POST https://<api>/auth/login` com o usuário do seed (ou um real) devolve `access_token`.
- [ ] Frontend: as 5 `*_API_URL` (Production e Preview) apontando para a URL da API; Redeploy feito.
- [ ] `GET https://<frontend>/api/health` com os cinco `reachable: true`.
- [ ] Fluxo principal no frontend: login, cadastrar insumo (com entrada de estoque), criar receita, registrar produção, registrar e concluir uma venda e ver o produto no painel.
- [ ] Microsserviços antigos desligados depois de alguns dias sem erro (ver [Aposentadoria](#aposentadoria-dos-microsserviços)).
- [ ] Aviso colado no README do `GrupoDoisENG/lucroai-backend`.
- [ ] FE-39 do frontend (URL única) agendada.

## Aposentadoria dos microsserviços

Depois do corte, o [`GrupoDoisENG/lucroai-backend`](https://github.com/GrupoDoisENG/lucroai-backend) deixa de ser usado. Nada aqui altera aquele repositório; quem tiver acesso a ele faz:

1. Confirmar que nenhum cliente chama mais os 5 serviços (logs de acesso vazios por alguns dias).
2. Se houver base em uso, concluir antes a issue de migração de dados ([Dados](#dados)) e guardar um `pg_dump` de cada banco.
3. Desligar os 5 serviços, o RabbitMQ e o Adminer no provedor, e depois os bancos.
4. Colar o aviso abaixo no topo do `README.md` de lá e **arquivar** o repositório (Settings → Archive), para ele ficar só como referência.

### Aviso para o README do repositório antigo

Texto pronto para colar no topo do `README.md` do `GrupoDoisENG/lucroai-backend`:

```markdown
> **Este repositório foi substituído.** O backend do LucroAI agora é um monolito modular (um app NestJS e um Postgres), com o mesmo contrato de API, em [victorschmidt21/lucroai-backend](https://github.com/victorschmidt21/lucroai-backend).
> Os 5 microsserviços (auth, catalog, recipe, operations e sales) e o RabbitMQ daqui não recebem mais mudanças nem estão em produção. O código fica só como referência das regras originais.
```
