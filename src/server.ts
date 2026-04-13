import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { z } from "zod";

import { env, SORT_DIRECTIONS, SORT_FIELDS } from "./config";
import { CoincapApiError, CoincapService } from "./coincap/service";

const service = new CoincapService();
const sortEnumValues = [...SORT_FIELDS];
const directionEnumValues = [...SORT_DIRECTIONS];

const assetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).default(100),
  sort: z.enum(SORT_FIELDS).default("rank"),
  direction: z.enum(SORT_DIRECTIONS).default("ASC"),
  search: z.string().trim().max(80).optional()
});

const allAssetsQuerySchema = z.object({
  sort: z.enum(SORT_FIELDS).default("rank"),
  direction: z.enum(SORT_DIRECTIONS).default("ASC"),
  search: z.string().trim().max(80).optional()
});

const assetParamsSchema = z.object({
  id: z.string().trim().min(1).max(120)
});

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    trustProxy: env.TRUST_PROXY
  });

  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "CoinCap Community API",
        version: "1.0.0",
        description:
          "Open-source API wrapper for CoinCap market table data and icon URLs. Not affiliated with CoinCap."
      },
      tags: [
        { name: "meta", description: "API status and metadata endpoints." },
        { name: "market", description: "Market overview and asset endpoints." }
      ]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  app.addSchema({
    $id: "ErrorResponse",
    type: "object",
    additionalProperties: false,
    required: ["error"],
    properties: {
      error: { type: "string" },
      statusCode: { type: "number" }
    }
  });

  app.addSchema({
    $id: "ValidationErrorResponse",
    type: "object",
    additionalProperties: false,
    required: ["error", "issues"],
    properties: {
      error: { type: "string" },
      issues: { type: "object", additionalProperties: true }
    }
  });

  app.addSchema({
    $id: "Asset",
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "rank",
      "name",
      "symbol",
      "logo",
      "iconUrl",
      "coincapUrl",
      "priceUsd",
      "marketCapUsd",
      "vwapUsd24Hr",
      "supply",
      "volumeUsd24Hr",
      "changePercent24Hr"
    ],
    properties: {
      id: { type: "string", example: "bitcoin" },
      rank: {
        anyOf: [{ type: "integer" }, { type: "null" }],
        example: 1
      },
      name: { type: "string", example: "Bitcoin" },
      symbol: { type: "string", example: "BTC" },
      logo: {
        anyOf: [{ type: "string" }, { type: "null" }],
        example: "btc2"
      },
      iconUrl: {
        type: "string",
        format: "uri",
        example: "https://assets.coincap.io/assets/icons/btc2@2x.png"
      },
      coincapUrl: {
        type: "string",
        format: "uri",
        example: "https://coincap.io/assets/bitcoin"
      },
      priceUsd: {
        anyOf: [{ type: "string" }, { type: "null" }],
        example: "70790.51"
      },
      marketCapUsd: {
        anyOf: [{ type: "string" }, { type: "null" }],
        example: "1416885507846.90"
      },
      vwapUsd24Hr: {
        anyOf: [{ type: "string" }, { type: "null" }],
        example: "71052.70"
      },
      supply: {
        anyOf: [{ type: "string" }, { type: "null" }],
        example: "20015190.00"
      },
      volumeUsd24Hr: {
        anyOf: [{ type: "string" }, { type: "null" }],
        example: "21425804602.52"
      },
      changePercent24Hr: {
        anyOf: [{ type: "string" }, { type: "null" }],
        example: "-1.16"
      }
    }
  });

  app.addSchema({
    $id: "AssetsMeta",
    type: "object",
    additionalProperties: false,
    required: ["fetchedAt", "requestedLimit", "returned", "scanned", "sort", "direction", "search"],
    properties: {
      fetchedAt: { type: "string", format: "date-time" },
      requestedLimit: { type: "integer" },
      returned: { type: "integer" },
      scanned: { type: "integer" },
      sort: { type: "string", enum: sortEnumValues },
      direction: { type: "string", enum: directionEnumValues },
      search: {
        anyOf: [{ type: "string" }, { type: "null" }]
      }
    }
  });

  app.addSchema({
    $id: "AssetsResponse",
    type: "object",
    additionalProperties: false,
    required: ["meta", "data"],
    properties: {
      meta: { $ref: "AssetsMeta#" },
      data: {
        type: "array",
        items: { $ref: "Asset#" }
      }
    }
  });

  app.addSchema({
    $id: "OverviewSource",
    type: "object",
    additionalProperties: false,
    required: ["provider", "graphqlUrl"],
    properties: {
      provider: { type: "string", example: "CoinCap GraphQL" },
      graphqlUrl: { type: "string", format: "uri", example: "https://graphql.coincap.io/" }
    }
  });

  app.addSchema({
    $id: "OverviewMarket",
    type: "object",
    additionalProperties: false,
    required: ["marketCapUsd", "exchangeVolumeUsd24Hr", "assets", "exchanges", "markets", "btcDominancePercent"],
    properties: {
      marketCapUsd: { type: "string" },
      exchangeVolumeUsd24Hr: { type: "string" },
      assets: { type: "string" },
      exchanges: { type: "string" },
      markets: { type: "string" },
      btcDominancePercent: {
        anyOf: [{ type: "string" }, { type: "null" }]
      }
    }
  });

  app.addSchema({
    $id: "OverviewResponse",
    type: "object",
    additionalProperties: false,
    required: ["fetchedAt", "source", "market", "bitcoin"],
    properties: {
      fetchedAt: { type: "string", format: "date-time" },
      source: { $ref: "OverviewSource#" },
      market: { $ref: "OverviewMarket#" },
      bitcoin: {
        anyOf: [{ $ref: "Asset#" }, { type: "null" }]
      }
    }
  });

  app.addSchema({
    $id: "AssetByIdResponse",
    type: "object",
    additionalProperties: false,
    required: ["fetchedAt", "data"],
    properties: {
      fetchedAt: { type: "string", format: "date-time" },
      data: { $ref: "Asset#" }
    }
  });

  app.addSchema({
    $id: "RootResponse",
    type: "object",
    additionalProperties: false,
    required: ["name", "docs", "endpoints"],
    properties: {
      name: { type: "string" },
      docs: { type: "string" },
      endpoints: {
        type: "array",
        items: { type: "string" }
      }
    }
  });

  app.addSchema({
    $id: "HealthResponse",
    type: "object",
    additionalProperties: false,
    required: ["status", "timestamp"],
    properties: {
      status: { type: "string", example: "ok" },
      timestamp: { type: "string", format: "date-time" }
    }
  });

  app.get(
    "/",
    {
      schema: {
        tags: ["meta"],
        summary: "List API metadata and available routes.",
        response: {
          200: { $ref: "RootResponse#" }
        }
      }
    },
    async () => {
      return {
        name: "CoinCap Community API",
        docs: "/docs",
        endpoints: ["/health", "/api/v1/overview", "/api/v1/assets", "/api/v1/assets/all", "/api/v1/assets/:id"]
      };
    }
  );

  app.get(
    "/health",
    {
      schema: {
        tags: ["meta"],
        summary: "Health check endpoint.",
        response: {
          200: { $ref: "HealthResponse#" }
        }
      }
    },
    async () => {
      return {
        status: "ok",
        timestamp: new Date().toISOString()
      };
    }
  );

  app.get(
    "/api/v1/overview",
    {
      schema: {
        tags: ["market"],
        summary: "Get market totals and Bitcoin snapshot.",
        response: {
          200: { $ref: "OverviewResponse#" },
          502: { $ref: "ErrorResponse#" },
          504: { $ref: "ErrorResponse#" }
        }
      }
    },
    async () => {
      return service.getOverview();
    }
  );

  app.get(
    "/api/v1/assets",
    {
      schema: {
        tags: ["market"],
        summary: "List assets with sorting/filter and icon URL.",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 300,
              default: 100
            },
            sort: {
              type: "string",
              enum: sortEnumValues,
              default: "rank"
            },
            direction: {
              type: "string",
              enum: directionEnumValues,
              default: "ASC"
            },
            search: {
              type: "string",
              maxLength: 80
            }
          }
        },
        response: {
          200: { $ref: "AssetsResponse#" },
          400: { $ref: "ValidationErrorResponse#" },
          502: { $ref: "ErrorResponse#" },
          504: { $ref: "ErrorResponse#" }
        }
      }
    },
    async (request, reply) => {
      const parsed = assetsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid query parameters.",
          issues: parsed.error.flatten()
        });
      }

      return service.getAssets(parsed.data);
    }
  );

  app.get(
    "/api/v1/assets/all",
    {
      schema: {
        tags: ["market"],
        summary: "List all assets available from CoinCap.",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            sort: {
              type: "string",
              enum: sortEnumValues,
              default: "rank"
            },
            direction: {
              type: "string",
              enum: directionEnumValues,
              default: "ASC"
            },
            search: {
              type: "string",
              maxLength: 80
            }
          }
        },
        response: {
          200: { $ref: "AssetsResponse#" },
          400: { $ref: "ValidationErrorResponse#" },
          502: { $ref: "ErrorResponse#" },
          504: { $ref: "ErrorResponse#" }
        }
      }
    },
    async (request, reply) => {
      const parsed = allAssetsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid query parameters.",
          issues: parsed.error.flatten()
        });
      }

      const overview = await service.getOverview();
      const declaredAssets = Number.parseInt(overview.market.assets, 10);
      const desiredLimit = Number.isFinite(declaredAssets) && declaredAssets > 0 ? declaredAssets + 50 : 1200;
      const totalLimit = Math.min(env.ALL_ASSETS_MAX_LIMIT, Math.max(1, desiredLimit));

      return service.getAssets({
        direction: parsed.data.direction,
        limit: totalLimit,
        scanLimit: totalLimit,
        search: parsed.data.search,
        sort: parsed.data.sort
      });
    }
  );

  app.get(
    "/api/v1/assets/:id",
    {
      schema: {
        tags: ["market"],
        summary: "Get a single asset by CoinCap id (e.g. bitcoin, ethereum).",
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: {
              type: "string",
              minLength: 1,
              maxLength: 120
            }
          }
        },
        response: {
          200: { $ref: "AssetByIdResponse#" },
          400: { $ref: "ValidationErrorResponse#" },
          404: { $ref: "ErrorResponse#" },
          502: { $ref: "ErrorResponse#" },
          504: { $ref: "ErrorResponse#" }
        }
      }
    },
    async (request, reply) => {
      const parsed = assetParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid route parameter.",
          issues: parsed.error.flatten()
        });
      }

      const asset = await service.getAssetById(parsed.data.id);
      if (!asset) {
        return reply.code(404).send({ error: `Asset '${parsed.data.id}' not found.` });
      }

      return {
        fetchedAt: new Date().toISOString(),
        data: asset
      };
    }
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof CoincapApiError) {
      request.log.warn({ err: error, details: error.details }, "CoinCap upstream request failed.");
      return reply.code(error.statusCode).send({
        error: error.message,
        statusCode: error.statusCode
      });
    }

    request.log.error({ err: error }, "Unhandled error.");
    return reply.code(500).send({
      error: "Internal server error."
    });
  });

  return app;
}
