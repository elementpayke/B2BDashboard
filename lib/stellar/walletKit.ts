import type { StellarNetworkConfig } from "@/lib/stellar/network";

let initPromise: Promise<void> | null = null;

async function loadKit() {
  const [{ StellarWalletsKit }, { defaultModules }, { Networks, SwkAppLightTheme }] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit/sdk"),
    import("@creit.tech/stellar-wallets-kit/modules/utils"),
    import("@creit.tech/stellar-wallets-kit/types"),
  ]);
  return { StellarWalletsKit, defaultModules, Networks, SwkAppLightTheme };
}

export async function ensureStellarWalletsKit(config: StellarNetworkConfig) {
  const { StellarWalletsKit, defaultModules, Networks, SwkAppLightTheme } = await loadKit();
  const network = config.isTestnet ? Networks.TESTNET : Networks.PUBLIC;
  if (!initPromise) {
    initPromise = Promise.resolve().then(() => {
      StellarWalletsKit.init({
        modules: defaultModules(),
        network,
        theme: {
          ...SwkAppLightTheme,
          primary: "#3B2ED3",
          "primary-foreground": "#ffffff",
          "font-family": "DM Sans, system-ui, sans-serif",
          "border-radius": "16px",
        },
      });
    });
  }
  await initPromise;
  StellarWalletsKit.setNetwork(network);
  return StellarWalletsKit;
}

export async function connectStellarWallet(config: StellarNetworkConfig): Promise<string> {
  const kit = await ensureStellarWalletsKit(config);
  const { address } = await kit.authModal();
  return address;
}

export async function disconnectStellarWallet(): Promise<void> {
  if (!initPromise) return;
  await initPromise;
  const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk");
  await StellarWalletsKit.disconnect();
}

export async function signStellarTransaction(
  config: StellarNetworkConfig,
  xdr: string,
  address: string,
): Promise<string> {
  const kit = await ensureStellarWalletsKit(config);
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    networkPassphrase: config.networkPassphrase,
    address,
  });
  return signedTxXdr;
}
