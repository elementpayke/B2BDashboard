import { Asset, Horizon, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { parseStellarAmount } from "@/lib/stellar/amount";
import { isHorizonNotFound } from "@/lib/stellar/errors";
import type { StellarNetworkConfig } from "@/lib/stellar/network";

type HorizonBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
};

type HorizonAccount = {
  account_id?: string;
  balances: HorizonBalance[];
};

function hasUsdcTrustline(account: HorizonAccount, issuer: string): boolean {
  return account.balances.some(
    (b) =>
      b.asset_code === "USDC" &&
      b.asset_issuer === issuer &&
      (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12"),
  );
}

function usdcBalance(account: HorizonAccount, issuer: string): number {
  const row = account.balances.find(
    (b) => b.asset_code === "USDC" && b.asset_issuer === issuer,
  );
  return row ? Number(row.balance) : 0;
}

export async function sendStellarUsdc(opts: {
  config: StellarNetworkConfig;
  fromAddress: string;
  toAddress: string;
  amountRaw: string;
  signXdr: (xdr: string) => Promise<string>;
}): Promise<{ hash: string }> {
  const parsed = parseStellarAmount(opts.amountRaw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  if (opts.fromAddress === opts.toAddress) {
    throw new Error("Connect the wallet that holds USDC, not the ElementPay deposit address.");
  }

  const server = new Horizon.Server(opts.config.horizonUrl);
  let source: Awaited<ReturnType<Horizon.Server["loadAccount"]>>;
  try {
    source = await server.loadAccount(opts.fromAddress);
  } catch (err) {
    remapUnfundedSourceError(err);
  }

  const sourceView = source as unknown as HorizonAccount;
  if (!hasUsdcTrustline(sourceView, opts.config.usdcIssuer)) {
    throw new Error("This wallet has no USDC trustline. Add Circle USDC in the wallet first.");
  }
  if (usdcBalance(sourceView, opts.config.usdcIssuer) < Number(parsed.amount)) {
    throw new Error("Not enough USDC in the connected wallet.");
  }

  try {
    const dest = (await server.loadAccount(opts.toAddress)) as unknown as HorizonAccount;
    if (!hasUsdcTrustline(dest, opts.config.usdcIssuer)) {
      throw new Error("The deposit address cannot receive Circle USDC yet.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("cannot receive")) throw err;
    throw new Error("Could not load the deposit address on Stellar. Try again or copy the address.");
  }

  const fee = String(await server.fetchBaseFee());
  const usdc = new Asset("USDC", opts.config.usdcIssuer);
  const tx = new TransactionBuilder(source, {
    fee,
    networkPassphrase: opts.config.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: opts.toAddress,
        asset: usdc,
        amount: parsed.amount,
      }),
    )
    .setTimeout(180)
    .build();

  const signedXdr = await opts.signXdr(tx.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, opts.config.networkPassphrase);
  const result = await server.submitTransaction(signed);
  return { hash: result.hash };
}

export function remapUnfundedSourceError(err: unknown): never {
  if (isHorizonNotFound(err)) {
    throw new Error("The connected wallet is not funded on Stellar yet (needs a little XLM).");
  }
  throw err;
}
