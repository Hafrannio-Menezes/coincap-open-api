import { env, SortDirection, SortField } from "../config";
import { TtlCache } from "../lib/ttl-cache";

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

type RawAsset = {
  id: string;
  rank: number | null;
  name: string;
  symbol: string;
  priceUsd: string | null;
  marketCapUsd: string | null;
  vwapUsd24Hr: string | null;
  supply: string | null;
  volumeUsd24Hr: string | null;
  changePercent24Hr: string | null;
  logo: string | null;
};

type AssetsGraphqlData = {
  assets: {
    edges: Array<{
      cursor: string;
      node: RawAsset;
    }>;
  };
};

type OverviewGraphqlData = {
  marketTotal: {
    marketCapUsd: string;
    exchangeVolumeUsd24Hr: string;
    assets: string;
    exchanges: string;
    markets: string;
  };
  asset: RawAsset | null;
};

type AssetGraphqlData = {
  asset: RawAsset | null;
};

export type AssetDTO = {
  id: string;
  rank: number | null;
  name: string;
  symbol: string;
  logo: string | null;
  iconUrl: string;
  coincapUrl: string;
  priceUsd: string | null;
  marketCapUsd: string | null;
  vwapUsd24Hr: string | null;
  supply: string | null;
  volumeUsd24Hr: string | null;
  changePercent24Hr: string | null;
};

export type AssetsResponse = {
  meta: {
    fetchedAt: string;
    requestedLimit: number;
    returned: number;
    scanned: number;
    sort: SortField;
    direction: SortDirection;
    search: string | null;
  };
  data: AssetDTO[];
};

export type OverviewResponse = {
  fetchedAt: string;
  source: {
    provider: string;
    graphqlUrl: string;
  };
  market: {
    marketCapUsd: string;
    exchangeVolumeUsd24Hr: string;
    assets: string;
    exchanges: string;
    markets: string;
    btcDominancePercent: string | null;
  };
  bitcoin: AssetDTO | null;
};

export class CoincapApiError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, statusCode = 502, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const ASSET_FIELDS = `
  id
  rank
  name
  symbol
  priceUsd
  marketCapUsd
  vwapUsd24Hr
  supply
  volumeUsd24Hr
  changePercent24Hr
  logo
`;

const GET_ASSETS_QUERY = `
  query Assets($first: Int, $sort: AssetSortInput, $direction: SortDirection) {
    assets(first: $first, sort: $sort, direction: $direction) {
      edges {
        cursor
        node {
          ${ASSET_FIELDS}
        }
      }
    }
  }
`;

const GET_OVERVIEW_QUERY = `
  query Overview {
    marketTotal {
      marketCapUsd
      exchangeVolumeUsd24Hr
      assets
      exchanges
      markets
    }
    asset(id: "bitcoin") {
      ${ASSET_FIELDS}
    }
  }
`;

const GET_ASSET_BY_ID_QUERY = `
  query AssetById($id: ID!) {
    asset(id: $id) {
      ${ASSET_FIELDS}
    }
  }
`;

type RequestOptions = {
  cacheKey: string;
  ttlMs: number;
};

type GetAssetsInput = {
  direction: SortDirection;
  limit: number;
  search?: string;
  sort: SortField;
};

export function buildIconUrl(logo: string | null, symbol: string, baseUrl = env.COINCAP_ASSETS_BASE_URL): string {
  const fileBaseName = (logo?.trim() || symbol.toLowerCase()) + "@2x.png";
  return `${baseUrl}/assets/icons/${fileBaseName}`;
}

function normalizeMetric(value: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.toString().trim();
  return normalized.length > 0 ? normalized : null;
}

function toAssetDTO(raw: RawAsset): AssetDTO {
  return {
    id: raw.id,
    rank: raw.rank,
    name: raw.name,
    symbol: raw.symbol,
    logo: raw.logo ?? null,
    iconUrl: buildIconUrl(raw.logo, raw.symbol),
    coincapUrl: `https://coincap.io/assets/${raw.id}`,
    priceUsd: normalizeMetric(raw.priceUsd),
    marketCapUsd: normalizeMetric(raw.marketCapUsd),
    vwapUsd24Hr: normalizeMetric(raw.vwapUsd24Hr),
    supply: normalizeMetric(raw.supply),
    volumeUsd24Hr: normalizeMetric(raw.volumeUsd24Hr),
    changePercent24Hr: normalizeMetric(raw.changePercent24Hr)
  };
}

