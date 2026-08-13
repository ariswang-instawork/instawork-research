import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("./db", () => ({ prisma: { shiftGroup: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import {
  getServableRowsForBusiness,
  formatEligibilitySiteLabel,
  disambiguateDuplicateSiteLabels,
  getSiteLabelsByBusinessId,
} from "./serving";

const base = {
  isOverbookShiftGroup: false,
  openShiftsCount: 2,
  shiftDate: "2999-01-01",
  shiftLink: "https://instawork.com/s/1",
};

beforeEach(() => findMany.mockReset());

describe("getServableRowsForBusiness", () => {
  it("returns only rows matching the businessId", async () => {
    findMany.mockResolvedValue([
      { ...base, id: 1, businessId: 100 },
      { ...base, id: 2, businessId: 200 },
      { ...base, id: 3, businessId: 100 },
    ]);
    const rows = await getServableRowsForBusiness(100);
    expect(rows.map((r) => r.id)).toEqual([1, 3]);
  });

  it("excludes non-servable rows (bad link) even when the businessId matches", async () => {
    findMany.mockResolvedValue([
      { ...base, id: 1, businessId: 100 },
      { ...base, id: 2, businessId: 100, shiftLink: "http://insecure" },
    ]);
    const rows = await getServableRowsForBusiness(100);
    expect(rows.map((r) => r.id)).toEqual([1]);
  });
});

describe("formatEligibilitySiteLabel", () => {
  it("shows city and state for standard sites", () => {
    expect(
      formatEligibilitySiteLabel({ siteLabel: "Boston", city: "Boston", stateCode: "MA" }),
    ).toBe("Boston, MA");
  });

  it("shows numbered location codenames as City, ST (n)", () => {
    expect(
      formatEligibilitySiteLabel({
        siteLabel: "Philadelphia 1",
        city: "Philadelphia",
        stateCode: "PA",
      }),
    ).toBe("Philadelphia, PA (1)");
    expect(
      formatEligibilitySiteLabel({
        siteLabel: "Philadelphia 2",
        city: "Philadelphia",
        stateCode: "PA",
      }),
    ).toBe("Philadelphia, PA (2)");
    expect(
      formatEligibilitySiteLabel(
        {
          siteLabel: "Philadelphia 1, Philadelphia, PA",
          city: "Philadelphia",
          stateCode: "PA",
        },
        372868,
      ),
    ).toBe("Philadelphia, PA (1)");
    expect(
      formatEligibilitySiteLabel(
        { siteLabel: "Philadelphia", city: "Philadelphia", stateCode: "PA" },
        372868,
      ),
    ).toBe("Philadelphia, PA (1)");
    expect(
      formatEligibilitySiteLabel(
        { siteLabel: "Philadelphia", city: "Philadelphia", stateCode: "PA" },
        353952,
      ),
    ).toBe("Philadelphia, PA (2)");
  });

  it("never uses business or company names as the label", () => {
    expect(
      formatEligibilitySiteLabel({
        siteLabel: "Acme Research LLC",
        city: "New York",
        stateCode: "NY",
        businessName: "Acme Research LLC",
      }),
    ).toBe("New York, NY");
  });
});

describe("getSiteLabelsByBusinessId (production-like: Mode label is just the city)", () => {
  it("numbers the two Philadelphia sites even when site_label === city", async () => {
    findMany.mockResolvedValue([
      { businessId: 365079, siteLabel: "Boston", city: "Boston", stateCode: "MA", businessName: "Q.ai", companyName: null },
      { businessId: 372868, siteLabel: "Philadelphia", city: "Philadelphia", stateCode: "PA", businessName: "Q.ai", companyName: null },
      { businessId: 353952, siteLabel: "Philadelphia", city: "Philadelphia", stateCode: "PA", businessName: "Q.ai", companyName: null },
    ]);
    const labels = await getSiteLabelsByBusinessId();
    expect(labels.get(365079)).toBe("Boston, MA");
    expect(labels.get(372868)).toBe("Philadelphia, PA (1)");
    expect(labels.get(353952)).toBe("Philadelphia, PA (2)");
  });
});

describe("disambiguateDuplicateSiteLabels", () => {
  it("numbers duplicate Philadelphia labels using known business ids", () => {
    const map = new Map<number, string>([
      [365079, "Boston, MA"],
      [353952, "Philadelphia, PA"],
      [372868, "Philadelphia, PA"],
    ]);
    const out = disambiguateDuplicateSiteLabels(map);
    expect(out.get(365079)).toBe("Boston, MA");
    expect(out.get(372868)).toBe("Philadelphia, PA (1)");
    expect(out.get(353952)).toBe("Philadelphia, PA (2)");
  });

  it("does NOT number other duplicate cities (e.g. New York)", () => {
    const map = new Map<number, string>([
      [365082, "New York, NY"],
      [201172, "New York, NY"],
    ]);
    const out = disambiguateDuplicateSiteLabels(map);
    expect(out.get(365082)).toBe("New York, NY");
    expect(out.get(201172)).toBe("New York, NY");
  });
});
