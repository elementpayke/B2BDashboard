/**
 * Default settlement rail for B2B country OffRamp (Send money → by country).
 * Matches the funded Polygon USDT treasury account users expect.
 */
export const OFFRAMP_ASSET = {
  currency: "USDT",
  network: "Polygon",
  label: "USDT on Polygon",
} as const;

type WalletLike = {
  id: string;
  currency: string;
  network: string;
};

function isPolygonNetwork(network: string): boolean {
  const compact = network.replace(/[^a-zA-Z]/g, "").toLowerCase();
  return compact === "polygon" || compact.startsWith("polygon");
}

/**
 * Prefer an explicit selection, then Polygon USDT, then any USDT, then first wallet.
 * Avoids auto-picking Base USDC when the house treasury is Polygon USDT.
 */
export function preferCountryOfframpWallet<T extends WalletLike>(
  wallets: T[],
  selectedId?: string | null,
): T | null {
  if (!wallets.length) return null;
  const selected = selectedId
    ? wallets.find((w) => w.id === selectedId) || null
    : null;
  if (selected) return selected;

  const wantCurrency = OFFRAMP_ASSET.currency;
  const usdtPolygon = wallets.find(
    (w) =>
      w.currency.trim().toUpperCase() === wantCurrency && isPolygonNetwork(w.network),
  );
  if (usdtPolygon) return usdtPolygon;

  const anyUsdt = wallets.find((w) => w.currency.trim().toUpperCase() === wantCurrency);
  if (anyUsdt) return anyUsdt;

  return wallets[0] || null;
}
