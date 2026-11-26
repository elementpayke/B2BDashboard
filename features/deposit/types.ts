import type * as React from "react";
import type { BankInstructionRow } from "@/lib/services/transferTerms";

/** How the money comes in. Mobile money and bank share the OnRamp corridor state. */
export type DepositMethod = "mobile" | "bank" | "crypto" | "interac";

/** A wallet the money can land in (stablecoin accounts). */
export type DepositWalletOption = {
  value: string;
  label: string;
  /** Secondary line, e.g. a short address or "Base". */
  meta?: string | null;
  /** Formatted balance, e.g. "1,240.50 USDC". Null when it didn't load: shown as —. */
  balanceText?: string | null;
  /** Coin and network, for the row's brand marks (e.g. "USDC", "Base"). */
  asset?: string;
  network?: string;
};

/** A CAD account that can be funded by Interac e-Transfer (payment requests). */
export type InteracAccount = {
  id: string;
  entityId: string;
  label: string;
  balanceText?: string | null;
};

/** A fiat account the user opened (USD, EUR, GBP…): funded by a bank transfer to its own details. */
export type FiatFundingAccount = {
  id: string;
  currency: string;
  label: string;
  balanceText?: string | null;
  /** Grouped bank details, e.g. "Domestic transfer" / "International wire". Empty while not issued yet. */
  sections: { title: string; rows: { label: string; value: string; copyValue?: string }[] }[];
  /** Reference rule from the partner, shown as a warning. */
  disclaimer?: string | null;
  /** Mobile money / African bank can fund it, converted in the background. */
  convertFund?: boolean;
  /** EUR/GBP: open banking request. */
  openBanking?: boolean;
};

export type DepositCountryRow = {
  idx: number;
  name: string;
  /** Currency code, e.g. "KES". */
  code: string;
  flagUrl: string | null;
  /** Rails the catalog offers for OnRamp here: "mobile" and/or "bank". */
  railTypes: ("mobile" | "bank")[];
  /** Provider names, for search and the row's meta line. */
  providerNames: string[];
  select: () => void;
};

export type DepositProviderOption = {
  name: string;
  /** Short label for mobile money operators (e.g. "M-Pesa"). */
  displayLabel?: string;
  selected: boolean;
  select: () => void;
};

export type DepositRailGroup = {
  railIdx: number;
  type: "mobile" | "bank";
  label: string;
  providers: DepositProviderOption[];
};

export type DepositChoice = { key: string; label: string; selected: boolean; select: () => void };

/** Where a submitted mobile-money or bank top-up stands. */
export type DepositOutcome = "processing" | "received" | "failed";

export type DepositFlowProps = {
  containerRef?: React.Ref<HTMLDivElement>;

  /* Account being funded */
  walletOptions: DepositWalletOption[];
  walletId: string;
  selectWallet: (id: string) => void;
  walletsLoading?: boolean;
  walletsError?: string | null;
  onRetryWallets?: () => void;
  /** Opened from inside an account: that account is already chosen, step 1 is skipped. */
  walletLocked?: boolean;
  walletLabel?: string | null;
  /** CAD accounts that take Interac. Empty or absent hides Interac. */
  interacAccounts?: InteracAccount[];
  /** Opened from inside a CAD account. */
  interacLockedAccountId?: string | null;
  /** Business name sent as the Interac payer name; the user can't edit it. */
  interacPayerName?: string;
  /** Signed-in user's email, filled in as the Interac recipient. */
  interacDefaultEmail?: string;

  /** Fiat accounts funded by bank transfer to their own details. */
  fiatAccounts?: FiatFundingAccount[];
  /** Opened from inside a fiat account: go straight to its details. */
  fiatLockedAccountId?: string | null;
  /** Called when a fiat account is chosen, so the parent can refresh missing details. */
  onOpenFiatAccount?: (id: string) => void;
  /** Mobile money or African bank into a fiat account: parent sets up the converted top-up. */
  onFiatConvertFund?: (id: string) => void;
  /** Open banking into a EUR/GBP account (its own request screen). */
  onFiatOpenBanking?: (id: string) => void;

  /* Method + corridor (shared OnRamp state in DashboardApp) */
  setGroup: (group: "country" | "crypto") => void;
  countryRows: DepositCountryRow[];
  catalogLoading?: boolean;
  catalogError?: string | null;
  onRetryCatalog?: () => void;
  countryName: string;
  countryFlagUrl?: string | null;
  /** Fiat the payer pays in, e.g. "KES". */
  currency: string;
  railGroups: DepositRailGroup[];
  /** Provider as named to the user, e.g. "M-Pesa" or "KCB Bank". */
  providerLabel: string;

  /* Parent step machine: 1 = choose, 2 = amount (or address), 3 = review */
  /** Corridor group the parent is on: "country" (mobile money / bank) or "crypto". */
  group: "country" | "crypto";
  stepIs2: boolean;
  stepIs3: boolean;
  /** Moves the parent forward: to the amount/address step, then fetches the quote. */
  next: () => void;
  back: () => void;

  /* Amount (mobile money / bank) */
  payerLabel: string;
  payerPlaceholder: string;
  dialCode: string;
  phone: string;
  setPhone: (e: React.ChangeEvent<HTMLInputElement>) => void;
  amount: string;
  setAmount: (e: React.ChangeEvent<HTMLInputElement>) => void;
  limitsText?: string | null;
  limitError?: string | null;
  quoteLoading: boolean;
  quoteError: string;

  /* Quote (review) */
  feeText: string;
  rateLine?: string | null;
  /** What lands in the wallet, from the quote, e.g. "99.38 USDC". */
  receiveText?: string | null;
  arrivalText: string;
  quoteExpiresAt?: string | null;
  acceptError: string;
  accepting: boolean;
  submit: () => void;

  /* After paying */
  done: boolean;
  outcome?: DepositOutcome | null;
  failureMessage?: string | null;
  orderId?: string | null;
  /** Starts the same top-up again after a failure. Hidden when absent. */
  retry?: () => void;
  bankLines: BankInstructionRow[];
  bankArrival: string;
  /** EUR/USD/GBP account funded through a stablecoin: background convert status. */
  fundTargetCurrency?: string | null;
  fundConvertStatus?: string;
  fundConvertError?: string;

  /* Stablecoin */
  assets: DepositChoice[];
  networks: DepositChoice[];
  assetCode: string;
  networkKey: string;
  networkLabel: string;
  address: string;
  addressEmptyMessage?: string;
  createAccount?: (() => void) | null;
  createAccountLabel?: string;

  close: () => void;
  onViewTransactions?: () => void;
  onHelp?: () => void;
};
