import type { DepositFlowProps } from "./types";

/** Props fixtures for DepositFlow tests and stories. */
const noop = () => {};

export function baseProps(overrides: Partial<DepositFlowProps> = {}): DepositFlowProps {
  return {
    walletOptions: [
      { value: "w-base", label: "USDC wallet · Base", meta: "0x8f3…4f2a", balanceText: "1,240.50 USDC" },
      { value: "w-stellar", label: "USDC wallet · Stellar", meta: "GDX4…7QPL", balanceText: null },
    ],
    walletId: "w-base",
    selectWallet: noop,
    walletLabel: "USDC wallet · Base",
    setGroup: noop,
    group: "country",
    countryRows: [
      {
        idx: 0,
        name: "Kenya",
        code: "KES",
        flagUrl: "https://flagcdn.com/w40/ke.png",
        railTypes: ["mobile", "bank"],
        providerNames: ["M-Pesa", "Airtel Money", "KCB Bank"],
        select: noop,
      },
      {
        idx: 1,
        name: "Nigeria",
        code: "NGN",
        flagUrl: "https://flagcdn.com/w40/ng.png",
        railTypes: ["bank"],
        providerNames: ["Access Bank"],
        select: noop,
      },
    ],
    countryName: "Kenya",
    countryFlagUrl: "https://flagcdn.com/w40/ke.png",
    currency: "KES",
    railGroups: [
      {
        railIdx: 0,
        type: "mobile",
        label: "Mobile money",
        providers: [
          { name: "Safaricom M-Pesa", displayLabel: "M-Pesa", selected: false, select: noop },
          { name: "Airtel Money", displayLabel: "Airtel Money", selected: false, select: noop },
        ],
      },
      {
        railIdx: 1,
        type: "bank",
        label: "Bank transfer",
        providers: [{ name: "KCB Bank", selected: false, select: noop }],
      },
    ],
    providerLabel: "M-Pesa",
    stepIs2: false,
    stepIs3: false,
    next: noop,
    back: noop,
    payerLabel: "M-Pesa number to charge",
    payerPlaceholder: "712 345 678",
    dialCode: "+254",
    phone: "",
    setPhone: noop,
    amount: "",
    setAmount: noop,
    limitsText: "Min KES 100 · Max KES 150,000",
    limitError: null,
    quoteLoading: false,
    quoteError: "",
    feeText: "130.00 KES",
    rateLine: "1 USDC = 129.50 KES",
    receiveText: "99.38 USDC",
    arrivalText: "In minutes, once you approve on your phone",
    quoteExpiresAt: null,
    acceptError: "",
    accepting: false,
    submit: noop,
    done: false,
    outcome: null,
    failureMessage: null,
    orderId: "4821",
    bankLines: [],
    bankArrival: "Within 1 business day",
    assets: [
      { key: "usdc", label: "USDC", selected: true, select: noop },
      { key: "usdt", label: "USDT", selected: false, select: noop },
    ],
    networks: [
      { key: "stellar", label: "Stellar", selected: false, select: noop },
      { key: "base", label: "Base", selected: true, select: noop },
    ],
    assetCode: "USDC",
    networkKey: "base",
    networkLabel: "Base",
    address: "0x9b44c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
    close: noop,
    ...overrides,
  };
}

/** Mobile money, amount step filled in, quote back: the review screen. */
export function reviewProps(overrides: Partial<DepositFlowProps> = {}): DepositFlowProps {
  return baseProps({
    stepIs3: true,
    phone: "712345678",
    amount: "13000",
    railGroups: baseProps().railGroups.map((g) =>
      g.type === "mobile"
        ? { ...g, providers: g.providers.map((p, i) => ({ ...p, selected: i === 0 })) }
        : g,
    ),
    ...overrides,
  });
}
