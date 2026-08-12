/** Per-site lifetime session caps by business_id (UX study locations). */
export const LIFETIME_CAP_BY_BUSINESS_ID: Readonly<Record<number, number>> = {
  365079: 3, // Boston
  365082: 1, // NYC Recording
  372868: 3, // Philadelphia 1
  353952: 3, // Philadelphia 2
  361268: 3, // San Diego
  372982: 3, // Santa Clara
  201172: 1, // NYC
};

export const DEFAULT_LIFETIME_CAP = 3;

export function getLifetimeCap(businessId: number): number {
  return LIFETIME_CAP_BY_BUSINESS_ID[businessId] ?? DEFAULT_LIFETIME_CAP;
}
