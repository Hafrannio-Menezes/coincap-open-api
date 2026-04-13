import { afterEach, describe, expect, it, vi } from "vitest";

import { CoincapService } from "../src/coincap/service";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("CoincapService request deduplication", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent requests for the same cache key", async () => {
    const fetchMock = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return jsonResponse({
        data: {
          marketTotal: {
            marketCapUsd: "100",
            exchangeVolumeUsd24Hr: "50",
            assets: "1",
            exchanges: "1",
            markets: "1"
          },
          asset: {
            id: "bitcoin",
            rank: 1,
            name: "Bitcoin",
            symbol: "BTC",
            priceUsd: "1",
            marketCapUsd: "50",
            vwapUsd24Hr: "1",
            supply: "1",
            volumeUsd24Hr: "1",
            changePercent24Hr: "0",
            logo: "btc2"
          }
        }
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    const service = new CoincapService();

    const [a, b, c] = await Promise.all([
      service.getOverview(60_000),
      service.getOverview(60_000),
      service.getOverview(60_000)
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.market.assets).toBe("1");
    expect(b.market.assets).toBe("1");
    expect(c.market.assets).toBe("1");
  });
});
