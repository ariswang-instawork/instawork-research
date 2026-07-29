/** Stub eligibility data — used when DATABASE_URL is unset. */
export const STUB_ELIGIBILITY = {
  workerId: 999,
  sites: [
    {
      businessId: 1101,
      siteLabel: "Center City, Philadelphia",
      cap: 3,
      remaining: 1,
      completedCount: 1,
      bookedCount: 1,
      isBlocked: false,
    },
    {
      businessId: 1201,
      siteLabel: "Midtown, New York",
      cap: 3,
      remaining: 0,
      completedCount: 2,
      bookedCount: 1,
      isBlocked: true,
    },
    {
      businessId: 1401,
      siteLabel: "SoMa, San Francisco",
      cap: 3,
      remaining: 2,
      completedCount: 1,
      bookedCount: 0,
      isBlocked: false,
    },
  ],
};
