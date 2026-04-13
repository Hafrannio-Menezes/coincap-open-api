import { describe, expect, it } from "vitest";

import { TtlCache } from "../src/lib/ttl-cache";

describe("TtlCache", () => {
  it("evicts least-recently-used entry when max size is reached", () => {
    const cache = new TtlCache<string, string>({ maxEntries: 2 });

    cache.set("a", "1", 60_000);
    cache.set("b", "2", 60_000);

    // Refresh "a" recency so "b" becomes oldest.
    expect(cache.get("a")).toBe("1");

    cache.set("c", "3", 60_000);

    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
  });
});
