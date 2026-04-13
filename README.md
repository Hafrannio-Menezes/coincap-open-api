# CoinCap Community API

API open source em **Node.js + Fastify + TypeScript** para expor os dados da tabela de criptos do CoinCap (preço, market cap, volume, variação 24h, supply, rank) com **URL de ícones pronta**.

## Objetivo

Evitar scraping com browser automation (Playwright/Selenium) e oferecer uma base mais profissional para a comunidade:

- backend estável
- cache TTL
- rate limit
- validação de entrada com Zod
- documentação Swagger em `/docs`

## Fonte dos dados

- Dados: `https://graphql.coincap.io/`
- Ícones: `https://assets.coincap.io/assets/icons/{logoOuSymbolLower}@2x.png`

## Requisitos

- Node.js 20+
- npm 10+

## Instalação

```bash
npm install
cp .env.example .env
npm run dev
```

Servidor local padrão: `http://localhost:3000`

## Endpoints

### `GET /health`

Status da API.

### `GET /api/v1/overview`

Retorna os indicadores do topo da página:

- market cap total
- exchange volume 24h
- total de assets/exchanges/markets
- dominância do BTC
- bloco de dados do Bitcoin

### `GET /api/v1/assets`

Lista assets com ícone e métricas.

Parâmetros:

- `limit` (1-300, default: 100)
- `sort` (`rank`, `name`, `priceUsd`, `marketCapUsd`, `vwapUsd24Hr`, `supply`, `volumeUsd24Hr`, `changePercent24Hr`)
- `direction` (`ASC` ou `DESC`)
- `search` (opcional, busca por `id`, `name` ou `symbol`)

Exemplo:

```bash
curl "http://localhost:3000/api/v1/assets?limit=20&sort=marketCapUsd&direction=DESC"
```

### `GET /api/v1/assets/all`

Retorna todas as criptos disponiveis no CoinCap no momento.

Parametros:

- `sort` (`rank`, `name`, `priceUsd`, `marketCapUsd`, `vwapUsd24Hr`, `supply`, `volumeUsd24Hr`, `changePercent24Hr`)
- `direction` (`ASC` ou `DESC`)
- `search` (opcional, busca por `id`, `name` ou `symbol`)

Exemplo:

```bash
curl "http://localhost:3000/api/v1/assets/all?sort=rank&direction=ASC"
```

### `GET /api/v1/assets/:id`

Detalhe de um asset.

Exemplo:

```bash
curl "http://localhost:3000/api/v1/assets/bitcoin"
```

## Estrutura

```text
src/
  coincap/service.ts   # cliente GraphQL + transformação + cache
  lib/ttl-cache.ts     # cache em memória com expiração
  config.ts            # env, tipos e validações
  server.ts            # rotas Fastify
  index.ts             # bootstrap
```

## Scripts

- `npm run dev` - desenvolvimento com reload
- `npm run build` - compila para `dist/`
- `npm run start` - roda compilado
- `npm run test` - testes com Vitest
- `npm run typecheck` - checagem de tipos

## Aviso

Este projeto é independente e **não é afiliado ao CoinCap**.  
Use respeitando os termos de uso do provedor original.

## Licença

MIT