function toNumber(metric: string | null | number): number {
  const numeric = Number(metric);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function compareAssets(a: AssetDTO, b: AssetDTO, sort: SortField, direction: SortDirection): number {
  const directionMultiplier = direction === "ASC" ? 1 : -1;

  if (sort === "name") {
    return a.name.localeCompare(b.name) * directionMultiplier;
  }

  if (sort === "rank") {
    const rankA = typeof a.rank === "number" ? a.rank : Number.POSITIVE_INFINITY;
    const rankB = typeof b.rank === "number" ? b.rank : Number.POSITIVE_INFINITY;
    return (rankA - rankB) * directionMultiplier;
  }

  const valueA = toNumber(a[sort]);
  const valueB = toNumber(b[sort]);
  const safeA = Number.isNaN(valueA) ? Number.NEGATIVE_INFINITY : valueA;
  const safeB = Number.isNaN(valueB) ? Number.NEGATIVE_INFINITY : valueB;
  return (safeA - safeB) * directionMultiplier;
}

export class CoincapService {
  private readonly cache = new TtlCache<string, unknown>();

  async getOverview(ttlMs = env.CACHE_TTL_MS): Promise<OverviewResponse> {
    return this.cachedRequest(
      { cacheKey: "overview", ttlMs },
      async () => {
        const data = await this.graphqlRequest<OverviewGraphqlData>(GET_OVERVIEW_QUERY);
        const bitcoin = data.asset ? toAssetDTO(data.asset) : null;

        const marketCapUsd = Number(data.marketTotal.marketCapUsd);
        const btcMarketCapUsd = Number(data.asset?.marketCapUsd ?? 0);
        const btcDominancePercent =
          marketCapUsd > 0 && btcMarketCapUsd > 0 ? ((btcMarketCapUsd / marketCapUsd) * 100).toFixed(2) : null;

        return {
          fetchedAt: new Date().toISOString(),
          source: {
            provider: "CoinCap GraphQL",
            graphqlUrl: env.COINCAP_GRAPHQL_URL
          },
          market: {
            marketCapUsd: data.marketTotal.marketCapUsd,
            exchangeVolumeUsd24Hr: data.marketTotal.exchangeVolumeUsd24Hr,
            assets: data.marketTotal.assets,
            exchanges: data.marketTotal.exchanges,
            markets: data.marketTotal.markets,
            btcDominancePercent
          },
          bitcoin
        };
      }
    );
  }

  async getAssets(input: GetAssetsInput, ttlMs = env.CACHE_TTL_MS): Promise<AssetsResponse> {
    const normalizedSearch = input.search?.trim() || "";
    const cacheKey = [
      "assets",
      input.limit,
      input.sort,
      input.direction,
      normalizedSearch.toLowerCase()
    ].join(":");

    return this.cachedRequest(
      { cacheKey, ttlMs },
      async () => {
        const scanLimit = normalizedSearch
          ? Math.min(env.SEARCH_SCAN_LIMIT, Math.max(250, input.limit * 6))
          : input.limit;

        const data = await this.graphqlRequest<AssetsGraphqlData>(GET_ASSETS_QUERY, {
          direction: input.direction,
          first: scanLimit,
          sort: input.sort
        });

        let assets = data.assets.edges.map((edge) => toAssetDTO(edge.node));

        if (normalizedSearch) {
          const searchTerm = normalizedSearch.toLowerCase();
          assets = assets.filter((asset) => {
            return (
              asset.id.toLowerCase().includes(searchTerm) ||
              asset.name.toLowerCase().includes(searchTerm) ||
              asset.symbol.toLowerCase().includes(searchTerm)
            );
          });
        }

        assets = assets.sort((a, b) => compareAssets(a, b, input.sort, input.direction));
        const slicedAssets = assets.slice(0, input.limit);

        return {
          meta: {
            fetchedAt: new Date().toISOString(),
            requestedLimit: input.limit,
            returned: slicedAssets.length,
            scanned: scanLimit,
            sort: input.sort,
            direction: input.direction,
            search: normalizedSearch.length > 0 ? normalizedSearch : null
          },
          data: slicedAssets
        };
      }
    );
  }

  async getAssetById(id: string, ttlMs = env.CACHE_TTL_MS): Promise<AssetDTO | null> {
    const normalizedId = id.trim().toLowerCase();
    const cacheKey = `asset:${normalizedId}`;

    return this.cachedRequest(
      { cacheKey, ttlMs },
      async () => {
        const data = await this.graphqlRequest<AssetGraphqlData>(GET_ASSET_BY_ID_QUERY, { id: normalizedId });
        return data.asset ? toAssetDTO(data.asset) : null;
      }
    );
  }

  private async cachedRequest<T>(options: RequestOptions, resolver: () => Promise<T>): Promise<T> {
    const existing = this.cache.get(options.cacheKey);
    if (existing) {
      return existing as T;
    }

    const fresh = await resolver();
    this.cache.set(options.cacheKey, fresh, options.ttlMs);
    return fresh;
  }

  private async graphqlRequest<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(env.COINCAP_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query,
          variables
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new CoincapApiError(
          `CoinCap request failed with status ${response.status}`,
          response.status,
          await response.text()
        );
      }

      const payload = (await response.json()) as GraphqlResponse<TData>;
      if (payload.errors && payload.errors.length > 0) {
        throw new CoincapApiError(payload.errors[0].message, 502, payload.errors);
      }

      if (!payload.data) {
        throw new CoincapApiError("CoinCap response did not include data.", 502, payload);
      }

      return payload.data;
    } catch (error) {
      if (error instanceof CoincapApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new CoincapApiError("CoinCap request timed out.", 504);
      }

      throw new CoincapApiError("Could not reach CoinCap service.", 502, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
