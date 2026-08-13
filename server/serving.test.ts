import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("./db", () => ({ prisma: { shiftGroup: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { getServableRowsForBusiness, formatEligibilitySiteLabel } from "./serving";

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

  it("shows location codename and state when site differs from city", () => {
    expect(
      formatEligibilitySiteLabel({
        siteLabel: "Philadelphia 1",
        city: "Philadelphia",
        stateCode: "PA",
      }),
    ).toBe("Philadelphia 1, PA");
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
