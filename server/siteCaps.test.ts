import { describe, expect, it } from "vitest";

import { getLifetimeCap, isOneVisitLimitSite } from "./siteCaps";

describe("getLifetimeCap", () => {
  it("returns cap 1 for NYC business sites", () => {
    expect(getLifetimeCap(365082)).toBe(1);
    expect(getLifetimeCap(201172)).toBe(1);
  });

  it("returns cap 3 for other configured sites", () => {
    expect(getLifetimeCap(365079)).toBe(3);
    expect(getLifetimeCap(372868)).toBe(3);
    expect(getLifetimeCap(353952)).toBe(3);
    expect(getLifetimeCap(361268)).toBe(3);
    expect(getLifetimeCap(372982)).toBe(3);
  });

  it("defaults to 3 for unknown business ids", () => {
    expect(getLifetimeCap(999999)).toBe(3);
  });
});

describe("isOneVisitLimitSite", () => {
  it("returns true only for NYC business sites", () => {
    expect(isOneVisitLimitSite(365082)).toBe(true);
    expect(isOneVisitLimitSite(201172)).toBe(true);
    expect(isOneVisitLimitSite(365079)).toBe(false);
  });
});
