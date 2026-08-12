import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("./db", () => ({ prisma: { shiftGroup: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { getServableRowsForBusiness } from "./serving";

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
