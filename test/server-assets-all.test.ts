import { afterEach, describe, expect, it, vi } from "vitest";

import { buildServer } from "../src/server";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("GET /api/v1/assets/all", () => {
  let app: Awaited<ReturnType<typeof buildServer>> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("scans the full all-assets range when search is provided", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        query: string;
        variables?: Record<string, unknown>;
      };

      if (body.query.includes("query Overview")) {
        return jsonResponse({
          data: {
            marketTotal: {
              marketCapUsd: "1000",
              exchangeVolumeUsd24Hr: "100",
              assets: "1600",
              exchanges: "1",
              markets: "1"
            },
            asset: {
              id: "bitcoin",
              rank: 1,
              name: "Bitcoin",
              symbol: "BTC",
              priceUsd: "1",
              marketCapUsd: "500",
              vwapUsd24Hr: "1",
              supply: "1",
              volumeUsd24Hr: "1",
              changePercent24Hr: "0",
              logo: "btc2"
            }
          }
        });
      }

      if (body.query.includes("query Assets")) {
        expect(body.variables?.first).toBe(1650);
        return jsonResponse({
          data: {
            assets: {
              edges: [
                {
                  cursor: "0",
                  node: {
                    id: "amsterdamcoin",
                    rank: 1233,
                    name: "AmsterdamCoin",
                    symbol: "AMS",
                    priceUsd: "0.1",
                    marketCapUsd: "1",
                    vwapUsd24Hr: "0.1",
                    supply: "1",
                    volumeUsd24Hr: "1",
                    changePercent24Hr: "0",
                    logo: null
                  }
                }
              ]
            }
          }
        });
      }

      throw new Error("Unexpected GraphQL operation in test.");
    });

    vi.stubGlobal("fetch", fetchMock);

    app = await buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/assets/all?sort=rank&direction=ASC&search=amsterdamcoin"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      meta: { scanned: number; returned: number };
      data: Array<{ id: string }>;
    };

    expect(payload.meta.scanned).toBe(1650);
    expect(payload.meta.returned).toBe(1);
    expect(payload.data[0].id).toBe("amsterdamcoin");
  });
});
