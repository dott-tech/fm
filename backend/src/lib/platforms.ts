// Platform commissions: the share of each fare the platform keeps.
// One place to add or change a rate (e.g. Careem, Toters) later.
// Keys are lowercase; matching ignores case and spaces ("Baly", " baly ").
export const PLATFORM_FEE_RATES: Record<string, number> = {
  baly: 0.2, // Baly keeps 20% of the fare
};

export function platformFeeRate(platform: string | null | undefined): number | null {
  if (!platform) return null;
  return PLATFORM_FEE_RATES[platform.trim().toLowerCase()] ?? null;
}

// Default fee for an entry: rate x (amount - tips). Tips go fully to the
// driver, so they aren't part of what the platform takes a cut of.
export function defaultPlatformFee(platform: string | null | undefined, amount: number, tips: number | null | undefined): number | null {
  const rate = platformFeeRate(platform);
  if (rate === null) return null;
  return Math.round(Math.max(0, amount - (tips ?? 0)) * rate);
}
