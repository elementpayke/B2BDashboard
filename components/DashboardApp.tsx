"use client";
import { QK } from "@/lib/api/queryKeys";
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  flagUrl,
  ACCOUNTS,
  CORRIDORS,
  LIGHT, DARK, DARK_HC_OVERRIDES, qp,
} from "./mockData";
import { applyThemeVars, clearThemeVars } from "@/lib/theme/applyThemeVars";
import { useDashboardUrlSync } from "@/lib/navigation/useDashboardUrlSync";
import {
  dashboardApi,
  liveRateRowsFromSummary,
  mergeExchangeRates,
} from "@/lib/services/dashboard";
import {
  formatHomeCashFlowUsd,
  moneyFlowFromTransactions,
  pendingAmountFromTransactions,
} from "@/lib/services/homeCashFlow";
import { transactionsApi, type Transaction } from "@/lib/services/transactions";
import { recentActivityForFinancialAccount } from "@/lib/services/accountCredits";
import {
  activityInstantMs,
  formatCardSpendWhen,
  presentTransaction,
} from "@/lib/services/transactionPresentation";
import { describeTransactionStatus } from "@/lib/services/transactionStatus";
import { useStellarWalletPaymentsForAccounts } from "@/lib/hooks/useStellarWalletPayments";
import {
  collectPresentedTxHashes,
  filterPresentedActivityRows,
  mergePresentedActivityRows,
  mergeWalletPaymentsWithElementActivity,
  parseOnchainTxDetailId,
  presentOnchainWalletPayment,
  presentUnmatchedOnchainPayments,
  onchainTxDetailId,
} from "@/lib/stellar/walletPaymentsActivity";
import { isStellarUsdcRail } from "@/lib/stellar/network";
import {
  applyCollectEventTimes,
  collectEventTimesFromPayload,
} from "@/lib/collect/eventTimes";
import {
  PRIMARY_TX_FILTERS,
  searchTransactions,
  type PrimaryTransactionFilter,
} from "@/lib/services/transactionFilters";
import { useTransactionsPage } from "@/lib/hooks/useTransactionsPage";
import { authApi, type AuthMe } from "@/lib/services/auth";
import { bootstrapApi, type DashboardBootstrap } from "@/lib/services/bootstrap";
import { apiKeysApi } from "@/lib/services/apiKeys";
import {
  teamApi,
  canManageTeam,
  defaultTeamAcceptUrl,
  displayNameFromEmail,
  initialsFromEmail,
  roleLabel,
  MEMBERSHIP_ROLES,
  type MembershipRole,
} from "@/lib/services/team";
import {
  depositAccountsApi,
  mapDepositAccountToCardView,
  buildDepositAccountDetailRows,
  buildDepositAccountDetailSections,
  mergeDepositAccount,
  applySyncedDepositAccount,
  needsDepositInstructionsSync,
  resolveDepositDisclaimer,
  currencyIso,
  currencyLabel,
  occupiedFiatCurrencyCodes,
  SUPPORTED_IBAN_CURRENCIES,
  supportedCurrenciesFromEligibility,
  allSupportedStablecoinSlots,
  networksForStablecoin,
  isClosedDepositStatus,
  isCloseableDepositAccount,
  listedDepositAccounts,
  type DepositAccount,
  type DepositAccountListResult,
} from "@/lib/services/depositAccounts";
import {
  ordersApi,
  buildSendQuotePayload,
  buildDepositQuotePayload,
  buildPaymentInstructionRows,
  formatQuoteFees,
  toE164,
  isQuoteExpiredError,
  isQuoteAlreadyAcceptedError,
  newIdempotencyKey,
} from "@/lib/services/orders";
import {
  accountSendsApi,
  buildAccountSendResultSummary,
  buildAccountSendSuccessDetails,
  buildSendExplorerUrl,
  buildSendPreviewPayload,
  explainAccountSendError,
  mergeSendableAccounts,
  resolveSendStablecoinSelection,
  sendableAssetsFromAccounts,
  sendableChainsForAsset,
  sendCryptoRecipientPlaceholder,
  SEND_STABLECOIN_NETWORKS,
} from "@/lib/services/accountSends";
import {
  createSavedRecipient,
  listSavedRecipients,
  type SavedRecipient,
  type SavedRecipientRail,
} from "@/lib/clients/savedRecipientsApi";
import {
  accountForNetwork,
  listSendableStablecoinAccounts,
  listStablecoinAccounts,
  resolvePrimaryEntityId,
  buildStablecoinOpenPayload,
  entitiesApi,
  describeStablecoinAccountStatus,
  buildStablecoinAccountDetailRows,
  formatNetworkLabel,
  isReadyStatus,
  isFundableStablecoinAccount,
  isSendableStablecoinAccount,
  occupiedStablecoinNetworkCodes,
  occupiedStablecoinSlots,
  isClosedStatus,
  isCloseableStablecoinAccount,
  stablecoinStatusTone,
  toPartnerNetwork,
  toUiNetworkKey,
  visibleStablecoinAccounts,
} from "@/lib/services/entities";
import {
  remittanceMethodForCurrency,
  remittanceMethodLabel,
} from "@/lib/services/paymentRequests";
import {
  findRailForAssetNetwork,
  fundRailsForAccount,
  networkOptionsForAssetFromRails,
} from "@/lib/collect/cctpRails";
import { parseCollectSupportedChainKeys } from "@/lib/collect/sendDestChains";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useOrderStatus } from "@/lib/hooks/useOrderStatus";
import {
  failureMessage as unifiedFailureMessage,
  feeText as unifiedFeeText,
  accountBoxError,
  defaultSendSource,
  eligibleSendSources,
  estimateBreakdown,
  estimateHeadline,
  extraFieldError,
  findPayoutDestination,
  invalidExtraField,
  isUsdLike,
  missingExtraField,
  payableCorridors,
  payoutRailDestinations,
  payoutSource,
  recipientDetails,
  recipientExtraFields,
  sendSourceLabel,
  findWalletDestination,
  isQuoteExpired as isUnifiedQuoteExpired,
  moneyText as unifiedMoneyText,
  refundText as unifiedRefundText,
  sendErrorMessage as unifiedSendErrorMessage,
  sendPollIntervalMs,
  toOrderQuoteShape,
  toSendPreviewShape,
  unifiedSendsApi,
  unifiedSendsEnabled,
} from "@/lib/services/unifiedSends";
import { useCardTransactionsLive } from "@/lib/hooks/useCardTransactionsLive";
import { useSecretExpiry } from "@/lib/hooks/useSecretExpiry";
import { useRevealGuard } from "@/lib/hooks/useRevealGuard";
import {
  offRampCountriesFromCatalog,
  offRampProvidersForRail,
  onRampCountriesFromCatalog,
  onRampProvidersForRail,
  networkIdForProvider,
  providerNamesFromCatalog,
  type CatalogCorridorCountry,
} from "@/lib/services/catalog";
import { setSessionLostHandler, ApiRequestError, isSessionExpiredError } from "@/lib/apiClient";
import { copyText } from "@/lib/clipboard";
import {
  feeOnTopUsd,
  formatLimitsLine,
  limitViolation,
  limitViolationAcrossCurrencies,
  maxSendableAmount,
  providerLimits,
} from "@/lib/services/transferTerms";
import {
  resolveTreasuryWalletAddress,
} from "@/lib/services/treasuryWallet";
import {
  amountExceedsBalance,
  canEnterInLocalCurrency,
  describeAmountEquivalent,
  formatFeeDual,
  formatRateLine,
  indicativeRate,
  maxAmountForBalance,
  toPayloadUsdAmount,
} from "@/lib/services/sendAmount";
import { useViewport } from "@/lib/responsive";
import {
  buildSendDestinationSummary,
  buildSendStepDots,
  friendlyDepositAcceptError,
  friendlySendAcceptError,
  friendlySendQuoteError,
  railIndexForMethod,
  sendRailBlockedByMissingNetworkId,
  sendRailHasChoice as railHasChoice,
  type SendQuoteErrorData,
} from "@/lib/hooks/sendFlowHelpers";
import { preferCountryOfframpWallet } from "@/lib/services/offrampAsset";
import { countryRailsLabel, fundFromAccountTarget, countrySearchHaystack, depositRailBlockedByMissingNetworkId, ensureSelectedProvider, indexOfProviderName, resolveQuotedProviderName } from "@/lib/hooks/depositFlowHelpers";
import { channelLabelForRail } from "@/lib/services/channelLabels";
import {
  isMobileMoneyRail,
  mobileMoneyDisplayLabel,
} from "@/lib/services/mobileMoneyBrands";
import { useSendCatalog } from "@/lib/hooks/useSendCatalog";
import {
  assertSufficientBalance,
  DEFAULT_DISPLAY_CURRENCY,
  displayCurrencyOptionsFromCatalog,
  formatAccountBalance,
  formatHeroTotalLabel,
  formatUsdEquivalentSub,
  insufficientBalanceMessage,
  isDisplayCurrency,
  parseBalanceNumber,
  readStoredDisplayCurrency,
  resolveDisplayCurrency,
  totalBalanceInDisplayCurrency,
  writeStoredDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/services/balances";
import {
  conversionsApi,
  pickPreferredConvertAccountId,
  secondsUntilExpiry,
  type ConversionOut,
} from "@/lib/services/conversions";
import {
  isQuotableRoute,
  resolveConvertRoute,
  type ConvertRouteLeg,
} from "@/lib/services/convertRoutes";
import {
  describeLedgerConversionError,
  isTerminalConversionStatus,
  ledgerConversionsApi,
  ledgerPreviewToConversionOut,
  ledgerResultToConversionOut,
} from "@/lib/services/ledgerConversions";
import {
  bookTransferPreviewToConversionOut,
  bookTransferResultToConversionOut,
  bookTransfersApi,
  type BookTransferPreview,
} from "@/lib/services/bookTransfers";
import ConvertFlow from "@/components/convert/ConvertFlow";
import { feeDisclosureText } from "@/components/money/FeeDisclosure";
import {
  cardsApi,
  cardholderPrefillFromKybProfile,
  describeCardStatus,
  describeUsdFundingIssueNote,
  formatCardExpiry,
  formatCardPan,
  formatMaskedPan,
  isCardActionable,
  isCardFailedStatus,
  isValidCardE164,
  isValidCardholderEmail,
  newCardReference,
  reconcileIssuedCardsList,
  resolveCardBrand,
  resolveUsdFundingAccount,
  isCardFrozenStatus,
  type IssuedCard,
  type IssuedCardsList,
  type UsdFundingAccount,
} from "@/lib/services/cards";
import {
  cardTransactionsApi,
  isCardSpendTransaction,
  mapCardTransactionToTransaction,
  reconcileCardTransactionList,
  type CardTransactionList,
} from "@/lib/services/cardTransactions";
import CardDetailModal, {
  billingAddressFromKyb,
} from "@/components/cards/CardDetailModal";
import CardBrandMark from "@/components/cards/CardBrandMark";
import CardFlipTile, { CardPreview } from "@/components/cards/CardFlipTile";
import CardColorPicker from "@/components/cards/CardColorPicker";
import { listCardColors, saveCardColor, type CardColorMap } from "@/lib/clients/cardColorsApi";
import {
  cardColor,
  nextCardColor,
  resolveCardColors,
  type CardColorKey,
} from "@/lib/services/cardColors";
import CardSpendList, { type CardSpendItem } from "@/components/cards/CardSpendList";

import ActivityList, { type ActivityItem } from "@/components/ui/ActivityList";
import ChoicePicker from "@/components/ui/ChoicePicker";
import ComingSoonPanel from "@/components/ui/ComingSoonPanel";
import StatementsPanel from "@/components/reports/StatementsPanel";
import dynamic from "next/dynamic";
import InvoicesErrorBoundary from "@/components/invoices/InvoicesErrorBoundary";

const InvoicesScreen = dynamic(() => import("@/components/invoices/InvoicesScreen"), {
  ssr: false,
  loading: () => (
    <div className="ep-panel ep-invoices-empty">
      <p className="ep-invoices-muted">Loading invoices…</p>
    </div>
  ),
});
import StatusBadge from "@/components/ui/StatusBadge";
import SectionHeader from "@/components/ui/SectionHeader";
import HomeIdentity from "@/components/home/HomeIdentity";
import SendFlow from "@/features/send/SendFlow";
import MbokaMark from "@/components/brand/MbokaMark";
import NetworkMark, { partnerNetworkForMark } from "@/components/brand/NetworkMark";
import DesktopSidebar from "@/components/navigation/DesktopSidebar";
import HeaderRates from "@/components/navigation/HeaderRates";
import MobileBottomNav from "@/components/navigation/MobileBottomNav";
import MoreSheet from "@/components/navigation/MoreSheet";
import SupportHelpModal from "@/components/support/SupportHelpModal";
import type { SupportCategory } from "@/lib/services/support";
import TransactionsScreen from "@/components/transactions/TransactionsScreen";
import TxDetailModal from "@/components/transactions/TxDetailModal";
import WalletsScreen from "@/components/wallets/WalletsScreen";
import CreateAccountModal from "@/components/wallets/CreateAccountModal";
import AccountDetailModal from "@/components/wallets/AccountDetailModal";
import AccountDetailScreen from "@/components/wallets/AccountDetailScreen";

/**
 * Reveal-guard key for the card detail modal. The modal shows one card at a
 * time, so a single key covers it; tiles key on their own card id.
 */
const MODAL_REVEAL_KEY = "card-detail-modal";

function fiatRailForCurrency(code: string): string {
  const c = code.toUpperCase();
  if (c === "EUR") return "IBAN · SEPA";
  if (c === "GBP") return "IBAN · Faster Pay";
  if (c === "USD") return "IBAN · SWIFT";
  if (c === "KES") return "Mobile money";
  return "Bank transfer";
}

import FundChooserModal, { type FundChooserOption } from "@/components/wallets/FundChooserModal";
import CloseAccountModal from "@/components/wallets/CloseAccountModal";
import BookTransferModal from "@/components/wallets/BookTransferModal";
import FundPaymentRequestModal from "@/components/wallets/FundPaymentRequestModal";
import FundStablecoinModal from "@/components/wallets/FundStablecoinModal";
import PayoutModal from "@/components/wallets/PayoutModal";
import { fiatSendOpensBankPayout } from "@/lib/payoutForm";
import BulkStellarPayoutWizard from "@/components/wallets/BulkStellarPayoutWizard";
import PayoutBatchWizard from "@/components/wallets/PayoutBatchWizard";
import DisbursementBatchHistory from "@/components/wallets/DisbursementBatchHistory";
import StellarLiquidityPanel from "@/components/developer/StellarLiquidityPanel";
import {
  MIXED_RAIL_BULK_PAYOUTS_ENABLED,
  SHOW_STELLAR_LIQUIDITY_PANEL,
  STELLAR_BULK_PAYOUTS_ENABLED,
  isAllowlistedStellarStable,
} from "@/lib/config/stellarFeatures";
import {
  AFRICAN_FUND_FIAT_CURRENCIES,
  africanFundDisabledReason,
  planAfricanFundOrchestration,
} from "@/lib/services/fundOrchestration";
import {
  fundsApi,
  isAfricaFundProcessing,
  isAfricaFundTerminal,
} from "@/lib/services/funds";
import {
  coerceStablecoinNetworkKey,
  DEPOSIT_STABLECOIN_NETWORKS,
  describeMissingOnRampDestination,
  pickFundableWalletForRail,
  resolveAfricanFundOpenIntent,
  resolveOnRampDestination,
  resolveStablecoinPickerDestination,
  stablecoinNetworksForAsset,
} from "@/lib/services/depositRampDestination";
import DepositFlow from "@/features/deposit/DepositFlow";
import ReceiveModal from "@/components/deposit/ReceiveModal";
import VerificationScreen from "@/components/verification/VerificationScreen";
import KybWizardModal from "@/components/verification/KybWizardModal";
import KybGateBanner from "@/components/verification/KybGateBanner";
import { useKybWizard } from "@/lib/hooks/useKybWizard";
import {
  canOpenKybWizard,
  describeKybStatus,
  isKybApproved,
  mergeKybSummaryCache,
  normalizeKybReviewFindings,
} from "@/lib/services/kyb";
import { mfaApi } from "@/lib/services/mfa";
import MfaReminderBanner from "@/components/auth/MfaReminderBanner";
import TotpEnrollment from "@/components/auth/TotpEnrollment";

type Props = {
  boostDarkContrast?: boolean;
  forceMobile?: boolean;
  startScreen?: string;
  startTheme?: string;
};

export default function DashboardApp(props: Props = {}) {
  const router = useRouter();
  const viewport = useViewport(props.forceMobile);
  const isCompact = viewport.isCompact;
  const isMobile = viewport.isMobile;

  const rootRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastModalFocusRef = useRef<HTMLElement | null>(null);

  const [state, setStateRaw] = useState<any>(() => ({
    theme: props.startTheme || "light", screen: props.startScreen || "home",
    sidebarOpen: false,
    moreOpen: false,
    modal: null as string | null,
    /** Where Back from a money flow should return (home / accountDetail / …). */
    moneyFlowReturn: null as string | null,
    sendStep: 1, sendMethod: null as null | "bank" | "mobile" | "crypto" | "internal",
    sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0, sendRecipient: "", sendRecipientTyped: "", sendRecipientName: "", sendRecipientDetails: {}, sendReference: "", sendMemo: "", sendAmount: "", sendAmountCurrency: "USD", sendDone: false, sendAsset: "usdc", sendChain: "stellar",
    sendQuote: null as any, sendUnifiedQuote: null as any, sendUnified: null as any, sendQuoteLoading: false, sendQuoteError: "", sendAccept: null as any, sendAccepting: false, sendAcceptError: "",
    sendPreview: null as any, sendConfirm: null as any, sendAccountId: "",
    depositStep: 1, depositGroup: "country", depositSub: "country", depositCountryIdx: -1, depositRailIdx: -1, depositProviderIdx: -1, depositProviderName: "", depositPhone: "", depositAmount: "", depositPromptSent: false, depositAsset: "usdc", depositNetwork: "stellar",
    depositQuote: null as any, depositQuoteLoading: false, depositQuoteError: "", depositAccept: null as any, depositAccepting: false, depositAcceptError: "", depositDone: false, depositIdempotencyKey: "",
    receiveGroup: "fiat", receiveAcctIdx: 0, receiveAsset: "usdc", receiveNetwork: "base", copiedKey: "",
    bulkSelected: [0,3,6], bulkLoaded: false, bulkDone: false,
    onrampDir: "onramp", quoteSeconds: 87, swapAccepted: false,
    // No convertMode: the rail is derived from the account pair.
    convertSourceAccountId: "",
    convertDestAccountId: "",
    convertAmount: "",
    convertQuote: null as ConversionOut | null,
    // Raw book-transfer preview, kept so confirm can echo it back the way
    // BookTransferModal does rather than guess which fields Mboka needs.
    convertBookPreview: null as BookTransferPreview | null,
    convertQuoteLoading: false,
    convertAccepting: false,
    convertError: "",
    // A bridged conversion confirms into a job that settles over minutes;
    // these say where to poll it. Empty when nothing is in flight.
    convertJobEntityId: "",
    convertJobAccountId: "",
    /** Set when live progress can't be fetched — the job still runs. */
    convertJobNote: "",
    convertHop: 1 as 1 | 2,
    convertBridgeUsdcId: "" as string,
    convertFiatPair: ["EUR", "USD"] as [string, string],
    txFilter: "all" as PrimaryTransactionFilter,
    txView: "payments" as "payments" | "batches",
    txSearch: "",
    txCurrency: "all",
    txDateRange: "all" as "all" | "7d" | "30d",
    selectedTxId: null as number | string | null,
    selectedInvoiceId: null as number | null,
    /** Stable key: `fiat:EUR` or `stablecoin:{accountId}` — not list index. */
    selectedAcctKey: "" as string,
    selectedAcctKind: "fiat" as "fiat" | "stablecoin",
    selectedCardId: "" as string,
    /** "details" | "fund" — same coords modal, fund reframes copy for bank transfer. */
    acctDetailIntent: "details" as "details" | "fund",
    /** When set, Deposit OnRamp is funding this fiat or stablecoin account (African path). */
    fundAfricanTargetCurrency: null as string | null,
    /** Fiat VA FinancialAccount id when African-funding a deposit account. */
    fundFiatAccountId: null as string | null,
    /** Stablecoin account to credit via OnRamp (prefer Polygon USDT for fiat VA funds). */
    fundTargetAccountId: null as string | null,
    /** CAD account being funded by Interac from inside the account. */
    fundInteracAccountId: null as string | null,
    /** Fiat account (USD/EUR/GBP…) whose bank details Add money opens on, from inside it. */
    fundFiatLockedId: null as string | null,
    /** Add money opened from inside a stablecoin wallet: that wallet is chosen. */
    depositFromAccount: false,
    africaFundId: null as string | null,
    africaFundStatus: "" as string,
    fundConvertStatus: "" as string,
    fundConvertError: "" as string,
    apiKeyRevealed: {}, secretRevealed: {}, copiedField: "",
    apiKeyName: "", apiKeyEnvironment: "sandbox", apiKeyCreating: false, apiKeyError: "", newlyCreatedKey: null as any,
    addAccountMenu: false, createAccountKind: "bank", createAccountName: "",
    createAccountCurrency: "", createAccountStablecoin: "", createAccountNetwork: "",
    createAccountSaving: false, createAccountError: "",
    inviteOpen: false, inviteEmail: "", inviteRole: "operator" as MembershipRole,
    inviteBusy: false, inviteError: "", teamActionError: "",
    teamConfirm: null as null | { kind: "revoke" | "remove"; id: number; label: string },
    teamConfirmBusy: false,
    mfaDisablePassword: "", mfaDisableCode: "", mfaDisableBusy: false, mfaDisableError: "",
    newCardLabel: "",
    newCardFirstName: "",
    newCardLastName: "",
    newCardEmail: "",
    newCardPhone: "",
    newCardDone: false,
    newCardIssuing: false,
    newCardError: "",
    newlyIssuedCard: null as IssuedCard | null,
    cardFreezeBusy: false,
    cardFreezeError: "",
    cardSecrets: null as null | { number: string; cvv: string },
    cardSecretsBusy: false,
    cardSecretsError: "",
    /** Colour chosen in the create-card modal (palette key). */
    newCardColor: "indigo" as CardColorKey,
    /** Cardholder fields are collapsed to a summary when KYB prefilled them. */
    newCardHolderOpen: false,
    /** Grid-tile flip UX — keyed by card id since two cards can be flipped at once. */
    cardTileFlipped: {} as Record<string, boolean>,
    cardTileSecrets: {} as Record<string, { number: string; cvv: string }>,
    cardTileSecretsBusy: {} as Record<string, boolean>,
    cardTileSecretsError: {} as Record<string, string>,
    cardFrozen: false, tierDone: false,
    balanceView: "all", sendGroup: "country",
    displayCurrency: DEFAULT_DISPLAY_CURRENCY as DisplayCurrency,
    supportCategory: "other" as SupportCategory,
    supportReferenceId: "",
  }));
  const setState = useCallback((update: any) => {
    setStateRaw((prev: any) => ({ ...prev, ...(typeof update === "function" ? update(prev) : update) }));
  }, []);

  /**
   * Strands credential reveals that the user dismissed while they were still
   * in flight. Checking current UI state at write time is not equivalent:
   * show → hide → show would land the abandoned request's PAN/CVV.
   */
  const revealGuard = useRevealGuard();

  useEffect(() => {
    const timer = setInterval(() => {
      setState((s: any) => {
        if (s.convertQuote?.expires_at) {
          return { quoteSeconds: secondsUntilExpiry(s.convertQuote.expires_at) };
        }
        return { quoteSeconds: Math.max(0, s.quoteSeconds - 1) };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [setState]);

  useEffect(() => {
    setState({ displayCurrency: readStoredDisplayCurrency() });
  }, [setState]);

  // Deep-link query params (screen/modal/theme) — applied after mount so SSR
  // and the first client render stay identical (avoids hydration mismatch).
  useEffect(() => {
    const screen = qp("screen");
    const modal = qp("modal");
    const theme = qp("theme");
    if (!screen && !modal && !theme) return;
    setState((s: any) => ({
      ...(screen ? { screen } : {}),
      ...(modal ? { modal } : {}),
      ...(theme ? { theme } : {}),
    }));
  }, [setState]);

  // Real URLs per top-level screen (/dashboard/transactions…): address bar
  // follows state.screen, Back/Forward switch screens and close any modal.
  useDashboardUrlSync(state.screen, (screen) =>
    setState({ screen, modal: null, sidebarOpen: false, moreOpen: false }),
  );

  // Portaled overlays (ChoicePicker) mount under document.body and miss the
  // dashboard root's inline theme vars — keep <html> in sync.
  useEffect(() => {
    const boostDark = props.boostDarkContrast ?? true;
    const next =
      state.theme === "dark"
        ? boostDark
          ? { ...DARK, ...DARK_HC_OVERRIDES }
          : DARK
        : LIGHT;
    applyThemeVars(next, state.theme === "dark" ? "dark" : "light");
    return () => clearThemeVars(Object.keys(LIGHT));
  }, [state.theme, props.boostDarkContrast]);

  // Close compact navigation when crossing into desktop chrome.
  useEffect(() => {
    if (!isCompact && (state.sidebarOpen || state.moreOpen)) {
      setState({ sidebarOpen: false, moreOpen: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact]);

  // Real backend data. Session-expiry from any of these bounces to /login —
  // registered in useLayoutEffect so it is ready before queries flush effects.
  const queryClient = useQueryClient();
  const [saveRecipientBusy, setSaveRecipientBusy] = useState(false);
  const [saveRecipientMessage, setSaveRecipientMessage] = useState("");
  useLayoutEffect(() => {
    setSessionLostHandler(() => {
      queryClient.clear();
      router.replace("/login");
    });
    return () => setSessionLostHandler(null);
  }, [router, queryClient]);

  const meQuery = useQuery({ queryKey: [QK.authMe], queryFn: authApi.me, retry: false });
  useEffect(() => {
    if (!meQuery.isError) return;
    if (!isSessionExpiredError(meQuery.error)) return;
    queryClient.clear();
    router.replace("/login");
  }, [meQuery.isError, meQuery.error, queryClient, router]);
  const businessId = meQuery.data?.business?.id ?? null;
  const myRole = meQuery.data?.role ?? null;
  const myUserId = meQuery.data?.user?.id ?? null;
  const isTeamAdmin = canManageTeam(myRole);
  const meKybStatus =
    (meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? null;
  const meKybApproved = isKybApproved(meKybStatus);
  const mfaEnabled = meQuery.data?.mfa?.enabled ?? false;
  const mfaShouldRemind = meQuery.data?.mfa?.should_remind ?? false;
  const mfaCutoverAt = meQuery.data?.mfa?.cutover_at ?? null;
  // Gate off-screen fetches so Home/Accounts win connection slots after login.
  const screen = state.screen;
  const needsActivityFeed =
    screen === "home" ||
    screen === "wallets" ||
    screen === "accountDetail" ||
    screen === "cards" ||
    screen === "reports" ||
    screen === "transactions";
  // accountDetail included: a book transfer closes onto it, so without a
  // poll here a settling transfer never appears on the account it left.
  const activityPoll =
    screen === "home" ||
    screen === "transactions" ||
    screen === "wallets" ||
    screen === "accountDetail";
  const kybWizard = useKybWizard({
    businessId,
    kybSummary: meQuery.data?.kyb_summary,
    business: meQuery.data?.business,
    kybStatus: meKybStatus,
    enabled: state.modal === "kyb",
    onSubmitted: () => {
      queryClient.invalidateQueries({ queryKey: [QK.authMe] });
      queryClient.invalidateQueries({ queryKey: [QK.dashboardBootstrap] });
      queryClient.invalidateQueries({ queryKey: [QK.depositAccountsEligibility] });
    },
  });
  // One-shot Home aggregate: identity slice, eligibility, treasury, FX, all accounts.
  const bootstrapQuery = useQuery({
    queryKey: [QK.dashboardBootstrap],
    queryFn: bootstrapApi.get,
    retry: false,
    staleTime: 30_000,
    enabled: meQuery.isSuccess,
  });
  const bootstrapReady = bootstrapQuery.isSuccess;
  const bootstrapFailed = bootstrapQuery.isError;
  // When bootstrap lands first, lift business name / KYB into auth-me cache.
  useEffect(() => {
    const patch = bootstrapQuery.data?.authMePatch;
    if (!patch?.business?.name) return;
    queryClient.setQueryData([QK.authMe], (prev: AuthMe | undefined) => {
      if (!prev) return prev;
      const prevName = prev.business?.name?.trim() || "";
      const mergedKyb = mergeKybSummaryCache(prev.kyb_summary, patch.kyb_summary);
      if (prevName && prevName !== "Your business") {
        return {
          ...prev,
          role: patch.role ?? prev.role,
          kyb_summary: mergedKyb,
        };
      }
      return {
        ...prev,
        role: patch.role ?? prev.role,
        kyb_summary: mergedKyb,
        business: patch.business
          ? {
              ...(prev.business ?? patch.business),
              ...patch.business,
              // Keep richer /auth/me business fields when bootstrap only has a name stub.
              legal_name: patch.business.legal_name ?? prev.business?.legal_name ?? null,
              registration_number:
                patch.business.registration_number ?? prev.business?.registration_number ?? null,
              country: patch.business.country || prev.business?.country || "",
            }
          : prev.business,
      };
    });
  }, [bootstrapQuery.data, queryClient]);
  const summaryQuery = useQuery({
    queryKey: [QK.dashboardSummary],
    queryFn: dashboardApi.summary,
    retry: false,
    // Bootstrap already carries treasury + FX; keep summary for money-in/out when needed.
    enabled: true,
  });
  const exchangeRatesQuery = useQuery({
    queryKey: [QK.exchangeRates],
    queryFn: dashboardApi.exchangeRates,
    retry: false,
    staleTime: 60_000,
    // Skip when bootstrap already supplied usable FX.
    enabled: !bootstrapQuery.data?.fxRates,
  });
  const txFilterStatus =
    state.txFilter === "processing" || state.txFilter === "failed"
      ? state.txFilter
      : "all";
  // Tx detail modal fetches by id, not by list index/position — the list can
  // reorder or refetch (15s poll above) while the modal is open, and an
  // index would silently point at a different transaction.
  const txDetailQuery = useQuery({
    queryKey: [QK.transaction, state.selectedTxId],
    queryFn: () => transactionsApi.get(state.selectedTxId as number | string),
    enabled:
      state.selectedTxId != null &&
      state.modal === "txDetail" &&
      parseOnchainTxDetailId(state.selectedTxId) == null,
    retry: false,
  });
  // Live order-status tracking with tiered HTTP polling fallback.
  // Account-credit rows (`acr_…`) are not merchant_orders — skip order polling.
  const selectedTxIsMerchantOrder =
    state.selectedTxId != null && typeof state.selectedTxId === "number";
  const txStatusQuery = useOrderStatus(state.selectedTxId, {
    enabled: state.modal === "txDetail" && selectedTxIsMerchantOrder,
  });
  const sendStatusQuery = useOrderStatus(state.sendAccept?.merchant_order_id, {
    enabled: state.modal === "send" && state.sendDone && !!state.sendAccept,
  });
  // Unified sends (/v1/sends): one status read for every method. Polls until
  // the send is final; a failed send with a pending refund is re-read slowly.
  // Shown when the send options cannot be read: the accounts exist, the list
  // just did not load (for example a backend without `/v1/sends` yet).
  const SEND_OPTIONS_UNAVAILABLE =
    "We couldn’t load your accounts just now. Try again in a moment.";
  const sendOptionsQuery = useQuery({
    queryKey: [QK.sendOptions],
    queryFn: unifiedSendsApi.options,
    enabled: unifiedSendsEnabled() && state.modal === "send",
    staleTime: 5 * 60 * 1000,
    // A backend without the unified routes answers 404; asking again won't help.
    retry: (count, err) =>
      !(err instanceof ApiRequestError && err.status === 404) && count < 1,
  });
  // The new flow only runs when its account list loaded. If the backend does
  // not have `/v1/sends` yet (or it failed), the composer falls back to the
  // existing order / account-send flow and its own wallet picker, so the
  // user can still choose where the money comes from.
  const sendOptionsUnavailable = sendOptionsQuery.isError && !sendOptionsQuery.data;
  const unifiedSendsLive = () => unifiedSendsEnabled() && !sendOptionsUnavailable;
  const unifiedSendId: string | null = state.sendUnified?.send_id ?? null;
  const unifiedSendQuery = useQuery({
    queryKey: [QK.unifiedSend, unifiedSendId],
    queryFn: () => unifiedSendsApi.get(unifiedSendId as string),
    enabled: state.modal === "send" && state.sendDone && !!unifiedSendId,
    refetchInterval: (query) =>
      sendPollIntervalMs(query.state.data, query.state.dataUpdateCount),
  });
  const depositStatusQuery = useOrderStatus(state.depositAccept?.merchant_order_id, {
    enabled:
      (state.modal === "deposit" || !!state.fundAfricanTargetCurrency) &&
      state.depositDone &&
      !!state.depositAccept,
  });
  const orderTrackingActive =
    (state.modal === "send" &&
      state.sendDone &&
      !!state.sendAccept &&
      !sendStatusQuery.isTerminal) ||
    (state.modal === "txDetail" &&
      selectedTxIsMerchantOrder &&
      !txStatusQuery.isTerminal) ||
    ((state.modal === "deposit" || !!state.fundAfricanTargetCurrency) &&
      state.depositDone &&
      !!state.depositAccept &&
      !depositStatusQuery.isTerminal);
  const activityPollMs = activityPoll ? (orderTrackingActive ? 5_000 : 15_000) : false;
  const transactionsQuery = useQuery({
    queryKey: [QK.transactions],
    queryFn: transactionsApi.list,
    retry: false,
    enabled: needsActivityFeed,
    refetchInterval: activityPollMs,
    // The global 30s staleTime suppressed the recovery paths: navigating to
    // Home, or alt-tabbing back, would not refetch if the feed had been
    // fetched seconds earlier. That is what made a missing transfer feel
    // random rather than consistently late. The activity feed is the one
    // query where freshness beats the request saved.
    staleTime: 0,
  });
  const transactionsPageQuery = useTransactionsPage(txFilterStatus, {
    enabled: screen === "transactions",
    refetchIntervalMs: orderTrackingActive ? 5_000 : 15_000,
  });
  const apiKeysQuery = useQuery({
    queryKey: [QK.apiKeys],
    queryFn: () => apiKeysApi.list(),
    retry: false,
    enabled: screen === "developer" || state.modal === "apiKey",
  });
  const teamQuery = useQuery({
    queryKey: [QK.team, businessId],
    queryFn: () => teamApi.list(businessId as number),
    retry: false,
    enabled: screen === "team" && typeof businessId === "number",
  });
  // Public supported-catalog, used by the Send ("by country") flow to
  // resolve a real aggregator networkId per provider instead of relying on
  // the hardcoded corridor list alone. See lib/services/catalog.ts.
  // Also powers Home display-currency options — keep warm on Home.
  const sendCatalogQuery = useSendCatalog({
    enabled:
      screen === "home" ||
      state.modal === "send" ||
      state.modal === "deposit" ||
      state.modal === "bulk" ||
      !!state.fundAfricanTargetCurrency,
  });

  // Settled once the first catalog fetch finishes (success or error).
  const sendCatalogSettled = sendCatalogQuery.isFetched;
  // With unified sends the country list also depends on the send options, so
  // it is not ready until they have loaded (otherwise it would reshuffle).
  const sendCatalogLoading =
    !sendCatalogSettled ||
    (sendCatalogQuery.isFetching && !sendCatalogQuery.data) ||
    (unifiedSendsLive() && state.modal === "send" && sendOptionsQuery.isLoading);
  const sendCatalogError =
    sendCatalogQuery.isError && !sendCatalogQuery.data
      ? sendCatalogQuery.error instanceof Error
        ? sendCatalogQuery.error.message
        : "Upstream request failed. Please try again."
      : null;
  const retrySendCatalog = () => {
    void sendCatalogQuery.refetch();
  };
  // Live corridors only — never the hardcoded mock COUNTRIES list.
  // Unified sends: a bare currency (CAD, EUR …) is listed only when one of the
  // business's balances has a live rail for it. Its catalog "providers" are
  // conversion routes, not banks, so there is nothing to pick otherwise.
  const sendCountriesFromCatalog = (catalog: typeof sendCatalogQuery.data) => {
    const all = offRampCountriesFromCatalog(catalog);
    if (!unifiedSendsLive()) return all;
    const countryIsos = Object.entries(catalog?.offramp?.countries ?? {})
      .filter(([, country]) => country?.enabled)
      .map(([iso]) => iso);
    return payableCorridors(all, countryIsos, sendOptionsQuery.data);
  };
  const sendCountries = sendCountriesFromCatalog(sendCatalogQuery.data);
  const depositCountries = onRampCountriesFromCatalog(sendCatalogQuery.data);
  // Unified sends: a currency the business holds a balance in (USD …) is paid
  // by rail (ACH, wire, SWIFT) straight from that balance, not by converting
  // from a stablecoin wallet. Real off-ramp countries keep the catalog's bank
  // list. Null means "use the catalog".
  const sendPayoutContext = (countryIdx: number, railIdx: number, providerIdx: number) => {
    if (!unifiedSendsLive()) return null;
    const country = sendCountries[countryIdx];
    if (!country) return null;
    const rail = country.rails[railIdx] || country.rails[0];
    if (!rail || rail.type !== "bank") return null;
    if (sendCatalogQuery.data?.offramp?.countries?.[country.iso.toUpperCase()]?.enabled) return null;
    const rails = payoutRailDestinations(sendOptionsQuery.data, country.code);
    if (rails.length === 0) return null;
    const destination = rails[Math.min(Math.max(providerIdx, 0), rails.length - 1)];
    return {
      rails,
      destination,
      source: payoutSource(sendOptionsQuery.data, destination),
      fields: recipientExtraFields(destination),
    };
  };

  // When the catalog (or corridor) changes the provider list, clamp the
  // selection so sendProviderIdx never points past the active options.
  useEffect(() => {
    const countries = sendCountriesFromCatalog(sendCatalogQuery.data);
    const country = countries[state.sendCountryIdx];
    if (!country) return;
    const rail = country.rails[state.sendRailIdx] || country.rails[0];
    if (!rail) return;
    const catalogProviders = offRampProvidersForRail(
      sendCatalogQuery.data,
      country.iso,
      rail.type,
      country.code,
    );
    const payoutCtx = sendPayoutContext(state.sendCountryIdx, state.sendRailIdx, 0);
    const options = payoutCtx
      ? payoutCtx.rails.map((d) => d.name)
      : providerNamesFromCatalog(catalogProviders);
    if (!options.length) return;
    setState((s: any) => {
      if (s.sendProviderIdx < options.length) return {};
      return { sendProviderIdx: options.length - 1 };
    });
    // sendPayoutContext reads the two queries listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendCatalogQuery.data, sendOptionsQuery.data, state.sendCountryIdx, state.sendRailIdx, setState]);

  useEffect(() => {
    const countries = sendCountriesFromCatalog(sendCatalogQuery.data);
    if (!countries.length) return;
    if (state.sendCountryIdx < countries.length) return;
    setState({ sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0 });
    // sendCountriesFromCatalog also reads the send options listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendCatalogQuery.data, sendOptionsQuery.data, state.sendCountryIdx, setState]);

  useEffect(() => {
    const countries = onRampCountriesFromCatalog(sendCatalogQuery.data);
    const country = countries[state.depositCountryIdx];
    if (!country) return;
    if (state.depositRailIdx < 0 || !state.depositProviderName) return;
    const rail = country.rails[state.depositRailIdx] || country.rails[0];
    if (!rail) return;
    const catalogProviders = onRampProvidersForRail(
      sendCatalogQuery.data,
      country.iso,
      rail.type,
      country.code,
    );
    const options = providerNamesFromCatalog(catalogProviders);
    if (!options.length) return;
    const resolvedIdx = indexOfProviderName(options, state.depositProviderName);
    setState((s: any) => {
      if (s.depositProviderIdx === resolvedIdx) return {};
      return { depositProviderIdx: resolvedIdx };
    });
  }, [sendCatalogQuery.data, state.depositCountryIdx, state.depositRailIdx, state.depositProviderName, setState]);

  // Prefer bootstrap accounts. Fall back to eligibility → IBAN + entities walk
  // only when bootstrap fails (older backends / outage).
  const depositEligibilityQuery = useQuery({
    queryKey: [QK.depositAccountsEligibility],
    queryFn: depositAccountsApi.eligibility,
    retry: false,
    enabled: bootstrapFailed,
  });
  const depositEligible = bootstrapReady
    ? Boolean(bootstrapQuery.data?.eligibility.eligible)
    : depositEligibilityQuery.data?.eligible === true;
  // Live currency list once Mboka ships Nuvion-backed rails beyond USD/EUR —
  // falls back to the static constant until then, same source on both the
  // bootstrap-happy-path and the eligibility-fallback path.
  const supportedFiatCurrencies = supportedCurrenciesFromEligibility(
    bootstrapReady ? bootstrapQuery.data?.eligibility : depositEligibilityQuery.data,
  );
  // Full descriptors (same source) — lets Create Account look up a
  // per-currency monthly_maintenance_fee. Empty until backend ships it.
  const supportedAccountDescriptors =
    (bootstrapReady
      ? bootstrapQuery.data?.eligibility.supported_accounts
      : depositEligibilityQuery.data?.supported_accounts) ?? [];
  const needsFullFiatCoords =
    state.selectedAcctKind === "fiat" &&
    (state.modal === "acctDetail" ||
      state.modal === "receive" ||
      state.screen === "accountDetail");
  const depositAccountsQuery = useQuery({
    queryKey: [QK.depositAccounts],
    queryFn: depositAccountsApi.list,
    retry: false,
    enabled:
      needsFullFiatCoords ||
      (bootstrapFailed &&
        (depositEligibilityQuery.data?.eligible === true ||
          (meKybApproved && depositEligibilityQuery.data?.eligible !== false) ||
          // Soft-fail list: try directly once eligibility isn't known false.
          depositEligibilityQuery.isFetched)),
  });
  const stablecoinAccountsQuery = useQuery({
    queryKey: [QK.stablecoinAccounts],
    queryFn: listStablecoinAccounts,
    retry: false,
    enabled: bootstrapFailed,
  });

  /** Prefer bootstrap payload; fall back to the dedicated list query. */
  const resolvedStablecoinAccounts = visibleStablecoinAccounts(
    bootstrapReady
      ? (bootstrapQuery.data?.stablecoinAccounts ?? [])
      : (stablecoinAccountsQuery.data ?? []),
  );
  const collectHomeForTimes = resolvedStablecoinAccounts.find(
    (account) =>
      isFundableStablecoinAccount(account) &&
      account.currency.trim().toUpperCase() === "USDC" &&
      isStellarUsdcRail({ network: account.network, currency: account.currency }),
  );
  const collectEventTimesQuery = useQuery({
    queryKey: [
      "collect-event-times",
      collectHomeForTimes?.entityId ?? "",
      collectHomeForTimes?.id ?? "",
    ],
    queryFn: async () =>
      collectEventTimesFromPayload(
        await entitiesApi.listCollectCctpTransfers(
          String(collectHomeForTimes!.entityId),
          String(collectHomeForTimes!.id),
        ),
      ),
    enabled: Boolean(collectHomeForTimes?.entityId && collectHomeForTimes?.id),
    retry: false,
    staleTime: 15_000,
  });
  const fundableRefundWallets = resolvedStablecoinAccounts.filter(isFundableStablecoinAccount);

  // Top-up destination wallet — mirror Send’s refund-wallet auto-pick so quotes
  // always land on an explicit account-backed address.
  const fundableWalletIds = fundableRefundWallets.map((a) => a.id).join("|");
  useEffect(() => {
    if (state.modal !== "deposit") return;
    if (state.fundTargetAccountId) return;
    if (fundableRefundWallets.length === 0) return;
    const preferred =
      fundableRefundWallets.find((a) => a.currency.trim().toUpperCase() === "USDC") ||
      fundableRefundWallets[0];
    if (!preferred) return;
    setState({
      fundTargetAccountId: preferred.id,
      depositAsset: preferred.currency.trim().toLowerCase() || "usdc",
      depositNetwork: toUiNetworkKey(preferred.network) || state.depositNetwork,
    });
    // fundableWalletIds tracks account identity without depending on a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.modal, state.fundTargetAccountId, fundableWalletIds]);

  const cardsSurfaceOpen =
    state.screen === "cards" ||
    state.modal === "newCard" ||
    state.modal === "cardDetail";
  const cardTxnSurfaceOpen =
    cardsSurfaceOpen ||
    state.screen === "transactions" ||
    state.screen === "home" ||
    state.screen === "wallets";
  const bootstrapFiatAccounts = bootstrapQuery.data?.fiatAccounts ?? [];
  const fundingDepositAccounts = listedDepositAccounts(
    bootstrapReady
      ? bootstrapFiatAccounts
      : (depositAccountsQuery.data?.accounts ?? []),
  );
  // Prefer IBAN USD once eligibility+list settle; still allow entity-account fallback.
  const usdFundingReady =
    bootstrapReady ||
    (depositEligibilityQuery.isFetched &&
      (depositEligibilityQuery.data?.eligible !== true ||
        depositAccountsQuery.isFetched));
  const usdFundingQuery = useQuery({
    queryKey: [
      "usd-funding-account",
      bootstrapReady ? "boot" : "legacy",
      bootstrapReady
        ? bootstrapQuery.dataUpdatedAt
        : depositAccountsQuery.dataUpdatedAt,
    ],
    queryFn: () =>
      resolveUsdFundingAccount({
        depositAccounts: fundingDepositAccounts,
      }),
    enabled: cardTxnSurfaceOpen && usdFundingReady,
    retry: false,
    staleTime: 30_000,
  });

  const issuedCardsQuery = useQuery({
    queryKey: [
      "issued-cards",
      usdFundingQuery.data?.entityId,
      usdFundingQuery.data?.accountId,
    ],
    queryFn: async () => {
      const entityId = usdFundingQuery.data!.entityId;
      const accountId = usdFundingQuery.data!.accountId;
      const fetchStartedAt = Date.now();
      const fetched = await cardsApi.list(entityId, accountId);
      const live = queryClient.getQueryData<IssuedCardsList>([
        "issued-cards",
        entityId,
        accountId,
      ]);
      // Server list owns membership; only in-flight SSE patches overlay status.
      return reconcileIssuedCardsList(fetched, live, fetchStartedAt);
    },
    enabled: Boolean(
      cardsSurfaceOpen &&
        usdFundingQuery.data?.entityId &&
        usdFundingQuery.data?.accountId,
    ),
    retry: false,
    staleTime: 15_000,
  });

  // Card colours are cosmetic and owned by this dashboard (see app/api/card-colors).
  const cardColorsQuery = useQuery({
    queryKey: [QK.cardColors],
    queryFn: listCardColors,
    enabled: cardsSurfaceOpen,
    staleTime: 60_000,
  });

  const cardTxnStreamEnabled = Boolean(
    cardTxnSurfaceOpen &&
      usdFundingQuery.data?.entityId &&
      usdFundingQuery.data?.accountId,
  );
  useCardTransactionsLive(
    usdFundingQuery.data?.entityId,
    usdFundingQuery.data?.accountId,
    cardTxnStreamEnabled,
  );

  const cardTransactionsQuery = useQuery({
    queryKey: [
      "card-transactions",
      usdFundingQuery.data?.entityId,
      usdFundingQuery.data?.accountId,
    ],
    queryFn: async () => {
      const entityId = usdFundingQuery.data!.entityId;
      const accountId = usdFundingQuery.data!.accountId;
      const fetched = await cardTransactionsApi.listForAccount(entityId, accountId, {
        limit: 50,
      });
      const live = queryClient.getQueryData<CardTransactionList>([
        "card-transactions",
        entityId,
        accountId,
      ]);
      return reconcileCardTransactionList(fetched, live);
    },
    enabled: Boolean(
      cardTxnSurfaceOpen &&
        usdFundingQuery.data?.entityId &&
        usdFundingQuery.data?.accountId,
    ),
    retry: false,
    staleTime: 15_000,
    // SSE is primary for live spend; keep a tight poll even when the stream
    // reports active (multi-replica SSE can miss events; Aggregator/Mboka GET
    // reconcile recovers within one interval).
    refetchInterval:
      cardTxnSurfaceOpen || activityPoll ? 15_000 : false,
  });

  // Prefill convert accounts once lists load.
  //
  // Prefers a funded source *that has a routable destination*. Ranking by
  // balance alone used to be enough when the mode narrowed the lists for us;
  // now that both lists hold every account, the best-funded one might be a
  // KES balance with nowhere to go, and Convert would open on a refusal.
  useEffect(() => {
    if (state.screen !== "convert" && state.modal !== "convert") return;
    // Built from the same helpers the rendered pickers use, so the prefill
    // can never land on an account (a closed one, say) that the list hides —
    // which would leave the picker showing its placeholder over a set value.
    const rows: (ConvertRouteLeg & { balanceAmount: number | null })[] = [
      ...listedDepositAccounts(
        bootstrapReady
          ? (bootstrapQuery.data?.fiatAccounts ?? [])
          : (depositAccountsQuery.data?.accounts ?? []),
      )
        .filter((a) => a.id)
        .map((a) => ({
          id: String(a.id),
          currency: String(a.currency || "").toUpperCase(),
          network: null,
          balanceAmount: parseBalanceNumber(a.balance),
        })),
      ...resolvedStablecoinAccounts
        .filter(
          (a) =>
            (a.currency === "USDC" || a.currency === "USDT") &&
            isReadyStatus(a.status) &&
            a.id,
        )
        .map((a) => ({
          id: String(a.id),
          currency: String(a.currency || "").toUpperCase(),
          network: a.network ?? null,
          balanceAmount: parseBalanceNumber(a.balance),
        })),
    ];
    const bestDestinationFor = (sourceId: string): string => {
      const source = rows.find((a) => a.id === sourceId) || null;
      if (!source) return "";
      return pickPreferredConvertAccountId(
        rows.filter(
          (a) => a.id !== sourceId && isQuotableRoute(resolveConvertRoute(source, a)),
        ),
        [sourceId],
      );
    };
    const existingSourceId = String(state.convertSourceAccountId || "");
    let openingSourceId = existingSourceId;
    let openingDestId = existingSourceId ? bestDestinationFor(existingSourceId) : "";
    if (!existingSourceId) {
      // Walk sources best-funded first and stop at the first one that can
      // actually reach somewhere. `tried` grows every pass, so this ends.
      const tried = new Set<string>();
      for (;;) {
        const candidateId = pickPreferredConvertAccountId(rows, tried);
        if (!candidateId) break;
        tried.add(candidateId);
        const destId = bestDestinationFor(candidateId);
        if (destId) {
          openingSourceId = candidateId;
          openingDestId = destId;
          break;
        }
      }
      // Nothing routes: still open on the funded account rather than empty
      // pickers, and let the route explain itself.
      if (!openingSourceId) openingSourceId = pickPreferredConvertAccountId(rows);
    }
    setState((s: any) => {
      const next: Record<string, string> = {};
      if (!s.convertSourceAccountId && openingSourceId) {
        next.convertSourceAccountId = openingSourceId;
      }
      if (!s.convertDestAccountId && openingDestId) {
        next.convertDestAccountId = openingDestId;
      }
      return Object.keys(next).length ? next : {};
    });
  }, [
    state.screen,
    state.modal,
    state.convertSourceAccountId,
    state.convertDestAccountId,
    bootstrapReady,
    bootstrapQuery.data,
    // The query payloads, deliberately — NOT `resolvedStablecoinAccounts`.
    // That is recomputed into a fresh array every render, and `setState`
    // always spreads into a new object, so depending on it would re-run this
    // effect on every render forever.
    depositAccountsQuery.data,
    stablecoinAccountsQuery.data,
    setState,
  ]);

  // Register / advance Africa → fiat VA background fund after OnRamp accept.
  // Polling is keyed by africaFundId so closing the deposit modal does not abort it.
  useEffect(() => {
    const order = depositStatusQuery.data;
    const targetFiat = state.fundAfricanTargetCurrency;
    const fiatAccountId = state.fundFiatAccountId;
    const stableAccountId = state.fundTargetAccountId;
    const existingFundId = state.africaFundId;

    let cancelled = false;

    const pollFund = async (fundId: string) => {
      for (let i = 0; i < 36 && !cancelled; i++) {
        const fund = await fundsApi.get(fundId);
        if (cancelled) return;
        const terminal = isAfricaFundTerminal(fund.status);
        setState({
          africaFundStatus: fund.status,
          fundConvertStatus: terminal
            ? fund.status === "completed"
              ? "completed"
              : `failed: ${fund.failure_reason || fund.status}`
            : `processing: ${fund.status}`,
          fundConvertError: fund.failure_reason || "",
          ...(terminal
            ? {
                africaFundId: null,
                africaFundStatus: "",
              }
            : {}),
        });
        if (terminal) {
          queryClient.invalidateQueries({ queryKey: [QK.transactions] });
          queryClient.invalidateQueries({ queryKey: [QK.depositAccounts] });
          queryClient.invalidateQueries({ queryKey: [QK.stablecoinAccounts] });
          queryClient.invalidateQueries({ queryKey: [QK.dashboardBootstrap] });
          queryClient.invalidateQueries({ queryKey: [QK.dashboardSummary] });
          return;
        }
        if (!isAfricaFundProcessing(fund.status)) return;
        await new Promise((r) => setTimeout(r, 5000));
      }
    };

    const run = async () => {
      try {
        if (existingFundId) {
          await pollFund(existingFundId);
          return;
        }

        if (!targetFiat || !fiatAccountId || !stableAccountId) return;
        if (
          !AFRICAN_FUND_FIAT_CURRENCIES.includes(
            targetFiat.trim().toUpperCase() as (typeof AFRICAN_FUND_FIAT_CURRENCIES)[number],
          )
        ) {
          return;
        }
        if (!order?.id && !state.depositAccept?.merchant_order_id) return;

        const merchantOrderId = Number(
          order?.id ?? state.depositAccept?.merchant_order_id,
        );
        if (!Number.isFinite(merchantOrderId) || merchantOrderId <= 0) return;

        const stableRow = resolvedStablecoinAccounts.find((a) => a.id === stableAccountId);
        const stableCcy = String(stableRow?.currency || state.depositAsset || "USDT")
          .trim()
          .toUpperCase();
        const registered = await fundsApi.registerAfricaToFiat({
          destination_account_id: fiatAccountId,
          stable_account_id: stableAccountId,
          onramp_merchant_order_id: merchantOrderId,
          source_currency: order?.currency_code || undefined,
          source_amount: order?.amount_crypto || order?.amount_fiat || state.depositAmount || undefined,
          stable_currency: stableCcy === "USDC" ? "USDC" : "USDT",
        });
        if (cancelled) return;
        setState({
          africaFundId: registered.id,
          africaFundStatus: registered.status,
          fundConvertStatus: `processing: ${registered.status}`,
          fundConvertError: "",
        });
        await pollFund(registered.id);
      } catch (err) {
        if (cancelled) return;
        setState({
          fundConvertStatus: "failed: could not start background convert",
          fundConvertError:
            err instanceof ApiRequestError ? err.message : "Background fund failed to register.",
        });
      }
    };

    if (existingFundId || state.depositAccept || order) {
      void run();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    depositStatusQuery.data?.status,
    depositStatusQuery.data?.id,
    state.fundAfricanTargetCurrency,
    state.fundFiatAccountId,
    state.fundTargetAccountId,
    state.africaFundId,
    state.depositAccept?.merchant_order_id,
    state.depositAsset,
    resolvedStablecoinAccounts,
  ]);

  // The list endpoint deliberately omits webhook_url / webhook_secret
  // (ApiKeyListOut); only the per-key detail endpoint returns them. Fetch
  // details so the Developer screen's webhook rows show real values.
  const apiKeyDetailQueries = useQueries({
    queries: (apiKeysQuery.data ?? []).map((k) => ({
      queryKey: [QK.apiKey, k.id],
      queryFn: () => apiKeysApi.get(k.id),
      retry: false,
      enabled: screen === "developer" || state.modal === "apiKey",
    })),
  });
  const apiKeyDetailById = new Map<number, any>();
  (apiKeysQuery.data ?? []).forEach((k, i) => {
    const d = apiKeyDetailQueries[i]?.data;
    if (d) apiKeyDetailById.set(k.id, d);
  });

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      router.push("/login");
    }
  };



  const toggleTheme = () => setState(s => ({ theme: s.theme === "light" ? "dark" : "light" }));
  const closeMore = useCallback(() => setState({ moreOpen: false }), [setState]);
  const setScreen = (screen: string) => () =>
    setState({ screen, sidebarOpen: false, moreOpen: false });
  const navigateToScreen = (screen: string) =>
    setState({ screen, sidebarOpen: false, moreOpen: false });
  const goTransactions = () => navigateToScreen("transactions");

  const moneyFlowReset = {
    sendStep: 1, sendDone: false, sendRecipient: "", sendRecipientTyped: "", sendRecipientName: "", sendRecipientDetails: {}, sendReference: "", sendMemo: "", sendAmount: "", sendAmountCurrency: "USD", sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0, sendGroup: "country", sendMethod: null,
    sendQuote: null, sendUnifiedQuote: null, sendUnified: null, sendQuoteLoading: false, sendQuoteError: "", sendAccept: null, sendAccepting: false, sendAcceptError: "",
    sendPreview: null, sendConfirm: null, sendAccountId: "", sendAsset: "usdc", sendChain: "stellar",
    bulkLoaded: false, bulkDone: false, depositStep: 1, depositPromptSent: false, depositCountryIdx: -1, depositRailIdx: -1, depositProviderIdx: -1, depositProviderName: "", depositGroup: "country", depositSub: "country",
    depositAmount: "", depositQuote: null, depositQuoteLoading: false, depositQuoteError: "", depositAccept: null, depositAccepting: false, depositAcceptError: "", depositDone: false, depositIdempotencyKey: "",
    receiveGroup: "fiat", receiveAcctIdx: 0, receiveAsset: "usdc", receiveNetwork: "base", copiedKey: "",
    swapAccepted: false, onrampDir: "onramp", quoteSeconds: 87,
    convertSourceAccountId: "",
    convertDestAccountId: "",
    convertAmount: "",
    convertQuote: null,
    convertBookPreview: null,
    convertQuoteLoading: false,
    convertAccepting: false,
    convertError: "",
    convertHop: 1,
    convertBridgeUsdcId: "",
    fundAfricanTargetCurrency: null, fundFiatAccountId: null, fundTargetAccountId: null, fundInteracAccountId: null, fundFiatLockedId: null, depositFromAccount: false, fundConvertStatus: "", fundConvertError: "",
    // africaFundId / africaFundStatus intentionally omitted — keep background
    // polling alive after the deposit modal closes until the fund is terminal.
    depositAsset: "usdc", depositNetwork: "stellar",
  };
  /** Non-money overlays (tx detail, KYB, cards, …). Money moves use screens. */
  const openModal = (name) => () => setState({
    modal: name,
    moreOpen: false,
    sidebarOpen: false,
    ...moneyFlowReset,
  });
  const openHelp = (opts?: { category?: SupportCategory; referenceId?: string }) => {
    setState({
      modal: "support",
      supportCategory: opts?.category ?? "other",
      supportReferenceId: opts?.referenceId ?? "",
      moreOpen: false,
      sidebarOpen: false,
      ...moneyFlowReset,
    });
  };
  const isMoneyFlowScreen = (screen: string) =>
    screen === "send" || screen === "deposit" || screen === "receive" || screen === "convert";
  /** Money moves open as bottom sheets (compact) / centered dialogs (desktop). */
  const openMoneyFlow = (name: "send" | "deposit" | "receive" | "convert") => () =>
    setState({
      modal: name,
      moreOpen: false,
      sidebarOpen: false,
      ...moneyFlowReset,
      ...(name === "convert"
        ? { swapAccepted: false, onrampDir: "onramp", quoteSeconds: 87 }
        : {}),
    });
  const exitMoneyFlow = () =>
    setState((prev: any) => ({
      screen: prev.moneyFlowReturn || "home",
      moneyFlowReturn: null,
      // Keep africaFundId / status / convert notes so background polling
      // continues after the sheet closes until the fund is terminal.
      fundAfricanTargetCurrency: null,
      fundFiatAccountId: null,
      fundTargetAccountId: null,
    }));

  // Ready USDC/USDT Base/Polygon (and Stellar USDC) FinancialAccounts for the
  // Stablecoin send tab (Phase 4 `/v1/accounts/{id}/sends`). Fetched when Send opens.
  const sendableAccountsQuery = useQuery({
    queryKey: [QK.sendableStablecoinAccounts],
    queryFn: listSendableStablecoinAccounts,
    enabled: state.modal === "send",
    retry: false,
    staleTime: 30_000,
  });
  const collectSupportedChainsQuery = useQuery({
    queryKey: [QK.collectCctpSupportedChains],
    queryFn: () => entitiesApi.collectSupportedChains(),
    enabled: state.modal === "send",
    retry: false,
    staleTime: 60_000,
  });
  const savedRecipientsQuery = useQuery({
    queryKey: [QK.savedRecipients],
    queryFn: listSavedRecipients,
    enabled: state.modal === "send",
    retry: false,
    staleTime: 30_000,
  });

  // Takes the send state explicitly so the one-page composer can run the
  // destination checks and the quote back to back (see sendReview). Step 1
  // returns the patch it applied, or null when it stopped on an error.
  type SendStateSnapshot = typeof state;
  const sendNextWith = async (
    state: SendStateSnapshot,
  ): Promise<Partial<SendStateSnapshot> | null> => {
    // Country tab step 1: wait for catalog so provider chips / networkId match.
    if (state.sendStep === 1 && state.sendGroup === "country" && !sendCatalogSettled) {
      return null;
    }
    // A bank rail with no catalog-backed provider has no `networkId`, and the
    // backend rejects that payload outright. Stop here rather than collect a
    // recipient and an amount first and fail at the quote.
    if (state.sendStep === 1 && state.sendGroup === "country") {
      const country = sendCountries[state.sendCountryIdx];
      if (!country) {
        setState({
          sendQuoteError: friendlySendQuoteError("network_id is required"),
        });
        return null;
      }
      const rail = country.rails[state.sendRailIdx] || country.rails[0];
      const payoutCtx = sendPayoutContext(
        state.sendCountryIdx,
        state.sendRailIdx,
        state.sendProviderIdx,
      );
      if (payoutCtx) {
        // Paid from the held balance: no provider id and no stablecoin wallet.
        const patch = {
          sendStep: 2,
          sendQuoteError: payoutCtx.source
            ? ""
            : `You need a ${country.code} balance to send by ${payoutCtx.destination.name}.`,
          sendAccountId: payoutCtx.source?.account_id || "",
          sendPreview: null,
          sendAcceptError: "",
        };
        setState(patch);
        return patch;
      }
      if (unifiedSendsLive()) {
        // Any account can pay; the amount step lets the user choose which.
        const chosen = defaultSendSource(
          eligibleSendSources(sendOptionsQuery.data, null),
          state.sendAccountId,
        );
        const patch = {
          sendStep: 2,
          sendQuoteError:
            chosen || sendOptionsQuery.isLoading
              ? ""
              : sendOptionsQuery.isError
                ? SEND_OPTIONS_UNAVAILABLE
                : "You have no account to pay from yet. Open one under Accounts.",
          sendAccountId: chosen?.account_id || "",
          sendPreview: null,
          sendAcceptError: "",
        };
        setState(patch);
        return patch;
      }
      const providers = offRampProvidersForRail(
        sendCatalogQuery.data,
        country.iso,
        rail.type,
        country.code,
      );
      const options = providerNamesFromCatalog(providers);
      const name = options[Math.min(state.sendProviderIdx, Math.max(0, options.length - 1))] || "";
      if (
        sendRailBlockedByMissingNetworkId({
          sendGroup: state.sendGroup,
          networkId: networkIdForProvider(providers, name),
          catalogSettled: sendCatalogSettled,
        })
      ) {
        setState({
          sendQuoteError: friendlySendQuoteError("network_id is required"),
        });
        return null;
      }
      // OffRamp quotes need a refund wallet — prefer Polygon USDT (funded
      // treasury rail) over Base USDC leftovers.
      const preferred = preferCountryOfframpWallet(
        fundableRefundWallets,
        state.sendAccountId,
      );
      const patch = {
        sendStep: 2,
        sendQuoteError: preferred
          ? ""
          : "No ready stablecoin wallet to refund from. Open a USDT account on Polygon and wait until it is active.",
        sendAccountId: preferred?.id || "",
        sendChain: preferred ? toUiNetworkKey(preferred.network) || state.sendChain : state.sendChain,
        sendAsset: preferred
          ? preferred.currency.trim().toLowerCase() || state.sendAsset
          : state.sendAsset,
        sendPreview: null,
        sendAcceptError: "",
      };
      setState(patch);
      return patch;
    }
    // Stablecoin tab step 1 → 2: require a ready account for the chosen
    // asset + network before collecting the recipient (Phase 4).
    if (state.sendStep === 1 && state.sendGroup === "crypto") {
      const accounts = mergeSendableAccounts(
        sendableAccountsQuery.data,
        resolvedStablecoinAccounts,
      );
      const selection = resolveSendStablecoinSelection({
        accounts,
        asset: state.sendAsset,
        chain: state.sendChain,
        preferredAccountId: state.sendAccountId,
        accountsReady: sendableAccountsQuery.isFetched || bootstrapReady,
        supportedChainKeys: parseCollectSupportedChainKeys(
          collectSupportedChainsQuery.data,
        ),
      });
      if (!selection.accountId) {
        setState({
          sendAsset: selection.asset,
          sendChain: selection.chain,
          sendAccountId: "",
          sendQuoteError: sendableAccountsQuery.isLoading
            ? `Loading your ${selection.asset.toUpperCase()} accounts…`
            : selection.asset === "usdc"
              ? `No ready Stellar USDC account to send from. Open a USDC account on Stellar first.`
              : `No ready ${selection.asset.toUpperCase()} account on ${selection.chainLabel}. Open a ${selection.asset.toUpperCase()} account on this network first.`,
        });
        return null;
      }
      const patch = {
        sendStep: 2,
        sendAsset: selection.asset,
        sendChain: selection.chain,
        sendAccountId: selection.accountId,
        sendQuoteError: "",
        sendPreview: null,
        sendAcceptError: "",
      };
      setState(patch);
      return patch;
    }
    // Step 2 -> 3: OffRamp quote (by country) or account-send preview (stablecoin).
    if (state.sendStep === 2 && state.sendGroup === "country") {
      if (!state.sendRecipient.trim() || !state.sendRecipientName.trim() || !state.sendAmount.trim()) return;
      // The box may be in the destination currency; the payload always prices
      // from USD. Converting here (not at keystroke time) keeps the entered
      // figure exactly as typed in the field.
      // Same three sources as homeFxRates/sendIndicativeRate — otherwise a
      // bootstrap-only rate would let Max/inline validation treat the box as
      // convertible while this submit-time lookup finds no rate and silently
      // reinterprets the local figure as raw USD.
      const amountRates = mergeExchangeRates(
        bootstrapQuery.data?.fxRates,
        summaryQuery.data?.fx_rates,
        exchangeRatesQuery.data,
      );
      const amountRate = indicativeRate(
        amountRates?.rates,
        sendCountries[state.sendCountryIdx]?.code,
      );
      const usdAmount = toPayloadUsdAmount(state.sendAmount, {
        currency: amountRate ? state.sendAmountCurrency : "USD",
        rate: amountRate,
      });
      if (!usdAmount) {
        setState({
          sendQuoteError: "Enter an amount greater than zero.",
        });
        return;
      }
      setState({ sendQuoteLoading: true, sendQuoteError: "" });
      try {
        const payoutCtx = sendPayoutContext(
          state.sendCountryIdx,
          state.sendRailIdx,
          state.sendProviderIdx,
        );
        if (payoutCtx) {
          const payCcy = payoutCtx.destination.currency.toUpperCase();
          if (!payoutCtx.source) {
            throw new Error(`You need a ${payCcy} balance to send by ${payoutCtx.destination.name}.`);
          }
          const missing = missingExtraField(payoutCtx.fields, state.sendRecipientDetails);
          if (missing) {
            throw new Error(`Enter the ${missing.label.toLowerCase()} to continue.`);
          }
          const invalid = invalidExtraField(payoutCtx.fields, state.sendRecipientDetails);
          const accountError = accountBoxError(payoutCtx.fields, state.sendRecipient);
          if (invalid || accountError) {
            throw new Error(invalid?.message || accountError || "Check the bank details.");
          }
          // A rail pays out the currency it is funded in, so the amount is
          // that currency as typed — never a converted figure.
          const typedCcy = amountRate ? state.sendAmountCurrency : "USD";
          const payoutAmount =
            payCcy === "USD" ? usdAmount : typedCcy === payCcy ? state.sendAmount.trim() : null;
          if (!payoutAmount) {
            throw new Error(`Enter the amount in ${payCcy}.`);
          }
          if (payoutCtx.source.available != null) {
            assertSufficientBalance({
              amount: payoutAmount,
              balance: { available: payoutCtx.source.available, currency: payCcy },
              currency: payCcy,
            });
          }
          const unifiedQuote = await unifiedSendsApi.quote({
            destination_id: payoutCtx.destination.id,
            source_account_id: payoutCtx.source.account_id,
            amount: payoutAmount,
            amount_currency: payCcy,
            recipient: {
              name: state.sendRecipientName.trim(),
              account: state.sendRecipient.trim(),
              details: recipientDetails(payoutCtx.fields, state.sendRecipientDetails),
            },
            reference: state.sendReference?.trim() || undefined,
          });
          setState({
            sendQuoteLoading: false,
            sendUnifiedQuote: unifiedQuote,
            sendQuote: toOrderQuoteShape(unifiedQuote),
            sendAccountId: payoutCtx.source.account_id,
            sendStep: 3,
          });
          return;
        }
        if (unifiedSendsLive()) {
          // One contract for every method: the user picks the account, the
          // backend picks the route and returns a single combined price.
          const country = sendCountries[state.sendCountryIdx];
          if (!country) {
            throw new Error("Supported corridors are still loading. Try again in a moment.");
          }
          const rail = country.rails[state.sendRailIdx] || country.rails[0];
          const names = providerNamesFromCatalog(
            offRampProvidersForRail(sendCatalogQuery.data, country.iso, rail.type, country.code),
          );
          const providerName =
            names[Math.min(state.sendProviderIdx, Math.max(0, names.length - 1))] || "";
          const sendOptions = await queryClient.fetchQuery({
            queryKey: [QK.sendOptions],
            queryFn: unifiedSendsApi.options,
            staleTime: 5 * 60 * 1000,
          });
          const destination = findPayoutDestination(sendOptions, {
            countryIso: country.iso,
            railType: rail.type,
            providerName,
          });
          if (!destination) {
            throw new Error(
              `${providerName || "That provider"} is not available right now. Pick another provider or try again shortly.`,
            );
          }
          const source = defaultSendSource(
            eligibleSendSources(sendOptions, destination),
            state.sendAccountId,
          );
          if (!source) {
            throw new Error("Choose an account to pay from, then try again.");
          }
          const srcCcy = source.currency.toUpperCase();
          const dstCcy = destination.currency.toUpperCase();
          const typedCcy = (amountRate ? state.sendAmountCurrency : "USD").toUpperCase();
          // Typed in the destination currency: that is what the recipient
          // gets. Typed in USD: that is what leaves a dollar-pegged account.
          let quoteAmount: string;
          let quoteCurrency: string;
          if (typedCcy === dstCcy) {
            quoteAmount = state.sendAmount.trim();
            quoteCurrency = dstCcy;
          } else if (isUsdLike(srcCcy)) {
            quoteAmount = usdAmount;
            quoteCurrency = srcCcy;
          } else {
            throw new Error(
              `Enter the amount in ${dstCcy} when paying from your ${srcCcy} balance.`,
            );
          }
          if (quoteCurrency === srcCcy && source.available != null) {
            assertSufficientBalance({
              amount: quoteAmount,
              balance: { available: source.available, currency: srcCcy },
              currency: srcCcy,
            });
          }
          const typedAccount = state.sendRecipient.trim();
          const quoteAccount =
            rail.type === "mobile" ? toE164(typedAccount, country.dialCode) : typedAccount;
          if (quoteAccount !== typedAccount) setState({ sendRecipient: quoteAccount });
          const unifiedQuote = await unifiedSendsApi.quote({
            destination_id: destination.id,
            source_account_id: source.account_id,
            amount: quoteAmount,
            amount_currency: quoteCurrency,
            recipient: { name: state.sendRecipientName.trim(), account: quoteAccount },
            reference: state.sendReference?.trim() || undefined,
          });
          setState({
            sendQuoteLoading: false,
            sendUnifiedQuote: unifiedQuote,
            sendQuote: toOrderQuoteShape(unifiedQuote),
            sendAccountId: source.account_id,
            sendStep: 3,
          });
          return;
        }
        // Prefer the selected chain's ready USDC account so the quote can
        // tag asset/network; fall back to summary or any ready USDC wallet
        // so a 500 from /dashboard/summary is not reported as unprovisioned.
        const rampDest = resolveOnRampDestination({
          accounts: resolvedStablecoinAccounts,
          selectedAccountId: state.sendAccountId || undefined,
          depositNetworkKey: state.sendChain,
          depositAsset: state.sendAsset,
          summaryWallet: summaryQuery.data?.totals.wallet_address,
        });
        if (!rampDest) {
          throw new Error(
            describeMissingOnRampDestination({
              selectedAccountId: state.sendAccountId || undefined,
              summaryFailed: summaryQuery.isError,
            }),
          );
        }
        // Catch overdraft before the partner quote — country OffRamp settles
        // from the selected stablecoin wallet (crypto_amount ≈ USD 1:1).
        const refundWallet =
          fundableRefundWallets.find((a) => a.id === state.sendAccountId) ||
          preferCountryOfframpWallet(fundableRefundWallets, state.sendAccountId);
        if (refundWallet) {
          const settleCcy = (
            refundWallet.currency ||
            rampDest.asset?.currency ||
            "USDT"
          ).toUpperCase();
          try {
            assertSufficientBalance({
              amount: usdAmount,
              balance: refundWallet.balance,
              currency: settleCcy,
            });
          } catch (balanceErr) {
            if (!(balanceErr instanceof Error)) throw balanceErr;
            const typed = state.sendAmount.trim();
            const typedCcy = amountRate ? state.sendAmountCurrency : "USD";
            // When the box is in local fiat, usdAmount is converted — don't
            // say "you entered 10" if they typed 1,300 KES.
            if (typedCcy !== "USD" && typed && typed !== usdAmount) {
              throw new Error(
                `Insufficient ${settleCcy} balance. Available ${formatAccountBalance(refundWallet.balance)}; ${typed} ${typedCcy} needs about ${usdAmount} ${settleCcy}.`,
              );
            }
            throw balanceErr;
          }
        }
        const refundAddress = rampDest.walletAddress;
        const country = sendCountries[state.sendCountryIdx];
        if (!country) {
          throw new Error("Supported corridors are still loading. Try again in a moment.");
        }
        const rail = country.rails[state.sendRailIdx] || country.rails[0];
        const catalogProviders = offRampProvidersForRail(
          sendCatalogQuery.data,
          country.iso,
          rail.type,
          country.code,
        );
        const providerOptions = providerNamesFromCatalog(catalogProviders);
        if (!providerOptions.length) {
          throw new Error("No live providers for this corridor. Pick another destination or try again shortly.");
        }
        const providerIdx =
          providerOptions.length === 0
            ? 0
            : Math.min(state.sendProviderIdx, providerOptions.length - 1);
        const providerName = providerOptions[providerIdx] || providerOptions[0];
        const networkId = networkIdForProvider(catalogProviders, providerName);
        // Sync the input to E.164 before quote so the user sees +254… and
        // the payload matches (mobile rails only).
        const recipientRaw = state.sendRecipient.trim();
        const recipientAccountNumber =
          rail.type === "mobile"
            ? toE164(recipientRaw, country.dialCode)
            : recipientRaw;
        if (rail.type === "mobile" && recipientAccountNumber !== recipientRaw) {
          setState({ sendRecipient: recipientAccountNumber });
        }
        const payload = buildSendQuotePayload({
          currency: country.code,
          countryIso: country.iso,
          railType: rail.type,
          recipientAccountNumber,
          recipientName: state.sendRecipientName.trim(),
          amount: usdAmount,
          refundAddress,
          asset: rampDest.asset,
          // Mobile rails need E.164; the field's placeholder is local format.
          dialCode: country.dialCode,
          networkId,
          networkName: providerName?.trim() || undefined,
        });
        if (unifiedSendsLive()) {
          // One contract for every method: the backend picks the route and
          // returns a single combined price.
          if (!refundWallet) {
            throw new Error("Choose a wallet to pay from, then try again.");
          }
          const sendOptions = await queryClient.fetchQuery({
            queryKey: [QK.sendOptions],
            queryFn: unifiedSendsApi.options,
            staleTime: 5 * 60 * 1000,
          });
          const destination = findPayoutDestination(sendOptions, {
            countryIso: country.iso,
            railType: rail.type,
            providerName,
          });
          if (!destination) {
            throw new Error(
              `${providerName} is not available right now. Pick another provider or try again shortly.`,
            );
          }
          const unifiedQuote = await unifiedSendsApi.quote({
            destination_id: destination.id,
            source_account_id: refundWallet.id,
            amount: usdAmount,
            amount_currency: (refundWallet.currency || "USDT").toUpperCase(),
            recipient: {
              name: state.sendRecipientName.trim(),
              account: recipientAccountNumber,
            },
          });
          setState({
            sendQuoteLoading: false,
            sendUnifiedQuote: unifiedQuote,
            sendQuote: toOrderQuoteShape(unifiedQuote),
            sendAccountId: refundWallet.id,
            sendStep: 3,
          });
          return;
        }
        const quote = await ordersApi.quote(payload);
        setState({ sendQuoteLoading: false, sendQuote: quote, sendStep: 3 });
      } catch (err) {
        setState({
          sendQuoteLoading: false,
          sendQuoteError: unifiedSendsLive()
            ? unifiedSendErrorMessage(err, "Couldn't get a quote. Try again.")
            : err instanceof ApiRequestError
              ? friendlySendQuoteError(
                  err.message,
                  err.data && typeof err.data === "object"
                    ? (err.data as SendQuoteErrorData)
                    : null,
                  err.status,
                )
              : err instanceof Error
                ? friendlySendQuoteError(err.message)
                : "Couldn't get a quote. Try again.",
        });
      }
      return;
    }
    if (state.sendStep === 2 && state.sendGroup === "crypto") {
      if (!state.sendRecipient.trim() || !state.sendAmount.trim()) return;
      setState({ sendQuoteLoading: true, sendQuoteError: "" });
      try {
        const accounts = [
          ...(sendableAccountsQuery.data ?? []),
          ...resolvedStablecoinAccounts.filter(isSendableStablecoinAccount),
        ];
        const assetCode = (state.sendAsset || "usdc").trim().toUpperCase() || "USDC";
        const account =
          accounts.find(
            (a) =>
              a.id === state.sendAccountId &&
              a.currency.trim().toUpperCase() === assetCode,
          ) || accountForNetwork(accounts, state.sendChain, assetCode);
        if (!account) {
          throw new Error(`No ready ${assetCode} account on this network.`);
        }
        // Prefer bootstrap/list balance when the dedicated sendable fetch is
        // stale or Horizon briefly reported zeros while the account page shows funds.
        const balanceAccount =
          resolvedStablecoinAccounts.find((a) => a.id === account.id) || account;
        assertSufficientBalance({
          amount: state.sendAmount.trim(),
          balance: balanceAccount.balance ?? account.balance,
          currency: account.currency || assetCode,
        });
        const payload = buildSendPreviewPayload({
          toAddress: state.sendRecipient.trim(),
          amount: state.sendAmount.trim(),
          networkKey: state.sendChain,
          accountNetwork: account.network,
          currency: account.currency || assetCode,
          memo: state.sendMemo,
        });
        if (unifiedSendsLive()) {
          const sendOptions = await queryClient.fetchQuery({
            queryKey: [QK.sendOptions],
            queryFn: unifiedSendsApi.options,
            staleTime: 5 * 60 * 1000,
          });
          const destination = findWalletDestination(sendOptions, {
            asset: assetCode,
            network: state.sendChain,
          });
          if (!destination) {
            throw new Error(`${assetCode} on this network is not available right now.`);
          }
          const unifiedQuote = await unifiedSendsApi.quote({
            destination_id: destination.id,
            source_account_id: account.id,
            amount: state.sendAmount.trim(),
            amount_currency: (account.currency || assetCode).toUpperCase(),
            recipient: {
              name: state.sendRecipientName.trim() || "Wallet",
              account: state.sendRecipient.trim(),
            },
            reference: state.sendMemo?.trim() || null,
          });
          setState({
            sendQuoteLoading: false,
            sendUnifiedQuote: unifiedQuote,
            sendPreview: toSendPreviewShape(unifiedQuote),
            sendAccountId: account.id,
            sendStep: 3,
          });
          return;
        }
        const preview = await accountSendsApi.preview(account.id, payload);
        setState({
          sendQuoteLoading: false,
          sendPreview: preview,
          sendAccountId: account.id,
          sendStep: 3,
        });
      } catch (err) {
        setState({
          sendQuoteLoading: false,
          sendQuoteError: unifiedSendsLive()
            ? unifiedSendErrorMessage(err, "Couldn't preview this send. Try again.")
            : err instanceof ApiRequestError
              ? friendlySendQuoteError(
                  explainAccountSendError(err.message, state.sendChain),
                  err.data && typeof err.data === "object"
                    ? (err.data as SendQuoteErrorData)
                    : null,
                  err.status,
                )
              : err instanceof Error
                ? friendlySendQuoteError(explainAccountSendError(err.message, state.sendChain))
                : "Couldn't preview this send. Try again.",
        });
      }
      return;
    }
    setState((s: any) => ({ sendStep: Math.min(3, s.sendStep + 1) }));
    return null;
  };
  const sendNext = () => sendNextWith(state);
  // One-page composer: re-run the destination checks (country, rail and
  // provider may have changed since the last attempt), then go straight to
  // the quote / preview with the same inputs.
  const sendReview = async () => {
    if (state.sendQuoteLoading) return;
    const patch = await sendNextWith({ ...state, sendStep: 1 });
    if (!patch || patch.sendStep !== 2 || patch.sendQuoteError) return;
    await sendNextWith({ ...state, ...patch });
  };
  // After a failed payout: drop the dead order and quote but keep what the
  // user typed, so they can correct the recipient and send again.
  const sendRetry = () =>
    setState({
      sendDone: false,
      sendStep: 1,
      sendAccept: null,
      sendConfirm: null,
      sendQuote: null,
      sendUnifiedQuote: null,
      sendUnified: null,
      sendPreview: null,
      sendQuoteError: "",
      sendAcceptError: "",
    });
  const sendBack = () =>
    setState((s: any) => {
      // Step 1 (destination) is the first step after the method chooser, so
      // Back from there returns to the chooser and clears the draft.
      if (s.sendStep <= 1) {
        return {
          sendMethod: null,
          sendStep: 1,
          sendQuoteError: "",
          sendAcceptError: "",
          sendPreview: null,
          sendQuote: null,
          sendUnifiedQuote: null,
          sendRecipient: "",
          sendRecipientTyped: "",
          sendRecipientName: "", sendRecipientDetails: {}, sendReference: "",
          sendMemo: "",
          sendAmount: "",
        };
      }
      return {
        sendStep: s.sendStep - 1,
        sendQuoteError: "",
        sendAcceptError: "",
        sendPreview: null,
        sendQuote: null,
        sendUnifiedQuote: null,
      };
    });
  const depositNext = async () => {
    if (state.depositGroup === "crypto") {
      if (!state.fundTargetAccountId) {
        setState({
          depositQuoteError:
            "Select a ready stablecoin wallet to top up. Open a USDC account under Accounts if you do not have one yet.",
        });
        return;
      }
      setState((s: any) => ({ depositStep: Math.min(2, s.depositStep + 1), depositQuoteError: "" }));
      return;
    }
    if (
      state.depositStep === 1 &&
      (state.depositSub !== "method" || state.depositRailIdx < 0 || !state.depositProviderName)
    ) {
      return;
    }
    if (state.depositStep === 1 && !state.fundTargetAccountId) {
      setState({
        depositQuoteError:
          "Select a ready stablecoin wallet to top up. Open a USDC account under Accounts if you do not have one yet.",
      });
      return;
    }
    if (state.depositStep === 2) {
      if (!state.depositPhone.trim() || !state.depositAmount.trim()) return;
      if (!state.fundTargetAccountId) {
        setState({
          depositQuoteLoading: false,
          depositQuoteError:
            "Select a ready stablecoin wallet to top up before requesting a quote.",
        });
        return;
      }
      setState({ depositQuoteLoading: true, depositQuoteError: "" });
      try {
        const rampDest = resolveOnRampDestination({
          accounts: resolvedStablecoinAccounts,
          selectedAccountId: state.fundTargetAccountId,
          depositNetworkKey: state.depositNetwork,
          depositAsset: state.depositAsset,
          fundAfricanTargetCurrency: state.fundAfricanTargetCurrency,
          summaryWallet: summaryQuery.data?.totals.wallet_address,
        });
        if (!rampDest) {
          throw new Error(
            describeMissingOnRampDestination({
              selectedAccountId: state.fundTargetAccountId,
              summaryFailed: summaryQuery.isError,
            }),
          );
        }
        const walletAddress = rampDest.walletAddress;
        const country = depositCountries[state.depositCountryIdx];
        if (!country) {
          throw new Error("Supported corridors are still loading. Try again in a moment.");
        }
        const rail = country.rails[state.depositRailIdx] || country.rails[0];
        const catalogProviders = onRampProvidersForRail(
          sendCatalogQuery.data,
          country.iso,
          rail.type,
          country.code,
        );
        const providerOptions = providerNamesFromCatalog(catalogProviders);
        const providerName = resolveQuotedProviderName(
          providerOptions,
          state.depositProviderName,
        );
        const networkId = networkIdForProvider(catalogProviders, providerName);
        if (
          depositRailBlockedByMissingNetworkId({
            depositGroup: state.depositGroup,
            networkId,
            catalogSettled: sendCatalogSettled,
          })
        ) {
          throw new Error(
            friendlySendQuoteError("network_id is required") ||
              "This corridor isn’t available right now — pick another method or try again shortly.",
          );
        }
        const payerName =
          meQuery.data?.business?.legal_name ||
          meQuery.data?.business?.name ||
          "Business account";
        const idempotencyKey = newIdempotencyKey();
        const payload = buildDepositQuotePayload({
          currency: country.code,
          countryIso: country.iso,
          railType: rail.type,
          payerAccountNumber: state.depositPhone.trim(),
          payerName,
          amount: state.depositAmount.trim(),
          walletAddress,
          asset: rampDest.asset,
          dialCode: country.dialCode,
          networkId,
          networkName: providerName?.trim() || undefined,
        });
        const quote = await ordersApi.quote(payload, idempotencyKey);
        setState({
          depositQuoteLoading: false,
          depositQuote: quote,
          depositStep: 3,
          depositIdempotencyKey: idempotencyKey,
        });
      } catch (err) {
        setState({
          depositQuoteLoading: false,
          depositQuoteError:
            err instanceof ApiRequestError
              ? friendlySendQuoteError(
                  err.message,
                  err.data && typeof err.data === "object"
                    ? (err.data as SendQuoteErrorData)
                    : null,
                  err.status,
                )
              : err instanceof Error
                ? friendlySendQuoteError(err.message)
                : "Couldn't get a quote. Try again.",
        });
      }
      return;
    }
    setState((s: any) => ({ depositStep: Math.min(3, s.depositStep + 1) }));
  };
  const depositBack = () =>
    setState((s: any) => {
      if (s.depositStep === 1 && s.depositGroup === "country" && s.depositSub === "method") {
        return {
          depositSub: "country",
          depositQuoteError: "",
          depositAcceptError: "",
        };
      }
      return {
        depositStep: Math.max(1, s.depositStep - 1),
        depositQuoteError: "",
        depositAcceptError: "",
      };
    });
  /**
   * Refresh everything that shows money after a transfer settles.
   *
   * Book transfers used to close their modal without invalidating anything,
   * so a completed move stayed invisible until something else happened to
   * refetch. Worse, it closes onto `accountDetail`, which is not in
   * `activityPoll` — so there was no 15s poll to rescue it either, and the
   * transfer could sit unseen indefinitely on the very account it left.
   *
   * Every other money flow already did this inline; this just names it so a
   * new flow cannot forget a key.
   */
  const refreshMoneyViews = () => {
    for (const key of [
      QK.transactions,
      QK.transactionsPage,
      QK.dashboardSummary,
      QK.depositAccounts,
      QK.stablecoinAccounts,
      // Was the literal "bootstrap", which matched no query — balances on
      // Home never refreshed after a money movement settled.
      QK.dashboardBootstrap,
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const closeModal = () => {
    // Escape reaches every open modal through this shared function — block
    // it here too while a disable-2FA request is in flight (see
    // closeMfaDisable for why).
    if (state.modal === "mfaDisable" && state.mfaDisableBusy) return;
    // Closing dismisses any reveal still in flight, so its response cannot
    // repopulate cardSecrets behind a shut modal.
    revealGuard.invalidate(MODAL_REVEAL_KEY);
    setBulkModalExpanded(false);
    setBulkModalSize(null);
    if (isMoneyFlowScreen(state.screen)) {
      exitMoneyFlow();
      return;
    }
    setState({
      modal: null,
      // Do not clear africaFundId here — polling must outlive the modal.
      fundAfricanTargetCurrency: null,
      fundFiatAccountId: null,
      fundTargetAccountId: null,
      cardSecrets: null,
      cardSecretsBusy: false,
      cardSecretsError: "",
    });
  };
  const closeModalRef = useRef(closeModal);
  const depositInstructionsSyncAttemptedRef = useRef(new Set<string>());
  closeModalRef.current = closeModal;

  useEffect(() => {
    if (!state.modal) return;
    const node = modalRef.current;
    if (!node) return;

    lastModalFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const pickerOpen = () =>
      Boolean(document.querySelector(".ep-choice-overlay, .ep-choice-popover"));
    const focusables = () =>
      [
        ...node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.closest(".ep-choice-overlay, .ep-choice-popover"));

    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (pickerOpen()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeModalRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastModalFocusRef.current?.focus();
    };
  }, [state.modal]);

  const stopClick = (e) => e.stopPropagation();
  const openTxDetail = (id: number | string) => () =>
    setState({ modal: "txDetail", selectedTxId: id });
  const openInvoiceDetail = (id: number) =>
    setState({ modal: "invoiceDetail", selectedInvoiceId: id });
  const openOnchainTxDetail = (payment: { txHash: string }) =>
    setState({
      modal: "txDetail",
      selectedTxId: onchainTxDetailId(payment.txHash),
    });
  // UX redesign: account card → full Account detail screen; Details button → modal.
  const openAcctDetail = (kind: "fiat" | "stablecoin", key: string) => () =>
    setState({
      screen: "accountDetail",
      selectedAcctKind: kind,
      selectedAcctKey: key,
      modal: null,
      sidebarOpen: false,
    });
  const openAcctDetailsModal = () =>
    setState({ modal: "acctDetail", acctDetailIntent: "details", copiedField: "" });
  /** Partner docs: fund fiat EUR/USD via bank transfer to deposit-instructions — not OnRamp quote. */
  const openAcctFundModal = () =>
    setState({ modal: "acctDetail", acctDetailIntent: "fund", copiedField: "" });
  const openAcctFundChooser = () =>
    setState({
      modal: "fundChooser",
      fundConvertStatus: "",
      fundConvertError: "",
      fundAfricanTargetCurrency: null,
      fundFiatAccountId: null,
      fundTargetAccountId: null,
      africaFundId: null,
      africaFundStatus: "",
    });
  const openCloseAccountChooser = () =>
    setState({ modal: "closeAccount" });
  /** `fiat` given: fund that fiat account from inside the Add money flow (keeps its lock). */
  const openAfricanFundOnRamp = (fiat?: { id: string; currency: string }) => {
    // Prefer bootstrap-backed lists — depositAccountsQuery / stablecoinAccountsQuery
    // are disabled once bootstrap succeeds.
    const fiatList = fundingDepositAccounts;
    const stableList = resolvedStablecoinAccounts;
    const currencyKey = fiat
      ? fiat.currency.toUpperCase()
      : state.selectedAcctKind === "fiat" && state.selectedAcctKey.startsWith("fiat:")
        ? state.selectedAcctKey.slice("fiat:".length)
        : "";
    const selectedFiat = fiat
      ? fiatList.find((a) => String(a.id) === fiat.id) ?? null
      : state.selectedAcctKind === "fiat"
        ? fiatList.find((a) => a.currency.toUpperCase() === currencyKey) ?? null
        : null;
    const selectedStablecoin =
      !fiat && state.selectedAcctKind === "stablecoin" && state.selectedAcctKey.startsWith("stablecoin:")
        ? stableList.find(
            (a) => a.id === state.selectedAcctKey.slice("stablecoin:".length),
          ) ?? null
        : null;
    const preferredUsdt =
      stableList.find(
        (a) =>
          isReadyStatus(a.status) &&
          a.currency === "USDT" &&
          /polygon/i.test(a.network || "") &&
          a.id,
      ) ??
      stableList.find(
        (a) => isReadyStatus(a.status) && a.currency === "USDT" && a.id,
      ) ??
      stableList.find(
        (a) => isReadyStatus(a.status) && a.currency === "USDC" && a.id,
      ) ??
      null;
    const intent = resolveAfricanFundOpenIntent({
      selectedKind: fiat ? "fiat" : state.selectedAcctKind,
      selectedFiatCurrency: selectedFiat?.currency || currencyKey || "EUR",
      selectedStablecoin: selectedStablecoin
        ? {
            id: selectedStablecoin.id,
            currency: selectedStablecoin.currency,
            network: selectedStablecoin.network,
          }
        : null,
      preferredStableAccount: preferredUsdt
        ? {
            id: preferredUsdt.id,
            currency: preferredUsdt.currency,
            network: preferredUsdt.network,
          }
        : null,
    });
    setState({
      ...moneyFlowReset,
      modal: "deposit",
      moreOpen: false,
      sidebarOpen: false,
      depositStep: 1,
      depositGroup: "country",
      depositDone: false,
      depositQuote: null,
      depositAccept: null,
      depositQuoteError: "",
      depositAcceptError: "",
      fundAfricanTargetCurrency: intent.fundAfricanTargetCurrency,
      fundFiatAccountId: selectedFiat?.id ? String(selectedFiat.id) : null,
      fundTargetAccountId: intent.fundTargetAccountId,
      depositNetwork: intent.depositNetwork,
      depositAsset: intent.depositAsset,
      africaFundId: null,
      africaFundStatus: "",
      fundConvertStatus: "",
      fundConvertError: "",
      // Inside the Add money flow: keep the account it was opened on.
      ...(fiat ? { fundFiatLockedId: state.fundFiatLockedId } : {}),
    });
  };
  const backToWallets = () => setState({ screen: "wallets", modal: null });
  const openCardDetail = (cardId: string) => () => {
    // Switching cards must strand the previous card's reveal — otherwise its
    // credentials land in a modal now showing a different card.
    revealGuard.invalidate(MODAL_REVEAL_KEY);
    setState({
      modal: "cardDetail",
      selectedCardId: cardId,
      cardFreezeBusy: false,
      cardFreezeError: "",
      cardSecrets: null,
      cardSecretsBusy: false,
      cardSecretsError: "",
      copiedField: "",
    });
  };
  const openNewCard = () => {
    const prefill = cardholderPrefillFromKybProfile(
      meQuery.data?.kyb_summary?.profile ?? null,
    );
    const sessionEmail = meQuery.data?.user?.email?.trim() || "";
    const holder = {
      first: prefill.first_name || "",
      last: prefill.last_name || "",
      email: prefill.email || sessionEmail,
      phone: prefill.phone_number || "",
    };
    const holderComplete = Boolean(
      holder.first &&
        holder.last &&
        isValidCardholderEmail(holder.email) &&
        isValidCardE164(holder.phone),
    );
    setState({
      modal: "newCard",
      newCardLabel: "",
      newCardColor: nextColorForNewCard(),
      newCardHolderOpen: !holderComplete,
      newCardDone: false,
      newCardIssuing: false,
      newCardError: "",
      newlyIssuedCard: null,
      // Cardholder must be a person — never the business legal name.
      newCardFirstName: holder.first,
      newCardLastName: holder.last,
      newCardEmail: holder.email,
      newCardPhone: holder.phone,
    });
  };
  const goVerification = () => setState({ screen: "verification", sidebarOpen: false, moreOpen: false });
  const openModalKyb = () => {
    if (meQuery.isLoading || meQuery.isPending) return;
    const status = (meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? "pending";
    // One live submission at a time — don't reopen the wizard while in review / already verified.
    if (!canOpenKybWizard(status)) {
      goVerification();
      return;
    }
    setState({ modal: "kyb" });
  };
  const guardMoneyModal = (name: string) => () => {
    // Wait for /auth/me before treating KYB as pending — otherwise approved
    // businesses get bounced to verification while the profile is still loading.
    if (meQuery.isLoading || meQuery.isPending) return;
    const status = (meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? "pending";
    if (!isKybApproved(status)) {
      goVerification();
      if (canOpenKybWizard(status)) openModalKyb();
      return;
    }
    if (name === "send" || name === "deposit" || name === "receive" || name === "convert") {
      openMoneyFlow(name)();
      return;
    }
    openModal(name)();
  };
  /** Same KYB gate as guardMoneyModal, but navigates to a screen instead of
   * opening a modal/money-flow overlay. */
  const guardScreenNav = (screen: string) => () => {
    if (meQuery.isLoading || meQuery.isPending) return;
    const status = (meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? "pending";
    if (!isKybApproved(status)) {
      goVerification();
      if (canOpenKybWizard(status)) openModalKyb();
      return;
    }
    navigateToScreen(screen);
  };
  const openSelectedAccountSend = () => {
    guardMoneyModal("send")();
    if (
      state.selectedAcctKind === "stablecoin" &&
      state.selectedAcctKey.startsWith("stablecoin:")
    ) {
      const accountId = state.selectedAcctKey.slice("stablecoin:".length);
      const account =
        resolvedStablecoinAccounts.find((row) => row.id === accountId) ||
        (stablecoinAccountsQuery.data ?? []).find((row) => row.id === accountId);
      if (account) {
        setState({
          sendAsset: account.currency.trim().toLowerCase(),
          sendChain: toUiNetworkKey(account.network),
          sendAccountId: account.id,
          sendGroup: "crypto",
          sendMethod: "crypto",
          sendStep: 2,
        });
      }
    }
  };

  /** Changing country keeps the rail the chosen method implies, so a "Mobile
   *  money" send does not silently become a bank transfer when the user picks
   *  a different country. Falls back to the first rail where the country has
   *  no rail of that type. */
  const selectSendCountry = (i) => () =>
    setState((prev: any) => ({
      sendCountryIdx: i,
      sendRailIdx: railIndexForMethod(sendCountries[i]?.rails, prev.sendMethod),
      sendProviderIdx: 0,
    }));
  const selectSendRail = (i) => () => setState({ sendRailIdx: i, sendProviderIdx: 0 });
  const selectSendProvider = (i) => () => setState({ sendProviderIdx: i });
  const resetSendMethod = () => {
    setSaveRecipientMessage("");
    setState({
      sendMethod: null,
      sendStep: 1,
      sendDone: false,
      sendRecipient: "",
      sendRecipientTyped: "",
      sendRecipientName: "", sendRecipientDetails: {}, sendReference: "",
      sendMemo: "",
      sendAmount: "",
      sendQuote: null,
      sendQuoteError: "",
      sendAcceptError: "",
      sendPreview: null,
      sendConfirm: null,
      sendAccountId: "",
    });
  };
  const openConvert = openMoneyFlow("convert");
  // sendRecipientTyped keeps the account exactly as entered; sendRecipient may
  // be rewritten to E.164 for the API, but receipts show what the user typed.
  const setSendRecipient = (e) => setState({ sendRecipient: e.target.value, sendRecipientTyped: e.target.value });
  const setSendRecipientName = (e) => setState({ sendRecipientName: e.target.value });
  const setSendMemo = (e) => setState({ sendMemo: e.target.value });
  // Blocks typing past whichever cap is known (corridor max, wallet balance —
  // sendMaxAmount is already the smaller of the two, in the box's currency).
  // Never blocks below the minimum: reaching "150" means typing through "1"
  // and "15" first, both under it.
  const setSendAmount = (e) => {
    const next = e.target.value;
    const cap = sendMaxAmount ? Number(sendMaxAmount) : null;
    if (cap != null) {
      const n = Number(next.replace(/,/g, ""));
      if (Number.isFinite(n) && n > cap) return;
    }
    setState({ sendAmount: next });
  };
  /** Mobile money: rewrite local numbers (07…) to E.164 (+254…) in the field. */
  const normalizeSendRecipientPhone = (e?: React.FocusEvent<HTMLInputElement>) => {
    setState((prev: any) => {
      if (prev.sendGroup !== "country") return {};
      const country = sendCountries[prev.sendCountryIdx] || sendCountries[0];
      if (!country) return {};
      const rail = country.rails[prev.sendRailIdx] || country.rails[0];
      const isMobile = prev.sendMethod === "mobile" || rail?.type === "mobile";
      if (!isMobile || !country.dialCode) return {};
      const raw = String(e?.currentTarget?.value ?? prev.sendRecipient ?? "").trim();
      if (!raw) return {};
      const next = toE164(raw, country.dialCode);
      if (next === prev.sendRecipient) return {};
      return { sendRecipient: next };
    });
  };
  const pickSendProvider = (index: number) => setState({ sendProviderIdx: index });
  const applySavedRecipient = (r: SavedRecipient) => {
    setSaveRecipientMessage("");
    const patch: Record<string, unknown> = {
      sendRecipientName: r.label,
      sendRecipient: r.accountNumber,
      sendRecipientTyped: r.accountNumber,
    };
    let countryIdx = state.sendCountryIdx;
    if (state.sendGroup === "country" && (r.countryCode || r.currency)) {
      const match = sendCountries.findIndex((c) => {
        if (r.countryCode && c.iso.toUpperCase() === String(r.countryCode).toUpperCase()) return true;
        if (r.currency && c.code.toUpperCase() === String(r.currency).toUpperCase()) return true;
        return false;
      });
      if (match >= 0) {
        countryIdx = match;
        patch.sendCountryIdx = match;
        patch.sendRailIdx = railIndexForMethod(sendCountries[match].rails, state.sendMethod);
        patch.sendProviderIdx = 0;
      }
    }
    const country = sendCountries[countryIdx] || sendCountries[0];
    if (!country) {
      setState(patch);
      return;
    }
    const railIdx =
      typeof patch.sendRailIdx === "number" ? (patch.sendRailIdx as number) : state.sendRailIdx;
    const rail = country.rails[railIdx] || country.rails[0];
    const isMobile =
      state.sendMethod === "mobile" || r.railType === "mobile" || rail?.type === "mobile";
    if (isMobile && country.dialCode) {
      patch.sendRecipient = toE164(String(r.accountNumber || ""), country.dialCode);
    }
    if (r.provider && state.sendGroup === "country") {
      const catalogProviders = offRampProvidersForRail(
        sendCatalogQuery.data,
        country.iso,
        rail.type,
        country.code,
      );
      const options = providerNamesFromCatalog(catalogProviders);
      const idx = options.findIndex(
        (name) => name.toLowerCase() === String(r.provider).toLowerCase(),
      );
      if (idx >= 0) patch.sendProviderIdx = idx;
    }
    setState(patch);
  };
  const saveCurrentRecipientDetails = async () => {
    const name = state.sendRecipientName.trim();
    let account = state.sendRecipient.trim();
    if (!account || (state.sendGroup === "country" && !name)) return;
    const rail: SavedRecipientRail =
      state.sendGroup === "crypto"
        ? "crypto"
        : state.sendMethod === "mobile"
          ? "mobile"
          : "bank";
    const country = sendCountries[state.sendCountryIdx] || sendCountries[0];
    if (!country) return;
    if (rail === "mobile" && country.dialCode) {
      account = toE164(account, country.dialCode);
      if (account !== state.sendRecipient.trim()) setState({ sendRecipient: account });
    }
    const countryRail = country.rails[state.sendRailIdx] || country.rails[0];
    const catalogProviders = offRampProvidersForRail(
      sendCatalogQuery.data,
      country.iso,
      countryRail.type,
      country.code,
    );
    const savePayoutCtx = sendPayoutContext(
      state.sendCountryIdx,
      state.sendRailIdx,
      state.sendProviderIdx,
    );
    const providerOptions = savePayoutCtx
      ? savePayoutCtx.rails.map((d) => d.name)
      : providerNamesFromCatalog(catalogProviders);
    const provider =
      state.sendGroup === "country"
        ? providerOptions[Math.min(state.sendProviderIdx, Math.max(0, providerOptions.length - 1))] ||
          undefined
        : undefined;
    setSaveRecipientBusy(true);
    setSaveRecipientMessage("");
    try {
      await createSavedRecipient({
        name: name || account,
        account,
        rail,
        countryCode: state.sendGroup === "country" ? country.iso.toUpperCase() : undefined,
        countryName: state.sendGroup === "country" ? country.name : undefined,
        currency: state.sendGroup === "country" ? country.code : state.sendAsset.toUpperCase(),
        provider,
        network: state.sendGroup === "crypto" ? state.sendChain : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: [QK.savedRecipients] });
      setSaveRecipientMessage("Recipient saved. You can pick them next time from saved details.");
    } catch (err) {
      setSaveRecipientMessage(
        err instanceof Error ? err.message : "Couldn't save recipient details. Try again.",
      );
    } finally {
      setSaveRecipientBusy(false);
    }
  };
  const submitSend = async () => {
    if (unifiedSendsLive() && state.sendUnifiedQuote) {
      if (state.sendAccepting) return;
      setState({ sendAccepting: true, sendAcceptError: "" });
      try {
        // One key per confirm attempt. The backend also returns the same send
        // if this quote is confirmed twice, so a double click cannot pay twice.
        const confirmed = await unifiedSendsApi.confirm(
          state.sendUnifiedQuote.quote_id,
          newIdempotencyKey(),
        );
        queryClient.setQueryData([QK.unifiedSend, confirmed.send_id], confirmed);
        queryClient.invalidateQueries({ queryKey: [QK.transactions] });
        queryClient.invalidateQueries({ queryKey: [QK.transactionsPage] });
        queryClient.invalidateQueries({ queryKey: [QK.dashboardSummary] });
        queryClient.invalidateQueries({ queryKey: [QK.sendableStablecoinAccounts] });
        queryClient.invalidateQueries({ queryKey: [QK.sendOptions] });
        setState({ sendAccepting: false, sendUnified: confirmed, sendDone: true });
      } catch (err) {
        if (isUnifiedQuoteExpired(err)) {
          setState({
            sendAccepting: false,
            sendQuote: null,
            sendPreview: null,
            sendUnifiedQuote: null,
            sendStep: 2,
            sendAcceptError: "",
            sendQuoteError: "That quote expired. Press Review to get a fresh price, then try again.",
          });
          return;
        }
        setState({
          sendAccepting: false,
          sendAcceptError: unifiedSendErrorMessage(err, "Couldn't send the payment. Try again."),
        });
      }
      return;
    }
    if (state.sendGroup === "crypto") {
      if (!state.sendPreview?.preview_token || !state.sendAccountId) return;
      setState({ sendAccepting: true, sendAcceptError: "" });
      try {
        // Idempotency-Key is REQUIRED (8–64 chars) — mint once per confirm
        // attempt; retries of the exact same confirm should reuse the key,
        // but a new preview gets a new confirm key.
        const idempotencyKey = newIdempotencyKey();
        const confirmed = await accountSendsApi.confirm(
          state.sendAccountId,
          { preview_token: state.sendPreview.preview_token },
          idempotencyKey,
        );
        queryClient.invalidateQueries({ queryKey: [QK.transactions] });
        queryClient.invalidateQueries({ queryKey: [QK.transactionsPage] });
        queryClient.invalidateQueries({ queryKey: [QK.dashboardSummary] });
        queryClient.invalidateQueries({ queryKey: [QK.sendableStablecoinAccounts] });
        setState({ sendAccepting: false, sendConfirm: confirmed, sendDone: true });
      } catch (err) {
        setState({
          sendAccepting: false,
          sendAcceptError:
            err instanceof ApiRequestError || err instanceof Error
              ? err.message
              : "Couldn't confirm this send. Try again.",
        });
      }
      return;
    }
    if (!state.sendQuote) return;
    setState({ sendAccepting: true, sendAcceptError: "" });
    try {
      const accepted = await ordersApi.accept(state.sendQuote.quote_id);
      queryClient.invalidateQueries({ queryKey: [QK.transactions] });
      queryClient.invalidateQueries({ queryKey: [QK.transactionsPage] });
      queryClient.invalidateQueries({ queryKey: [QK.dashboardSummary] });
      setState({ sendAccepting: false, sendAccept: accepted, sendDone: true });
    } catch (err) {
      if (isQuoteExpiredError(err)) {
        // The quote_id is dead server-side — send the user back to fetch a
        // fresh quote with the same inputs rather than retrying accept.
        setState({
          sendAccepting: false,
          sendQuote: null,
          sendStep: 2,
          sendAcceptError: "",
          sendQuoteError: "That quote expired. Press Review to get a fresh price, then try again.",
        });
        return;
      }
      if (isQuoteAlreadyAcceptedError(err)) {
        // A duplicate accept (e.g. a double-click) already produced an
        // order for this quote_id — the payout went through, so this is
        // not a failure to show the user.
        queryClient.invalidateQueries({ queryKey: [QK.transactions] });
        queryClient.invalidateQueries({ queryKey: [QK.transactionsPage] });
        queryClient.invalidateQueries({ queryKey: [QK.dashboardSummary] });
        setState({ sendAccepting: false, sendAccept: null, sendDone: true });
        return;
      }
      setState({
        sendAccepting: false,
        sendAcceptError:
          err instanceof ApiRequestError
            ? friendlySendAcceptError(
                err.message,
                err.data && typeof err.data === "object"
                  ? (err.data as {
                      code?: string;
                      available?: string | number | null;
                      amount?: string | number | null;
                      currency?: string | null;
                      network?: string | null;
                    })
                  : null,
              )
            : "Couldn't send the payment. Try again.",
      });
    }
  };

  const setDepositGroup = (g) => () => setState({ depositGroup: g, depositSub: "country", depositCountryIdx: -1, depositRailIdx: -1, depositProviderIdx: -1, depositProviderName: "", depositPromptSent: false, depositStep: 1, depositQuote: null, depositQuoteError: "", depositAccept: null, depositAcceptError: "", depositDone: false });
  const selectDepositCountry = (i) => () => setState({ depositCountryIdx: i, depositSub: "method", depositRailIdx: -1, depositProviderIdx: -1, depositProviderName: "", depositPromptSent: false, depositQuote: null, depositQuoteError: "" });
  const selectDepositMethod = (railIdx: number, providerIdx: number, providerName: string) => () =>
    setState({ depositRailIdx: railIdx, depositProviderIdx: providerIdx, depositProviderName: providerName, depositQuote: null, depositQuoteError: "" });
  const setDepositPhone = (e) => setState({ depositPhone: e.target.value });
  const setDepositAmount = (e) => setState({ depositAmount: e.target.value });
  const submitDeposit = async () => {
    if (state.depositGroup !== "country") return;
    if (!state.depositQuote) return;
    const country = depositCountries[state.depositCountryIdx];
    if (!country) return;
    const rail = country.rails[state.depositRailIdx] || country.rails[0];
    setState({ depositAccepting: true, depositAcceptError: "" });
    try {
      const accepted = await ordersApi.accept(
        state.depositQuote.quote_id,
        undefined,
        state.depositQuote.quote_id,
      );
      queryClient.invalidateQueries({ queryKey: [QK.transactions] });
      queryClient.invalidateQueries({ queryKey: [QK.dashboardSummary] });
      const isMobile = rail.type === "mobile";
      setState({
        depositAccepting: false,
        depositAccept: accepted,
        depositDone: true,
        depositPromptSent: isMobile,
      });
    } catch (err) {
      if (isQuoteExpiredError(err)) {
        setState({
          depositAccepting: false,
          depositQuote: null,
          depositStep: 2,
          depositAcceptError: "",
          depositQuoteError: "That quote expired. Press Review to get a fresh price, then try again.",
        });
        return;
      }
      if (isQuoteAlreadyAcceptedError(err)) {
        queryClient.invalidateQueries({ queryKey: [QK.transactions] });
        queryClient.invalidateQueries({ queryKey: [QK.dashboardSummary] });
        setState({
          depositAccepting: false,
          depositAccept: null,
          depositDone: true,
          depositPromptSent: rail.type === "mobile",
        });
        return;
      }
      setState({
        depositAccepting: false,
        depositAcceptError:
          err instanceof ApiRequestError
            ? friendlyDepositAcceptError(err.message, err.data)
            : "Couldn't confirm the top-up. Try again.",
      });
    }
  };
  const setSendAsset = (k) => () => {
    const accounts = mergeSendableAccounts(
      sendableAccountsQuery.data,
      resolvedStablecoinAccounts,
    );
    const next = resolveSendStablecoinSelection({
      accounts,
      asset: k,
      chain: state.sendChain,
      preferredAccountId: state.sendAccountId,
      accountsReady: sendableAccountsQuery.isFetched || bootstrapReady,
      supportedChainKeys: parseCollectSupportedChainKeys(
        collectSupportedChainsQuery.data,
      ),
    });
    setState({
      sendAsset: next.asset,
      sendChain: next.chain,
      sendAccountId: next.accountId,
      sendPreview: null,
      sendQuoteError: "",
    });
  };
  const setSendChain = (k) => () => {
    const accounts = mergeSendableAccounts(
      sendableAccountsQuery.data,
      resolvedStablecoinAccounts,
    );
    const next = resolveSendStablecoinSelection({
      accounts,
      asset: state.sendAsset,
      chain: k,
      preferredAccountId: state.sendAccountId,
      accountsReady: sendableAccountsQuery.isFetched || bootstrapReady,
      supportedChainKeys: parseCollectSupportedChainKeys(
        collectSupportedChainsQuery.data,
      ),
    });
    setState({
      sendChain: next.chain,
      sendAsset: next.asset,
      sendAccountId: next.accountId,
      sendPreview: null,
      sendQuoteError: "",
    });
  };
  const setDepositAsset = (k) => () => {
    const nextNetwork = coerceStablecoinNetworkKey(state.depositNetwork, k, depositNetworkOptions);
    const currency = (k || "usdc").trim().toLowerCase();
    const partner = toPartnerNetwork(nextNetwork);
    // Collect Aquarius (Stellar USDT/EURC) and CCTP bridge deposits credit the
    // Stellar USDC home — pin that account so auto-pick does not snap away.
    const pinStellarHome =
      (currency === "usdc" && partner !== "Stellar") ||
      ((currency === "usdt" || currency === "eurc") && partner === "Stellar");
    const match = pinStellarHome
      ? resolvedStablecoinAccounts.find(
          (a) =>
            isFundableStablecoinAccount(a) &&
            a.currency.trim().toUpperCase() === "USDC" &&
            isStellarUsdcRail({ network: a.network, currency: a.currency }),
        )
      : pickFundableWalletForRail({
          accounts: resolvedStablecoinAccounts,
          networkKey: nextNetwork,
          currency: k,
          preferredAccountId: state.fundTargetAccountId,
        });
    setState({
      depositAsset: k,
      depositNetwork: nextNetwork,
      fundTargetAccountId: match?.id ?? null,
      depositQuote: null,
      depositQuoteError: "",
      depositAccept: null,
      depositAcceptError: "",
      depositDone: false,
    });
  };
  const setDepositNetwork = (k) => () => {
    // depositNetworkOptions (below) is the CCTP-backed rail list actually
    // rendered in the picker — Arc/Arbitrum/Optimism/etc. live there, not in
    // the default DEPOSIT_STABLECOIN_NETWORKS (base/polygon/stellar only).
    // Coercing against the default silently snapped every non-default pick
    // back to "base", making those rows look unclickable.
    const nextNetwork = coerceStablecoinNetworkKey(k, state.depositAsset, depositNetworkOptions);
    const currency = (state.depositAsset || "usdc").trim().toLowerCase();
    const partner = toPartnerNetwork(nextNetwork);
    // USDC's home wallet is always Stellar — a bridge network (Base, etc.)
    // is just where this particular deposit is coming from, not a separate
    // account. Stellar USDT/EURC Aquarius deposits also credit that home.
    const pinStellarHome =
      (currency === "usdc" && partner !== "Stellar") ||
      ((currency === "usdt" || currency === "eurc") && partner === "Stellar");
    const match = pinStellarHome
      ? resolvedStablecoinAccounts.find(
          (a) =>
            isFundableStablecoinAccount(a) &&
            a.currency.trim().toUpperCase() === "USDC" &&
            isStellarUsdcRail({ network: a.network, currency: a.currency }),
        )
      : pickFundableWalletForRail({
          accounts: resolvedStablecoinAccounts,
          networkKey: nextNetwork,
          currency: state.depositAsset,
          preferredAccountId: state.fundTargetAccountId,
        });
    setState({
      depositNetwork: nextNetwork,
      fundTargetAccountId: match?.id ?? null,
      depositAsset: match && !pinStellarHome
        ? match.currency.trim().toLowerCase() || state.depositAsset
        : state.depositAsset,
      depositQuote: null,
      depositQuoteError: "",
      depositAccept: null,
      depositAcceptError: "",
      depositDone: false,
    });
  };

  const setReceiveGroup = (g) => () => setState({ receiveGroup: g, copiedKey: "" });
  const selectReceiveAcct = (i) => () => setState({ receiveAcctIdx: i, copiedKey: "" });
  const setReceiveAsset = (k) => () =>
    setState({
      receiveAsset: k,
      receiveNetwork: coerceStablecoinNetworkKey(state.receiveNetwork, k),
      copiedKey: "",
    });
  const setReceiveNetwork = (k) => () =>
    setState({
      receiveNetwork: coerceStablecoinNetworkKey(k, state.receiveAsset),
      copiedKey: "",
    });
  const copyReceiveField = (key, val) => async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(val);
      setState({ copiedKey: key });
    } catch {
      // Don't show "Copied" when the write failed (permission / insecure context).
      setState({ copiedKey: "" });
    }
  };

  const toggleBulkCountry = (i) => () => setState(s => ({ bulkSelected: s.bulkSelected.includes(i) ? s.bulkSelected.filter(x => x !== i) : [...s.bulkSelected, i] }));
  /**
   * The rail for the pair currently selected, read off raw account data.
   *
   * The render body derives the same route for display; this reads it again
   * from the query caches because the handlers run against `state`, not the
   * rendered snapshot. Both go through `resolveConvertRoute`, so the button
   * the user pressed and the endpoint we call can never disagree.
   */
  const convertLegFor = (accountId: string): ConvertRouteLeg | null => {
    const id = String(accountId || "").trim();
    if (!id) return null;
    const fiat =
      (depositAccountsQuery.data?.accounts ?? []).find((a) => String(a.id) === id) ||
      (bootstrapQuery.data?.fiatAccounts ?? []).find((a) => String(a.id) === id);
    if (fiat) {
      return { id, currency: String(fiat.currency || ""), network: null };
    }
    const stable =
      (stablecoinAccountsQuery.data ?? []).find((a) => String(a.id) === id) ||
      (bootstrapQuery.data?.stablecoinAccounts ?? []).find((a) => String(a.id) === id);
    if (stable) {
      return {
        id,
        currency: String(stable.currency || ""),
        network: stable.network ?? null,
      };
    }
    return null;
  };
  const currentConvertRoute = () =>
    resolveConvertRoute(
      convertLegFor(state.convertSourceAccountId),
      convertLegFor(state.convertDestAccountId),
    );
  /**
   * Owning entity for a convert source account.
   *
   * Book transfers and ledger FX are both entity-scoped, and ledger FX now
   * runs from stablecoin sources too (USDC → USDT), so this cannot read
   * `entity_id` off the fiat list alone — stablecoin accounts carry it as
   * `entityId`.
   */
  const convertEntityIdFor = (accountId: string): string => {
    const id = String(accountId || "").trim();
    if (!id) return "";
    const fiat =
      (depositAccountsQuery.data?.accounts ?? []).find((a) => String(a.id) === id) ||
      (bootstrapQuery.data?.fiatAccounts ?? []).find((a) => String(a.id) === id);
    if (fiat) return String(fiat.entity_id || "").trim();
    const stable =
      (stablecoinAccountsQuery.data ?? []).find((a) => String(a.id) === id) ||
      (bootstrapQuery.data?.stablecoinAccounts ?? []).find((a) => String(a.id) === id);
    return stable ? String(stable.entityId || "").trim() : "";
  };
  const refreshConvertQuote = async () => {
    const sourceId = state.convertSourceAccountId;
    const selectedDestId = state.convertDestAccountId;
    const amount = state.convertAmount;
    const route = currentConvertRoute();

    if (!sourceId || !selectedDestId || !amount.trim()) {
      setState({ convertError: "Pick both accounts and enter an amount (min 1.00)." });
      return;
    }

    // The CTA is already disabled for an unsupported pair; this is the
    // belt-and-braces so no programmatic path can quote one.
    if (!isQuotableRoute(route)) {
      setState({
        convertError: route.reason || "This pair can't be converted yet.",
      });
      return;
    }

    // Client-side available-balance guard when the partner exposed a balance.
    const fiatSource =
      (depositAccountsQuery.data?.accounts ?? []).find((a) => String(a.id) === sourceId) ||
      (bootstrapQuery.data?.fiatAccounts ?? []).find((a) => String(a.id) === sourceId);
    const stableSource =
      (stablecoinAccountsQuery.data ?? []).find((a) => String(a.id) === sourceId) ||
      (bootstrapQuery.data?.stablecoinAccounts ?? []).find((a) => String(a.id) === sourceId);
    try {
      if (fiatSource) {
        assertSufficientBalance({
          amount,
          balance: fiatSource.balance,
          currency: fiatSource.currency,
        });
      } else if (stableSource) {
        assertSufficientBalance({
          amount,
          balance: stableSource.balance,
          currency: stableSource.currency,
        });
      }
    } catch (err) {
      setState({
        convertError: err instanceof Error ? err.message : "Insufficient balance.",
      });
      return;
    }

    // Book transfers and ledger FX are entity-scoped endpoints; the ramp is
    // not. Resolving the entity up front keeps the failure in front of the
    // spinner rather than behind it.
    const entityId = convertEntityIdFor(sourceId);
    if ((route.kind === "ledger_fx" || route.kind === "book_transfer") && !entityId) {
      setState({
        convertError: "Couldn't resolve the business entity for this account.",
      });
      return;
    }

    setState({
      convertQuoteLoading: true,
      convertError: "",
      convertQuote: null,
      convertBookPreview: null,
      swapAccepted: false,
      convertHop: 1,
    });
    try {
      let quote: ConversionOut;
      let bookPreview: BookTransferPreview | null = null;
      if (route.kind === "book_transfer") {
        bookPreview = await bookTransfersApi.preview(entityId, sourceId, {
          destination_account_id: selectedDestId,
          amount: amount.trim(),
          currency: String(fiatSource?.currency || ""),
        });
        quote = bookTransferPreviewToConversionOut(bookPreview, {
          sourceAccountId: sourceId,
          destinationAccountId: selectedDestId,
          currency: String(fiatSource?.currency || ""),
        });
      } else if (route.kind === "ledger_fx") {
        const preview = await ledgerConversionsApi.preview(entityId, sourceId, {
          destination_account_id: selectedDestId,
          amount,
        });
        quote = ledgerPreviewToConversionOut(preview, {
          sourceAccountId: sourceId,
          destinationAccountId: selectedDestId,
        });
      } else {
        quote = await conversionsApi.quote({
          source_account_id: sourceId,
          destination_account_id: selectedDestId,
          amount,
        });
      }
      setState({
        convertQuoteLoading: false,
        convertQuote: quote,
        convertBookPreview: bookPreview,
        quoteSeconds: secondsUntilExpiry(quote.expires_at) || 120,
      });
    } catch (err) {
      const upstream =
        err instanceof ApiRequestError &&
        err.data &&
        typeof err.data === "object" &&
        (err.data as { upstream?: { message?: unknown } }).upstream &&
        typeof (err.data as { upstream?: { message?: unknown } }).upstream === "object"
          ? String(
              ((err.data as { upstream?: { message?: unknown } }).upstream as {
                message?: unknown;
              }).message || "",
            ).trim()
          : "";
      setState({
        convertQuoteLoading: false,
        convertError:
          route.kind === "ledger_fx"
            ? describeLedgerConversionError(err, "Couldn't get a conversion quote.")
            : upstream ||
              (err instanceof Error ? err.message : "Couldn't get a conversion quote."),
      });
    }
  };
  const acceptConvertQuote = async () => {
    const quote = state.convertQuote;
    if (!quote?.quote_id) return;
    // Only a locked rate expires client-side. A bridged quote prices on
    // arrival and shows no countdown; the backend judges its token.
    if (quote.rate_locked !== false && state.quoteSeconds <= 0) return;
    // Re-derive rather than trusting a stashed flag: the accept must hit the
    // same rail that produced the quote the user is looking at.
    const route = currentConvertRoute();
    setState({ convertAccepting: true, convertError: "", convertJobNote: "" });
    let jobEntityId = "";
    try {
      let accepted: ConversionOut;
      const sourceId = state.convertSourceAccountId;
      if (route.kind === "book_transfer" || route.kind === "ledger_fx") {
        const entityId = convertEntityIdFor(sourceId);
        if (!entityId) {
          throw new Error("Couldn't resolve the business entity for this account.");
        }
        if (route.kind === "book_transfer") {
          // Echoes the preview back the way BookTransferModal does — that is
          // the shape Mboka's confirm is known to accept, and a money move is
          // the wrong place to find out which fields were actually optional.
          const result = await bookTransfersApi.confirm(entityId, sourceId, {
            ...(state.convertBookPreview ?? {}),
            destination_account_id: state.convertDestAccountId,
            amount: quote.source_amount,
            currency: quote.source_currency,
            preview_token: quote.quote_id,
          });
          accepted = bookTransferResultToConversionOut(result, quote);
        } else {
          const result = await ledgerConversionsApi.confirm(entityId, sourceId, {
            preview_token: quote.quote_id,
          });
          accepted = ledgerResultToConversionOut(result, quote);
          jobEntityId = entityId;
        }
      } else {
        accepted = await conversionsApi.accept(quote.quote_id);
      }
      queryClient.invalidateQueries({ queryKey: [QK.dashboardBootstrap] });
      queryClient.invalidateQueries({ queryKey: [QK.depositAccounts] });
      queryClient.invalidateQueries({ queryKey: [QK.stablecoinAccounts] });
      queryClient.invalidateQueries({ queryKey: [QK.transactions] });

      // A bridged confirm returns a job still in flight: keep where to poll
      // it, and the polling effect takes it from there.
      // Only bridged jobs (`cvj_…`) are pollable: a direct confirm is already
      // final, and the aggregator answers 404 for its transfer id.
      const inFlight =
        route.kind === "ledger_fx" &&
        accepted.route === "bridged" &&
        !isTerminalConversionStatus(accepted.status);
      setState({
        convertAccepting: false,
        swapAccepted: true,
        convertQuote: accepted,
        convertHop: 1,
        convertJobEntityId: inFlight ? jobEntityId : "",
        convertJobAccountId: inFlight ? sourceId : "",
      });
    } catch (err) {
      setState({
        convertAccepting: false,
        convertError:
          route.kind === "ledger_fx"
            ? describeLedgerConversionError(err, "Couldn't accept this conversion.")
            : err instanceof Error
              ? err.message
              : "Couldn't accept this conversion.",
      });
    }
  };

  // Poll an in-flight bridged conversion until it reaches a terminal status.
  // The job runs server-side regardless; this only keeps the view current.
  const convertJobId = state.convertJobAccountId ? state.convertQuote?.id ?? "" : "";
  const convertJobEntityId = state.convertJobEntityId;
  const convertJobAccountId = state.convertJobAccountId;
  useEffect(() => {
    if (!convertJobId || !convertJobEntityId || !convertJobAccountId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const result = await ledgerConversionsApi.get(
          convertJobEntityId,
          convertJobAccountId,
          convertJobId,
        );
        if (cancelled) return;
        // Read off the response, not inside the updater — React may run
        // the updater after this function has moved on.
        const terminal = isTerminalConversionStatus(result.status);
        setState((s: any) => {
          if (!s.convertQuote || s.convertQuote.id !== convertJobId) return {};
          const next = ledgerResultToConversionOut(result, s.convertQuote);
          return terminal
            ? { convertQuote: next, convertJobEntityId: "", convertJobAccountId: "" }
            : { convertQuote: next };
        });
        if (terminal) {
          queryClient.invalidateQueries({ queryKey: [QK.dashboardBootstrap] });
          queryClient.invalidateQueries({ queryKey: [QK.depositAccounts] });
          queryClient.invalidateQueries({ queryKey: [QK.stablecoinAccounts] });
          queryClient.invalidateQueries({ queryKey: [QK.transactions] });
          return;
        }
      } catch (err) {
        if (cancelled) return;
        // Job unknown upstream (404), or no status route on this backend
        // (405): stop asking and say where to look.
        if (err instanceof ApiRequestError && (err.status === 404 || err.status === 405)) {
          setState({
            convertJobNote:
              "Couldn't load live progress. The conversion carries on — check Transactions for the result.",
            convertJobEntityId: "",
            convertJobAccountId: "",
          });
          return;
        }
        // Anything else is likely transient; keep polling.
      }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [convertJobId, convertJobEntityId, convertJobAccountId, queryClient, setState]);
  const setTxFilter = (filter: PrimaryTransactionFilter) => () =>
    setState({ txFilter: filter });
  // Add Account: a small menu that branches into two create modals.
  const toggleAddAccountMenu = () => setState(s => ({ addAccountMenu: !s.addAccountMenu }));
  const closeAddAccountMenu = () => setState({ addAccountMenu: false });
  const openCreateAccount = (
    kind: string,
    preferredNetwork?: string,
    preferredCurrency?: string,
  ) => () => {
    const slots = occupiedStablecoinSlots(resolvedStablecoinAccounts);
    const fiatOccupied = occupiedFiatCurrencyCodes(
      bootstrapReady
        ? (bootstrapQuery.data?.fiatAccounts ?? [])
        : (depositAccountsQuery.data?.accounts ?? []),
    );
    if (kind === "stablecoin") {
      const preferredAsset = (preferredCurrency || "USDC").trim().toUpperCase() || "USDC";
      const preferred = typeof preferredNetwork === "string"
        ? preferredNetwork.trim().toUpperCase()
        : "";
      const preferredNetworks = networksForStablecoin(preferredAsset);
      const preferredOk =
        preferred &&
        preferredNetworks.includes(preferred) &&
        !slots.has(`${preferredAsset}:${preferred}`)
          ? preferred
          : "";
      const availableForPreferred = preferredNetworks.filter(
        (code) => !slots.has(`${preferredAsset}:${code}`),
      );
      const anyOpen = allSupportedStablecoinSlots().some(
        (slot) => !slots.has(`${slot.currency}:${slot.network}`),
      );
      setState({
        modal: "createAccount",
        addAccountMenu: false,
        createAccountKind: "stablecoin",
        createAccountName:
          preferredOk === "STELLAR" && preferredAsset === "USDC" ? "Stellar USDC" : "",
        createAccountCurrency: "",
        createAccountStablecoin: anyOpen ? preferredAsset : "",
        createAccountNetwork:
          preferredOk ||
          (availableForPreferred.length === 1 ? availableForPreferred[0] : ""),
        createAccountError: anyOpen
          ? ""
          : "You already have a stablecoin account on every available asset and network.",
      });
      return;
    }
    const availableFiat = supportedFiatCurrencies.filter(
      (code) => !fiatOccupied.has(code),
    );
    setState({
      modal: "createAccount",
      addAccountMenu: false,
      createAccountKind: "bank",
      createAccountName: "",
      createAccountCurrency: availableFiat.length === 1 ? availableFiat[0] : "",
      createAccountStablecoin: "",
      createAccountNetwork: "",
      createAccountError:
        availableFiat.length === 0
          ? "You already have fiat accounts for USD and EUR."
          : "",
    });
  };
  const setCreateAccountName = (e) => setState({ createAccountName: e.target.value });
  const setCreateAccountCurrency = (e) => setState({ createAccountCurrency: e.target.value, createAccountError: "" });
  const setCreateAccountStablecoin = (e) => {
    const next = e.target.value;
    const allowed = networksForStablecoin(next);
    const keepNetwork =
      state.createAccountNetwork &&
      allowed.includes(state.createAccountNetwork.trim().toUpperCase())
        ? state.createAccountNetwork
        : "";
    setState({
      createAccountStablecoin: next,
      createAccountNetwork: keepNetwork,
      createAccountError: "",
    });
  };
  const setCreateAccountNetwork = (e) => setState({ createAccountNetwork: e.target.value, createAccountError: "" });

  const copyField = (fieldKey, val) => async () => {
    // Don't show "Copied" when nothing could write (permission / insecure context).
    if (!(await copyText(String(val)))) {
      setState({ copiedField: "" });
      return;
    }
    setState({ copiedField: fieldKey });
    window.setTimeout(() => {
      setState((s: { copiedField?: string }) =>
        s.copiedField === fieldKey ? { copiedField: "" } : {},
      );
    }, 1500);
  };
  const toggleRevealKey = (id) => () => setState(s => ({ apiKeyRevealed: { ...s.apiKeyRevealed, [id]: !s.apiKeyRevealed[id] } }));
  const toggleRevealSecret = (id) => () => setState(s => ({ secretRevealed: { ...s.secretRevealed, [id]: !s.secretRevealed[id] } }));

  // Cards: issue / list / freeze against an active fiat USD funding account.
  const setNewCardLabel = (e) => setState({ newCardLabel: e.target.value, newCardError: "" });
  const setNewCardFirstName = (e) => setState({ newCardFirstName: e.target.value, newCardError: "" });
  const setNewCardLastName = (e) => setState({ newCardLastName: e.target.value, newCardError: "" });
  const setNewCardEmail = (e) => setState({ newCardEmail: e.target.value, newCardError: "" });
  const setNewCardPhone = (e) => setState({ newCardPhone: e.target.value, newCardError: "" });
  const issueCard = async () => {
    const label = state.newCardLabel.trim();
    const funding = usdFundingQuery.data;
    const firstName = state.newCardFirstName.trim();
    const lastName = state.newCardLastName.trim();
    const email = state.newCardEmail.trim();
    const phone = state.newCardPhone.trim();
    if (!funding) {
      setState({
        newCardError:
          "Open an active USD deposit account first — every card must be linked to USD.",
      });
      return;
    }
    if (!label) {
      setState({ newCardError: "Enter a card label." });
      return;
    }
    if (!firstName || !lastName) {
      setState({ newCardHolderOpen: true, newCardError: "Enter the cardholder’s first and last name." });
      return;
    }
    if (!isValidCardholderEmail(email)) {
      setState({ newCardHolderOpen: true, newCardError: "Enter a valid cardholder email." });
      return;
    }
    if (!isValidCardE164(phone)) {
      setState({
        newCardHolderOpen: true,
        newCardError: "Enter phone in E.164 format (e.g. +12125550198).",
      });
      return;
    }
    setState({ newCardIssuing: true, newCardError: "" });
    try {
      const issued = await cardsApi.create(funding.entityId, funding.accountId, {
        type: "virtual",
        reference: newCardReference(label),
        card_name: label,
        cardholder: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: phone,
        },
      });
      persistCardColor(issued.id, state.newCardColor);
      await queryClient.invalidateQueries({ queryKey: [QK.issuedCards] });
      setState({
        newCardIssuing: false,
        newCardDone: true,
        newlyIssuedCard: issued,
        selectedCardId: issued.id,
      });
    } catch (err) {
      setState({
        newCardIssuing: false,
        newCardError:
          err instanceof Error ? err.message : "Couldn't issue this card.",
      });
    }
  };
  /** Default for the create modal: first palette colour no card uses (spec §5). */
  const nextColorForNewCard = (): CardColorKey => {
    const existing = issuedCardsQuery.data?.cards ?? [];
    const resolved = resolveCardColors(existing, cardColorsQuery.data ?? {});
    const newestFirst = [...existing]
      .sort((x, y) => String(y.created_at || "").localeCompare(String(x.created_at || "")))
      .map((c) => ({ color: resolved[c.id] }));
    return nextCardColor(newestFirst);
  };
  /** Colour is chosen once, at issue time, and saved against the new card id. */
  const persistCardColor = (cardId: string, color: CardColorKey) => {
    queryClient.setQueryData<CardColorMap>([QK.cardColors], (m) => ({ ...(m ?? {}), [cardId]: color }));
    // Fire and forget: a failed save leaves the card on its resolved fallback.
    void saveCardColor(cardId, color)
      .then((map) => queryClient.setQueryData([QK.cardColors], map))
      .catch(() => undefined);
  };
  const toggleFreezeCard = async (cardId: string = state.selectedCardId) => {
    const funding = usdFundingQuery.data;
    const card = (issuedCardsQuery.data?.cards ?? []).find((c) => c.id === cardId);
    if (!funding || !card) return;
    setState({ cardFreezeBusy: true, cardFreezeError: "", selectedCardId: cardId });
    try {
      const frozen = isCardFrozenStatus(card.status);
      const updated = frozen
        ? await cardsApi.unfreeze(funding.entityId, funding.accountId, card.id)
        : await cardsApi.freeze(funding.entityId, funding.accountId, card.id);
      const patched = {
        ...(issuedCardsQuery.data || {
          entity_id: funding.entityId,
          account_id: funding.accountId,
          cards: [] as IssuedCard[],
        }),
        cards: (issuedCardsQuery.data?.cards ?? []).map((row) =>
          row.id === updated.id ? { ...row, ...updated, number: null, cvv: null } : row,
        ),
      };
      queryClient.setQueryData(
        [QK.issuedCards, funding.entityId, funding.accountId],
        patched,
      );
      await queryClient.invalidateQueries({ queryKey: [QK.issuedCards] });
      await queryClient.invalidateQueries({ queryKey: [QK.cardTransactions] });
      setState({
        cardFreezeBusy: false,
        cardFreezeError: "",
        selectedCardId: updated.id,
      });
    } catch (err) {
      // Own field: the card detail modal renders this one. `newCardError` only
      // surfaces inside the issue-card modal, so a failed toggle looked silent.
      setState({
        cardFreezeBusy: false,
        cardFreezeError:
          err instanceof Error ? err.message : "Couldn't update card freeze state.",
      });
    }
  };
  const revealCardSecrets = async () => {
    const funding = usdFundingQuery.data;
    const cardId = state.selectedCardId;
    if (!funding || !cardId) return;
    const abandoned = revealGuard.begin(MODAL_REVEAL_KEY);
    setState({ cardSecretsBusy: true, cardSecretsError: "", copiedField: "" });
    try {
      const revealed = await cardsApi.credentials(
        funding.entityId,
        funding.accountId,
        cardId,
      );
      // Modal closed, card switched, or the window elapsed while we waited —
      // the busy flag is already cleared by whoever dismissed it.
      if (abandoned()) return;
      const number = String(revealed.number || "").trim();
      const cvv = String(revealed.cvv || "").trim();
      if (!number || !cvv) {
        setState({
          cardSecretsBusy: false,
          cardSecretsError: "Card details aren't available right now.",
        });
        return;
      }
      setState({
        cardSecretsBusy: false,
        cardSecrets: { number, cvv },
        cardSecretsError: "",
      });
      // Brand is derived from PAN at reveal and persisted upstream — refresh list marks.
      await queryClient.invalidateQueries({ queryKey: [QK.issuedCards] });
    } catch (err) {
      if (abandoned()) return;
      setState({
        cardSecretsBusy: false,
        cardSecretsError:
          err instanceof Error ? err.message : "Couldn't load card details.",
      });
    }
  };
  const hideCardSecrets = useCallback(() => {
    revealGuard.invalidate(MODAL_REVEAL_KEY);
    setState({
      cardSecrets: null,
      cardSecretsBusy: false,
      cardSecretsError: "",
      copiedField: "",
    });
  }, [revealGuard, setState]);
  const toggleCardSecrets = () => {
    if (state.cardSecrets) {
      hideCardSecrets();
      return;
    }
    void revealCardSecrets();
  };
  const revealCardTileSecrets = async (cardId: string) => {
    const funding = usdFundingQuery.data;
    if (!funding) return;
    const abandoned = revealGuard.begin(cardId);
    setState((s: any) => ({
      cardTileSecretsBusy: { ...s.cardTileSecretsBusy, [cardId]: true },
      cardTileSecretsError: { ...s.cardTileSecretsError, [cardId]: "" },
    }));
    try {
      const revealed = await cardsApi.credentials(funding.entityId, funding.accountId, cardId);
      // Hidden, auto-hidden, or navigated away from while in flight. Bail
      // before touching state: whoever dismissed this reveal already cleared
      // the busy flag, and a later reveal may now own the card.
      if (abandoned()) return;
      const number = String(revealed.number || "").trim();
      const cvv = String(revealed.cvv || "").trim();
      if (!number || !cvv) {
        setState((s: any) => ({
          cardTileSecretsBusy: { ...s.cardTileSecretsBusy, [cardId]: false },
          cardTileSecretsError: {
            ...s.cardTileSecretsError,
            [cardId]: "Card details aren't available right now.",
          },
        }));
        return;
      }
      setState((s: any) => ({
        cardTileSecretsBusy: { ...s.cardTileSecretsBusy, [cardId]: false },
        cardTileSecrets: { ...s.cardTileSecrets, [cardId]: { number, cvv } },
        cardTileSecretsError: { ...s.cardTileSecretsError, [cardId]: "" },
      }));
      // Brand is derived from PAN at reveal and persisted upstream — refresh list marks.
      await queryClient.invalidateQueries({ queryKey: [QK.issuedCards] });
    } catch (err) {
      if (abandoned()) return;
      setState((s: any) => ({
        cardTileSecretsBusy: { ...s.cardTileSecretsBusy, [cardId]: false },
        cardTileSecretsError: {
          ...s.cardTileSecretsError,
          [cardId]: err instanceof Error ? err.message : "Couldn't load card details.",
        },
      }));
    }
  };
  /**
   * Purge one card's credentials and turn the tile face-up.
   *
   * Order matters: the PAN/CVV leave client state, they are not merely covered
   * by a CSS rotation. Flipping alone left them readable in React state (and so
   * in any memory dump or devtools session) for the rest of the visit.
   */
  const hideCardTileSecrets = useCallback(
    (cardId: string) => {
      revealGuard.invalidate(cardId);
      setState((s: any) => {
        const secrets = { ...s.cardTileSecrets };
        delete secrets[cardId];
        // Busy must clear too. Leaving it set stranded the tile: the guard now
        // drops the in-flight response, and the re-reveal below is gated on
        // exactly this flag, so the card would sit on "Loading…" forever.
        const busy = { ...s.cardTileSecretsBusy };
        delete busy[cardId];
        return {
          cardTileSecrets: secrets,
          cardTileSecretsBusy: busy,
          cardTileFlipped: { ...s.cardTileFlipped, [cardId]: false },
          cardTileSecretsError: { ...s.cardTileSecretsError, [cardId]: "" },
          copiedField: "",
        };
      });
    },
    [revealGuard, setState],
  );

  const flipCardTile = (cardId: string) => () => {
    const willFlip = !state.cardTileFlipped[cardId];
    if (!willFlip) {
      hideCardTileSecrets(cardId);
      return;
    }
    setState((s: any) => ({ cardTileFlipped: { ...s.cardTileFlipped, [cardId]: true } }));
    if (!state.cardTileSecrets[cardId] && !state.cardTileSecretsBusy[cardId]) {
      void revealCardTileSecrets(cardId);
    }
  };

  // Auto-hide revealed credentials. The window starts when the secrets land,
  // not when the flip begins, so a slow reveal doesn't eat the user's time.
  useSecretExpiry(Object.keys(state.cardTileSecrets), hideCardTileSecrets);

  // The detail modal shows the same PAN/CVV and gets the same window. It
  // already purged on close, so it only needed the timer.
  useSecretExpiry(state.cardSecrets ? [MODAL_REVEAL_KEY] : [], hideCardSecrets);

  // Leaving Cards purges every revealed card. Navigating away is as strong a
  // signal as "hide" that the user is done looking.
  const onCardsScreen = state.screen === "cards";
  useEffect(() => {
    if (onCardsScreen) return;
    // Strand in-flight reveals as well as purging stored values, or a request
    // issued on the Cards screen would repopulate credentials after we left.
    revealGuard.invalidateAll();
    setState((s: any) =>
      Object.keys(s.cardTileSecrets).length === 0 && !s.cardSecrets
        ? {}
        : {
            cardTileSecrets: {},
            cardTileSecretsBusy: {},
            cardTileFlipped: {},
            cardSecrets: null,
            cardSecretsBusy: false,
            copiedField: "",
          },
    );
  }, [onCardsScreen, revealGuard, setState]);
  const fundCard = () =>
    setState({
      modal: "acctDetail",
      acctDetailIntent: "fund",
      selectedAcctKind: "fiat",
      selectedAcctKey: "fiat:USD",
      cardSecrets: null,
      cardSecretsError: "",
    });
  const openInvite = () =>
    setState({
      inviteOpen: true,
      inviteEmail: "",
      inviteRole: "operator" as MembershipRole,
      inviteBusy: false,
      inviteError: "",
    });
  const closeInvite = () => setState({ inviteOpen: false, inviteBusy: false, inviteError: "" });
  const setInviteEmail = (e) => setState({ inviteEmail: e.target.value, inviteError: "" });
  const setInviteRole = (k: MembershipRole) => () => setState({ inviteRole: k });
  const submitInvite = async () => {
    if (!isTeamAdmin || typeof businessId !== "number") return;
    const email = String(state.inviteEmail || "").trim();
    if (!email) return;
    setState({ inviteBusy: true, inviteError: "" });
    try {
      await teamApi.invite(businessId, {
        email,
        role: state.inviteRole as MembershipRole,
        accept_url: defaultTeamAcceptUrl(),
      });
      await queryClient.invalidateQueries({ queryKey: [QK.team, businessId] });
      setState({ inviteOpen: false, inviteBusy: false, inviteError: "" });
    } catch (err) {
      setState({
        inviteBusy: false,
        inviteError: err instanceof ApiRequestError ? err.message : "Couldn't send the invite.",
      });
    }
  };
  const setMemberRole = (userId: number) => async (e) => {
    if (!isTeamAdmin || typeof businessId !== "number") return;
    const role = e.target.value as MembershipRole;
    setState({ teamActionError: "" });
    try {
      await teamApi.updateRole(businessId, userId, role);
      await queryClient.invalidateQueries({ queryKey: [QK.team, businessId] });
      if (userId === myUserId) {
        await queryClient.invalidateQueries({ queryKey: [QK.authMe] });
      }
    } catch (err) {
      setState({
        teamActionError: err instanceof ApiRequestError ? err.message : "Couldn't update the role.",
      });
    }
  };
  const askRemoveMember = (userId: number, label: string) => () =>
    setState({
      teamConfirm: { kind: "remove", id: userId, label },
      teamConfirmBusy: false,
      teamActionError: "",
    });
  const askRevokeInvite = (inviteId: number, label: string) => () =>
    setState({
      teamConfirm: { kind: "revoke", id: inviteId, label },
      teamConfirmBusy: false,
      teamActionError: "",
    });
  const closeTeamConfirm = () => setState({ teamConfirm: null, teamConfirmBusy: false, teamActionError: "" });
  const confirmTeamAction = async () => {
    if (!isTeamAdmin || typeof businessId !== "number" || !state.teamConfirm) return;
    const { kind, id } = state.teamConfirm;
    setState({ teamConfirmBusy: true, teamActionError: "" });
    try {
      if (kind === "remove") {
        await teamApi.remove(businessId, id);
      } else {
        await teamApi.revokeInvite(businessId, id);
      }
      await queryClient.invalidateQueries({ queryKey: [QK.team, businessId] });
      setState({ teamConfirm: null, teamConfirmBusy: false });
    } catch (err) {
      setState({
        teamConfirmBusy: false,
        teamActionError:
          err instanceof ApiRequestError
            ? err.message
            : kind === "remove"
              ? "Couldn't remove the member."
              : "Couldn't revoke the invite.",
      });
    }
  };

  // Voluntary 2FA enrollment (from Team/security) and disable — mandatory
  // post-login setup lives on its own page (app/mfa/setup) since there's no
  // session/dashboard shell to render into at that point.
  const openMfaSetup = () => setState({ modal: "mfaSetup" });
  const onMfaSetupComplete = () => {
    setState({ modal: null });
    queryClient.invalidateQueries({ queryKey: [QK.authMe] });
  };
  const dismissMfaReminder = async () => {
    // Optimistically hide now; `/me` is the source of truth on next load.
    queryClient.setQueryData([QK.authMe], (prev: AuthMe | undefined) =>
      prev?.mfa ? { ...prev, mfa: { ...prev.mfa, should_remind: false } } : prev,
    );
    try {
      await mfaApi.reminderDismissed();
    } catch {
      // Best-effort — worst case the reminder reappears on the next /me fetch.
    }
  };
  const openMfaDisable = () =>
    setState({ modal: "mfaDisable", mfaDisablePassword: "", mfaDisableCode: "", mfaDisableError: "" });
  const closeMfaDisable = () => {
    // Ignore backdrop/Escape while a disable request is in flight — closing
    // and reopening the dialog before it resolves would let the stale
    // response write into (or close) the new dialog.
    if (state.mfaDisableBusy) return;
    setState({ modal: null, mfaDisableBusy: false, mfaDisableError: "" });
  };
  const submitMfaDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    // Don't trim the password itself — a leading/trailing space can be part
    // of the real password, and trimming it here would send a different
    // string than the one the account was created with.
    const password = String(state.mfaDisablePassword || "");
    const code = String(state.mfaDisableCode || "").trim();
    if (!password.trim() || !code) return;
    setState({ mfaDisableBusy: true, mfaDisableError: "" });
    try {
      await mfaApi.disable(password, code);
      await queryClient.invalidateQueries({ queryKey: [QK.authMe] });
      setState({ modal: null, mfaDisableBusy: false, mfaDisablePassword: "", mfaDisableCode: "" });
    } catch (err) {
      setState({
        mfaDisableBusy: false,
        mfaDisableError: err instanceof ApiRequestError ? err.message : "Couldn't disable 2FA.",
      });
    }
  };

  const openCreateApiKeyModal = () => setState({ modal: "apiKey", apiKeyName: "", apiKeyEnvironment: "sandbox", apiKeyError: "" });
  const setApiKeyName = (e) => setState({ apiKeyName: e.target.value });
  const setApiKeyEnvironment = (env: string) => () => setState({ apiKeyEnvironment: env });
  const submitApiKey = async () => {
    if (!state.apiKeyName.trim()) return;
    setState({ apiKeyCreating: true, apiKeyError: "" });
    try {
      const created = await apiKeysApi.create({ name: state.apiKeyName.trim(), environment: state.apiKeyEnvironment });
      queryClient.invalidateQueries({ queryKey: [QK.apiKeys] });
      // Auto-reveal the new key in its own row — it's the only moment the
      // plaintext exists, so it must be visible without an extra click.
      setState((prev: any) => ({
        apiKeyCreating: false,
        modal: null,
        newlyCreatedKey: created,
        apiKeyRevealed: { ...prev.apiKeyRevealed, [created.id]: true },
      }));
    } catch (err) {
      setState({ apiKeyCreating: false, apiKeyError: err instanceof ApiRequestError ? err.message : "Couldn't create the key." });
    }
  };
  const submitCreateAccount = async () => {
    if (!depositEligible) {
      return setState({
        createAccountError: "Complete business verification before issuing currency accounts.",
      });
    }
    if (!state.createAccountName.trim()) {
      return setState({ createAccountError: "Give the account a name." });
    }
    if (state.createAccountKind === "stablecoin") {
      if (!state.createAccountStablecoin || !state.createAccountNetwork) {
        return setState({ createAccountError: "Choose a stablecoin and a network." });
      }
      const currency = state.createAccountStablecoin.trim().toUpperCase();
      const occupied = occupiedStablecoinNetworkCodes(
        bootstrapReady
          ? (bootstrapQuery.data?.stablecoinAccounts ?? [])
          : (stablecoinAccountsQuery.data ?? []),
        currency,
      );
      if (occupied.has(state.createAccountNetwork.trim().toUpperCase())) {
        return setState({
          createAccountError:
            `You already have a ${currency} account on this network.`,
        });
      }
      setState({ createAccountSaving: true, createAccountError: "" });
      try {
        const payload = buildStablecoinOpenPayload({
          currency: state.createAccountStablecoin,
          network: state.createAccountNetwork,
          displayName: state.createAccountName.trim(),
        });
        const entityId = await resolvePrimaryEntityId();
        await entitiesApi.openAccount(entityId, payload);
        queryClient.invalidateQueries({ queryKey: [QK.dashboardBootstrap] });
        queryClient.invalidateQueries({ queryKey: [QK.stablecoinAccounts] });
        queryClient.invalidateQueries({ queryKey: [QK.sendableStablecoinAccounts] });
        setState({ createAccountSaving: false, modal: null });
      } catch (err) {
        setState({
          createAccountSaving: false,
          createAccountError: err instanceof Error ? err.message : "Couldn't create the account.",
        });
      }
      return;
    }
    if (!state.createAccountCurrency) {
      return setState({ createAccountError: "Choose a currency." });
    }
    const occupiedFiat = occupiedFiatCurrencyCodes(
      depositAccountsQuery.data?.accounts ?? [],
    );
    if (occupiedFiat.has(state.createAccountCurrency.trim().toUpperCase())) {
      return setState({
        createAccountError: `You already have a ${state.createAccountCurrency.toUpperCase()} account.`,
      });
    }
    setState({ createAccountSaving: true, createAccountError: "" });
    try {
      await depositAccountsApi.create(
        {
          currency: state.createAccountCurrency,
          accountName: state.createAccountName.trim(),
        },
        supportedFiatCurrencies,
      );
      queryClient.invalidateQueries({ queryKey: [QK.dashboardBootstrap] });
      queryClient.invalidateQueries({ queryKey: [QK.depositAccounts] });
      setState({ createAccountSaving: false, modal: null });
    } catch (err) {
      setState({
        createAccountSaving: false,
        createAccountError: err instanceof Error ? err.message : "Couldn't create the account.",
      });
    }
  };
  const refreshDepositAccount = async (accountId: string) => {
    const synced = await depositAccountsApi.sync(accountId);
    await queryClient.cancelQueries({ queryKey: [QK.dashboardBootstrap] });
    await queryClient.cancelQueries({ queryKey: [QK.depositAccounts] });
    queryClient.setQueryData<DashboardBootstrap | undefined>(
      [QK.dashboardBootstrap],
      (prev) =>
        prev
          ? {
              ...prev,
              fiatAccounts: applySyncedDepositAccount(prev.fiatAccounts, accountId, synced),
            }
          : prev,
    );
    queryClient.setQueryData<DepositAccountListResult | undefined>(
      [QK.depositAccounts],
      (prev) => ({
        ...(prev ?? { accounts: [] }),
        accounts: applySyncedDepositAccount(prev?.accounts, accountId, synced),
      }),
    );
  };
  useEffect(() => {
    if (state.modal !== "acctDetail") return;
    if (state.selectedAcctKind !== "fiat") return;
    if (!state.selectedAcctKey.startsWith("fiat:")) return;
    const currency = state.selectedAcctKey.slice("fiat:".length).trim();
    if (!currency) return;
    const stub =
      (bootstrapQuery.data?.fiatAccounts ?? []).find(
        (row) => (row.currency || "").trim().toUpperCase() === currency.toUpperCase(),
      ) ?? null;
    const overlay =
      (depositAccountsQuery.data?.accounts ?? []).find(
        (row) => (row.currency || "").trim().toUpperCase() === currency.toUpperCase(),
      ) ?? null;
    const account = mergeDepositAccount(stub, overlay);
    if (!account || !needsDepositInstructionsSync(account)) return;
    const id = String(account.id ?? "").trim();
    if (!id || depositInstructionsSyncAttemptedRef.current.has(id)) return;
    depositInstructionsSyncAttemptedRef.current.add(id);
    void refreshDepositAccount(id).catch(() => {
      depositInstructionsSyncAttemptedRef.current.delete(id);
    });
  }, [
    state.modal,
    state.selectedAcctKind,
    state.selectedAcctKey,
    bootstrapQuery.data,
    depositAccountsQuery.data,
  ]);
  const revokeApiKey = (id: number) => async () => {
    await apiKeysApi.revoke(id);
    queryClient.invalidateQueries({ queryKey: [QK.apiKeys] });
  };
  const deleteApiKey = (id: number) => async () => {
    await apiKeysApi.remove(id);
    queryClient.invalidateQueries({ queryKey: [QK.apiKeys] });
  };

  const setBalanceView = (v) => () => setState({ balanceView: v });
  const setDisplayCurrency = (currency: string) => {
    const code = currency.trim().toUpperCase();
    if (!isDisplayCurrency(code)) return;
    const options = displayCurrencyOptionsFromCatalog(
      sendCatalogQuery.data,
      mergeExchangeRates(summaryQuery.data?.fx_rates, exchangeRatesQuery.data),
    );
    if (!options.includes(code)) return;
    writeStoredDisplayCurrency(code);
    setState({ displayCurrency: code });
  };
  /** Send opens on a method chooser. Bank/mobile preselect that rail, then the
   *  flow runs the design's three steps: destination → recipient → review.
   *
   *  Internal transfer jumps to Convert meaning "move a stablecoin balance
   *  into a fiat VA". Convert no longer has a mode to set for that, so the
   *  intent is expressed as a preselected source instead — a funded, non-
   *  Stellar stablecoin account. The route is still derived from the pair,
   *  and the prefill effect fills in a destination that actually routes. */
  const openInternalTransfer = () =>
    setState({
      ...moneyFlowReset,
      modal: "convert",
      moreOpen: false,
      sidebarOpen: false,
      convertSourceAccountId: pickPreferredConvertAccountId(
        resolvedStablecoinAccounts
          .filter(
            (a) =>
              (a.currency === "USDC" || a.currency === "USDT") &&
              isReadyStatus(a.status) &&
              toPartnerNetwork(a.network) !== "Stellar" &&
              a.id,
          )
          .map((a) => ({
            id: String(a.id),
            currency: String(a.currency || "").toUpperCase(),
            balanceAmount: parseBalanceNumber(a.balance),
          })),
      ),
      convertDestAccountId: "",
      convertAmount: "",
      convertQuote: null,
      convertBookPreview: null,
      convertError: "",
      convertHop: 1,
      swapAccepted: false,
      quoteSeconds: 0,
    });
  const chooseSendMethod = (m) => () => {
    if (m === "internal") {
      openInternalTransfer();
      return;
    }
    const common = {
      sendMethod: m,
      sendStep: 1,
      sendCountryIdx: 0,
      sendProviderIdx: 0,
      sendRecipient: "",
      sendRecipientTyped: "",
      sendRecipientName: "", sendRecipientDetails: {}, sendReference: "",
      sendMemo: "",
      sendAmount: "",
      sendAmountCurrency: "USD",
      sendQuoteError: "",
      sendAcceptError: "",
      sendPreview: null,
      sendConfirm: null,
      sendAccountId: "",
      sendAsset: "usdc",
    };
    if (m === "crypto") {
      setState({ ...common, sendGroup: "crypto" });
      return;
    }
    const prefer = m === "mobile" ? "mobile" : "bank";
    const countryIdx = sendCountries.findIndex((c) => c.rails.some((r) => r.type === prefer));
    const idx = countryIdx >= 0 ? countryIdx : 0;
    setState({
      ...common,
      sendGroup: "country",
      sendCountryIdx: idx,
      sendRailIdx: railIndexForMethod(sendCountries[idx]?.rails, m),
    });
  };

    const s = state;
    const boostDark = props.boostDarkContrast ?? true;
    const vars = s.theme === "dark" ? (boostDark ? { ...DARK, ...DARK_HC_OVERRIDES } : DARK) : LIGHT;

    const titles: Record<string, [string, string]> = {
      home: ["Home", "Your balances, actions, and activity at a glance"],
      wallets: ["Accounts", "Bank and stablecoin accounts for your business"],
      accountDetail: ["Account", "Balance, details, and activity for this account"],
      cards: ["Cards", "Virtual USD cards for team spend"],
      transactions: ["Transactions", "Every payout, deposit, and swap across rails"],
      invoices: ["Invoices", "Create and manage payment requests across every payment method"],
      reports: ["Statements", "Download period statements for reconcile and books"],
      verification: ["Verification", "Submit once — then track compliance feedback"],
      team: ["Team", "Invite teammates and manage their access"],
      developer: ["Developer", "API keys and webhooks"],
      send: ["Send money", "Pay a bank account, mobile money wallet or stablecoin wallet"],
      deposit: [
        s.fundAfricanTargetCurrency
          ? `Fund ${s.fundAfricanTargetCurrency}`
          : "Top up balance",
        s.fundAfricanTargetCurrency
          ? "Fund via African rails"
          : "Add funds from any supported rail",
      ],
      receive: ["Receive globally", "Share IBAN, Paybill, or wallet details"],
      convert: ["Convert", "Swap fiat and stablecoin at a locked quote"],
    };
    const [currentTitle, currentSubtitle] = titles[s.screen] || titles.wallets;

    const emptyCorridor: CatalogCorridorCountry = {
      code: "",
      name: "",
      iso: "",
      rails: [],
    };
    const sendCountryChips = sendCountries.map((c, i) => ({
      idx: i,
      flagUrl: flagUrl(c.iso), name: c.name, code: c.code, select: selectSendCountry(i),
      bg: i === s.sendCountryIdx ? "var(--indigo-tint)" : "var(--surface2)", border: i === s.sendCountryIdx ? "var(--indigo)" : "transparent",
      selectSend: selectSendCountry(i), sendBg: i === s.sendCountryIdx ? "var(--indigo-tint)" : "var(--surface2)", sendBorder: i === s.sendCountryIdx ? "var(--indigo)" : "transparent",
      _rails: c.rails,
    })).filter((c) => {
      if (s.sendMethod === "mobile") return c._rails.some((r) => r.type === "mobile");
      if (s.sendMethod === "bank") return c._rails.some((r) => r.type === "bank");
      return true;
    });
    const sendCountry = sendCountries[s.sendCountryIdx] || sendCountries[0] || emptyCorridor;
    const sendRailChips = sendCountry.rails.map((r, i) => ({ label: r.label, select: selectSendRail(i), selected: i === s.sendRailIdx, bg: i === s.sendRailIdx ? "var(--ink)" : "var(--surface2)", color: i === s.sendRailIdx ? "var(--bg)" : "var(--ink)" }));
    const sendRail = sendCountry.rails[s.sendRailIdx] || sendCountry.rails[0] || {
      type: "bank" as const,
      label: "Bank transfer",
      options: [] as string[],
      field: "Recipient account number",
      placeholder: "Account number",
      arrival: "Arrives within 1 business day",
    };
    const sendCatalogProviders = offRampProvidersForRail(
      sendCatalogQuery.data,
      sendCountry.iso,
      sendRail.type,
      sendCountry.code,
    );
    const sendPayoutRails = sendPayoutContext(s.sendCountryIdx, s.sendRailIdx, s.sendProviderIdx);
    const sendProviderOptions = sendPayoutRails
      ? sendPayoutRails.rails.map((d) => d.name)
      : providerNamesFromCatalog(sendCatalogProviders);
    const sendProviderIdx =
      sendProviderOptions.length === 0
        ? 0
        : Math.min(s.sendProviderIdx, sendProviderOptions.length - 1);
    const sendProvider = sendProviderOptions[sendProviderIdx] || sendProviderOptions[0] || "";
    const sendProviderChips = sendProviderOptions.map((name, i) => ({
      name,
      select: selectSendProvider(i),
      bg: i === sendProviderIdx ? "var(--indigo-tint)" : "var(--surface2)",
      border: i === sendProviderIdx ? "var(--indigo)" : "transparent",
    }));

    const depositCountryPicked = s.depositCountryIdx >= 0 && Boolean(depositCountries[s.depositCountryIdx]);
    const depositCountry = depositCountries[s.depositCountryIdx] || depositCountries[0] || emptyCorridor;
    const depositRail = depositCountry.rails[s.depositRailIdx] || depositCountry.rails[0] || {
      type: "bank" as const,
      label: "Bank transfer",
      options: [] as string[],
      field: "Recipient account number",
      placeholder: "Account number",
      arrival: "Arrives within 1 business day",
    };
    const depositCatalogProviders = onRampProvidersForRail(
      sendCatalogQuery.data,
      depositCountry.iso,
      depositRail.type,
      depositCountry.code,
    );
    const depositProviderOptions = providerNamesFromCatalog(depositCatalogProviders);
    const depositProvider = resolveQuotedProviderName(
      depositProviderOptions,
      s.depositProviderName,
    );
    const depositProviderIdx = indexOfProviderName(depositProviderOptions, s.depositProviderName);
    const depositCountryRows = depositCountries.map((c, i) => {
      const extraNames = c.rails.flatMap((rail) => {
        const catalog = onRampProvidersForRail(
          sendCatalogQuery.data,
          c.iso,
          rail.type,
          c.code,
        );
        return catalog ? catalog.map((p) => p.name) : [];
      });
      return {
        idx: i,
        flagUrl: flagUrl(c.iso),
        name: c.name,
        code: c.code,
        railsLabel: countryRailsLabel(c),
        searchText: countrySearchHaystack(c, extraNames),
        railTypes: Array.from(
          new Set(c.rails.map((rail) => (isMobileMoneyRail(rail.type) ? "mobile" : "bank") as "mobile" | "bank")),
        ),
        providerNames: Array.from(
          new Set(extraNames.length ? extraNames : c.rails.flatMap((rail) => rail.options)),
        ),
        select: selectDepositCountry(i),
      };
    });
    const depositMethodGroups = depositCountryPicked
      ? depositCountry.rails.map((rail, railIdx) => {
          const catalogProviders = onRampProvidersForRail(
            sendCatalogQuery.data,
            depositCountry.iso,
            rail.type,
            depositCountry.code,
          );
          const options = ensureSelectedProvider(
            providerNamesFromCatalog(catalogProviders),
            s.depositRailIdx === railIdx ? s.depositProviderName : "",
          );
          return {
            railIdx,
            type: rail.type,
            label: rail.label,
            providers: options.map((name, providerIdx) => ({
              name,
              displayLabel: isMobileMoneyRail(rail.type)
                ? mobileMoneyDisplayLabel(name)
                : name,
              selected:
                s.depositRailIdx === railIdx &&
                indexOfProviderName([name], s.depositProviderName) === 0,
              select: selectDepositMethod(railIdx, providerIdx, name),
            })),
          };
        })
      : [];

    const bulkCountryChips = sendCountries.slice(0, 10).map((c, i) => ({
      flagUrl: flagUrl(c.iso), code: c.code, toggleBulk: toggleBulkCountry(i),
      bulkBg: s.bulkSelected.includes(i) ? "var(--indigo-tint)" : "var(--surface2)",
      bulkBorder: s.bulkSelected.includes(i) ? "var(--indigo)" : "transparent",
    }));

    const decorateTx = (t: Transaction) => {
      return {
        ...presentTransaction(t),
        openDetail: openTxDetail(t.id),
      };
    };
    const cardSpendTransactions = (
      cardTransactionsQuery.data?.transactions ?? []
    ).map(mapCardTransactionToTransaction);
    const collectEventTimes = collectEventTimesQuery.data ?? [];
    const feedTransactions = (() => {
      const base = applyCollectEventTimes(
        transactionsQuery.data?.items ?? [],
        collectEventTimes,
      );
      const seen = new Set(base.map((row) => String(row.id)));
      const extras = cardSpendTransactions.filter((row) => !seen.has(String(row.id)));
      return [...extras, ...base].sort((a, b) => {
        const delta = activityInstantMs(b.created_at) - activityInstantMs(a.created_at);
        if (delta !== 0) return delta;
        return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
      });
    })();
    const decoratedAll = feedTransactions.map(decorateTx);
    const txUsesLatestFifty =
      s.txFilter === "incoming" ||
      s.txFilter === "outgoing" ||
      Boolean(s.txSearch.trim()) ||
      s.txCurrency !== "all" ||
      s.txDateRange !== "all";
    const latestFiftyMatches = searchTransactions(feedTransactions, {
      primary: s.txFilter,
      query: s.txSearch,
      currency: s.txCurrency,
      dateRange: s.txDateRange,
    }).map(decorateTx);
    const pageTransactions = applyCollectEventTimes(
      transactionsPageQuery.items,
      collectEventTimes,
    ).map(decorateTx);
    // Deposit account status pills — balances come from partner `balance`
    // when present (see docs/api-contract.md / lib/services/balances.ts).
    const depositStatusPalette: Record<string, [string, string]> = {
      active: ["var(--indigo-text)", "var(--indigo-tint)"],
      pending: ["var(--amber)", "var(--amber-tint)"],
      unavailable: ["var(--red)", "var(--red-tint)"],
      deposit_unavailable: ["var(--red)", "var(--red-tint)"],
      closed: ["var(--muted)", "var(--surface2)"],
    };
    const depositStatusColors = (status: string): [string, string] =>
      depositStatusPalette[status] || ["var(--muted)", "var(--surface2)"];
    const depositAccountsList = listedDepositAccounts(
      bootstrapReady
        ? (bootstrapQuery.data?.fiatAccounts ?? [])
        : (depositAccountsQuery.data?.accounts ?? []),
    );
    const stablecoinAccountsList = visibleStablecoinAccounts(
      bootstrapReady
        ? (bootstrapQuery.data?.stablecoinAccounts ?? [])
        : (stablecoinAccountsQuery.data ?? []),
    );
    const occupiedFiatCodes = occupiedFiatCurrencyCodes(depositAccountsList);
    const occupiedStablecoinSlotKeys = occupiedStablecoinSlots(stablecoinAccountsList);
    const selectedFiatCurrency =
      s.selectedAcctKind === "fiat" && s.selectedAcctKey.startsWith("fiat:")
        ? s.selectedAcctKey.slice("fiat:".length)
        : null;
    const selectedDepositAccount = selectedFiatCurrency
      ? mergeDepositAccount(
          depositAccountsList.find(
            (a) => a.currency.toUpperCase() === selectedFiatCurrency,
          ) ?? null,
          (depositAccountsQuery.data?.accounts ?? []).find(
            (a) => a.currency.toUpperCase() === selectedFiatCurrency,
          ) ?? null,
        )
      : null;
    const selectedStablecoinAccount =
      s.selectedAcctKind === "stablecoin" && s.selectedAcctKey.startsWith("stablecoin:")
        ? stablecoinAccountsList.find(
            (a) => a.id === s.selectedAcctKey.slice("stablecoin:".length),
          ) ?? null
        : null;
    // Stellar USDC home — Collect EVM rails credit this account after CCTP.
    const collectHomeAccount =
      stablecoinAccountsList.find(
        (a) =>
          isFundableStablecoinAccount(a) &&
          a.currency.trim().toUpperCase() === "USDC" &&
          isStellarUsdcRail({ network: a.network, currency: a.currency }),
      ) ?? null;
    const collectFundSurfaceOpen =
      s.modal === "fundStablecoin" ||
      s.modal === "fundChooser" ||
      (s.modal === "acctDetail" && s.acctDetailIntent === "fund") ||
      (s.modal === "deposit" && s.depositGroup === "crypto");
    const collectDepositInstructionsQuery = useQuery({
      queryKey: [
        "collect-deposit-instructions",
        collectHomeAccount?.entityId ?? "",
        collectHomeAccount?.id ?? "",
      ],
      queryFn: () =>
        entitiesApi.depositInstructions(
          String(collectHomeAccount!.entityId),
          String(collectHomeAccount!.id),
        ),
      retry: false,
      enabled:
        collectFundSurfaceOpen &&
        Boolean(collectHomeAccount?.entityId && collectHomeAccount?.id),
    });
    const selectedFiatUnavailable =
      selectedDepositAccount?.status === "deposit_unavailable" ||
      selectedDepositAccount?.status === "unavailable";
    const stellarWalletPaymentsQuery = useStellarWalletPaymentsForAccounts(
      stablecoinAccountsList.map((account) => ({
        id: account.id,
        network: account.network,
        currency: account.currency,
        walletAddress: account.walletAddress,
      })),
      { limit: 25 },
    );
    const elementTxHashes = collectPresentedTxHashes(decoratedAll);
    const unmatchedOnchainRows = presentUnmatchedOnchainPayments({
      payments: stellarWalletPaymentsQuery.payments.map((row) => ({
        network: row.network,
        payment: row.payment,
      })),
      elementTxHashes,
      onOpenDetail: openOnchainTxDetail,
    });
    const filteredOnchainRows = filterPresentedActivityRows(unmatchedOnchainRows, {
      primary: s.txFilter,
      query: s.txSearch,
      currency: s.txCurrency,
      dateRange: s.txDateRange,
    });
    // Paginated All page 1: include Horizon-only rows without changing order offsets.
    // Pending/Failed pages stay ElementPay-only. Local filters merge into latest-50 mode.
    // Prefer the /v1/transactions feed (includes payment backfill) over the
    // paginated /v1/orders page when both cover the same first-page rows.
    const filteredTransactions = txUsesLatestFifty
      ? mergePresentedActivityRows(latestFiftyMatches, filteredOnchainRows)
      : s.txFilter === "all" && transactionsPageQuery.pageNumber === 1
        ? mergePresentedActivityRows(
            decoratedAll.length ? decoratedAll : pageTransactions,
            unmatchedOnchainRows,
          )
        : pageTransactions;
    // Fetched by id (txDetailQuery), independent of the list above — see
    // openTxDetail. Falls back to the list's cached copy while the detail
    // fetch is in flight so the modal isn't blank on first open.
    // Horizon-only wallet rows use `onchain:<hash>` and skip the API.
    const listTxDetail =
      decoratedAll.find((t) => t.id === s.selectedTxId) ??
      filteredTransactions.find((t) => t.id === s.selectedTxId);
    const apiTxDetail = txDetailQuery.data
      ? decorateTx(applyCollectEventTimes([txDetailQuery.data], collectEventTimes)[0] ?? txDetailQuery.data)
      : null;
    const txDetailBase = apiTxDetail ?? listTxDetail;
    const txLiveStatus =
      s.modal === "txDetail" &&
      txDetailBase &&
      selectedTxIsMerchantOrder &&
      !txStatusQuery.isTerminal
        ? {
            label: txStatusQuery.isFrozen ? "Frozen — needs review" : "Tracking live — updates automatically",
            isFetching: txStatusQuery.isFetching,
          }
        : null;
    const acctDetail = selectedDepositAccount
      ? (() => {
          const view = mapDepositAccountToCardView(selectedDepositAccount);
          const [statusColor, statusSoft] = depositStatusColors(view.status);
          const rows = buildDepositAccountDetailRows(selectedDepositAccount);
          const sections = buildDepositAccountDetailSections(selectedDepositAccount);
          return {
            currency: view.currency,
            name: view.name,
            status: view.status,
            beneficiary: selectedDepositAccount.account_holder_name?.trim() || null,
            flagUrl: view.iso ? flagUrl(view.iso) : null,
            statusLabel: view.statusLabel,
            statusColor,
            statusSoft,
            balance: view.balance,
            balanceSub: view.hasBalance ? "Available balance" : "Balance not yet available",
            rows,
            sections,
            instructions: selectedDepositAccount.instructions,
            deposit_reference_required:
              selectedDepositAccount.deposit_reference_required === true,
            deposit_disclaimer: resolveDepositDisclaimer(selectedDepositAccount),
            railLabel: fiatRailForCurrency(view.currency),
            showConvert: true,
            showDownloadLetter: rows.length > 0,
            accountId: selectedDepositAccount.id ? String(selectedDepositAccount.id) : null,
          };
        })()
      : selectedStablecoinAccount
        ? (() => {
            const networkLabel = formatNetworkLabel(selectedStablecoinAccount.network);
            const statusKey = stablecoinStatusTone(selectedStablecoinAccount.status);
            const [statusColor, statusSoft] = depositStatusColors(statusKey);
            const rows = buildStablecoinAccountDetailRows(selectedStablecoinAccount);
            return {
              currency: selectedStablecoinAccount.currency,
              name: `${selectedStablecoinAccount.currency} · ${networkLabel}`,
              beneficiary: null as string | null,
              flagUrl: null as string | null,
              statusLabel: describeStablecoinAccountStatus(selectedStablecoinAccount.status),
              statusColor,
              statusSoft,
              balance: formatAccountBalance(selectedStablecoinAccount.balance, {
                maximumFractionDigits: 6,
              }),
              balanceSub: formatAccountBalance(selectedStablecoinAccount.balance) !== "—"
                ? "Available balance"
                : "Balance not yet available",
              rows,
              sections: [{ title: "Account", rows }],
              instructions: null as string | null,
              railLabel: `Stablecoin · ${networkLabel}`,
              showConvert: ["USDC", "USDT"].includes(
                String(selectedStablecoinAccount.currency || "").toUpperCase(),
              ),
              showDownloadLetter: false,
            };
          })()
      : null;
    // The hero already shows the balance and the identity line the rail and
    // status, so the summary strip only carries rows that add something.
    const repeatsHero = (label: string) => /balance|^rail$|^status$/i.test(label.trim());
    const acctDetailLines = (acctDetail?.rows ?? [])
      .filter((row) => !row.copyValue && !repeatsHero(row.label))
      .slice(0, 3)
      .map((row) => ({ k: row.label, v: row.value }));
    const issuedCardsList = issuedCardsQuery.data?.cards ?? [];
    const cardColorKeys = resolveCardColors(issuedCardsList, cardColorsQuery.data ?? {});
    const cardSel =
      issuedCardsList.find((c) => c.id === s.selectedCardId) || null;
    const usdFunding: UsdFundingAccount | null = usdFundingQuery.data ?? null;
    const usdSpendLabel =
      usdFunding && usdFunding.balanceLabel !== "—"
        ? `$${usdFunding.balanceLabel}`
        : "—";
  const rootStyle: React.CSSProperties = { minHeight: "100vh", position: "relative", background: "var(--bg)", color: "var(--ink)", fontFamily: "'DM Sans',sans-serif", ...vars };
  const themeIcon = s.theme === "dark" ? "☀" : "☾";
  const isHome = s.screen === "home";
  const isWallets = s.screen === "wallets";
  const isAccountDetail = s.screen === "accountDetail";
  const isCards = s.screen === "cards";
  const isTransactions = s.screen === "transactions";
  const isInvoices = s.screen === "invoices";
  const isReports = s.screen === "reports";
  const isVerification = s.screen === "verification";
  const isTeam = s.screen === "team";
  const isDeveloper = s.screen === "developer";
  const balanceViewTabs = ["all","fiat","stablecoin"].map(v => ({ key: v, label: v === "all" ? "All" : v === "fiat" ? "Fiat" : "Stablecoin", select: setBalanceView(v), bg: s.balanceView === v ? "#fff" : "transparent", color: s.balanceView === v ? "var(--indigo)" : "#fff" }));
  const fiatLedgerItems = depositAccountsList.map((a) => ({
    currency: a.currency,
    balance: a.balance,
  }));
  const stableLedgerItems = stablecoinAccountsList.map((a) => ({
    currency: a.currency,
    balance: a.balance,
  }));
  const homeAvailableLedgerItems =
    s.balanceView === "stablecoin"
      ? stableLedgerItems.filter((a) => (a.currency || "").toUpperCase() === "USDC")
      : s.balanceView === "fiat"
        ? fiatLedgerItems
        : [...fiatLedgerItems, ...stableLedgerItems];
  const homeFxRates = mergeExchangeRates(
    bootstrapQuery.data?.fxRates,
    summaryQuery.data?.fx_rates,
    exchangeRatesQuery.data,
  );
  const displayCurrencyOptions = displayCurrencyOptionsFromCatalog(
    sendCatalogQuery.data,
    homeFxRates,
  );
  const displayCurrency: DisplayCurrency = resolveDisplayCurrency(
    s.displayCurrency,
    displayCurrencyOptions,
  );
  const homeDisplayTotal = totalBalanceInDisplayCurrency(
    homeAvailableLedgerItems,
    displayCurrency,
    homeFxRates,
    { maximumFractionDigits: 2 },
  );
  const homeUsdTotal = totalBalanceInDisplayCurrency(
    homeAvailableLedgerItems,
    "USD",
    homeFxRates,
    { maximumFractionDigits: 2 },
  );
  const homeHeroLabel = formatHeroTotalLabel(homeDisplayTotal.total, displayCurrency, {
    maximumFractionDigits: 2,
  });
  const homeUsdSub =
    displayCurrency === "USD"
      ? null
      : formatUsdEquivalentSub(homeUsdTotal.total);
  // Sourced from processing-status transactions (same data the "Pending"
  // filter on Transactions uses) rather than account balance deltas — a
  // pending deposit often hasn't moved an account's current/available
  // balance yet, so the delta-based total silently missed real pending rows.
  const homePendingUsd = transactionsQuery.isSuccess
    ? pendingAmountFromTransactions(transactionsQuery.data?.items ?? [], homeFxRates)
    : null;
  const awaitingSettlementLabel = formatHomeCashFlowUsd(homePendingUsd);
  // Fiat IBAN chips + partner stablecoin account chips.
  const fiatBalanceRows = depositAccountsList.map((a) => {
    const view = mapDepositAccountToCardView(a);
    return { flagUrl: view.iso ? flagUrl(view.iso) : null, code: view.currency, balance: view.balance };
  });
  const stableBalanceRows = stablecoinAccountsList.map((a) => ({
    flagUrl: null as string | null,
    network: a.network,
    code: `${a.currency}/${formatNetworkLabel(a.network)}`,
    balance: formatAccountBalance(a.balance, { maximumFractionDigits: 2 }),
  }));
  const homeCurrencyChips =
    s.balanceView === "stablecoin"
      ? stableBalanceRows
      : s.balanceView === "fiat"
        ? fiatBalanceRows
        : [...fiatBalanceRows, ...stableBalanceRows];
  // Unknown while /auth/me is in flight — distinct from a real "pending" KYB
  // status, so we don't flash "Start verification" for already-approved businesses.
  const kybStatusLoading = (meQuery.isLoading || meQuery.isPending) && !meQuery.data;
  const kybStatus = kybStatusLoading
    ? undefined
    : ((meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? "pending");
  const kybApproved = isKybApproved(kybStatus);
  const showStellarLiquidityPanel = SHOW_STELLAR_LIQUIDITY_PANEL && isTeamAdmin;
  const bulkPayoutSourceAccounts = stablecoinAccountsList.filter(
    (account) => isReadyStatus(account.status) && toPartnerNetwork(account.network) === "Stellar",
  );
  const quickActionTiles = [
        { label: "Send money", icon: "↗", desc: "Pay anyone by bank, mobile money or stablecoin.", open: guardMoneyModal("send"), iconBg: "var(--indigo)", iconColor: "var(--indigo-on)" },
        { label: "Bulk payout", icon: "⇉", desc: (MIXED_RAIL_BULK_PAYOUTS_ENABLED || STELLAR_BULK_PAYOUTS_ENABLED) ? (MIXED_RAIL_BULK_PAYOUTS_ENABLED ? "Pay many recipients at once from one file." : "CSV disbursements from your Stellar wallet.") : "Coming soon — join the waitlist.", open: guardMoneyModal("bulk"), iconBg: "var(--ink-panel)", iconColor: "#fff" },
        { label: "Get paid", icon: "↙", desc: "Share account details to receive local currency or USDC.", open: guardScreenNav("wallets"), iconBg: "var(--amber)", iconColor: "#fff" },
        { label: "Add money", icon: "＋", desc: "Top up by bank, mobile money or stablecoin.", open: guardMoneyModal("deposit"), iconBg: "var(--indigo-tint)", iconColor: "var(--indigo-text)" },
      ];
  const liveRates = liveRateRowsFromSummary(homeFxRates);
  // Money in/out: FX-convert completed Mboka txs (last 30d). Do not use raw
  // summary totals — those sum mixed fiats and were shown as fake-looking `$`.
  const homeMoneyFlow = transactionsQuery.isSuccess
    ? moneyFlowFromTransactions(transactionsQuery.data?.items ?? [], homeFxRates)
    : { moneyInUsd: null, moneyOutUsd: null };
  const goTxCashFlow = (
    filter: PrimaryTransactionFilter,
    dateRange: "all" | "7d" | "30d" = "30d",
  ) =>
    () =>
      setState({
        screen: "transactions",
        sidebarOpen: false,
        moreOpen: false,
        txFilter: filter,
        txDateRange: dateRange,
        txSearch: "",
        txCurrency: "all",
      });
  const homeStats = [
        {
          label: "Money in · 30 days",
          value: formatHomeCashFlowUsd(homeMoneyFlow.moneyInUsd),
          icon: "↑",
          iconBg: "var(--indigo-tint)",
          iconColor: "var(--indigo-text)",
          onOpen: goTxCashFlow("incoming", "30d"),
          ariaLabel: "View incoming transactions for the last 30 days",
        },
        {
          label: "Money out · 30 days",
          value: formatHomeCashFlowUsd(homeMoneyFlow.moneyOutUsd),
          icon: "↓",
          iconBg: "var(--surface3)",
          iconColor: "var(--muted)",
          onOpen: goTxCashFlow("outgoing", "30d"),
          ariaLabel: "View outgoing transactions for the last 30 days",
        },
        {
          label: "Awaiting settlement",
          value: awaitingSettlementLabel,
          icon: "◔",
          iconBg: "var(--amber-tint)",
          iconColor: "var(--amber)",
          onOpen: goTxCashFlow("processing", "all"),
          ariaLabel: "View pending transactions awaiting settlement",
        },
      ];
  const homeBalanceSub = !homeCurrencyChips.length
    ? "Balance not yet available"
    : homeDisplayTotal.excluded.length
      ? `Across all wallets and accounts · excludes ${homeDisplayTotal.excluded.join(", ")}`
      : "Across all wallets and accounts";
  const homeRecent = mergePresentedActivityRows(decoratedAll, unmatchedOnchainRows, 4);
  const fiatAccountCards = depositAccountsList.map((a) => {
    const view = mapDepositAccountToCardView(a);
    const [statusColor, statusSoft] = depositStatusColors(view.status);
    const key = `fiat:${view.currency.toUpperCase()}`;
    return {
      key,
      currency: view.currency,
      name: view.name,
      label: view.name,
      flagUrl: view.iso ? flagUrl(view.iso) : null,
      rail: fiatRailForCurrency(view.currency),
      balance: view.balance,
      detail: view.primaryDetail,
      statusLabel: view.statusLabel,
      statusColor,
      statusSoft,
      openDetail: openAcctDetail("fiat", key),
    };
  });
  const stablecoinAccountCards = stablecoinAccountsList.map((a) => {
    const networkLabel = formatNetworkLabel(a.network);
    const statusKey = stablecoinStatusTone(a.status);
    const [statusColor, statusSoft] = depositStatusColors(statusKey);
    const key = `stablecoin:${a.id}`;
    const balance = formatAccountBalance(a.balance, { maximumFractionDigits: 2 });
    return {
      key,
      currency: a.currency,
      name: a.currency,
      label: `${a.currency} · ${networkLabel}`,
      flagUrl: null as string | null,
      network: a.network,
      rail: `Stablecoin · ${networkLabel}`,
      balance,
      detail: networkLabel,
      statusLabel: describeStablecoinAccountStatus(a.status),
      statusColor,
      statusSoft,
      openDetail: openAcctDetail("stablecoin", key),
    };
  });
  const accounts = [...fiatAccountCards, ...stablecoinAccountCards];
  const accountsCount = accounts.length;
  const depositEligibilityErrorMessage = bootstrapReady
    ? undefined
    : depositEligibilityQuery.isError
      ? (depositEligibilityQuery.error instanceof Error
          ? depositEligibilityQuery.error.message
          : "Couldn't check account eligibility. Try again.")
      : bootstrapQuery.isError
        ? (bootstrapQuery.error instanceof Error
            ? bootstrapQuery.error.message
            : "Couldn't load accounts. Try again.")
        : undefined;
  const depositAccountsErrorMessage =
    !bootstrapReady &&
    (depositAccountsQuery.isError || stablecoinAccountsQuery.isError)
      ? (depositAccountsQuery.error instanceof Error
          ? depositAccountsQuery.error.message
          : stablecoinAccountsQuery.error instanceof Error
            ? stablecoinAccountsQuery.error.message
            : "Couldn't load currency accounts. Try again.")
      : undefined;
  const walletsRecent = mergePresentedActivityRows(decoratedAll, unmatchedOnchainRows, 5);
  const elementAccountDetailRecent = recentActivityForFinancialAccount(decoratedAll, {
    financialAccountId:
      selectedStablecoinAccount?.id ?? selectedDepositAccount?.id ?? null,
    walletAddress: selectedStablecoinAccount?.walletAddress ?? null,
  });
  const selectedAccountOnchainPayments = selectedStablecoinAccount
    ? stellarWalletPaymentsQuery.payments
        .filter((row) => row.accountId === selectedStablecoinAccount.id)
        .map((row) => row.payment)
    : [];
  const accountDetailRecent =
    selectedStablecoinAccount &&
    Boolean(selectedStablecoinAccount.walletAddress) &&
    isStellarUsdcRail({
      network: selectedStablecoinAccount.network,
      currency: selectedStablecoinAccount.currency,
    })
      ? stellarWalletPaymentsQuery.isFetched
        ? mergeWalletPaymentsWithElementActivity({
            payments: selectedAccountOnchainPayments,
            elementActivity: elementAccountDetailRecent,
            network: selectedStablecoinAccount.network,
            limit: 25,
            onOpenDetail: openOnchainTxDetail,
          })
        : elementAccountDetailRecent.slice(0, 5)
      : elementAccountDetailRecent.slice(0, 5);
  const onchainSelectedHash = parseOnchainTxDetailId(s.selectedTxId);
  const onchainTxDetail =
    onchainSelectedHash
      ? (() => {
          const match = stellarWalletPaymentsQuery.payments.find(
            (row) =>
              row.payment.txHash.toLowerCase() === onchainSelectedHash.toLowerCase(),
          );
          return match
            ? presentOnchainWalletPayment(match.payment, {
                network: match.network,
              })
            : null;
        })()
      : null;
  const txDetail = onchainTxDetail ?? txDetailBase;
  const fundingUsdcAccount =
    stablecoinAccountsList.find(
      (a) =>
        isFundableStablecoinAccount(a) &&
        a.currency === "USDT" &&
        /polygon/i.test(a.network || ""),
    ) ??
    stablecoinAccountsList.find(
      (a) => isFundableStablecoinAccount(a) && a.currency === "USDT",
    ) ??
    stablecoinAccountsList.find(
      (a) => isFundableStablecoinAccount(a) && a.currency === "USDC",
    ) ??
    stablecoinAccountsList.find((a) => isFundableStablecoinAccount(a)) ??
    null;
  const fundingOnRampAccount =
    (selectedStablecoinAccount && isFundableStablecoinAccount(selectedStablecoinAccount)
      ? selectedStablecoinAccount
      : null) ??
    fundingUsdcAccount;
  const fundStablecoinRails = fundRailsForAccount({
    selected: selectedStablecoinAccount,
    accounts: stablecoinAccountsList,
    depositInstructions: collectDepositInstructionsQuery.data,
    isFundable: isFundableStablecoinAccount,
    isStellarUsdc: (a) =>
      isStellarUsdcRail({ network: a.network, currency: a.currency }),
  });
  const africanFundPlan = acctDetail
    ? planAfricanFundOrchestration({
        fiatCurrency: acctDetail.currency,
        fiatAccountId: selectedDepositAccount?.id ? String(selectedDepositAccount.id) : null,
        entityId: fundingOnRampAccount?.entityId ?? null,
        usdcAccountId: fundingOnRampAccount?.id ?? null,
        usdcWalletAddress: fundingOnRampAccount?.walletAddress ?? null,
        treasuryWalletAddress: resolveTreasuryWalletAddress({
          summaryWallet: summaryQuery.data?.totals.wallet_address,
          stablecoinAccounts: stablecoinAccountsQuery.data,
        }),
        convertNetworkId: null,
      })
    : null;
  const cardsSpendAll = decoratedAll.filter((row) =>
    isCardSpendTransaction(row),
  );
  const formatCardSpendAmount = (row: (typeof cardsSpendAll)[number]) => {
    const currency = String(row.currency || "USD").toUpperCase();
    const numeric = Number(row.amount_fiat);
    const currencyCode = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
    let formatted: string;
    if (Number.isFinite(numeric)) {
      try {
        formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Math.abs(numeric));
      } catch {
        formatted = `${Math.abs(numeric).toFixed(2)} ${currency}`;
      }
    } else {
      formatted = `${row.amount_fiat} ${currency}`;
    }
    if (row.direction === "in") return `+${formatted}`;
    if (row.direction === "out") return `-${formatted}`;
    return formatted;
  };
  const cardsSpendItems: CardSpendItem[] = cardsSpendAll.slice(0, 20).map((row) => {
    const last4 =
      String(row.accountNumber || "")
        .replace(/[^\d]/g, "")
        .slice(-4) || "";
    const settled = row.statusLabel === "Settled";
    return {
      id: String(row.id),
      merchant: row.client || "Card spend",
      merchantLogoUrl: row.merchantLogoUrl,
      meta: `${row.type} · ${formatCardSpendWhen(String(row.created_at || ""))}`,
      cardLast4: last4 ? `···· ${last4}` : "",
      statusLabel: row.statusLabel,
      statusColor: settled ? "var(--indigo-text)" : row.statusColor,
      statusSoft: settled ? "var(--indigo-tint)" : row.statusSoft,
      amount: formatCardSpendAmount(row),
      amountColor: row.direction === "in" ? "var(--positive)" : "var(--ink)",
      openDetail: row.openDetail,
    };
  });
  const corridors = CORRIDORS.map(c => ({
        ...c,
        flagUrl: flagUrl(c.iso),
        statusLabel: c.status === "live" ? "Live" : "Degraded",
        statusColor: c.status === "live" ? "var(--indigo-text)" : "var(--amber)",
        statusSoft: c.status === "live" ? "var(--indigo-tint)" : "var(--amber-tint)",
      }));
  const cards = issuedCardsList.map((c) => {
    const frozen = isCardFrozenStatus(c.status);
    const actionable = isCardActionable(c);
    const failed = !actionable;
    const closed = isCardFailedStatus(c.status) && describeCardStatus(c.status) === "Closed";
    const brand = resolveCardBrand(c);
    return {
      id: c.id,
      label: c.card_name || (c.last_four ? `Card ···· ${c.last_four}` : "Virtual card"),
      last4: c.last_four || "",
      panMasked: formatMaskedPan(c.last_four),
      last4Short: c.last_four ? `···· ${c.last_four}` : "···· ····",
      exp: formatCardExpiry(c.expiration_month, c.expiration_year),
      brand,
      balance: usdSpendLabel,
      color: cardColor(cardColorKeys[c.id]),
      status: (failed ? "failed" : frozen ? "frozen" : "active") as "failed" | "frozen" | "active",
      statusLabel: closed ? "Closed" : failed ? "Failed" : describeCardStatus(c.status),
      actionDisabled: failed,
      actionDisabledReason: closed ? "This card is closed." : "This card is unavailable.",
      manage: openCardDetail(c.id),
    };
  });
  // Usable cards first, then frozen, then closed/failed at the end.
  const cardRank = { active: 0, frozen: 1, failed: 2 } as const;
  cards.sort((a, b) => cardRank[a.status] - cardRank[b.status]);
  const activeCardCount = cards.filter((c) => c.status === "active").length;
  const cardsSummarySub = usdFunding
    ? [
        cards.length
          ? `${activeCardCount} active card${activeCardCount === 1 ? "" : "s"}`
          : "No cards yet",
        `USD${usdFunding.accountMask ? ` ${usdFunding.accountMask}` : ""}`,
      ].join(" · ")
    : "Cards spend from your active USD deposit account balance.";
  const cardsLoading = usdFundingQuery.isLoading || issuedCardsQuery.isLoading;
  const cardsMissingUsd = !usdFunding && !usdFundingQuery.isLoading && !usdFundingQuery.isError;
  const cardsError =
    usdFundingQuery.isError || issuedCardsQuery.isError
      ? (usdFundingQuery.error instanceof Error
          ? usdFundingQuery.error.message
          : issuedCardsQuery.error instanceof Error
            ? issuedCardsQuery.error.message
            : "Couldn't load cards.")
      : cardsMissingUsd
        ? "Open an active USD deposit account to issue cards."
        : "";
  const cardsErrorBadge = cardsMissingUsd ? "USD required" : "Error";
  const txFilters = PRIMARY_TX_FILTERS.map((filter) => ({
    key: filter.key,
    label: filter.label,
    select: setTxFilter(filter.key),
    active: s.txFilter === filter.key,
  }));
  const txCurrencyOptions = Array.from(
    new Set([
      ...(transactionsQuery.data?.items ?? []).map((transaction) =>
        transaction.currency.toUpperCase(),
      ),
      ...(unmatchedOnchainRows.length ? ["USDC"] : []),
    ]),
  ).sort();

  // Reports screen hosts Statements (period PDF/CSV reconcile).

  // Single KYB case — no tier ladder. Submit once; then show clear compliance feedback.
  const hasKybProfile = !!meQuery.data?.kyb_summary?.profile;
  const kybReviewerNotes =
    typeof meQuery.data?.kyb_summary?.profile?.reviewer_notes === "string"
      ? meQuery.data.kyb_summary.profile.reviewer_notes
      : null;
  const kybReviewFindings = normalizeKybReviewFindings(
    meQuery.data?.kyb_summary?.profile?.review_findings,
  );
  const kybActionLabel =
    kybStatus === "rejected" || kybStatus === "expired"
      ? "Fix and resubmit"
      : hasKybProfile
        ? "Continue verification"
        : "Start verification";
  // The backend only ever returns the full plaintext key once, in the
  // create/rotate response — list/detail always return it masked. So
  // "Reveal"/"Copy" on the secret-key row can only do something real for a
  // key minted in this session (held in `newlyCreatedKey`); for every other
  // key they render in the same place but disabled, with a title saying why.
  // The webhook rows come from the per-key detail endpoint, since the list
  // endpoint omits them.
  const justMintedKey = s.newlyCreatedKey;
  const apiKeys = (apiKeysQuery.data ?? [])
    .filter((k) => !k.revoked)
    .map((k) => {
      const detail = apiKeyDetailById.get(k.id);
      const plaintext = justMintedKey && justMintedKey.id === k.id ? justMintedKey.key : null;
      const revealed = !!s.apiKeyRevealed[k.id];
      const secretRevealed = !!s.secretRevealed[k.id];
      const webhookSecret = detail?.webhook_secret ?? null;
      return {
        ...k,
        label: k.name,
        modeLabel: k.environment === "live" ? "Live" : "Test",
        modeBg: k.environment === "live" ? "var(--indigo-tint)" : "var(--surface2)",
        modeColor: k.environment === "live" ? "var(--indigo-text)" : "var(--muted)",

        keyDisplay: plaintext && revealed ? plaintext : k.key,
        canRevealKey: !!plaintext,
        revealLabel: revealed ? "Hide" : "Reveal",
        revealTitle: plaintext ? "" : "The full key is shown only once, when it's created.",
        toggleReveal: plaintext ? toggleRevealKey(k.id) : () => {},
        copyKey: plaintext ? copyField("key:" + k.id, plaintext) : () => {},
        copyKeyLabel: s.copiedField === "key:" + k.id ? "Copied" : "Copy",

        webhookUrl: detail?.webhook_url || "Not configured",
        copyWebhook: detail?.webhook_url ? copyField("wh:" + k.id, detail.webhook_url) : () => {},
        copyWebhookLabel: s.copiedField === "wh:" + k.id ? "Copied" : "Copy",
        canCopyWebhook: !!detail?.webhook_url,
        events: "Authorization uses dashboard roles (admin/finance/operator). API key scope fields are reserved and not enforced yet.",

        webhookSecretDisplay: webhookSecret ? (secretRevealed ? webhookSecret : "whsec_••••••••••••••••") : "Not configured",
        canRevealSecret: !!webhookSecret,
        revealSecretLabel: secretRevealed ? "Hide" : "Reveal",
        toggleRevealSecret: webhookSecret ? toggleRevealSecret(k.id) : () => {},
        copySecret: webhookSecret && secretRevealed ? copyField("whsec:" + k.id, webhookSecret) : () => {},
        copySecretLabel: s.copiedField === "whsec:" + k.id ? "Copied" : "Copy",
        canCopySecret: !!(webhookSecret && secretRevealed),
        isJustMinted: !!(plaintext),

        revoke: revokeApiKey(k.id),
      };
    });
  const apiKeysLoading = apiKeysQuery.isLoading;
  const apiKeysEmpty = !apiKeysLoading && apiKeys.length === 0;
  const dismissNewApiKey = () => setState({ newlyCreatedKey: null });
  const showNewApiKeyBanner = !!justMintedKey;
  const isModalApiKey = s.modal === "apiKey";
  const apiKeyName = s.apiKeyName;
  const apiKeyError = s.apiKeyError;
  const apiKeyCreating = s.apiKeyCreating;
  const apiKeyEnvironmentChips = ["sandbox", "live"].map((env) => ({
    key: env,
    label: env === "live" ? "Live" : "Sandbox",
    select: setApiKeyEnvironment(env),
    selected: s.apiKeyEnvironment === env,
    bg: s.apiKeyEnvironment === env ? "var(--ink)" : "var(--surface2)",
    color: s.apiKeyEnvironment === env ? "var(--bg)" : "var(--ink)",
  }));
  // Team loads from Mboka; only admins can invite / change roles / remove.
  const teamMembers = teamQuery.data?.members ?? [];
  const teamInvites = teamQuery.data?.invites ?? [];
  const teamCount = teamMembers.length + teamInvites.length;
  const teamLoading = teamQuery.isLoading || teamQuery.isFetching;
  const teamLoadError =
    teamQuery.isError
      ? teamQuery.error instanceof ApiRequestError
        ? teamQuery.error.message
        : "Couldn't load the team."
      : "";
  const inviteOpen = s.inviteOpen;
  const inviteEmail = s.inviteEmail;
  const inviteBusy = !!s.inviteBusy;
  const inviteError = s.inviteError || "";
  const teamActionError = s.teamActionError || "";
  const inviteRoleChips = MEMBERSHIP_ROLES.map((r) => ({
    key: r.key,
    label: r.label,
    desc: r.desc,
    select: setInviteRole(r.key),
    selected: s.inviteRole === r.key,
    bg: s.inviteRole === r.key ? "var(--indigo)" : "var(--surface2)",
    color: s.inviteRole === r.key ? "var(--indigo-on)" : "var(--ink)",
  }));
  const inviteCanSubmit = !!(String(s.inviteEmail || "").trim()) && isTeamAdmin && !inviteBusy;
  const inviteCannotSubmit = !inviteCanSubmit;
  const teamRows = teamMembers.map((m) => {
    const name = displayNameFromEmail(m.email);
    return {
      key: `member-${m.user_id}`,
      kind: "member" as const,
      userId: m.user_id,
      name,
      email: m.email,
      role: m.role,
      initials: initialsFromEmail(m.email),
      statusLabel: "Active",
      statusColor: "var(--indigo-text)",
      statusSoft: "var(--indigo-tint)",
      roleLabel: roleLabel(m.role),
      roleOptions: MEMBERSHIP_ROLES,
      setRole: setMemberRole(m.user_id),
      remove: askRemoveMember(m.user_id, name),
      isSelf: m.user_id === myUserId,
    };
  });
  const inviteRows = teamInvites.map((inv) => {
    const name = displayNameFromEmail(inv.email);
    return {
      key: `invite-${inv.id}`,
      kind: "invite" as const,
      inviteId: inv.id,
      name,
      email: inv.email,
      role: inv.role,
      initials: initialsFromEmail(inv.email),
      statusLabel: "Invited",
      statusColor: "var(--amber)",
      statusSoft: "var(--amber-tint)",
      roleLabel: roleLabel(inv.role),
      revoke: askRevokeInvite(inv.id, inv.email),
    };
  });
  const allTeamRows = [...teamRows, ...inviteRows];
  const teamConfirm = s.teamConfirm as null | { kind: "revoke" | "remove"; id: number; label: string };
  const teamConfirmBusy = !!s.teamConfirmBusy;
  const modalOpen = !!s.modal;
  const modalTitle = { send: "Send money", deposit: s.fundAfricanTargetCurrency ? `Fund ${s.fundAfricanTargetCurrency}` : "Top up balance", receive: "Receive globally", convert: "Convert", bulk: "Bulk payout", swap: "Convert", txDetail: "Transaction", acctDetail: s.acctDetailIntent === "fund" ? "Fund via bank transfer" : "Account details", fundChooser: "Fund account", fundStablecoin: "Fund account", fundPaymentRequest: "Fund via remittance", bookTransfer: "Move between accounts", payout: "Bank payout", closeAccount: "Close account", cardDetail: (issuedCardsQuery.data?.cards ?? []).find((c) => c.id === s.selectedCardId)?.card_name || "Card", newCard: "Create virtual card", kyb: "Business verification", fundCard: "Fund card", apiKey: "Create API key",
    support: "Help",
    mfaSetup: "Set up 2FA",
    invoiceDetail: "Invoice",
    invoiceCreate: "New invoice",
    createAccount: s.createAccountKind === "stablecoin" ? "Create Stablecoin Account" : "Create Account" }[s.modal] || "";
  const isModalCreateAccount = s.modal === "createAccount";
  const isModalInvoiceDetail = s.modal === "invoiceDetail";
  const isModalInvoiceCreate = s.modal === "invoiceCreate";
  const isModalSupport = s.modal === "support";
  const isSendFlow = s.modal === "send";
  const isDepositFlow = s.modal === "deposit";
  const isReceiveFlow = s.modal === "receive";
  const isConvertFlow = s.modal === "convert";
  const isModalBulk = s.modal === "bulk";
  // Mixed-rail edit table is wide — open expanded by default when that flag is on.
  const [bulkModalExpanded, setBulkModalExpanded] = useState(MIXED_RAIL_BULK_PAYOUTS_ENABLED);
  const [bulkModalSize, setBulkModalSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const bulkResizeRef = useRef<{
    edge: "e" | "w" | "se";
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  useEffect(() => {
    if (s.modal === "bulk" && MIXED_RAIL_BULK_PAYOUTS_ENABLED) {
      setBulkModalExpanded(true);
    }
  }, [s.modal]);

  const clampBulkModalSize = useCallback((width: number, height: number) => {
    if (typeof window === "undefined") return { width, height };
    const minW = 480;
    const minH = 420;
    const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.98));
    const maxH = Math.max(minH, Math.floor(window.innerHeight * 0.96));
    return {
      width: Math.min(maxW, Math.max(minW, Math.round(width))),
      height: Math.min(maxH, Math.max(minH, Math.round(height))),
    };
  }, []);

  const onBulkResizePointerDown = useCallback(
    (edge: "e" | "w" | "se") => (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!modalRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = modalRef.current.getBoundingClientRect();
      bulkResizeRef.current = {
        edge,
        startX: event.clientX,
        startY: event.clientY,
        startW: rect.width,
        startH: rect.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const onBulkResizePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = bulkResizeRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      let nextW = drag.startW;
      let nextH = drag.startH;
      if (drag.edge === "e" || drag.edge === "se") nextW = drag.startW + dx;
      if (drag.edge === "w") nextW = drag.startW - dx;
      if (drag.edge === "se") nextH = drag.startH + dy;
      setBulkModalSize(clampBulkModalSize(nextW, nextH));
    },
    [clampBulkModalSize],
  );

  const onBulkResizePointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!bulkResizeRef.current) return;
    bulkResizeRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);
  const isModalTxDetail = s.modal === "txDetail";
  const isModalAcctDetail = s.modal === "acctDetail";
  const isModalFundChooser = s.modal === "fundChooser";
  const isModalFundStablecoin = s.modal === "fundStablecoin";
  const isModalFundPaymentRequest = s.modal === "fundPaymentRequest";
  const isModalBookTransfer = s.modal === "bookTransfer";
  const isModalPayout = s.modal === "payout";
  const isModalCloseAccount = s.modal === "closeAccount";
  const isModalCardDetail = s.modal === "cardDetail";
  const isModalNewCard = s.modal === "newCard";
  const isModalKyb = s.modal === "kyb";
  const isModalMfaSetup = s.modal === "mfaSetup";
  const isModalMfaDisable = s.modal === "mfaDisable";
  const isModalFundCard = s.modal === "fundCard";
  const sendIsCountry = s.sendGroup === "country";
  const sendIsCrypto = s.sendGroup === "crypto";
  const sendRailHasChoice = railHasChoice(sendCountry.rails, s.sendMethod);
  const sendMethodChosen = !!s.sendMethod;
  const sendMethodOptions = [
    {
      key: "bank",
      label: "Bank transfer",
      desc: "Send to a bank account, locally or internationally",
      select: chooseSendMethod("bank"),
    },
    {
      key: "mobile",
      label: "Mobile money",
      desc: "Send to a mobile money wallet across Africa",
      select: chooseSendMethod("mobile"),
    },
    {
      key: "crypto",
      label: "Stablecoin",
      desc: "Send USDC to a wallet address",
      select: chooseSendMethod("crypto"),
    },
    {
      // Account-to-account via Convert: USDC/USDT → EUR/USD/GBP deposit VAs.
      key: "internal",
      label: "Internal transfer",
      desc: "Move USDC or USDT into your USD, EUR, or GBP accounts",
      select: chooseSendMethod("internal"),
    },
  ];
  const sendRecipient = s.sendRecipient;
  const sendRecipientName = s.sendRecipientName;
  const sendAmount = s.sendAmount;
  const sendDone = s.sendDone;
  const sendNotDone = !s.sendDone;
  const sendQuoteLoading = s.sendQuoteLoading;
  const sendQuoteError = s.sendQuoteError;
  const sendAccepting = s.sendAccepting;
  const sendAcceptError = s.sendAcceptError;
  const sendResultText = s.sendConfirm
    ? buildAccountSendResultSummary(s.sendConfirm)
    : s.sendAccept
      ? `Order #${s.sendAccept.merchant_order_id} · ${s.sendAccept.status}`
      : null;
  const sendSuccessDetails = s.sendConfirm
    ? buildAccountSendSuccessDetails({
        ...s.sendConfirm,
        network: s.sendConfirm.network || s.sendChain,
      })
    : null;
  const sendExplorerUrl = s.sendUnified
    ? (unifiedSendQuery.data ?? s.sendUnified).explorer_url ?? null
    : s.sendConfirm
    ? buildSendExplorerUrl({
        network: s.sendConfirm.network || s.sendChain,
        txHash: s.sendConfirm.tx_hash,
      })
    : null;
  // Live status on the send-success step, via the same polling hook the tx
  // detail modal uses. `sendStatusQuery.data` starts undefined right after
  // accept (first poll hasn't landed yet) — fall back to the accept
  // response's own "processing" status rather than showing nothing.
  const sendLiveOrderStatus = s.sendAccept ? sendStatusQuery.data?.status ?? "processing" : null;
  const sendLiveDescriptor = sendLiveOrderStatus
    ? describeTransactionStatus(sendLiveOrderStatus)
    : null;
  const sendLiveStatus = sendLiveDescriptor
    ? { label: sendLiveDescriptor.label, color: sendLiveDescriptor.color, soft: sendLiveDescriptor.soft, isSettling: !sendStatusQuery.isTerminal }
    : null;
  // One outcome for the status panel. Country sends follow the polled order;
  // stablecoin sends follow the confirm response. Anything not clearly
  // delivered or failed stays "processing" — never a guessed success.
  const sendConfirmStatusKey = String(s.sendConfirm?.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  // Unified sends report one status for every method. "sending" (confirmed,
  // not yet with the provider) shows as processing on the status panel.
  const unifiedSend = s.sendUnified ? unifiedSendQuery.data ?? s.sendUnified : null;
  const sendOutcome: "processing" | "delivered" | "failed" | "refunded" = unifiedSend
    ? unifiedSend.status === "delivered" || unifiedSend.status === "failed" || unifiedSend.status === "refunded"
      ? unifiedSend.status
      : "processing"
    : s.sendConfirm
    ? ["completed", "settled", "success", "succeeded"].includes(sendConfirmStatusKey)
      ? "delivered"
      : ["failed", "canceled", "cancelled", "rejected"].includes(sendConfirmStatusKey)
        ? "failed"
        : "processing"
    : sendLiveOrderStatus === "completed"
      ? "delivered"
      : sendLiveOrderStatus === "refunded"
        ? "refunded"
        : sendLiveOrderStatus === "failed" || sendLiveOrderStatus === "canceled"
          ? "failed"
          : "processing";
  const sendOrderId = unifiedSend
    ? unifiedSend.send_id
    : s.sendConfirm
    ? String(s.sendConfirm.id || "").trim() || null
    : s.sendAccept?.merchant_order_id != null
      ? String(s.sendAccept.merchant_order_id)
      : null;
  const sendRecipientLabel = s.sendGroup === "crypto" ? "Recipient wallet address" : sendRail.field;
  const sendRecipientPlaceholder =
    s.sendGroup === "crypto"
      ? sendCryptoRecipientPlaceholder(s.sendChain)
      : isMobileMoneyRail(sendRail.type) && sendCountry.dialCode
        ? `+${sendCountry.dialCode}712345678`
        : sendRail.placeholder;
  // USDC + USDT chips and Base/Polygon/Stellar chains come from live sendable
  // wallets (bootstrap + /entities accounts) — never mock Ethereum/Solana.
  const sendableAccountsForPicker = mergeSendableAccounts(
    sendableAccountsQuery.data,
    resolvedStablecoinAccounts,
  );
  const sendAccountsReady =
    sendableAccountsQuery.isFetched || bootstrapReady || resolvedStablecoinAccounts.length > 0;
  const sendSelection = resolveSendStablecoinSelection({
    accounts: sendableAccountsForPicker,
    asset: s.sendAsset,
    chain: s.sendChain,
    preferredAccountId: s.sendAccountId,
    accountsReady: sendAccountsReady,
    supportedChainKeys: parseCollectSupportedChainKeys(
      collectSupportedChainsQuery.data,
    ),
  });
  const sendAssetKeys =
    sendableAssetsFromAccounts(sendableAccountsForPicker).length > 0
      ? sendableAssetsFromAccounts(sendableAccountsForPicker)
      : (["usdc", "usdt"] as const);
  const sendAssets = sendAssetKeys.map((k) => ({
    key: k,
    label: k.toUpperCase(),
    select: setSendAsset(k),
    selected: sendSelection.asset === k,
    bg: sendSelection.asset === k ? "var(--ink)" : "var(--surface2)",
    color: sendSelection.asset === k ? "var(--bg)" : "var(--ink)",
  }));
  const sendChainOptions = sendableChainsForAsset(
    sendableAccountsForPicker,
    sendSelection.asset,
    {
      accountsReady: sendAccountsReady,
      supportedChainKeys: parseCollectSupportedChainKeys(
        collectSupportedChainsQuery.data,
      ),
    },
  );
  const sendChains = sendChainOptions.map((n) => ({
    key: n.key,
    label: n.label,
    select: setSendChain(n.key),
    selected: sendSelection.chain === n.key,
  }));
  const sendAssetCode = sendSelection.asset.toUpperCase();
  const sendChainLabel = sendSelection.chainLabel;
  const sendCorridorText = s.sendGroup === "crypto"
    ? `Sends ${sendAssetCode} from your Stellar balance to ${sendChainLabel} — min 1.00 ${sendAssetCode}.`
    : `${sendCountry.name} via ${channelLabelForRail(sendRail.type)} · ${sendRail.arrival}`;
  const sendProviderHasChoice = sendProviderOptions.length > 1;
  const sendProviderPickerLabel =
    isMobileMoneyRail(sendRail.type) ? "Mobile money provider" : "Bank account";
  const sendProvidersAreFallback = false;
  // Bank rails can't be quoted without the aggregator's institution id, which
  // only the catalog carries — so this corridor is a dead end until it loads.
  // Dual-currency amount entry. The toggle only appears for corridors the
  // summary carries a rate for — without one we cannot turn local input into
  // the USD the payload prices from, so USD-only is the honest option.
  const sendLocalCurrency = sendCountry.code;
  const sendIndicativeRate = indicativeRate(homeFxRates?.rates, sendLocalCurrency);
  const sendCanEnterLocal = sendIsCountry && canEnterInLocalCurrency(homeFxRates?.rates, sendLocalCurrency);
  const sendAmountCurrency = sendCanEnterLocal ? s.sendAmountCurrency : "USD";
  // Indicative only — flagged with "≈" and never sent anywhere. The binding
  // figures come back on the quote.
  const sendAmountEquivalent = sendIsCountry
    ? describeAmountEquivalent(
        s.sendAmount,
        { currency: sendAmountCurrency, rate: sendIndicativeRate },
        sendLocalCurrency,
      )
    : null;
  // Country sends get their max/error from the catalog-limits block below
  // (bridges currencies + the refund wallet balance into one message); this
  // account/balance lookup only drives the crypto/stablecoin send path.
  const sendBalanceAccount = sendIsCountry
    ? null
    : resolvedStablecoinAccounts.find((account) => account.id === sendSelection.accountId) ||
      sendableAccountsForPicker.find((account) => account.id === sendSelection.accountId);
  const sendAvailableBalance = parseBalanceNumber(sendBalanceAccount?.balance);
  const sendAmountMode = {
    currency: sendAmountCurrency,
    rate: sendIndicativeRate,
  };
  // The stablecoin rail charges its fee ON TOP of the amount, so the balance
  // has to cover both. Without this, 7,000 USDT of balance "passes" a 7,000
  // send carrying a 17.50 fee and the backend rejects it with no warning
  // ever shown. Taken from the preview — null until one exists, never guessed.
  const sendPreviewFeeUsd = sendIsCountry ? null : s.sendPreview?.fee_amount ?? null;
  const sendCryptoMaxAmount = sendAvailableBalance === null
    ? null
    : maxAmountForBalance(sendAvailableBalance, sendAmountMode, sendPreviewFeeUsd);
  const sendEnteredUsdAmount = toPayloadUsdAmount(s.sendAmount, sendAmountMode);
  const sendBalanceLabel = `${formatAccountBalance(sendBalanceAccount?.balance)} ${sendBalanceAccount?.balance?.currency || sendBalanceAccount?.currency}`;
  const sendFeeOnTopNote = feeOnTopUsd(sendPreviewFeeUsd)
    ? ` once the ${sendPreviewFeeUsd} fee is added`
    : "";
  const sendBalanceError = !sendIsCountry && amountExceedsBalance(
    s.sendAmount,
    sendAmountMode,
    sendAvailableBalance,
    sendPreviewFeeUsd,
  )
      ? sendAmountCurrency.toUpperCase() === "USD"
        ? `This amount is above your available balance of ${sendBalanceLabel}${sendFeeOnTopNote}.`
        : `This amount needs about ${sendEnteredUsdAmount} USD, above your available balance of ${sendBalanceLabel}${sendFeeOnTopNote}.`
      : null;
  const sendIndicativeRateLine = sendIsCountry
    ? formatRateLine(sendIndicativeRate, sendLocalCurrency)
    : null;
  // A payout rail is paid from a held balance and needs no provider id.
  const sendBlockedNoNetworkId =
    !sendPayoutContext(s.sendCountryIdx, s.sendRailIdx, s.sendProviderIdx) &&
    sendRailBlockedByMissingNetworkId({
      sendGroup: s.sendGroup,
      networkId: networkIdForProvider(sendCatalogProviders, sendProvider),
      catalogSettled: sendCatalogSettled,
    });
  const depositIsCountry = s.depositGroup === "country";
  const depositIsMobileRail = isMobileMoneyRail(depositRail.type);
  const depositChannelLabel = depositIsMobileRail
    ? mobileMoneyDisplayLabel(depositProvider) || channelLabelForRail(depositRail.type)
    : channelLabelForRail(depositRail.type);
  const depositOperator = depositChannelLabel;
  const depositMobileCode = depositCountry.code;
  const depositBankArrival = depositRail.arrival;
  const depositPaymentInstructionRows = s.depositAccept
    ? buildPaymentInstructionRows(s.depositAccept.payment_instructions).map((row) => ({
        k: row.k,
        v: row.v,
      }))
    : [];
  const depositBankLines =
    s.depositAccept?.payment_instructions?.type === "bank"
      ? [
          ...(s.depositAmount ? [{ k: "Amount", v: `${s.depositAmount} ${depositCountry.code}` }] : []),
          ...depositPaymentInstructionRows,
        ]
      : depositRail.type === "bank" && !s.depositAccept
        ? [{ k: "Account number", v: depositRail.placeholder }, { k: "Method", v: depositChannelLabel }]
        : depositPaymentInstructionRows;
  // Collect deposits: USDC via CCTP (+ Stellar home), USDT/EURC on Stellar via
  // Aquarius — network list is "where is this coming from", backed by rails.
  const depositCollectNetworkOptions = networkOptionsForAssetFromRails(
    fundStablecoinRails,
    s.depositAsset,
  );
  const depositCatalogNetworks = stablecoinNetworksForAsset(
    DEPOSIT_STABLECOIN_NETWORKS,
    s.depositAsset,
  );
  const depositNetworkOptions = (() => {
    if (s.depositAsset === "usdc" && depositCollectNetworkOptions.length > 0) {
      return depositCollectNetworkOptions;
    }
    if (s.depositAsset === "eurc") {
      return depositCollectNetworkOptions.length > 0
        ? depositCollectNetworkOptions
        : depositCatalogNetworks;
    }
    // USDT: Base/Polygon accounts + Stellar Aquarius when Collect rail is live.
    if (depositCollectNetworkOptions.length === 0) return depositCatalogNetworks;
    const seen = new Set<string>(depositCatalogNetworks.map((n) => n.key));
    return [
      ...depositCatalogNetworks,
      ...depositCollectNetworkOptions.filter((n) => !seen.has(n.key)),
    ];
  })();
  const depositNetworkUiKey = coerceStablecoinNetworkKey(s.depositNetwork, s.depositAsset, depositNetworkOptions);
  const depositNetworks = depositNetworkOptions.map((n) => ({
    key: n.key,
    label: n.label,
    select: setDepositNetwork(n.key),
    selected: depositNetworkUiKey === n.key,
  }));
  const treasuryWalletAddress = resolveTreasuryWalletAddress({
    summaryWallet:
      bootstrapQuery.data?.treasuryWallet ??
      summaryQuery.data?.totals.wallet_address,
    stablecoinAccounts: stablecoinAccountsList,
  });
  const depositAssetKeys = [
    "usdc",
    "usdt",
    ...(fundStablecoinRails.some((r) => r.currency.trim().toUpperCase() === "EURC")
      ? (["eurc"] as const)
      : []),
  ];
  const depositAssets = depositAssetKeys.map((k) => ({
    key: k,
    label: k.toUpperCase(),
    select: setDepositAsset(k),
    bg: s.depositAsset === k ? "var(--ink)" : "var(--surface2)",
    color: s.depositAsset === k ? "var(--bg)" : "var(--ink)",
  }));
  const pinnedOnRampDest = resolveOnRampDestination({
    accounts: stablecoinAccountsList,
    selectedAccountId: s.fundTargetAccountId,
    depositNetworkKey: depositNetworkUiKey,
    depositAsset: s.depositAsset,
    fundAfricanTargetCurrency: s.fundAfricanTargetCurrency,
    summaryWallet:
      bootstrapQuery.data?.treasuryWallet ??
      summaryQuery.data?.totals.wallet_address,
  });
  const depositAssetCode = (pinnedOnRampDest?.asset.currency || s.depositAsset).toUpperCase();
  const sendStep = s.sendStep;
  const sendStepDots = buildSendStepDots(s.sendStep, 3);
  const sendStepIs1 = s.sendStep === 1;
  const sendStepIs2 = s.sendStep === 2;
  const sendStepIs3 = s.sendStep === 3;
  const sendDestinationSummary = buildSendDestinationSummary({
    sendGroup: s.sendGroup,
    sendAsset: sendSelection.asset,
    sendChainLabel,
    countryName: sendCountry.name,
    channelLabel:
      isMobileMoneyRail(sendRail.type)
        ? mobileMoneyDisplayLabel(sendProvider) || channelLabelForRail(sendRail.type)
        : channelLabelForRail(sendRail.type),
  });
  // OffRamp quote (by country) or account-send preview (stablecoin).
  const sendQuote = s.sendQuote;
  const sendPreview = s.sendPreview;
  // Fee in both currencies, converted at the *quote's* rate so it lines up
  // with the figures beside it rather than with a rate that has since moved.
  const sendFeeCurrency = sendPreview?.currency || sendAssetCode;
  // A preview fee of "0" is real information, so it reads "No fee" rather
  // than disappearing; an absent one says when it lands.
  const sendFeeText = s.sendUnifiedQuote
    ? unifiedFeeText(s.sendUnifiedQuote.fee) ?? "Shown on review"
    : s.sendGroup === "crypto"
    ? feeDisclosureText({
        raw: sendPreview?.fee_amount,
        formatted: `${sendPreview?.fee_amount} ${sendFeeCurrency}`,
        whenUnknown: "Shown on review",
      })
    : sendQuote
      ? formatFeeDual(
          formatQuoteFees(sendQuote.amounts.fees),
          sendQuote.amounts.rate,
          sendQuote.amounts.rate_currency || sendQuote.amounts.user_receives.currency,
        )
      : "Shown on review";
  // The crypto rail charges its fee ON TOP of the amount — the recipient gets
  // the full `amount` — so what actually leaves the account is a third figure.
  // Taken verbatim from the aggregator's `total_debit`; never summed here.
  const sendTotalDebitText = s.sendUnifiedQuote
    ? unifiedMoneyText(s.sendUnifiedQuote.total_debit)
    : s.sendGroup === "crypto" &&
    sendPreview?.total_debit != null &&
    String(sendPreview.total_debit).trim()
      ? `${String(sendPreview.total_debit).trim()} ${sendFeeCurrency}`
      : null;
  const sendLimits = sendIsCountry ? providerLimits(sendCatalogProviders, sendProvider, sendCountry.code) : null;
  // Same wallet the submit handler settles from — resolved here too so the
  // balance check below reflects what Next would actually reject.
  // Unified payout rails are paid from the held balance, so that balance is
  // the source for the checks below; otherwise it is the stablecoin wallet.
  const sendPayoutCtx = sendIsCountry
    ? sendPayoutContext(s.sendCountryIdx, s.sendRailIdx, s.sendProviderIdx)
    : null;
  // Unified sends: the user chooses which account pays, from every account
  // the business holds (a rail paid from a balance narrows it to that one).
  const sendUnifiedCountry = unifiedSendsLive() && sendIsCountry;
  const sendEligibleSources = sendUnifiedCountry
    ? eligibleSendSources(sendOptionsQuery.data, sendPayoutCtx?.destination ?? null)
    : [];
  const sendUnifiedSource = sendUnifiedCountry
    ? defaultSendSource(sendEligibleSources, s.sendAccountId)
    : null;
  const sendUnifiedSourceWallet = sendUnifiedSource
    ? ({
        id: sendUnifiedSource.account_id,
        currency: sendUnifiedSource.currency,
        network: sendUnifiedSource.network ?? "",
        // The checks below compare a USD figure with this balance, so only a
        // dollar-pegged balance is comparable; others are left to the quote.
        balance:
          sendUnifiedSource.available != null && isUsdLike(sendUnifiedSource.currency)
            ? {
                available: sendUnifiedSource.available,
                currency: sendUnifiedSource.currency,
              }
            : undefined,
      } as unknown as (typeof fundableRefundWallets)[number])
    : null;
  const sendRefundWallet = sendUnifiedCountry
    ? sendUnifiedSourceWallet
    : sendIsCountry
      ? fundableRefundWallets.find((a) => a.id === s.sendAccountId) ||
        preferCountryOfframpWallet(fundableRefundWallets, s.sendAccountId)
      : null;
  // USD figure the payload would carry, converted the same way submitSend
  // does — so the balance check lines up with whatever currency is typed.
  const sendUsdAmountForChecks = sendIsCountry
    ? toPayloadUsdAmount(s.sendAmount, { currency: sendAmountCurrency, rate: sendIndicativeRate })
    : null;
  // Unified sends: an indicative fee and total while the amount is typed,
  // before any recipient is entered. Debounced so typing does not spam it.
  const sendEstimateDestination =
    unifiedSendsLive() && sendIsCountry
      ? sendPayoutCtx?.destination ??
        findPayoutDestination(sendOptionsQuery.data, {
          countryIso: sendCountry.iso,
          railType: sendRail.type,
          providerName: sendProvider,
        })
      : null;
  // Typed in the destination currency: estimate from what the recipient
  // should get. Typed in USD: estimate from what leaves a dollar-pegged account.
  const sendEstimateDstCcy = sendEstimateDestination?.currency?.toUpperCase() ?? "";
  const sendEstimateFromReceive =
    !!sendEstimateDstCcy &&
    sendEstimateDstCcy !== "USD" &&
    sendAmountCurrency.toUpperCase() === sendEstimateDstCcy;
  const sendEstimateRawAmount = sendEstimateFromReceive
    ? s.sendAmount.trim()
    : sendUsdAmountForChecks ?? "";
  const sendEstimateCurrency = sendEstimateFromReceive
    ? sendEstimateDstCcy
    : (sendRefundWallet?.currency || "USDT").toUpperCase();
  const sendEstimateAmount = useDebouncedValue(sendEstimateRawAmount, 500);
  const sendEstimateReady =
    !!sendEstimateDestination &&
    !!sendRefundWallet &&
    (sendEstimateFromReceive || isUsdLike(sendRefundWallet.currency)) &&
    !s.sendUnifiedQuote &&
    !s.sendDone &&
    Number(sendEstimateAmount) > 0;
  const sendEstimateQuery = useQuery({
    queryKey: [
      QK.sendEstimate,
      sendEstimateDestination?.id ?? null,
      sendRefundWallet?.id ?? null,
      sendEstimateAmount,
      sendEstimateCurrency,
    ],
    queryFn: () =>
      unifiedSendsApi.estimate({
        destination_id: sendEstimateDestination!.id,
        source_account_id: sendRefundWallet!.id,
        amount: sendEstimateAmount,
        amount_currency: sendEstimateCurrency,
      }),
    enabled: sendEstimateReady,
    staleTime: 20 * 1000,
    retry: false,
  });
  const sendEstimate = sendEstimateReady ? sendEstimateQuery.data ?? null : null;
  // Live fee, rate and totals under the amount box. While a new figure is on
  // its way the previous rows stay, dimmed, so the card does not jump.
  const sendBreakdown =
    unifiedSendsLive() &&
    sendIsCountry &&
    !!sendEstimateDestination &&
    !!sendRefundWallet &&
    (sendEstimateFromReceive || isUsdLike(sendRefundWallet.currency)) &&
    !s.sendUnifiedQuote &&
    Number(sendEstimateRawAmount) > 0
      ? {
          rows: sendEstimate
            ? estimateBreakdown(sendEstimate, {
                recipient: s.sendRecipientName.trim().split(/\s+/)[0] || null,
              })
            : [],
          headline: sendEstimate
            ? estimateHeadline(sendEstimate, {
                typedIsReceive: sendEstimateFromReceive,
                recipient: s.sendRecipientName.trim().split(/\s+/)[0] || null,
              })
            : null,
          pending: sendEstimateRawAmount !== sendEstimateAmount || sendEstimateQuery.isFetching,
          error:
            sendEstimateReady && sendEstimateQuery.isError && !sendEstimateQuery.isFetching
              ? unifiedSendErrorMessage(
                  sendEstimateQuery.error,
                  "We couldn’t work out the price just now. You can still continue.",
                )
              : null,
        }
      : null;
  const sendLimitError = sendIsCountry
    ? limitViolationAcrossCurrencies(s.sendAmount, sendAmountCurrency, sendLimits, sendIndicativeRate) ??
      (sendRefundWallet && sendUsdAmountForChecks
        ? insufficientBalanceMessage({
            amount: sendUsdAmountForChecks,
            balance: sendRefundWallet.balance,
            currency: (sendRefundWallet.currency || "USDT").toUpperCase(),
          })
        : null)
    : null;
  // "Max" fills the smaller of what the corridor allows and what the source
  // wallet holds — never a figure neither one actually supports.
  const sendLimitMaxUsd =
    sendLimits?.max != null
      ? sendLimits.currency === "USD"
        ? sendLimits.max
        : sendIndicativeRate
          ? sendLimits.max / sendIndicativeRate
          : null
      : null;
  const sendBalanceUsd = sendRefundWallet ? parseBalanceNumber(sendRefundWallet.balance) : null;
  // Country sends: bridge the corridor limit + refund wallet balance into one
  // figure. Crypto/stablecoin sends: fall back to the source-wallet-only max
  // computed above (sendCryptoMaxAmount) since there is no corridor limit.
  const sendMaxAmount = sendIsCountry
    ? maxSendableAmount(
        [sendLimitMaxUsd, sendBalanceUsd],
        sendAmountCurrency,
        sendIndicativeRate,
      )
    : sendCryptoMaxAmount;
  // Binding rate from the quote — exact, no "≈". Falls back to the indicative
  // line only before a quote exists, where the UI labels it as an estimate.
  // What actually leaves the account. Once quoted this is the aggregator's
  // own `user_pays`, never the raw input — which may have been typed in the
  // destination currency and must not be re-labelled as dollars.
  const sendYouPayText = s.sendGroup === "crypto"
    ? `${s.sendAmount} ${sendPreview?.currency || sendAssetCode}`
    : sendQuote
      ? `${sendQuote.amounts.user_pays.amount} ${sendQuote.amounts.user_pays.currency}`
      : `${s.sendAmount} ${sendAmountCurrency}`;
  const sendQuotedRateLine = sendQuote
    ? formatRateLine(
        sendQuote.amounts.rate,
        sendQuote.amounts.rate_currency || sendQuote.amounts.user_receives.currency,
      )
    : null;
  const sendArrivalText = s.sendGroup === "crypto"
    ? (sendPreview?.expires_at
      ? `Preview valid until ${new Date(sendPreview.expires_at).toLocaleTimeString()}`
      : "On-chain settlement · status via account.send.* webhooks")
    : sendQuote?.expires_at
      ? `Quote valid until ${new Date(sendQuote.expires_at).toLocaleTimeString()}`
      : sendRail.arrival;
  const sendQuoteRateText = s.sendGroup === "crypto"
    ? (sendPreview?.receive_amount != null ? `${sendPreview.receive_amount} ${sendPreview.currency || sendAssetCode}` : null)
    : sendQuote?.amounts.rate
      ? `${sendQuote.amounts.user_receives.amount} ${sendQuote.amounts.user_receives.currency}`
      : null;
  const depositStep = s.depositStep;
  const depositStepIs2 = s.depositStep === 2;
  const depositStepIs3 = s.depositStep === 3;
  // USDC's home wallet is always Stellar, so fundTargetAccountId is pinned
  // there even when the chosen network is a CCTP bridge (Base, etc.) — the
  // rail match (by the *selected network*, not the pinned account) is the
  // correct source for both the address and its label in that case.
  // Same for Stellar USDT/EURC Collect rails (Aquarius → USDC home).
  const depositCollectRailMatch = findRailForAssetNetwork(
    fundStablecoinRails,
    s.depositAsset,
    depositNetworkUiKey,
  );
  const depositNetworkLabel = depositCollectRailMatch
    ? depositCollectRailMatch.networkLabel
    : pinnedOnRampDest
      ? formatNetworkLabel(pinnedOnRampDest.asset.network)
      : depositNetworkOptions.find((n) => n.key === depositNetworkUiKey)?.label ||
        formatNetworkLabel(depositNetworkUiKey);
  const depositNetworkKey =
    depositCollectRailMatch?.network || pinnedOnRampDest?.asset.network || depositNetworkUiKey;
  const depositPickerDest = resolveStablecoinPickerDestination({
    accounts: resolvedStablecoinAccounts,
    asset: s.depositAsset,
    networkKey: depositNetworkUiKey,
    treasuryWallet: treasuryWalletAddress,
  });
  const depositAddress = depositCollectRailMatch
    ? depositCollectRailMatch.walletAddress
    : s.fundTargetAccountId
      ? pinnedOnRampDest?.walletAddress || "—"
      : depositPickerDest.address || "—";
  const depositAddressEmptyMessage = depositCollectRailMatch
    ? ""
    : s.fundTargetAccountId
      ? describeMissingOnRampDestination({
          selectedAccountId: s.fundTargetAccountId,
          summaryFailed: summaryQuery.isError,
        })
      : depositPickerDest.emptyMessage;
  const depositCreateAccount =
    !s.fundTargetAccountId &&
    depositPickerDest.offerCreate &&
    depositPickerDest.createNetwork
      ? openCreateAccount(
          "stablecoin",
          depositPickerDest.createNetwork,
          depositAssetCode,
        )
      : null;
  const depositCreateAccountLabel = depositPickerDest.createNetwork
    ? `Create ${depositAssetCode} on ${depositNetworkLabel}`
    : "Create stablecoin account";
  const depositWalletOptions = fundableRefundWallets.map((a) => ({
    value: a.id,
    label: `${a.currency} · ${formatNetworkLabel(a.network)}${
      a.walletAddress ? ` · ${a.walletAddress.slice(0, 6)}…${a.walletAddress.slice(-4)}` : ""
    }`,
  }));
  const depositWalletLabel =
    depositWalletOptions.find((option) => option.value === s.fundTargetAccountId)?.label ||
    (pinnedOnRampDest
      ? `${pinnedOnRampDest.asset.currency} · ${formatNetworkLabel(pinnedOnRampDest.asset.network)}`
      : null);
  const depositWalletLocked = Boolean(
    s.fundTargetAccountId &&
      ((s.depositFromAccount && !s.fundFiatLockedId && !s.fundInteracAccountId) ||
        (s.fundAfricanTargetCurrency &&
          !(AFRICAN_FUND_FIAT_CURRENCIES as readonly string[]).includes(
            s.fundAfricanTargetCurrency.trim().toUpperCase(),
          ))),
  );
  const depositDone = s.depositDone;
  const depositPayerLabel = depositIsMobileRail
    ? "Your mobile number"
    : "Bank account you'll send funds from";
  const depositPayerPlaceholder = depositIsMobileRail ? "712 345 678" : depositRail.placeholder;
  const depositQuote = s.depositQuote;
  const depositQuoteLoading = s.depositQuoteLoading;
  const depositQuoteError = s.depositQuoteError;
  const depositAccepting = s.depositAccepting;
  const depositAcceptError = s.depositAcceptError;
  // Never estimate: before a quote exists the fee is "shown on review".
  const depositFeeText = depositQuote ? formatQuoteFees(depositQuote.amounts.fees) : "Shown on review";
  const depositLimits = depositIsCountry
    ? providerLimits(depositCatalogProviders, depositProvider, depositCountry.code)
    : null;
  const depositLimitsText = formatLimitsLine(depositLimits);
  // Limits must be in the corridor currency the amount is typed in.
  const depositLimitError =
    depositLimits && depositLimits.currency === depositCountry.code.toUpperCase()
      ? limitViolation(s.depositAmount, depositLimits)
      : null;
  const depositRateLine = depositQuote
    ? formatRateLine(
        depositQuote.amounts.rate,
        depositQuote.amounts.rate_currency || depositQuote.amounts.user_pays.currency,
      )
    : null;
  const depositQuoteRateText = depositQuote?.amounts.rate
    ? `${depositQuote.amounts.user_receives.amount} ${depositQuote.amounts.user_receives.currency}`
    : null;
  const depositLiveOrderStatus = s.depositAccept ? depositStatusQuery.data?.status ?? "processing" : null;
  const receiveGroups = ["fiat","crypto"].map(g => ({ key: g, label: g === "fiat" ? "Fiat account" : "Stablecoin", select: setReceiveGroup(g), bg: s.receiveGroup === g ? "var(--ink)" : "var(--surface2)", color: s.receiveGroup === g ? "var(--bg)" : "var(--muted)" }));
  const receiveIsFiat = s.receiveGroup === "fiat";
  const receiveIsCrypto = s.receiveGroup === "crypto";
  const receiveAccountsList = depositAccountsQuery.data?.accounts ?? [];
  const receiveAcctChips = receiveAccountsList.map((a, i) => ({
    flagUrl: flagUrl(currencyIso(a.currency) ?? "eu"),
    code: a.currency,
    select: selectReceiveAcct(i),
    bg: i === s.receiveAcctIdx ? "var(--indigo-tint)" : "var(--surface2)",
    border: i === s.receiveAcctIdx ? "var(--indigo)" : "transparent",
  }));
  const selectedReceiveAccount = receiveAccountsList[s.receiveAcctIdx] ?? null;
  const receiveAcctLines = selectedReceiveAccount
    ? buildDepositAccountDetailRows(selectedReceiveAccount).map((row) => ({
        k: row.label,
        v: row.value,
        copy: copyReceiveField(row.label, row.copyValue ?? row.value),
        copied: s.copiedKey === row.label,
      }))
    : [];
  const receiveAcctRail = selectedReceiveAccount
    ? `${currencyLabel(selectedReceiveAccount.currency)} bank deposit`
    : receiveAccountsList.length === 0
      ? "Issue a currency account from Accounts to receive bank transfers."
      : "—";
  const receiveAssets = ["usdc","usdt"].map(k => ({ key: k, label: k.toUpperCase(), select: setReceiveAsset(k), bg: s.receiveAsset === k ? "var(--ink)" : "var(--surface2)", color: s.receiveAsset === k ? "var(--bg)" : "var(--ink)" }));
  const receiveNetworkOptions = stablecoinNetworksForAsset(
    DEPOSIT_STABLECOIN_NETWORKS,
    s.receiveAsset,
  );
  const receiveNetworkUiKey = coerceStablecoinNetworkKey(s.receiveNetwork, s.receiveAsset);
  const receiveNetworks = receiveNetworkOptions.map((n) => ({
    key: n.key,
    label: n.label,
    select: setReceiveNetwork(n.key),
    selected: receiveNetworkUiKey === n.key,
    bg: receiveNetworkUiKey === n.key ? "var(--indigo-tint)" : "var(--surface2)",
    border: receiveNetworkUiKey === n.key ? "var(--indigo)" : "transparent",
    color: receiveNetworkUiKey === n.key ? "var(--indigo-text)" : "var(--ink)",
  }));
  const receiveNetworkLabel =
    receiveNetworkOptions.find((n) => n.key === receiveNetworkUiKey)?.label ||
    formatNetworkLabel(receiveNetworkUiKey);
  const receiveNetworkKey = receiveNetworkUiKey;
  const receiveAssetCode = s.receiveAsset.toUpperCase();
  const receivePickerDest = resolveStablecoinPickerDestination({
    accounts: resolvedStablecoinAccounts,
    asset: s.receiveAsset,
    networkKey: receiveNetworkUiKey,
    treasuryWallet: treasuryWalletAddress,
  });
  const receiveAddress = receivePickerDest.address || "—";
  const receiveAddressEmptyMessage = receivePickerDest.emptyMessage;
  const receiveCreateAccount =
    receivePickerDest.offerCreate && receivePickerDest.createNetwork
      ? openCreateAccount(
          "stablecoin",
          receivePickerDest.createNetwork,
          receiveAssetCode,
        )
      : null;
  const receiveCreateAccountLabel = receivePickerDest.createNetwork
    ? `Create ${receiveAssetCode} on ${receiveNetworkLabel}`
    : "Create stablecoin account";
  const copyReceiveAddress = receivePickerDest.address
    ? copyReceiveField("addr", receivePickerDest.address)
    : () => {};
  const receiveAddressCopied = s.copiedKey === "addr";
  // Convert offers every account the customer owns on both sides and derives
  // the rail from the pair (lib/services/convertRoutes.ts). No currency
  // filter here on purpose: a same-currency move is a book transfer, which
  // the aggregator allows on *any* fiat currency, so a KES account belongs in
  // this list even though KES itself is not convertible. Filtering the list
  // by currency would hide a pair that works; the route object is what
  // refuses the pairs that don't, with a reason.
  const fiatConvertAccounts = depositAccountsList
    .filter((a) => a.id)
    .map((a) => {
      const view = mapDepositAccountToCardView(a);
      return {
        id: String(a.id),
        currency: a.currency.toUpperCase(),
        label: `${view.name} (${a.currency.toUpperCase()})`,
        balanceLabel: view.hasBalance ? view.balance : "—",
        balanceAmount: parseBalanceNumber(a.balance),
        flagUrl: view.iso ? flagUrl(view.iso) : null,
        network: null as string | null,
      };
    });
  const usdcConvertAccounts = stablecoinAccountsList
    .filter((a) => a.currency === "USDC" && isReadyStatus(a.status) && a.id)
    .map((a) => ({
      id: String(a.id),
      currency: "USDC",
      label: `USDC · ${formatNetworkLabel(a.network)}`,
      balanceLabel: formatAccountBalance(a.balance, { maximumFractionDigits: 2 }),
      balanceAmount: parseBalanceNumber(a.balance),
    }));
  // Stellar USDC accounts convert too: `resolveConvertRoute` sends any pair
  // with a Stellar leg to the ledger conversion, which bridges it over CCTP
  // (`route: "bridged"`) and reports progress stage by stage.
  const stableConvertAccounts = stablecoinAccountsList
    .filter(
      (a) =>
        (a.currency === "USDC" || a.currency === "USDT") &&
        isReadyStatus(a.status) &&
        a.id,
    )
    .map((a) => ({
      id: String(a.id),
      currency: String(a.currency || "").toUpperCase(),
      label: `${String(a.currency || "").toUpperCase()} · ${formatNetworkLabel(a.network)}`,
      balanceLabel: formatAccountBalance(a.balance, { maximumFractionDigits: 2 }),
      balanceAmount: parseBalanceNumber(a.balance),
      network: a.network as string | null,
      flagUrl: null as string | null,
    }));
  const convertSourceAccounts = [...fiatConvertAccounts, ...stableConvertAccounts];
  // The destination list is the same set minus the chosen source — picking
  // the same account twice is the one pair that needs no explanation.
  const convertDestAccounts = convertSourceAccounts.filter(
    (a) => a.id !== s.convertSourceAccountId,
  );
  const convertSourceAccount =
    convertSourceAccounts.find((a) => a.id === s.convertSourceAccountId) || null;
  const convertDestAccount =
    convertSourceAccounts.find((a) => a.id === s.convertDestAccountId) || null;
  // The whole mode machinery collapses into this one call.
  const convertRoute = resolveConvertRoute(convertSourceAccount, convertDestAccount);
  const convertSourceCurrency = convertSourceAccount?.currency || "";
  const convertDestCurrency = convertDestAccount?.currency || "";
  const convertPathLabel =
    convertSourceCurrency &&
    convertDestCurrency &&
    convertSourceCurrency !== convertDestCurrency
      ? `${convertSourceCurrency} → ${convertDestCurrency}`
      : null;
  const swapAccepted = s.swapAccepted;
  const cardIsFrozen = isCardFrozenStatus(cardSel?.status);
  const cardDetail: any = cardSel
    ? {
        id: cardSel.id,
        label: cardSel.card_name || `Card ···· ${cardSel.last_four || ""}`,
        last4: cardSel.last_four || "",
        balance: usdSpendLabel,
        color: cardColor(cardColorKeys[cardSel.id]),
        status: cardSel.status,
        freezeTrack: cardIsFrozen ? "var(--indigo)" : "var(--surface3)",
        freezeKnobLeft: cardIsFrozen ? "23px" : "3px",
        exp:
          formatCardExpiry(cardSel.expiration_month, cardSel.expiration_year) ||
          null,
      }
    : {};
  const newCardLabel = s.newCardLabel;
  const newCardFirstName = s.newCardFirstName;
  const newCardLastName = s.newCardLastName;
  const newCardEmail = s.newCardEmail;
  const newCardPhone = s.newCardPhone;
  const newCardNotDone = !s.newCardDone;
  const newCardDone = s.newCardDone;
  const newCardIssuing = s.newCardIssuing;
  const newCardError = s.newCardError;
  const newlyIssuedCard = s.newlyIssuedCard as IssuedCard | null;
  const cardFreezeBusy = s.cardFreezeBusy;
  const cardFreezeError = s.cardFreezeError;
  const cardSecrets = s.cardSecrets as null | { number: string; cvv: string };
  const cardSecretsBusy = s.cardSecretsBusy;
  const cardSecretsError = s.cardSecretsError;
  const newlyIssuedExp = newlyIssuedCard
    ? formatCardExpiry(
        newlyIssuedCard.expiration_month,
        newlyIssuedCard.expiration_year,
      )
    : null;
  const cardBilling = billingAddressFromKyb(
    (meQuery.data?.kyb_summary?.profile?.registered_address as
      | { street: string; street2?: string | null; city: string; post_code: string; state?: string | null; country: string }
      | null
      | undefined) ?? null,
  );
  const cardholderDisplay =
    meQuery.data?.business?.legal_name ||
    meQuery.data?.business?.name ||
    "—";
  // Fail closed: handle /me errors before cached data, and require success
  // so a non-session failure cannot keep painting a stale shell.
  if (meQuery.isError) {
    if (isSessionExpiredError(meQuery.error)) {
      return (
        <div style={rootStyle}>
          <div className="ep-shell" style={{ padding: 48, textAlign: "center" }}>
            Redirecting to sign in…
          </div>
        </div>
      );
    }
    return (
      <div style={rootStyle}>
        <div className="ep-shell" style={{ padding: 48, textAlign: "center" }}>
          <p>Couldn&apos;t load your session.</p>
          <button type="button" onClick={() => router.replace("/login")}>
            Sign in
          </button>
        </div>
      </div>
    );
  }
  if (!meQuery.isSuccess || !meQuery.data) {
    return (
      <div style={rootStyle}>
        <div className="ep-shell" style={{ padding: 48, textAlign: "center" }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={rootStyle}>
<div data-screen-label="App" className={`ep-shell${s.sidebarOpen ? " ep-shell--drawer-open" : ""}`}>

{!isCompact ? (
<DesktopSidebar
  screen={s.screen}
  businessName={meQuery.data?.business?.name || "Loading…"}
  role={meQuery.data?.role}
  themeIcon={themeIcon}
  onHome={() => navigateToScreen("home")}
  onNavigate={navigateToScreen}
  onOpenHelp={() => openHelp()}
  onToggleTheme={toggleTheme}
  onLogout={logout}
/>
) : null}

<main className="ep-main">
<header className="ep-header">
<div className="ep-header__lead">
{isMoneyFlowScreen(s.screen) ? (
<button type="button" className="ep-header__back" onClick={exitMoneyFlow} aria-label="Back">←</button>
) : isCompact ? (
<span className="ep-header__brand-mark"><MbokaMark size={28} title="Mboka" /></span>
) : null}
<div className="ep-header__titles">
<h1>{currentTitle}</h1>
<p>{currentSubtitle}</p>
</div>
</div>
<div className="ep-header__actions">
{!isCompact ? <HeaderRates rates={liveRates} /> : null}
</div>
</header>

<div className="ep-content ep-content-cap">

{(isHome) ? (<>
<div data-screen-label="Home" className="ep-home">

<HomeIdentity
  businessName={meQuery.data?.business?.name || "Loading…"}
  role={meQuery.data?.role}
  kybApproved={kybApproved}
  kybLabel={describeKybStatus(kybStatus)}
  kybLoading={kybStatusLoading}
/>

{/* Hero: design total-balance card + three summary stats. Identity
    strip is compact-only; desktop carries the same identity in the sidebar. */}
<div className="ep-grid-home-balance">
<div className="ep-home__balance">
<div className="ep-home__balance-top">
<div className="ep-home__balance-heading">
<span className="ep-home__balance-label">Total balance</span>
<div className="ep-home__display-currency">
<span className="ep-home__display-currency-label">Show in</span>
<ChoicePicker
  id="home-display-currency"
  className="ep-home__display-currency-picker"
  triggerClassName="ep-home__display-currency-select"
  hideLabel
  label="Display currency"
  title="Show balance in"
  value={displayCurrency}
  options={displayCurrencyOptions.map((code) => ({ value: code, label: code }))}
  onChange={setDisplayCurrency}
  loading={sendCatalogQuery.isLoading && !sendCatalogQuery.data}
  loadingLabel="…"
  searchable={displayCurrencyOptions.length > 8}
  compactSheet
/>
</div>
</div>
<div className="ep-home__balance-tabs">
{(balanceViewTabs || []).map((bv: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={bv.select} className="ep-home__balance-tab" style={{background: (bv.bg), color: (bv.color)}}>{bv.label}</button>
</React.Fragment>
))}
</div>
</div>
<div className="ep-home__balance-value">{homeHeroLabel}</div>
{homeUsdSub ? (
<div className="ep-home__balance-usd">{homeUsdSub}</div>
) : null}
<div className="ep-home__balance-sub">{homeBalanceSub}</div>
</div>

<div className="ep-home__stats-desktop" aria-label="Cash flow">
{(homeStats || []).map((hs: any, __i1: number) => (
<button
  key={__i1}
  type="button"
  className="ep-home__stat"
  onClick={hs.onOpen}
  aria-label={hs.ariaLabel}
>
<span className="ep-home__stat-icon" style={{background: (hs.iconBg), color: (hs.iconColor)}} aria-hidden>{hs.icon}</span>
<div><div className="ep-home__stat-label">{hs.label}</div><div className="ep-home__stat-value">{hs.value}</div></div>
</button>
))}
</div>
</div>

{!kybStatusLoading && !kybApproved ? (
<KybGateBanner verificationStatus={kybStatus} reviewerNotes={kybReviewerNotes} showAction={canOpenKybWizard(kybStatus)} actionLabel={kybActionLabel} onStartVerification={() => { goVerification(); openModalKyb(); }} />
) : null}

{mfaShouldRemind ? (
<MfaReminderBanner cutoverAt={mfaCutoverAt} onSetUp={openMfaSetup} onDismiss={dismissMfaReminder} />
) : null}

<div className="ep-home__qa-row" aria-label="Quick actions">
{(quickActionTiles || []).map((qa: any, __i1: number) => (
<button key={__i1} type="button" onClick={qa.open} className="ep-home__qa">
<span className="ep-home__qa-icon" style={{background: (qa.iconBg), color: (qa.iconColor)}} aria-hidden>{qa.icon}</span>
<span className="ep-home__qa-text">
<span className="ep-home__qa-label">{qa.label}</span>
<span className="ep-home__qa-desc">{qa.desc}</span>
</span>
</button>
))}
</div>

{(homeCurrencyChips?.length) ? (
<div className="ep-home__chips" aria-label="Currency balances">
{(homeCurrencyChips || []).map((hc: any, __i1: number) => (
<button key={__i1} type="button" className="ep-home__chip" onClick={setScreen("wallets")}>
{hc.flagUrl ? (
  <span className="ep-flag" style={{backgroundImage: `url(${hc.flagUrl})`}} aria-hidden />
) : partnerNetworkForMark(hc.network) ? (
  <NetworkMark network={hc.network} size={28} title={null} />
) : (
  <span className="ep-home__balance-row-avatar" aria-hidden>{String(hc.code).slice(0, 2)}</span>
)}
<span className="ep-home__chip-copy">{hc.code} {hc.balance}</span>
</button>
))}
</div>
) : null}

<SectionHeader title="Recent activity" actionLabel="See all" onAction={goTransactions} />
<ActivityList title="Recent activity" items={homeRecent} showHeader={false} emptyLabel={transactionsQuery.isLoading ? "Loading…" : "No recent activity"} />

</div>
</>) : null}

{(isWallets) ? (<>
<WalletsScreen
  isMobile={isMobile}
  accountsCount={accountsCount}
  addAccountMenu={s.addAccountMenu}
  toggleAddAccountMenu={toggleAddAccountMenu}
  closeAddAccountMenu={closeAddAccountMenu}
  openCreateAccount={openCreateAccount}
  canCreateStablecoin={allSupportedStablecoinSlots().some(
    (slot) => !occupiedStablecoinSlotKeys.has(`${slot.currency}:${slot.network}`),
  )}
  canCreateBank={supportedFiatCurrencies.some(
    (code) => !occupiedFiatCodes.has(code),
  )}
  accounts={accounts}
  eligible={depositEligible}
  eligibilityLoading={
    bootstrapQuery.isLoading ||
    (!bootstrapReady && depositEligibilityQuery.isLoading)
  }
  verificationStatus={
    bootstrapReady
      ? bootstrapQuery.data?.eligibility.verification_status
      : depositEligibilityQuery.data?.verification_status
  }
  eligibilityErrorMessage={depositEligibilityErrorMessage}
  accountsLoading={
    accounts.length === 0 &&
    (bootstrapQuery.isLoading ||
      (!bootstrapReady &&
        ((depositEligible && depositAccountsQuery.isLoading) ||
          stablecoinAccountsQuery.isLoading ||
          depositEligibilityQuery.isLoading)))
  }
  accountsPendingMore={
    accounts.length > 0 &&
    (bootstrapQuery.isFetching ||
      (!bootstrapReady &&
        ((depositEligible && depositAccountsQuery.isLoading) ||
          stablecoinAccountsQuery.isLoading)))
  }
  accountsErrorMessage={depositAccountsErrorMessage}
  onRetryAccounts={() => {
    queryClient.invalidateQueries({ queryKey: [QK.dashboardBootstrap] });
    queryClient.invalidateQueries({ queryKey: [QK.depositAccountsEligibility] });
    queryClient.invalidateQueries({ queryKey: [QK.depositAccounts] });
    queryClient.invalidateQueries({ queryKey: [QK.stablecoinAccounts] });
  }}
  walletsRecent={walletsRecent}
  goTransactions={goTransactions}
  onConvert={openConvert}
/>
</>) : null}

{(isAccountDetail && acctDetail) ? (<>
<AccountDetailScreen
  name={acctDetail.name}
  currency={acctDetail.currency}
  flagUrl={acctDetail.flagUrl}
  railLabel={acctDetail.railLabel ?? `${acctDetail.currency} · Fiat`}
  statusLabel={acctDetail.statusLabel}
  statusColor={acctDetail.statusColor}
  statusSoft={acctDetail.statusSoft}
  balance={acctDetail.balance ?? "—"}
  balanceSub={acctDetail.balanceSub ?? "Balance not yet available"}
  summaryLines={acctDetailLines}
  recent={accountDetailRecent}
  canConvert={Boolean(acctDetail.showConvert)}
  canFund={
    selectedDepositAccount
      ? !selectedFiatUnavailable
      : !selectedStablecoinAccount || !isClosedStatus(selectedStablecoinAccount.status)
  }
  fundDisabledReason={
    selectedDepositAccount && selectedFiatUnavailable
      ? "Deposit rail unavailable for this account."
      : undefined
  }
  canSend={!selectedStablecoinAccount || !isClosedStatus(selectedStablecoinAccount.status)}
  canClose={
    selectedStablecoinAccount
      ? isCloseableStablecoinAccount(selectedStablecoinAccount)
      : selectedDepositAccount
        ? isCloseableDepositAccount(selectedDepositAccount)
        : false
  }
  closeDisabledReason={
    selectedDepositAccount && !isCloseableDepositAccount(selectedDepositAccount)
      ? "This account isn't ready to close yet."
      : undefined
  }
  onBack={backToWallets}
  onOpenDetails={openAcctDetailsModal}
  onFund={() => {
    // Fund inside an account opens Add money with that account already chosen.
    if (meQuery.isLoading || meQuery.isPending) return;
    const kyb = (meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? "pending";
    if (!isKybApproved(kyb)) {
      goVerification();
      if (canOpenKybWizard(kyb)) openModalKyb();
      return;
    }
    const target = fundFromAccountTarget({
      stablecoin: selectedStablecoinAccount
        ? {
            id: selectedStablecoinAccount.id,
            currency: selectedStablecoinAccount.currency,
            network: selectedStablecoinAccount.network,
          }
        : null,
      fiat: selectedDepositAccount
        ? {
            id: selectedDepositAccount.id,
            currency: selectedDepositAccount.currency,
            entity_id: selectedDepositAccount.entity_id,
          }
        : null,
    });
    if (!target) {
      openAcctFundChooser();
      return;
    }
    const base = { ...moneyFlowReset, modal: "deposit", moreOpen: false, sidebarOpen: false };
    if (target.kind === "wallet") {
      setState({
        ...base,
        depositFromAccount: true,
        fundTargetAccountId: target.id,
        depositAsset: target.asset || s.depositAsset,
        depositNetwork: toUiNetworkKey(target.network) || s.depositNetwork,
      });
    } else if (target.kind === "interac") {
      setState({ ...base, fundInteracAccountId: target.id });
    } else {
      setState({ ...base, fundFiatLockedId: target.id });
    }
  }}
  onSend={
    selectedDepositAccount &&
    fiatSendOpensBankPayout(String(selectedDepositAccount.currency || ""))
      ? guardMoneyModal("payout")
      : openSelectedAccountSend
  }
  onConvert={openConvert}
  onMove={
    selectedDepositAccount
      ? guardMoneyModal("bookTransfer")
      : undefined
  }
  onPayout={
    selectedDepositAccount
      ? guardMoneyModal("payout")
      : undefined
  }
  onCloseAccount={
    selectedStablecoinAccount || selectedDepositAccount ? openCloseAccountChooser : undefined
  }
  onViewAllTx={goTransactions}
/>
</>) : null}
{(isAccountDetail && !acctDetail) ? (<>
<div className="ep-acct-detail" data-screen-label="Account detail">
<button type="button" onClick={backToWallets} className="ep-acct-detail__back">← Accounts</button>
<div className="ep-wallets__empty">
<div className="ep-wallets__empty-title">Account not found</div>
<div className="ep-wallets__empty-body">This account is no longer available. Go back to Accounts to pick another.</div>
</div>
</div>
</>) : null}

{(isCards) ? (<>
<div data-screen-label="Cards" className="ep-cards">
<div className="ep-cards__head">
{/* Every card spends one shared USD balance, so it — and topping it up —
    lives here once rather than repeated under each card. */}
<div className="ep-cards__summary">
<span className="ep-cards__summary-label">Card balance</span>
<span className="ep-cards__summary-amount">{usdFunding ? usdSpendLabel : "—"}</span>
<span className="ep-cards__summary-sub">{cardsSummarySub}</span>
</div>
<div className="ep-cards__head-actions">
<button type="button" onClick={fundCard} className="ep-cards__cta ep-cards__cta--secondary" disabled={!usdFunding}>Top up</button>
<button type="button" onClick={openNewCard} className="ep-cards__cta" disabled={!usdFunding}>+ New card</button>
</div>
</div>
{cardsError ? (
  <div className="ep-cards__preview" role="alert">
    <span className="ep-cards__preview-badge">{cardsErrorBadge}</span>
    <span className="ep-cards__preview-text">{cardsError}</span>
  </div>
) : null}
{cardsLoading ? (
  <div className="ep-cards__empty">Loading cards…</div>
) : cards.length === 0 && !cardsError ? (
  <div className="ep-cards__empty">No cards yet. Issue a virtual card linked to your USD account.</div>
) : (
<div className="ep-cards__grid">
{(cards || []).map((c: any) => (
<div key={c.id} className={`ep-cards__item${c.actionDisabled ? " ep-cards__item--failed" : ""}`}>
<CardFlipTile
  cardId={c.id}
  label={c.label}
  color={c.color}
  status={c.status}
  statusLabel={c.statusLabel}
  last4={c.last4}
  expiry={c.exp}
  flipped={!!s.cardTileFlipped[c.id]}
  onFlip={flipCardTile(c.id)}
  secrets={s.cardTileSecrets[c.id] || null}
  secretsBusy={!!s.cardTileSecretsBusy[c.id]}
  secretsError={s.cardTileSecretsError[c.id] || ""}
  copiedField={s.copiedField}
  onCopy={copyField}
  actionDisabled={c.actionDisabled}
  actionDisabledReason={c.actionDisabledReason}
/>
<div className="ep-cards__below">
<span className="ep-cards__state" data-state={c.status}>{c.statusLabel}</span>
{c.actionDisabled ? null : (
<div className="ep-cards__pills">
{c.status === "frozen" ? (
<button type="button" onClick={() => void toggleFreezeCard(c.id)} className="ep-cards__pill" disabled={s.cardFreezeBusy && s.selectedCardId === c.id} title={s.cardFreezeError && s.selectedCardId === c.id ? s.cardFreezeError : undefined}>{s.cardFreezeBusy && s.selectedCardId === c.id ? "Unfreezing…" : "Unfreeze"}</button>
) : (
<button type="button" onClick={flipCardTile(c.id)} className="ep-cards__pill" aria-pressed={!!s.cardTileFlipped[c.id]}>{s.cardTileFlipped[c.id] ? "Hide details" : "Details"}</button>
)}
<button type="button" onClick={c.manage} className="ep-cards__pill">Manage</button>
</div>
)}
</div>
</div>
))}
</div>
)}
<CardSpendList
  title="Card spend"
  items={cardsSpendItems}
  onViewAll={goTransactions}
  emptyLabel={
    cardTransactionsQuery.isLoading || usdFundingQuery.isLoading
      ? "Loading card spend…"
      : cardTransactionsQuery.isError
        ? "Couldn't load card spend. Try refreshing."
        : !usdFundingQuery.data
          ? "Link an active USD account to see card spend."
          : "No card spend yet. Authorizations show here after the card is used."
  }
/>
</div>
</>) : null}

{(isTransactions) ? (<>
{(MIXED_RAIL_BULK_PAYOUTS_ENABLED || STELLAR_BULK_PAYOUTS_ENABLED) ? (
<div className="ep-txn-filters" role="group" aria-label="Switch between payments and disbursement batches" style={{ marginBottom: "4px" }}>
  <button
    type="button"
    onClick={() => setState({ txView: "payments" })}
    className={`ep-txn-filter${s.txView !== "batches" ? " ep-txn-filter--active" : ""}`}
    aria-pressed={s.txView !== "batches"}
  >
    Payments
  </button>
  <button
    type="button"
    onClick={() => setState({ txView: "batches" })}
    className={`ep-txn-filter${s.txView === "batches" ? " ep-txn-filter--active" : ""}`}
    aria-pressed={s.txView === "batches"}
  >
    Batches
  </button>
</div>
) : null}
{(s.txView === "batches" && (MIXED_RAIL_BULK_PAYOUTS_ENABLED || STELLAR_BULK_PAYOUTS_ENABLED)) ? (
<DisbursementBatchHistory
  sourceAccounts={bulkPayoutSourceAccounts}
  onDone={() => setState({ txView: "payments" })}
/>
) : (
<TransactionsScreen
  txFilters={txFilters}
  filteredTransactions={filteredTransactions}
  emptyLabel={
    (txUsesLatestFifty ? transactionsQuery.isLoading : transactionsPageQuery.isLoading)
      ? "Loading…"
      : (txUsesLatestFifty ? transactionsQuery.isError : transactionsPageQuery.isError)
        ? "Couldn't load transactions"
        : "No transactions match this filter"
  }
  pageNumber={txUsesLatestFifty ? 1 : transactionsPageQuery.pageNumber}
  pageCount={txUsesLatestFifty ? 1 : transactionsPageQuery.pageCount}
  total={txUsesLatestFifty ? filteredTransactions.length : transactionsPageQuery.total}
  hasNext={!txUsesLatestFifty && transactionsPageQuery.hasNext}
  hasPrev={!txUsesLatestFifty && transactionsPageQuery.hasPrev}
  onNextPage={transactionsPageQuery.nextPage}
  onPrevPage={transactionsPageQuery.prevPage}
  isFetching={txUsesLatestFifty ? transactionsQuery.isFetching : transactionsPageQuery.isFetching}
  search={s.txSearch}
  onSearchChange={(value) => setState({ txSearch: value })}
  currency={s.txCurrency}
  currencyOptions={txCurrencyOptions}
  onCurrencyChange={(value) => setState({ txCurrency: value })}
  dateRange={s.txDateRange}
  onDateRangeChange={(value) => setState({ txDateRange: value })}
  usesLatestFifty={txUsesLatestFifty}
/>
) }
</>) : null}

{(isInvoices) ? (<>
<div data-screen-label="Invoices" className="ep-invoices-shell">
<InvoicesErrorBoundary>
<InvoicesScreen />
</InvoicesErrorBoundary>
</div>
</>) : null}

{(isReports) ? (<>
<div data-screen-label="Reports" className="ep-reports">
<StatementsPanel />
</div>
</>) : null}

{(isVerification) ? (<>
<VerificationScreen
  status={kybStatus}
  loading={kybStatusLoading}
  onStartKyb={openModalKyb}
  actionLabel={kybActionLabel}
  reviewerNotes={kybReviewerNotes}
  reviewFindings={kybReviewFindings}
  submittedAt={typeof meQuery.data?.kyb_summary?.profile?.submitted_at === "string" ? meQuery.data.kyb_summary.profile.submitted_at : null}
  reviewedAt={typeof meQuery.data?.kyb_summary?.profile?.reviewed_at === "string" ? meQuery.data.kyb_summary.profile.reviewed_at : null}
/>
</>) : null}

{(isTeam) ? (<>
<div data-screen-label="Team" className="ep-team">
<div className="ep-team__head">
<h2 className="ep-team__title">Members · {teamCount}</h2>
{isTeamAdmin ? (
<button type="button" onClick={openInvite} className="ep-team__cta">+ Invite person</button>
) : (
<span className="ep-team__preview-text">Only admins can invite or change roles.</span>
)}
</div>
{(teamLoadError || (teamActionError && !teamConfirm)) ? (
<p className="ep-team__preview-text" role="alert" style={{ color: "var(--danger, #b42318)" }}>
{teamLoadError || teamActionError}
</p>
) : null}
{teamLoading && !allTeamRows.length ? (
<p className="ep-team__preview-text">Loading team…</p>
) : null}

<section className="ep-panel ep-team__list">
{(allTeamRows || []).map((m: any) => (
<div key={m.key} className="ep-team-row">
<span className="ep-team__avatar" aria-hidden>{m.initials}</span>
<div className="ep-team__identity">
<div className="ep-team__name">{m.name}{m.isSelf ? " (you)" : ""}</div>
<div className="ep-team__email">{m.email}</div>
</div>
<div className="ep-team__meta">
<StatusBadge label={m.statusLabel} color={m.statusColor} soft={m.statusSoft} />
<span className="ep-team__role-pill">{m.roleLabel}</span>
</div>
<div className="ep-team-row__actions">
{m.kind === "member" && isTeamAdmin ? (
<>
<select value={m.role} onChange={m.setRole} aria-label={`Role for ${m.name}`}>
{(m.roleOptions || []).map((ro: any) => (
<option key={ro.key} value={ro.key}>{ro.label}</option>
))}
</select>
<button type="button" onClick={m.remove} className="ep-team__remove" aria-label={`Remove ${m.name}`}>✕</button>
</>
) : null}
{m.kind === "invite" && isTeamAdmin ? (
<button type="button" onClick={m.revoke} className="ep-team__remove" aria-label={`Revoke invite for ${m.email}`}>Revoke</button>
) : null}
</div>
</div>
))}
{!teamLoading && !allTeamRows.length && !teamLoadError ? (
<p className="ep-team__preview-text">No members yet.</p>
) : null}
</section>

<section className="ep-panel" style={{ marginTop: "20px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
<div>
<h3 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>
Two-factor authentication
</h3>
<p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
{mfaEnabled
  ? "Your account requires a code from your authenticator app when you sign in."
  : "Add an extra layer of protection to your own sign-in."}
</p>
</div>

<span role="status" aria-live="polite">
<StatusBadge
  label={mfaEnabled ? "Enabled" : "Disabled"}
  color={mfaEnabled ? "#1B7A3D" : "var(--muted)"}
  soft={mfaEnabled ? "#E8F7EE" : "var(--surface2)"}
/>
</span>
</div>
{mfaEnabled ? (
<button type="button" onClick={openMfaDisable} className="ep-team__remove" style={{ alignSelf: "flex-start" }}>
Disable 2FA
</button>
) : (
<button type="button" onClick={openMfaSetup} className="ep-team__cta" style={{ alignSelf: "flex-start" }}>
Set up 2FA
</button>
)}
</section>

{(inviteOpen) ? (<>
<div className="ep-team__invite-overlay" onClick={closeInvite} role="presentation">
<div className="ep-team__invite" onClick={stopClick} role="dialog" aria-modal="true" aria-labelledby="ep-team-invite-title">
<div className="ep-team__invite-head">
<h3 id="ep-team-invite-title" className="ep-team__invite-title">Invite a teammate</h3>
<button type="button" onClick={closeInvite} className="ep-team__invite-close" aria-label="Close invite">✕</button>
</div>
<label className="ep-team__field">
<span className="ep-team__field-label">Email address</span>
<input value={inviteEmail} onChange={setInviteEmail} placeholder="name@company.com" className="ep-team__input" type="email" autoComplete="email" />
</label>
<div className="ep-team__field">
<span className="ep-team__field-label">Role</span>
<div className="ep-team__roles" role="radiogroup" aria-label="Invite role">
{(inviteRoleChips || []).map((r: any) => (
<button
  key={r.key}
  type="button"
  role="radio"
  aria-checked={r.selected}
  onClick={r.select}
  className={`ep-team__role${r.selected ? " ep-team__role--selected" : ""}`}
>
<span className="ep-team__role-label">{r.label}</span>
<span className="ep-team__role-desc">{r.desc}</span>
</button>
))}
</div>
</div>
{inviteError ? <p role="alert" style={{ color: "var(--danger, #b42318)", fontSize: "13px" }}>{inviteError}</p> : null}
<p className="ep-team__invite-hint">
We&apos;ll email them a sign-in link and, if they&apos;re new, a temporary password. Signing in joins the team automatically.
</p>
<button type="button" onClick={submitInvite} disabled={inviteCannotSubmit} className="ep-team__invite-submit">
{inviteBusy ? "Sending…" : "Send invite"}
</button>
</div>
</div>
</>) : null}

{(teamConfirm) ? (<>
<div className="ep-team__invite-overlay" onClick={teamConfirmBusy ? undefined : closeTeamConfirm} role="presentation">
<div className="ep-team__invite ep-team__confirm" onClick={stopClick} role="dialog" aria-modal="true" aria-labelledby="ep-team-confirm-title">
<div className="ep-team__invite-head">
<h3 id="ep-team-confirm-title" className="ep-team__invite-title">
{teamConfirm.kind === "revoke" ? "Revoke invite?" : "Remove member?"}
</h3>
<button type="button" onClick={closeTeamConfirm} className="ep-team__invite-close" aria-label="Cancel" disabled={teamConfirmBusy}>✕</button>
</div>
<p className="ep-team__confirm-body">
{teamConfirm.kind === "revoke"
  ? <>This cancels the pending invite for <strong>{teamConfirm.label}</strong>. They won&apos;t be able to join with the old link.</>
  : <>Remove <strong>{teamConfirm.label}</strong> from this business? They&apos;ll lose access immediately.</>}
</p>
{teamActionError ? <p role="alert" style={{ color: "var(--danger, #b42318)", fontSize: "13px" }}>{teamActionError}</p> : null}
<div className="ep-team__confirm-actions">
<button type="button" onClick={closeTeamConfirm} className="ep-team__confirm-cancel" disabled={teamConfirmBusy}>Cancel</button>
<button type="button" onClick={confirmTeamAction} className="ep-team__confirm-danger" disabled={teamConfirmBusy}>
{teamConfirmBusy ? "Working…" : teamConfirm.kind === "revoke" ? "Revoke invite" : "Remove member"}
</button>
</div>
</div>
</div>
</>) : null}
</div>
</>) : null}

{(isDeveloper) ? (<>
<div data-screen-label="Developer" className="ep-developer">
<div className="ep-developer__head">
<h2 className="ep-developer__title">API keys</h2>
<button type="button" onClick={openCreateApiKeyModal} className="ep-developer__cta">+ Create key</button>
</div>

{(showNewApiKeyBanner) ? (
<div className="ep-developer__banner" role="status">
<div className="ep-developer__banner-copy">
<span className="ep-developer__banner-badge">Copy now</span>
<span className="ep-developer__banner-text">Your new secret key is shown once below. Store it securely — it can’t be recovered later.</span>
</div>
<button type="button" onClick={dismissNewApiKey} className="ep-developer__banner-dismiss">Dismiss</button>
</div>
) : null}

{(apiKeysLoading) ? (
<div className="ep-developer__empty" role="status">Loading API keys…</div>
) : null}

{(apiKeysEmpty) ? (
<div className="ep-developer__empty">
<p className="ep-developer__empty-title">No API keys yet</p>
<p className="ep-developer__empty-text">Create a sandbox key to integrate webhooks and server-side payouts.</p>
<button type="button" onClick={openCreateApiKeyModal} className="ep-developer__cta">+ Create key</button>
</div>
) : null}

{(apiKeys || []).map((k: any) => (
<section key={k.id} className={`ep-developer__card${k.isJustMinted ? " ep-developer__card--new" : ""}`}>
<div className="ep-developer__card-head">
<div className="ep-developer__card-identity">
<b className="ep-developer__card-name">{k.label}</b>
<span className={`ep-developer__env${k.modeLabel === "Live" ? " ep-developer__env--live" : ""}`}>{k.modeLabel}</span>
</div>
<button type="button" onClick={k.revoke} className="ep-developer__revoke">Revoke</button>
</div>

<div className="ep-developer__field">
<span className="ep-developer__field-label">Secret key</span>
<div className="ep-secret-row">
<span className="ep-secret-row__value">{k.keyDisplay}</span>
<div className="ep-secret-row__actions">
<button type="button" onClick={k.toggleReveal} disabled={!k.canRevealKey} title={k.revealTitle || undefined} className="ep-developer__btn ep-developer__btn--soft" style={{opacity: k.canRevealKey ? 1 : 0.5, cursor: k.canRevealKey ? "pointer" : "not-allowed"}}>{k.revealLabel}</button>
<button type="button" onClick={k.copyKey} disabled={!k.canRevealKey} title={k.revealTitle || undefined} className="ep-developer__btn ep-developer__btn--solid" style={{opacity: k.canRevealKey ? 1 : 0.5, cursor: k.canRevealKey ? "pointer" : "not-allowed"}}>{k.copyKeyLabel}</button>
</div>
</div>
{!k.canRevealKey ? <span className="ep-developer__hint">Full key available only at creation time.</span> : null}
</div>

<div className="ep-developer__field">
<span className="ep-developer__field-label">Webhook URL</span>
<div className="ep-secret-row">
<span className="ep-secret-row__value">{k.webhookUrl}</span>
<div className="ep-secret-row__actions">
<button type="button" onClick={k.copyWebhook} disabled={!k.canCopyWebhook} className="ep-developer__btn ep-developer__btn--solid" style={{opacity: k.canCopyWebhook ? 1 : 0.5, cursor: k.canCopyWebhook ? "pointer" : "not-allowed"}}>{k.copyWebhookLabel}</button>
</div>
</div>
<span className="ep-developer__hint">{k.events}</span>
</div>

<div className="ep-developer__field">
<span className="ep-developer__field-label">Webhook signing secret</span>
<div className="ep-secret-row">
<span className="ep-secret-row__value">{k.webhookSecretDisplay}</span>
<div className="ep-secret-row__actions">
<button type="button" onClick={k.toggleRevealSecret} disabled={!k.canRevealSecret} className="ep-developer__btn ep-developer__btn--soft" style={{opacity: k.canRevealSecret ? 1 : 0.5, cursor: k.canRevealSecret ? "pointer" : "not-allowed"}}>{k.revealSecretLabel}</button>
<button type="button" onClick={k.copySecret} disabled={!k.canCopySecret} className="ep-developer__btn ep-developer__btn--solid" style={{opacity: k.canCopySecret ? 1 : 0.5, cursor: k.canCopySecret ? "pointer" : "not-allowed"}}>{k.copySecretLabel}</button>
</div>
</div>
</div>
</section>
))}
{showStellarLiquidityPanel ? <StellarLiquidityPanel /> : null}
</div>
</>) : null}


</div>

{isCompact ? (
<MobileBottomNav
  screen={s.screen}
  moreOpen={s.moreOpen}
  onNavigate={navigateToScreen}
  onOpenMore={() => setState({ moreOpen: true })}
/>
) : null}
</main>
</div>

{isCompact ? (
<MoreSheet
  open={s.moreOpen}
  screen={s.screen}
  businessName={meQuery.data?.business?.name || "Loading…"}
  role={meQuery.data?.role}
  themeIcon={themeIcon}
  onClose={closeMore}
  onNavigate={navigateToScreen}
  onOpenHelp={() => openHelp()}
  onOpenBulk={guardMoneyModal("bulk")}
  bulkEnabled={MIXED_RAIL_BULK_PAYOUTS_ENABLED || STELLAR_BULK_PAYOUTS_ENABLED}
  onOpenTopUp={guardMoneyModal("deposit")}
  onToggleTheme={toggleTheme}
  onLogout={logout}
/>
) : null}

{isSendFlow ? (
<SendFlow
  sendNotDone={sendNotDone}
  sendDone={sendDone}
  sendMethodChosen={sendMethodChosen}
  sendMethodOptions={sendMethodOptions}
  resetSendMethod={resetSendMethod}
  sendStepDots={sendStepDots}
  sendStepIs1={sendStepIs1}
  sendStepIs2={sendStepIs2}
  sendStepIs3={sendStepIs3}
  sendIsCountry={sendIsCountry}
  sendIsCrypto={sendIsCrypto}
  sendCountryChips={sendCountryChips}
  sendRailHasChoice={sendRailHasChoice}
  sendRailChips={sendRailChips}
  sendProviderHasChoice={sendProviderHasChoice}
  sendProviderChips={sendProviderChips}
  sendCatalogLoading={sendCatalogLoading}
  sendCatalogError={sendCatalogError}
  onRetrySendCatalog={retrySendCatalog}
  sendAssets={sendAssets}
  sendChains={sendChains}
  sendAssetCode={sendAssetCode}
  sendChainLabel={sendChainLabel}
  sendNext={sendNext}
  sendReview={sendReview}
  sendMethodKey={s.sendMethod}
  sendBack={sendBack}
  sendDestinationSummary={sendDestinationSummary}
  sendCountryName={sendCountry.name}
  sendCountryFlagUrl={flagUrl(sendCountry.iso)}
  sendCurrencyCode={sendCountry.code}
  sendCurrencyName={currencyLabel(sendCountry.code)}
  sendCountryIdx={s.sendCountryIdx}
  selectSendCountry={(i) => selectSendCountry(i)()}
  sendProviderLabel={sendProviderPickerLabel}
  sendProviderOptions={sendProviderOptions}
  selectSendProvider={pickSendProvider}
  sendProviderIdx={sendProviderIdx}
  sendIsBankRail={sendIsCountry && sendRail.type === "bank"}
  sendIsMobileRail={sendIsCountry && isMobileMoneyRail(sendRail.type)}
  sendProvidersAreFallback={sendProvidersAreFallback}
  sendBlockedNoNetworkId={sendBlockedNoNetworkId}
  sendAmountCurrency={sendAmountCurrency}
  sendYouPayText={sendYouPayText}
  sendLocalCurrency={sendLocalCurrency}
  sendCanEnterLocal={sendCanEnterLocal}
  setSendAmountCurrency={(c: string) => setState({ sendAmountCurrency: c })}
  sendAmountEquivalent={sendAmountEquivalent}
  sendBreakdown={sendBreakdown}
  sendReference={s.sendReference || ""}
  setSendReference={
    unifiedSendsLive() && sendIsCountry
      ? (e) => setState({ sendReference: e.target.value, sendQuoteError: "" })
      : undefined
  }
  sendIndicativeRateLine={sendIndicativeRateLine}
  sendQuotedRateLine={sendQuotedRateLine}
  sendLimitError={sendLimitError}
  sendMaxAmount={sendMaxAmount}
  onMaxSendAmount={
    sendIsCountry && sendMaxAmount ? () => setState({ sendAmount: sendMaxAmount }) : undefined
  }
  setSendAmountToMax={
    !sendIsCountry && sendMaxAmount ? () => setState({ sendAmount: sendMaxAmount }) : undefined
  }
  sendBalanceError={sendBalanceError}
  savedRecipients={savedRecipientsQuery.data ?? []}
  savedRecipientsLoading={savedRecipientsQuery.isLoading}
  onSelectSavedRecipient={applySavedRecipient}
  onSaveRecipientDetails={saveCurrentRecipientDetails}
  saveRecipientBusy={saveRecipientBusy}
  saveRecipientMessage={saveRecipientMessage}
  sendRefundWalletOptions={sendUnifiedCountry
    ? sendEligibleSources.map((source) => ({
        value: source.account_id,
        label: sendSourceLabel(source),
      }))
    : fundableRefundWallets.map((a) => {
    const bal = formatAccountBalance(a.balance, { maximumFractionDigits: 2 });
    const balPart =
      bal !== "—" ? ` · Available ${bal} ${a.balance?.currency || a.currency}` : "";
    return {
      value: a.id,
      label: `${a.currency} · ${formatNetworkLabel(a.network)}${balPart}${
        a.walletAddress ? ` · ${a.walletAddress.slice(0, 6)}…${a.walletAddress.slice(-4)}` : ""
      }`,
    };
  })}
  sendRefundWalletId={sendUnifiedCountry ? sendUnifiedSource?.account_id || "" : s.sendAccountId || ""}
  selectSendRefundWallet={(accountId) => {
    if (sendUnifiedCountry) {
      setState({ sendAccountId: accountId, sendQuoteError: "", sendPreview: null });
      return;
    }
    const account = fundableRefundWallets.find((row) => row.id === accountId);
    if (!account) return;
    setState({
      sendAccountId: account.id,
      sendChain: toUiNetworkKey(account.network) || s.sendChain,
      sendAsset: account.currency.trim().toLowerCase() || s.sendAsset,
      sendQuoteError: "",
      sendPreview: null,
    });
  }}
  sendRefundWalletsError={
    sendUnifiedCountry && sendOptionsQuery.isError && !sendOptionsQuery.data
      ? SEND_OPTIONS_UNAVAILABLE
      : null
  }
  onRetrySendRefundWallets={
    sendUnifiedCountry ? () => void sendOptionsQuery.refetch() : undefined
  }
  sendRefundWalletsLoading={
    (sendUnifiedCountry
      ? sendOptionsQuery.isLoading
      : bootstrapQuery.isLoading || (!bootstrapReady && stablecoinAccountsQuery.isLoading))
  }
  sendRecipientName={sendRecipientName}
  setSendRecipientName={setSendRecipientName}
  sendProviderIsRail={!!sendPayoutCtx}
  sendExtraFields={(sendPayoutCtx?.fields ?? []).map((f) => ({
    ...f,
    value: String(s.sendRecipientDetails?.[f.key] ?? ""),
    error: extraFieldError(f.key, s.sendRecipientDetails?.[f.key], f.country),
  }))}
  sendRecipientError={accountBoxError(sendPayoutCtx?.fields ?? [], s.sendRecipient)}
  setSendExtraField={(key, value) =>
    setState((prev: any) => ({
      sendRecipientDetails: { ...(prev.sendRecipientDetails || {}), [key]: value },
      sendQuoteError: "",
    }))
  }
  sendRecipientLabel={sendRecipientLabel}
  sendRecipient={sendRecipient}
  sendRecipientTyped={s.sendRecipientTyped}
  setSendRecipient={setSendRecipient}
  normalizeSendRecipientPhone={normalizeSendRecipientPhone}
  sendRecipientPlaceholder={sendRecipientPlaceholder}
  sendMemo={s.sendMemo}
  setSendMemo={setSendMemo}
  sendMemoApplies={sendIsCrypto && s.sendChain === "stellar"}
  sendAmount={sendAmount}
  setSendAmount={setSendAmount}
  sendQuoteError={sendQuoteError}
  sendQuoteLoading={sendQuoteLoading}
  sendQuoteRateText={sendQuoteRateText}
  sendFeeText={
    sendEstimate && !s.sendUnifiedQuote
      ? `${unifiedFeeText(sendEstimate.fee)} (estimate)`
      : sendFeeText
  }
  sendTotalDebitText={
    sendEstimate && !s.sendUnifiedQuote
      ? unifiedMoneyText(sendEstimate.total_debit)
      : sendTotalDebitText
  }
  sendArrivalText={sendArrivalText}
  sendQuoteExpiresAt={(s.sendGroup === "crypto" ? sendPreview?.expires_at : sendQuote?.expires_at) ?? null}
  sendAcceptError={sendAcceptError}
  sendAccepting={sendAccepting}
  submitSend={submitSend}
  sendResultText={sendResultText}
  sendSuccessDetails={sendSuccessDetails}
  sendExplorerUrl={sendExplorerUrl}
  sendLiveStatus={sendLiveStatus}
  closeModal={closeModal}
  onContactSupport={() => openHelp({ category: "payout" })}
  sendOutcome={sendOutcome}
  sendOrderId={sendOrderId}
  sendUpdatedAt={unifiedSend ? unifiedSend.updated_at : sendStatusQuery.data?.updated_at ?? null}
  sendFailureMessage={unifiedFailureMessage(unifiedSend)}
  sendRefundText={unifiedRefundText(unifiedSend)}
  sendRetry={sendRetry}
  onViewTransactions={() => {
    closeModal();
    goTransactions();
  }}
  containerRef={modalRef}
/>
) : isDepositFlow ? (
<DepositFlow
  containerRef={modalRef}
  walletOptions={fundableRefundWallets.map((a) => {
    const available = a.balance?.available;
    const n = available == null || available === "" ? Number.NaN : Number(available);
    return {
      value: a.id,
      label: `${a.currency} wallet · ${formatNetworkLabel(a.network)}`,
      asset: a.currency,
      network: formatNetworkLabel(a.network),
      meta: a.walletAddress ? `${a.walletAddress.slice(0, 6)}…${a.walletAddress.slice(-4)}` : null,
      balanceText: Number.isFinite(n)
        ? `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${a.currency}`
        : null,
    };
  })}
  walletId={s.fundTargetAccountId || ""}
  selectWallet={(accountId) => {
    if (depositWalletLocked) return;
    const account = fundableRefundWallets.find((row) => row.id === accountId);
    if (!account) return;
    setState({
      fundTargetAccountId: account.id,
      // A wallet picked after a fiat account: no background convert.
      fundAfricanTargetCurrency: null,
      fundFiatAccountId: null,
      depositAsset: account.currency.trim().toLowerCase() || s.depositAsset,
      depositNetwork: toUiNetworkKey(account.network) || s.depositNetwork,
      depositQuote: null,
      depositQuoteError: "",
      depositAccept: null,
      depositAcceptError: "",
      depositDone: false,
    });
  }}
  walletsLoading={bootstrapQuery.isLoading || (!bootstrapReady && stablecoinAccountsQuery.isLoading)}
  walletsError={!bootstrapReady && stablecoinAccountsQuery.isError ? "Couldn’t load your accounts." : null}
  onRetryWallets={() => {
    void bootstrapQuery.refetch();
    void stablecoinAccountsQuery.refetch();
  }}
  walletLocked={depositWalletLocked}
  walletLabel={
    fundableRefundWallets.find((a) => a.id === s.fundTargetAccountId)
      ? (() => {
          const a = fundableRefundWallets.find((row) => row.id === s.fundTargetAccountId)!;
          return `${a.currency} wallet · ${formatNetworkLabel(a.network)}`;
        })()
      : depositWalletLabel
  }
  interacAccounts={depositAccountsList
    .filter(
      (a) =>
        remittanceMethodForCurrency(a.currency) === "interac" &&
        (a.status === "active" || a.status === "deposit_unavailable") &&
        Boolean(String(a.entity_id || "").trim() && a.id),
    )
    .map((a) => {
      const available = a.balance?.available;
      const n = available == null || available === "" ? Number.NaN : Number(available);
      return {
        id: String(a.id),
        entityId: String(a.entity_id),
        label: `${a.currency} account`,
        balanceText: Number.isFinite(n)
          ? `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${a.currency}`
          : null,
      };
    })}
  fiatAccounts={depositAccountsList
    .filter(
      (a) =>
        Boolean(a.id) &&
        (a.status === "active" || a.status === "pending") &&
        !(
          remittanceMethodForCurrency(a.currency) === "interac" &&
          Boolean(String(a.entity_id || "").trim())
        ),
    )
    .map((a) => {
      const available = a.balance?.available;
      const n = available == null || available === "" ? Number.NaN : Number(available);
      return {
        id: String(a.id),
        currency: a.currency,
        label: `${a.currency} account`,
        balanceText: Number.isFinite(n)
          ? `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${a.currency}`
          : null,
        sections: a.status === "active" ? buildDepositAccountDetailSections(a) : [],
        disclaimer: a.status === "active" ? resolveDepositDisclaimer(a) : null,
        convertFund: planAfricanFundOrchestration({
          fiatCurrency: a.currency,
          fiatAccountId: String(a.id),
          entityId: fundingUsdcAccount?.entityId ?? null,
          usdcAccountId: fundingUsdcAccount?.id ?? null,
          usdcWalletAddress: fundingUsdcAccount?.walletAddress ?? null,
          treasuryWalletAddress: resolveTreasuryWalletAddress({
            summaryWallet: summaryQuery.data?.totals.wallet_address,
            stablecoinAccounts: stablecoinAccountsQuery.data,
          }),
          convertNetworkId: null,
        }).canRunAfricanOnRamp,
        openBanking:
          remittanceMethodForCurrency(a.currency) === "open_banking" &&
          Boolean(String(a.entity_id || "").trim()),
      };
    })}
  onOpenFiatAccount={(id) => {
    const account = depositAccountsList.find((a) => String(a.id) === id);
    if (!account || !needsDepositInstructionsSync(account)) return;
    if (depositInstructionsSyncAttemptedRef.current.has(id)) return;
    depositInstructionsSyncAttemptedRef.current.add(id);
    void refreshDepositAccount(id).catch(() => {
      depositInstructionsSyncAttemptedRef.current.delete(id);
    });
  }}
  fiatLockedAccountId={s.fundFiatLockedId}
  onFiatConvertFund={(id) => {
    const account = depositAccountsList.find((a) => String(a.id) === id);
    if (account) openAfricanFundOnRamp({ id, currency: account.currency });
  }}
  onFiatOpenBanking={(id) => {
    const account = depositAccountsList.find((a) => String(a.id) === id);
    if (!account) return;
    setState({
      selectedAcctKind: "fiat",
      selectedAcctKey: `fiat:${account.currency.toUpperCase()}`,
      modal: "fundPaymentRequest",
    });
  }}
  interacLockedAccountId={s.fundInteracAccountId}
  interacPayerName={meQuery.data?.business?.legal_name || meQuery.data?.business?.name || ""}
  interacDefaultEmail={meQuery.data?.user?.email?.trim() || ""}
  setGroup={(group) => setDepositGroup(group)()}
  group={s.depositGroup === "crypto" ? "crypto" : "country"}
  countryRows={depositCountryRows.map((r) => ({
    idx: r.idx,
    name: r.name,
    code: r.code,
    flagUrl: r.flagUrl,
    railTypes: r.railTypes,
    providerNames: r.providerNames,
    select: r.select,
  }))}
  catalogLoading={sendCatalogLoading}
  catalogError={sendCatalogError}
  onRetryCatalog={retrySendCatalog}
  countryName={depositCountryPicked ? depositCountry.name : ""}
  countryFlagUrl={depositCountryPicked ? flagUrl(depositCountry.iso) : null}
  currency={depositCountry.code}
  railGroups={depositMethodGroups.map((g) => ({
    railIdx: g.railIdx,
    type: isMobileMoneyRail(g.type) ? ("mobile" as const) : ("bank" as const),
    label: g.label,
    providers: g.providers,
  }))}
  providerLabel={depositIsMobileRail ? depositOperator : depositProvider || depositOperator}
  stepIs2={depositStepIs2}
  stepIs3={depositStepIs3}
  next={depositNext}
  back={depositBack}
  payerLabel={depositIsMobileRail ? `${depositOperator} number to charge` : depositPayerLabel}
  payerPlaceholder={depositPayerPlaceholder}
  dialCode={depositMobileCode}
  phone={s.depositPhone}
  setPhone={setDepositPhone}
  amount={s.depositAmount}
  setAmount={setDepositAmount}
  limitsText={depositLimitsText}
  limitError={depositLimitError}
  quoteLoading={depositQuoteLoading}
  quoteError={depositQuoteError}
  feeText={depositQuote ? depositFeeText : ""}
  rateLine={depositRateLine}
  receiveText={depositQuoteRateText}
  arrivalText={depositRail.arrival}
  quoteExpiresAt={depositQuote?.expires_at ?? null}
  acceptError={depositAcceptError}
  accepting={depositAccepting}
  submit={submitDeposit}
  done={depositDone}
  outcome={
    !depositDone
      ? null
      : depositLiveOrderStatus === "completed"
        ? "received"
        : ["failed", "refunded", "canceled", "cancelled", "expired"].includes(String(depositLiveOrderStatus || ""))
          ? "failed"
          : "processing"
  }
  orderId={s.depositAccept?.merchant_order_id != null ? String(s.depositAccept.merchant_order_id) : null}
  retry={() =>
    setState({
      depositDone: false,
      depositAccept: null,
      depositQuote: null,
      depositStep: 2,
      depositAcceptError: "",
      depositPromptSent: false,
    })
  }
  bankLines={(depositBankLines || []).map((ln: { k: unknown; v: unknown }) => ({ k: String(ln.k), v: String(ln.v) }))}
  bankArrival={depositBankArrival}
  fundTargetCurrency={s.fundAfricanTargetCurrency}
  fundConvertStatus={s.fundConvertStatus}
  fundConvertError={s.fundConvertError}
  assets={depositAssets.map((a) => ({ key: a.key, label: a.label, select: a.select, selected: s.depositAsset === a.key }))}
  networks={depositNetworks}
  assetCode={depositAssetCode}
  networkKey={depositNetworkKey}
  networkLabel={depositNetworkLabel}
  address={depositAddress}
  addressEmptyMessage={depositAddressEmptyMessage}
  createAccount={depositCreateAccount}
  createAccountLabel={depositCreateAccountLabel}
  close={closeModal}
  onViewTransactions={() => {
    closeModal();
    goTransactions();
  }}
  onHelp={() => openHelp({ category: "deposit" })}
/>
) : modalOpen ? (<>
<div onClick={closeModal} className="ep-modal-overlay" role="presentation">
<div
  ref={modalRef}
  onClick={stopClick}
  className={[
    "ep-modal",
    isModalBulk ? "ep-modal--bulk" : "",
    isModalBulk && bulkModalExpanded ? "ep-modal--expanded" : "",
    isModalBulk && bulkModalExpanded ? "ep-modal--resizable" : "",
  ]
    .filter(Boolean)
    .join(" ")}
  style={
    isModalBulk && bulkModalExpanded && bulkModalSize
      ? {
          width: bulkModalSize.width,
          maxWidth: bulkModalSize.width,
          height: bulkModalSize.height,
          maxHeight: bulkModalSize.height,
        }
      : undefined
  }
  role="dialog"
  aria-modal="true"
  aria-labelledby="ep-modal-title"
>

<div className="ep-modal__grabber" aria-hidden="true">
<span className="ep-modal__grabber-bar" />
</div>

<div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 1 }}>
{isModalBulk ? (
<button
  type="button"
  onClick={() => {
    setBulkModalExpanded((expanded) => !expanded);
    setBulkModalSize(null);
  }}
  className="ep-modal__expand"
  aria-label={bulkModalExpanded ? "Collapse" : "Expand"}
  title={
    bulkModalExpanded
      ? "Collapse — or drag the side edges to resize"
      : "Expand to fit your screen"
  }
>
  {bulkModalExpanded ? "⤡" : "⤢"}
</button>
) : null}
<button type="button" onClick={closeModal} className="ep-modal__close" aria-label="Close">✕</button>
</div>
{isModalBulk && bulkModalExpanded ? (
  <>
    <button
      type="button"
      className="ep-modal__resize-handle ep-modal__resize-handle--w"
      aria-label="Resize dialog from the left"
      title="Drag to resize"
      onPointerDown={onBulkResizePointerDown("w")}
      onPointerMove={onBulkResizePointerMove}
      onPointerUp={onBulkResizePointerUp}
      onPointerCancel={onBulkResizePointerUp}
    />
    <button
      type="button"
      className="ep-modal__resize-handle ep-modal__resize-handle--e"
      aria-label="Resize dialog from the right"
      title="Drag to resize"
      onPointerDown={onBulkResizePointerDown("e")}
      onPointerMove={onBulkResizePointerMove}
      onPointerUp={onBulkResizePointerUp}
      onPointerCancel={onBulkResizePointerUp}
    />
    <button
      type="button"
      className="ep-modal__resize-handle ep-modal__resize-handle--se"
      aria-label="Resize dialog from the corner"
      title="Drag to resize"
      onPointerDown={onBulkResizePointerDown("se")}
      onPointerMove={onBulkResizePointerMove}
      onPointerUp={onBulkResizePointerUp}
      onPointerCancel={onBulkResizePointerUp}
    />
  </>
) : null}


{(isReceiveFlow) ? (<section className="ep-flow ep-flow--sheet" data-screen-label="Receive">
<ReceiveModal
  receiveGroups={receiveGroups}
  receiveIsFiat={receiveIsFiat}
  receiveIsCrypto={receiveIsCrypto}
  receiveAcctChips={receiveAcctChips}
  receiveAcctRail={receiveAcctRail}
  receiveAcctLines={receiveAcctLines}
  receiveAssets={receiveAssets}
  receiveNetworks={receiveNetworks}
  receiveAssetCode={receiveAssetCode}
  receiveNetwork={receiveNetworkKey}
  receiveNetworkLabel={receiveNetworkLabel}
  receiveAddress={receiveAddress}
  copyReceiveAddress={copyReceiveAddress}
  receiveAddressCopied={receiveAddressCopied}
  receiveAddressEmptyMessage={receiveAddressEmptyMessage}
  onCreateStablecoinAccount={receiveCreateAccount}
  createStablecoinAccountLabel={receiveCreateAccountLabel}
/>
</section>) : null}

{(isConvertFlow) ? (<section className="ep-flow ep-flow--sheet" data-screen-label="Convert">
<ConvertFlow
  route={convertRoute}
  sourceAccounts={convertSourceAccounts}
  destinationAccounts={convertDestAccounts}
  sourceAccountId={s.convertSourceAccountId}
  destinationAccountId={s.convertDestAccountId}
  onSourceAccount={(id) =>
    setState({
      convertSourceAccountId: id,
      // Picking the source you were about to receive into would leave the
      // pair pointing at one account; drop the destination and let the
      // user (or the prefill) choose again.
      ...(id === s.convertDestAccountId ? { convertDestAccountId: "" } : {}),
      convertQuote: null,
      convertBookPreview: null,
      convertError: "",
      swapAccepted: false,
    })
  }
  onDestinationAccount={(id) =>
    setState({
      convertDestAccountId: id,
      convertQuote: null,
      convertBookPreview: null,
      convertError: "",
      swapAccepted: false,
    })
  }
  amount={s.convertAmount}
  onAmount={(value) =>
    setState({
      convertAmount: value,
      convertQuote: null,
      convertBookPreview: null,
      convertError: "",
    })
  }
  quote={s.convertQuote}
  quoteSeconds={s.quoteSeconds}
  quoteLoading={s.convertQuoteLoading}
  acceptLoading={s.convertAccepting}
  error={s.convertError}
  progressNote={s.convertJobNote}
  pathLabel={convertPathLabel}
  done={swapAccepted}
  doneBody={
    s.convertQuote
      ? `${s.convertQuote.source_amount} ${s.convertQuote.source_currency} → ${s.convertQuote.destination_amount ?? "—"} ${s.convertQuote.destination_currency}`
      : undefined
  }
  onRefreshQuote={() => void refreshConvertQuote()}
  onAccept={() => void acceptConvertQuote()}
  onDone={closeModal}
/>
</section>) : null}


{(isModalBulk) ? (<>
{MIXED_RAIL_BULK_PAYOUTS_ENABLED ? (
<PayoutBatchWizard
  sourceAccounts={bulkPayoutSourceAccounts}
  onDone={closeModal}
  onCancel={closeModal}
/>
) : STELLAR_BULK_PAYOUTS_ENABLED ? (
<BulkStellarPayoutWizard
  sourceAccounts={bulkPayoutSourceAccounts}
  draftScopeId={businessId}
  onDone={closeModal}
  onCancel={closeModal}
/>
) : (
<ComingSoonPanel
  compact
  featureKey="bulk-payouts"
  title="Bulk payout"
  description="Bulk payouts from one list aren’t live yet. Join the waitlist and we’ll email you when it’s ready."
/>
) }
</>) : null}

{(isModalTxDetail) ? (<>
<TxDetailModal txDetail={txDetail} isLoading={txDetailQuery.isLoading} liveStatus={txLiveStatus} />
</>) : null}

{(isModalFundChooser && acctDetail) ? (<>
<FundChooserModal
  currency={acctDetail.currency}
  accountName={acctDetail.name}
  isStablecoinAccount={Boolean(selectedStablecoinAccount)}
  networkLabel={
    selectedStablecoinAccount
      ? formatNetworkLabel(selectedStablecoinAccount.network)
      : undefined
  }
  onCancel={closeModal}
  onContinue={(option: FundChooserOption) => {
    if (option === "bank") {
      openAcctFundModal();
      return;
    }
    if (option === "stablecoin") {
      setState({ modal: "fundStablecoin" });
      return;
    }
    if (option === "remittance") {
      const cadAccount =
        selectedDepositAccount &&
        remittanceMethodForCurrency(selectedDepositAccount.currency) === "interac" &&
        String(selectedDepositAccount.entity_id || "").trim()
          ? selectedDepositAccount
          : null;
      if (cadAccount) {
        setState({ ...moneyFlowReset, modal: "deposit", fundInteracAccountId: String(cadAccount.id) });
        return;
      }
      setState({ modal: "fundPaymentRequest" });
      return;
    }
    if (meQuery.isLoading || meQuery.isPending) return;
    const status =
      (meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? "pending";
    if (!isKybApproved(status)) {
      goVerification();
      if (canOpenKybWizard(status)) openModalKyb();
      return;
    }
    openAfricanFundOnRamp();
  }}
  africanDisabled={Boolean(africanFundPlan && !africanFundPlan.canRunAfricanOnRamp)}
  africanDisabledReason={
    africanFundPlan ? africanFundDisabledReason(africanFundPlan) : undefined
  }
  stablecoinDisabled={fundStablecoinRails.length === 0}
  stablecoinDisabledReason={
    fundStablecoinRails.length > 0
      ? undefined
      : "No ready stablecoin deposit rails yet. Open a stablecoin account and wait until it is active."
  }
  remittanceDisabled={!remittanceMethodForCurrency(acctDetail.currency)}
  remittanceDisabledReason={
    remittanceMethodForCurrency(acctDetail.currency)
      ? undefined
      : "Interac / open banking is available for CAD, EUR, and GBP accounts."
  }
  remittanceLabel={
    remittanceMethodForCurrency(acctDetail.currency)
      ? remittanceMethodLabel(remittanceMethodForCurrency(acctDetail.currency)!)
      : "Interac / open banking"
  }
  remittanceDesc={
    remittanceMethodForCurrency(acctDetail.currency)
      ? `Request ${acctDetail.currency} via ${remittanceMethodLabel(remittanceMethodForCurrency(acctDetail.currency)!)} — preferred when IBAN deposit is unavailable`
      : undefined
  }
/>
</>) : null}

{(isModalFundPaymentRequest && acctDetail && selectedDepositAccount) ? (<>
<FundPaymentRequestModal
  entityId={String(selectedDepositAccount.entity_id || "").trim()}
  accountId={String(selectedDepositAccount.id)}
  currency={acctDetail.currency}
  accountName={acctDetail.name}
  method={remittanceMethodForCurrency(acctDetail.currency) || "interac"}
  onBack={() => setState({ modal: "fundChooser" })}
/>
</>) : null}

{(isModalBookTransfer && selectedDepositAccount) ? (<>
<BookTransferModal
  entityId={String(selectedDepositAccount.entity_id || "").trim()}
  source={{
    id: String(selectedDepositAccount.id),
    entityId: String(selectedDepositAccount.entity_id || ""),
    assetType: "fiat",
    currency: String(selectedDepositAccount.currency || acctDetail?.currency || ""),
    network: "",
    status: String(selectedDepositAccount.status || ""),
  }}
  candidates={depositAccountsList.map((a) => ({
    id: String(a.id),
    entityId: String(a.entity_id || ""),
    assetType: "fiat",
    currency: String(a.currency || ""),
    network: "",
    status: String(a.status || ""),
  }))}
  onDone={() => {
    // The confirm already succeeded upstream; refresh before closing so
    // the row is present on the screen the user lands back on.
    refreshMoneyViews();
    closeModal();
  }}
  onCancel={closeModal}
/>
</>) : null}

{(isModalPayout && selectedDepositAccount) ? (<>
<PayoutModal
  entityId={String(selectedDepositAccount.entity_id || "").trim()}
  account={{
    id: String(selectedDepositAccount.id),
    entityId: String(selectedDepositAccount.entity_id || ""),
    assetType: "fiat",
    currency: String(selectedDepositAccount.currency || acctDetail?.currency || ""),
    network: "",
    status: String(selectedDepositAccount.status || ""),
  }}
  onDone={closeModal}
  onCancel={closeModal}
/>
</>) : null}

{(isModalFundStablecoin && acctDetail) ? (<>
<FundStablecoinModal
  targetCurrency={acctDetail.currency}
  targetName={acctDetail.name}
  rails={fundStablecoinRails}
  collectRailsError={
    collectDepositInstructionsQuery.isError
      ? collectDepositInstructionsQuery.error instanceof Error
        ? collectDepositInstructionsQuery.error.message
        : "Collect deposit instructions failed."
      : null
  }
  onRetryCollectRails={
    collectDepositInstructionsQuery.isError
      ? () => {
          void collectDepositInstructionsQuery.refetch();
        }
      : undefined
  }
  onBack={() => setState({ modal: "fundChooser" })}
/>
</>) : null}

{(isModalCloseAccount && acctDetail && (selectedStablecoinAccount || selectedDepositAccount)) ? (<>
<CloseAccountModal
  accountName={acctDetail.name}
  currency={acctDetail.currency}
  networkLabel={
    selectedStablecoinAccount ? formatNetworkLabel(selectedStablecoinAccount.network) : ""
  }
  alreadyClosed={
    selectedStablecoinAccount
      ? isClosedStatus(selectedStablecoinAccount.status)
      : isClosedDepositStatus(selectedDepositAccount?.status)
  }
  onCancel={closeModal}
  onContinue={async () => {
    if (selectedStablecoinAccount) {
      await entitiesApi.deleteAccount(
        selectedStablecoinAccount.entityId,
        selectedStablecoinAccount.id,
      );
      queryClient.invalidateQueries({ queryKey: [QK.stablecoinAccounts] });
    } else if (selectedDepositAccount?.entity_id && selectedDepositAccount?.id) {
      await entitiesApi.deleteAccount(
        selectedDepositAccount.entity_id,
        selectedDepositAccount.id,
      );
      queryClient.invalidateQueries({ queryKey: [QK.depositAccounts] });
    }
    await queryClient.invalidateQueries({ queryKey: [QK.dashboardBootstrap] });
    backToWallets();
  }}
/>
</>) : null}

{(isModalAcctDetail) ? (<>
<AccountDetailModal
  acctDetail={acctDetail}
  intent={s.acctDetailIntent === "fund" ? "fund" : "details"}
  copiedField={s.copiedField}
  copyField={copyField}
  onRefreshAccount={refreshDepositAccount}
/>
</>) : null}

{(isModalCardDetail && cardSel) ? (<>
<CardDetailModal
  card={cardSel}
  cardholderName={cardholderDisplay}
  accountLabel={cardSel.card_name || `···· ${cardSel.last_four || ""}`}
  balance={cardDetail.balance || usdSpendLabel}
  color={cardDetail.color}
  billing={cardBilling}
  recent={cardsSpendAll
    .filter(
      (row) => String((row as { card_id?: string | null }).card_id || "") === cardSel.id,
    )
    .slice(0, 20)}
  secrets={cardSecrets}
  secretsBusy={cardSecretsBusy}
  secretsError={cardSecretsError}
  freezeBusy={cardFreezeBusy}
  freezeError={cardFreezeError}
  copiedField={s.copiedField}
  onCopy={copyField}
  onToggleReveal={toggleCardSecrets}
  onToggleFreeze={() => void toggleFreezeCard()}
/>
</>) : null}

{(isModalFundCard) ? (<>
<div className="ep-cards__modal">
<div className="ep-cards__note">
Cards spend your linked USD deposit balance — there is no separate card wallet to load.
</div>
<button type="button" onClick={fundCard} className="ep-cards__modal-primary">Fund USD account</button>
</div>
</>) : null}

{(isModalNewCard) ? (<>
{(newCardNotDone) ? (<>
<form
  className="ep-cards__modal ep-card-create"
  onSubmit={(e) => {
    e.preventDefault();
    void issueCard();
  }}
>
<CardPreview label={newCardLabel.trim() || "New card"} color={cardColor(s.newCardColor)} />
<CardColorPicker
  value={s.newCardColor}
  onChange={(key) => setState({ newCardColor: key })}
  disabled={newCardIssuing}
/>
<label className="ep-card-create__name">
<span className="ep-sr-only">Card name</span>
<input value={newCardLabel} onChange={setNewCardLabel} placeholder="Card name" maxLength={40} className="ep-cards__input" autoComplete="off" autoFocus />
</label>
{s.newCardHolderOpen ? (
<fieldset className="ep-card-create__holder">
<legend className="ep-card-create__holder-title">Cardholder</legend>
<div className="ep-card-create__holder-grid">
<label className="ep-cards__field">
<span className="ep-cards__field-label">First name</span>
<input value={newCardFirstName} onChange={setNewCardFirstName} placeholder="Jane" className="ep-cards__input" autoComplete="given-name" />
</label>
<label className="ep-cards__field">
<span className="ep-cards__field-label">Last name</span>
<input value={newCardLastName} onChange={setNewCardLastName} placeholder="Doe" className="ep-cards__input" autoComplete="family-name" />
</label>
<label className="ep-cards__field">
<span className="ep-cards__field-label">Email</span>
<input value={newCardEmail} onChange={setNewCardEmail} type="email" placeholder="jane@company.com" className="ep-cards__input" autoComplete="email" />
</label>
<label className="ep-cards__field">
<span className="ep-cards__field-label">Phone (E.164)</span>
<input value={newCardPhone} onChange={setNewCardPhone} placeholder="+12125550198" className="ep-cards__input" inputMode="tel" autoComplete="tel" />
</label>
</div>
</fieldset>
) : (
<div className="ep-card-create__holder-summary">
<span className="ep-card-create__holder-copy">
<span className="ep-card-create__holder-label">Cardholder</span>
<span className="ep-card-create__holder-value">{`${newCardFirstName} ${newCardLastName}`.trim()} · {newCardEmail}</span>
</span>
<button type="button" className="ep-card-create__holder-edit" onClick={() => setState({ newCardHolderOpen: true })}>Edit</button>
</div>
)}
{newCardError ? (
  <div className="ep-cards__note" role="alert" style={{color: "var(--red)"}}>{newCardError}</div>
) : null}
<button type="submit" className="ep-cards__modal-primary ep-card-create__submit" disabled={!usdFunding || newCardIssuing || !newCardLabel.trim()}>
{newCardIssuing ? "Issuing…" : "Issue card"}
</button>
<p className="ep-card-create__funding" role={!usdFunding ? "alert" : undefined}>
{usdFunding
  ? describeUsdFundingIssueNote(usdFunding)
  : "Open an active USD deposit account before issuing cards. Every card must be linked to USD."}
</p>
</form>
</>) : null}
{(newCardDone) ? (<>
<div className="ep-cards__success">
<span className="ep-cards__success-icon" aria-hidden>✓</span>
<span className="ep-cards__success-title">Card issued</span>
<span className="ep-cards__success-text">
{newlyIssuedCard?.card_name || "Virtual card"}
{newlyIssuedCard?.last_four ? ` ···· ${newlyIssuedCard.last_four}` : ""}
</span>
{newlyIssuedCard?.number ? (
  <div className="ep-cards__secrets" role="status">
    <div className="ep-cards__note">Tap a value to copy — shown once.</div>
    <button
      type="button"
      className="ep-cards__tap-copy"
      data-copied={s.copiedField === "newcard:number" ? "true" : "false"}
      onClick={copyField("newcard:number", String(newlyIssuedCard.number).replace(/\s+/g, ""))}
      aria-label={s.copiedField === "newcard:number" ? "Number copied" : "Copy number"}
    >
      <span className="ep-cards__tap-copy-label">Number</span>
      <b className="ep-mono">{formatCardPan(newlyIssuedCard.number)}</b>
      <span className="ep-cards__tap-copy-hint">{s.copiedField === "newcard:number" ? "Copied" : "Tap to copy"}</span>
    </button>
    {newlyIssuedCard.cvv ? (
    <button
      type="button"
      className="ep-cards__tap-copy"
      data-copied={s.copiedField === "newcard:cvv" ? "true" : "false"}
      onClick={copyField("newcard:cvv", String(newlyIssuedCard.cvv))}
      aria-label={s.copiedField === "newcard:cvv" ? "CVV copied" : "Copy CVV"}
    >
      <span className="ep-cards__tap-copy-label">CVV</span>
      <b className="ep-mono">{newlyIssuedCard.cvv}</b>
      <span className="ep-cards__tap-copy-hint">{s.copiedField === "newcard:cvv" ? "Copied" : "Tap to copy"}</span>
    </button>
    ) : null}
    {newlyIssuedExp ? (
    <button
      type="button"
      className="ep-cards__tap-copy"
      data-copied={s.copiedField === "newcard:exp" ? "true" : "false"}
      onClick={copyField("newcard:exp", newlyIssuedExp)}
      aria-label={s.copiedField === "newcard:exp" ? "Expiry copied" : "Copy expiry"}
    >
      <span className="ep-cards__tap-copy-label">Expires</span>
      <b className="ep-mono">{newlyIssuedExp}</b>
      <span className="ep-cards__tap-copy-hint">{s.copiedField === "newcard:exp" ? "Copied" : "Tap to copy"}</span>
    </button>
    ) : null}
  </div>
) : (
  <div className="ep-cards__note">Credentials were not returned (same reference replay). Use Manage → eye icon to reveal.</div>
)}
<button type="button" onClick={closeModal} className="ep-cards__modal-secondary">Done</button>
</div>
</>) : null}
</>) : null}

{(isModalKyb) ? (<>
<KybWizardModal
  step={kybWizard.step}
  stepDots={kybWizard.stepDots}
  stepLabels={kybWizard.stepLabels}
  draft={kybWizard.draft}
  patchDraft={kybWizard.patchDraft}
  patchAssociate={kybWizard.patchAssociate}
  setUboCount={kybWizard.setUboCount}
  error={kybWizard.error}
  busy={kybWizard.busy}
  docRows={kybWizard.docRows}
  setDocumentFile={kybWizard.setDocumentFile}
  uploadDocumentRow={kybWizard.uploadDocumentRow}
  openDocument={kybWizard.openDocument}
  replaceDocumentRow={kybWizard.replaceDocumentRow}
  docsComplete={kybWizard.docsComplete}
  docsUploading={kybWizard.docsUploading}
  submitted={kybWizard.submitted}
  submitOutcome={kybWizard.submitOutcome}
  registeredPostalRequired={kybWizard.registeredPostalRequired}
  nextStep={kybWizard.nextStep}
  backStep={kybWizard.backStep}
  closeModal={closeModal}
/>
</>) : null}

{(isModalMfaSetup) ? (
  <TotpEnrollment onComplete={onMfaSetupComplete} onCancel={closeModal} />
) : null}

{(isModalMfaDisable) ? (<>
<div className="ep-team__invite-overlay" onClick={closeMfaDisable} role="presentation">
<form onSubmit={submitMfaDisable} onClick={stopClick} className="ep-team__invite" role="dialog" aria-modal="true" aria-labelledby="ep-mfa-disable-title">
<div className="ep-team__invite-head">
<h3 id="ep-mfa-disable-title" className="ep-team__invite-title">Disable two-factor authentication</h3>
<button type="button" onClick={closeMfaDisable} className="ep-team__invite-close" aria-label="Cancel" disabled={s.mfaDisableBusy}>✕</button>
</div>
<p className="ep-team__invite-hint">Confirm your password and a current code to turn 2FA off.</p>
<label className="ep-team__field">
<span className="ep-team__field-label">Password</span>
<input
  value={s.mfaDisablePassword}
  onChange={(e) => setState({ mfaDisablePassword: e.target.value, mfaDisableError: "" })}
  type="password"
  autoComplete="current-password"
  className="ep-team__input"
  disabled={s.mfaDisableBusy}
/>
</label>
<label className="ep-team__field">
<span className="ep-team__field-label">6-digit code or backup code</span>
<input
  value={s.mfaDisableCode}
  onChange={(e) => setState({ mfaDisableCode: e.target.value, mfaDisableError: "" })}
  className="ep-team__input"
  autoComplete="one-time-code"
  disabled={s.mfaDisableBusy}
/>
</label>
{s.mfaDisableError ? <p role="alert" style={{ color: "var(--danger, #b42318)", fontSize: "13px" }}>{s.mfaDisableError}</p> : null}
<button type="submit" className="ep-team__invite-submit" disabled={s.mfaDisableBusy || !s.mfaDisablePassword.trim() || !s.mfaDisableCode.trim()}>
{s.mfaDisableBusy ? "Disabling…" : "Disable 2FA"}
</button>
</form>
</div>
</>) : null}

{(isModalCreateAccount) ? (<>
<CreateAccountModal
  createAccountName={s.createAccountName}
  setCreateAccountName={setCreateAccountName}
  createAccountKind={s.createAccountKind}
  createAccountCurrency={s.createAccountCurrency}
  setCreateAccountCurrency={setCreateAccountCurrency}
  createAccountStablecoin={s.createAccountStablecoin}
  setCreateAccountStablecoin={setCreateAccountStablecoin}
  createAccountNetwork={s.createAccountNetwork}
  setCreateAccountNetwork={setCreateAccountNetwork}
  createAccountError={s.createAccountError}
  createAccountSaving={s.createAccountSaving}
  occupiedSlots={[...occupiedStablecoinSlots(stablecoinAccountsList)]}
  occupiedCurrencies={[...occupiedFiatCurrencyCodes(depositAccountsList)]}
  supportedCurrencies={supportedFiatCurrencies}
  supportedAccounts={supportedAccountDescriptors}
  closeModal={closeModal}
  submitCreateAccount={submitCreateAccount}
/>
</>) : null}

{(isModalApiKey) ? (<>
<div className="ep-developer__modal">
<label className="ep-developer__field">
<span className="ep-developer__field-label">Key name</span>
<input value={apiKeyName} onChange={setApiKeyName} placeholder="e.g. Server integration" className="ep-developer__input" />
</label>
<div className="ep-developer__field">
<span className="ep-developer__field-label">Environment</span>
<div className="ep-developer__env-chips" role="radiogroup" aria-label="API key environment">
{(apiKeyEnvironmentChips || []).map((e: any) => (
<button
  key={e.key}
  type="button"
  role="radio"
  aria-checked={e.selected}
  onClick={e.select}
  className={`ep-developer__env-chip${e.selected ? " ep-developer__env-chip--selected" : ""}${e.key === "live" ? " ep-developer__env-chip--live" : ""}`}
>
{e.label}
</button>
))}
</div>
{apiKeyEnvironmentChips.find((e: any) => e.selected)?.key === "live" ? (
<span className="ep-developer__hint">Live keys can move real money. Prefer sandbox while integrating.</span>
) : (
<span className="ep-developer__hint">Sandbox keys are safe for testing — no live funds.</span>
)}
</div>
{apiKeyError ? (<div className="ep-developer__error">{apiKeyError}</div>) : null}
<button type="button" onClick={submitApiKey} disabled={apiKeyCreating} className="ep-developer__submit">{apiKeyCreating ? "Creating…" : "Create key"}</button>
</div>
</>) : null}

{(isModalSupport) ? (
  <SupportHelpModal
    key={`${s.supportCategory}:${s.supportReferenceId}`}
    businessName={meQuery.data?.business?.name || ""}
    userEmail={meQuery.data?.user?.email || ""}
    screen={s.screen}
    initialCategory={s.supportCategory}
    initialReferenceId={s.supportReferenceId}
    onDone={closeModal}
  />
) : null}

</div>
</div>

</>) : null}
    </div>
  );
}
