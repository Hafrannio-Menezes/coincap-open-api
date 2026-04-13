import { describe, expect, it } from "vitest";

import { buildIconUrl } from "../src/coincap/service";

describe("buildIconUrl", () => {
  it("uses logo code when available", () => {
    expect(buildIconUrl("btc2", "BTC")).toBe("https://assets.coincap.io/assets/icons/btc2@2x.png");
  });

  it("falls back to symbol lowercase when logo code is missing", () => {
    expect(buildIconUrl(null, "ETH")).toBe("https://assets.coincap.io/assets/icons/eth@2x.png");
  });
});
