import type * as React from "react";
import type { SavedRecipient } from "@/lib/clients/savedRecipientsApi";
import type { NetworkPickItem } from "@/components/brand/NetworkPickList";

/** Props for the full-screen Send flow — state lives in DashboardApp. */
export type SendMethodOption = {
  key: string;
  label: string;
  desc: string;
  disabled?: boolean;
  disabledReason?: string;
  select: () => void;
};

export type SendCountryChip = {
  idx: number;
  name: string;
  code: string;
  flagUrl: string | null;
};

export type SendRailChip = { label: string; selected: boolean; select: () => void };

export type SendAssetChip = { key: string; label: string; selected: boolean; select: () => void };

/** Where a submitted payment stands. "sending" is derived from `sendAccepting`. */
export type SendOutcome = "processing" | "delivered" | "failed" | "refunded";

export type SendFlowProps = {
  sendNotDone: boolean;
  sendDone: boolean;
  /** False until a send method is picked — the flow opens on the chooser. */
  sendMethodChosen: boolean;
  sendMethodOptions: SendMethodOption[];
  resetSendMethod: () => void;
  sendStepDots?: { on: boolean }[];
  sendStepIs1: boolean;
  sendStepIs2: boolean;
  sendStepIs3: boolean;
  sendIsCountry: boolean;
  sendIsCrypto: boolean;
  sendCountryChips: SendCountryChip[];
  sendRailHasChoice: boolean;
  sendRailChips: SendRailChip[];
  sendProviderHasChoice?: boolean;
  sendProviderChips?: unknown[];
  /** True while GET /v1/supported/catalog is loading / retrying with no data yet. */
  sendCatalogLoading: boolean;
  /** Set when the catalog request failed and no corridors are available. */
  sendCatalogError?: string | null;
  onRetrySendCatalog?: () => void;
  sendAssets: SendAssetChip[];
  sendChains: NetworkPickItem[];
  sendAssetCode: string;
  sendChainLabel: string;
  sendNext?: () => void;
  /** Runs destination checks, then fetches the quote/preview, from the one-page composer. */
  sendReview: () => void;
  /** Selected payout method ("bank" | "mobile" | "crypto"), null before one is picked. */
  sendMethodKey: string | null;
  sendBack: () => void;
  sendDestinationSummary: string;
  /** Destination summary for the recipient-details layout */
  sendCountryName: string;
  sendCountryFlagUrl: string | null;
  sendCurrencyCode: string;
  sendCurrencyName: string;
  /** Country index into COUNTRIES — for destination select on recipient step. */
  sendCountryIdx: number;
  selectSendCountry: (index: number) => void;
  sendProviderLabel: string;
  sendProviderOptions: string[];
  selectSendProvider: (index: number) => void;
  sendProviderIdx: number;
  /** Country group on a bank rail — drives the "Bank" field on step 2. */
  sendIsBankRail: boolean;
  sendIsMobileRail: boolean;
  /** Corridor is running on standby providers — shows the rerouting note. */
  sendProvidersAreFallback: boolean;
  /** No aggregator institution id for this corridor — the quote cannot succeed. */
  sendBlockedNoNetworkId: boolean;
  /** Currency the amount box is being typed in — "USD" or the destination's. */
  sendAmountCurrency: string;
  /** What actually leaves, from the quote's `user_pays` once one exists. */
  sendYouPayText: string;
  sendLocalCurrency: string;
  /** False when we hold no rate for the corridor, so USD is the only option. */
  sendCanEnterLocal: boolean;
  setSendAmountCurrency: (currency: string) => void;
  /** "≈ 130,500.00 KES" — indicative, pre-quote. Null when no rate. */
  sendAmountEquivalent: string | null;
  /** Indicative "1 USD = 130.50 KES" shown while entering an amount. */
  sendIndicativeRateLine: string | null;
  /** Inline message when the typed amount is outside the published limits
   *  (country sends fold an insufficient-balance check into this same
   *  message; crypto sends use sendBalanceError below instead). */
  sendLimitError?: string | null;
  /** Inline message when the amount exceeds the selected source wallet
   *  balance — used by crypto/stablecoin sends. */
  sendBalanceError?: string | null;
  /** Most the corridor and/or source wallet support, in the typed
   *  currency — null when neither is known. */
  sendMaxAmount?: string | null;
  /** Fills the amount field with `sendMaxAmount` for country sends. Undefined hides the button. */
  onMaxSendAmount?: () => void;
  /** Fills the amount field with `sendMaxAmount` for crypto/stablecoin sends. */
  setSendAmountToMax?: () => void;
  /** Binding "1 USD = 130.50 KES" from the quote, shown on review. */
  sendQuotedRateLine: string | null;
  savedRecipients: SavedRecipient[];
  savedRecipientsLoading?: boolean;
  onSelectSavedRecipient: (recipient: SavedRecipient) => void;
  onSaveRecipientDetails: () => void;
  saveRecipientBusy?: boolean;
  saveRecipientMessage?: string;
  /** Country OffRamp: ready stablecoin wallets used as the refund/source rail. */
  sendRefundWalletOptions?: { value: string; label: string }[];
  sendRefundWalletId?: string;
  selectSendRefundWallet?: (accountId: string) => void;
  sendRefundWalletsLoading?: boolean;
  sendRecipientName: string;
  setSendRecipientName: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sendRecipientLabel: string;
  /** True when the choices are transfer types (ACH, wire, SWIFT) paid from a
   * held balance, not banks. */
  sendProviderIsRail?: boolean;
  /** Extra recipient inputs the chosen rail needs (routing number, bank name …). */
  sendExtraFields?: {
    key: string;
    label: string;
    placeholder?: string;
    value: string;
    /** Shown before the account number (routing number, SWIFT/BIC). */
    lead?: boolean;
    /** Why the typed value cannot be right (bad routing number, BIC …). */
    error?: string | null;
  }[];
  /** Why the account box cannot be right (an IBAN that fails its checksum). */
  sendRecipientError?: string | null;
  setSendExtraField?: (key: string, value: string) => void;
  sendRecipient: string;
  setSendRecipient: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** When mobile money — rewrite local 07… to +254… (E.164) on blur. */
  normalizeSendRecipientPhone?: (e?: React.FocusEvent<HTMLInputElement>) => void;
  sendRecipientPlaceholder: string;
  /** Optional Stellar MEMO_TEXT — some exchanges/pooled wallets need one to
   * route the deposit to the right account. */
  sendMemo: string;
  setSendMemo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** True only for Stellar-destination crypto sends — memo is ignored on EVM rails. */
  sendMemoApplies: boolean;
  sendAmount: string;
  setSendAmount: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sendQuoteError: string;
  sendQuoteLoading: boolean;
  sendQuoteRateText: string | null;
  sendFeeText: string;
  /**
   * What actually leaves the account — the backend's `total_debit`
   * (amount + fee, because the fee is charged on top and the recipient
   * receives the full amount). Never derived here. Null before a
   * preview/quote exists, where the row says when it will be known.
   */
  sendTotalDebitText?: string | null;
  sendArrivalText: string;
  /** ISO time the quote or preview stops being valid — drives the "Rate held" countdown on review. */
  sendQuoteExpiresAt?: string | null;
  sendAcceptError: string;
  sendAccepting: boolean;
  submitSend: () => void;
  sendResultText: string | null;
  /** Structured receipt fields for stablecoin confirm success. */
  sendSuccessDetails?: {
    title: string;
    amountDisplay: string;
    currency: string;
    statusLabel: string;
    referenceId: string | null;
    networkLabel: string | null;
    explorerLabel: string;
  } | null;
  /** Explorer URL for the confirmed on-chain transfer, when known. */
  sendExplorerUrl?: string | null;
  /** Live order status (polled via lib/hooks/useOrderStatus), null for the simulated stablecoin tab. */
  sendLiveStatus: { label: string; color: string; soft: string; isSettling: boolean } | null;
  closeModal: () => void;
  /** Opens Help when an error tells the user to contact support. */
  onContactSupport?: () => void;
  /** Where the submitted payment stands once `sendDone` is true. */
  sendOutcome: SendOutcome;
  /** Order id (country sends) or send id (stablecoin), when the backend returned one. */
  sendOrderId: string | null;
  /** Clears the submitted payment and reopens the recipient step with the details kept. */
  sendRetry: () => void;
  /** ISO time of the last order update, for the receipt date. Null when unknown. */
  sendUpdatedAt?: string | null;
  /** Why a payment failed, in the backend's own words. Null when unknown. */
  sendFailureMessage?: string | null;
  /** What came back once a refund is confirmed, e.g. "99.50 USDT". */
  sendRefundText?: string | null;
  /** Closes the flow and opens the Transactions screen. */
  onViewTransactions: () => void;
  /** Root element ref — the dashboard's focus trap and Esc handling attach here. */
  containerRef?: React.Ref<HTMLDivElement>;
};

export type { SavedRecipient };
