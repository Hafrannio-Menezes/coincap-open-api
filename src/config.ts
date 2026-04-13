import "dotenv/config";
import { z } from "zod";

export const SORT_FIELDS = [
  "rank",
  "name",
  "priceUsd",
  "marketCapUsd",
  "vwapUsd24Hr",
  "supply",
  "volumeUsd24Hr",
  "changePercent24Hr"
] as const;

export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ["ASC", "DESC"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const booleanEnvSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return false;
    }

    if (typeof value === "boolean") {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid boolean value. Use true/false, 1/0, yes/no, on/off."
    });
    return z.NEVER;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  TRUST_PROXY: booleanEnvSchema,
  COINCAP_GRAPHQL_URL: z.string().url().default("https://graphql.coincap.io/"),
  COINCAP_ASSETS_BASE_URL: z.string().url().default("https://assets.coincap.io"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  CACHE_TTL_MS: z.coerce.number().int().positive().default(15000),
  CACHE_MAX_ENTRIES: z.coerce.number().int().positive().max(10000).default(400),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  SEARCH_SCAN_LIMIT: z.coerce.number().int().positive().max(5000).default(900),
  ALL_ASSETS_MAX_LIMIT: z.coerce.number().int().positive().max(10000).default(2500)
});

export const env = envSchema.parse(process.env);
