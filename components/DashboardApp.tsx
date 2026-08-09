"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  flagUrl, COUNTRIES, CURRENCIES, MOBILE_CURRENCIES, BANK_CURRENCIES,
  DEPOSIT_NETWORKS, DEPOSIT_ADDRESSES, ACCOUNTS, ROLES, TEAM_MEMBERS,
  CORRIDORS, BULK_ROWS, CARDS, STATUS_MAP,
  LIGHT, DARK, DARK_HC_OVERRIDES, qp,
} from "./mockData";
import { dashboardApi, liveRateRowsFromSummary } from "@/lib/services/dashboard";
import { transactionsApi, type Transaction } from "@/lib/services/transactions";
import { TX_FILTERS } from "@/lib/services/transactionFilters";
import { useTransactionsPage } from "@/lib/hooks/useTransactionsPage";
import { authApi } from "@/lib/services/auth";
import { invoicesApi, buildSimpleDraftPayload } from "@/lib/services/invoices";
import { apiKeysApi } from "@/lib/services/apiKeys";
import {
  depositAccountsApi,
  mapDepositAccountToCardView,
  buildDepositAccountDetailRows,
  currencyIso,
  currencyLabel,
  occupiedFiatCurrencyCodes,
  SUPPORTED_IBAN_CURRENCIES,
} from "@/lib/services/depositAccounts";
import {
  ordersApi,
  buildSendQuotePayload,
  buildDepositQuotePayload,
  buildPaymentInstructionRows,
  formatQuoteFees,
  describeSendQuoteError,
  toE164,
  isQuoteExpiredError,
  isQuoteAlreadyAcceptedError,
  newIdempotencyKey,
} from "@/lib/services/orders";
import {
  accountSendsApi,
  buildSendPreviewPayload,
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
  buildFundStablecoinRails,
  formatNetworkLabel,
  isReadyStatus,
  isFundableStablecoinAccount,
  occupiedStablecoinNetworkCodes,
} from "@/lib/services/entities";
import { useOrderStatus } from "@/lib/hooks/useOrderStatus";
import {
  offRampProvidersForRail,
  onRampProvidersForRail,
  networkIdForProvider,
  providerNamesFromCatalog,
} from "@/lib/services/catalog";
import { setSessionLostHandler, ApiRequestError } from "@/lib/apiClient";
import { useViewport } from "@/lib/responsive";
import {
  buildSendDestinationSummary,
  buildSendStepDots,
  railIndexForMethod,
  sendRailHasChoice as railHasChoice,
} from "@/lib/hooks/sendFlowHelpers";
import { buildDepositDestinationSummary, buildDepositStepDots } from "@/lib/hooks/depositFlowHelpers";
import { useSendCatalog } from "@/lib/hooks/useSendCatalog";

/** Phase 4 account-sends support Base + Polygon USDC only. */
const SEND_STABLECOIN_NETWORKS = DEPOSIT_NETWORKS.filter(
  (n) => n.key === "base" || n.key === "polygon",
);
import ActivityList from "@/components/ui/ActivityList";
import InvoiceList from "@/components/ui/InvoiceList";
import StatusBadge from "@/components/ui/StatusBadge";
import SectionHeader from "@/components/ui/SectionHeader";
import HomeIdentity from "@/components/home/HomeIdentity";
import RatesMarquee from "@/components/home/RatesMarquee";
import SendModal from "@/components/send/SendModal";
import TransactionsScreen from "@/components/transactions/TransactionsScreen";
import TxDetailModal from "@/components/transactions/TxDetailModal";
import WalletsScreen from "@/components/wallets/WalletsScreen";
import CreateAccountModal from "@/components/wallets/CreateAccountModal";
import AccountDetailModal from "@/components/wallets/AccountDetailModal";
import AccountDetailScreen from "@/components/wallets/AccountDetailScreen";

function fiatRailForCurrency(code: string): string {
  const c = code.toUpperCase();
  if (c === "EUR") return "IBAN · SEPA";
  if (c === "GBP") return "IBAN · Faster Pay";
  if (c === "USD") return "IBAN · SWIFT";
  if (c === "KES") return "Mobile money";
  return "Bank transfer";
}
import FundChooserModal, { type FundChooserOption } from "@/components/wallets/FundChooserModal";
import FundStablecoinModal from "@/components/wallets/FundStablecoinModal";
import {
  africanFundDisabledReason,
  planAfricanFundOrchestration,
} from "@/lib/services/fundOrchestration";
import DepositModal from "@/components/deposit/DepositModal";
import ReceiveModal from "@/components/deposit/ReceiveModal";
import VerificationScreen from "@/components/verification/VerificationScreen";
import KybWizardModal from "@/components/verification/KybWizardModal";
import KybGateBanner from "@/components/verification/KybGateBanner";
import { useKybWizard } from "@/lib/hooks/useKybWizard";
import { canOpenKybWizard, describeKybStatus, isKybApproved, kybTierDisplay } from "@/lib/services/kyb";

type Props = {
  boostDarkContrast?: boolean;
  forceMobile?: boolean;
  startScreen?: string;
  startTheme?: string;
};

export default function DashboardApp(props: Props = {}) {
  const router = useRouter();
  const exitApp = () => router.push("/");
  const viewport = useViewport(props.forceMobile);
  const isCompact = viewport.isCompact;
  const isMobile = viewport.isMobile;

  const rootRef = useRef<HTMLDivElement>(null);

  const [state, setStateRaw] = useState<any>(() => ({
    theme: props.startTheme || "light", screen: props.startScreen || "home",
    sidebarOpen: false,
    modal: null as string | null,
    /** Where Back from a money flow should return (home / accountDetail / …). */
    moneyFlowReturn: null as string | null,
    sendStep: 1, sendMethod: null as null | "bank" | "mobile" | "crypto" | "internal",
    sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0, sendRecipient: "", sendRecipientName: "", sendAmount: "", sendDone: false, sendAsset: "usdc", sendChain: "base",
    sendQuote: null as any, sendQuoteLoading: false, sendQuoteError: "", sendQuoteErrorTitle: "", sendQuoteErrorAction: null as null | "verification", sendAccept: null as any, sendAccepting: false, sendAcceptError: "",
    sendPreview: null as any, sendConfirm: null as any, sendAccountId: "",
    depositStep: 1, depositGroup: "country", depositCountryIdx: 0, depositRailIdx: 0, depositProviderIdx: 0, depositPhone: "", depositAmount: "", depositPromptSent: false, depositAsset: "usdc", depositNetwork: "base",
    depositQuote: null as any, depositQuoteLoading: false, depositQuoteError: "", depositAccept: null as any, depositAccepting: false, depositAcceptError: "", depositDone: false, depositIdempotencyKey: "",
    receiveGroup: "fiat", receiveAcctIdx: 0, receiveAsset: "usdc", receiveNetwork: "base", copiedKey: "",
    bulkSelected: [0,3,6], bulkLoaded: false, bulkDone: false,
    onrampDir: "onramp", quoteSeconds: 87, swapAccepted: false,
    stableSel: "USDC", txFilter: "all",
    selectedTxId: null as number | null,
    /** Stable key: `fiat:EUR` or `stablecoin:{accountId}` — not list index. */
    selectedAcctKey: "" as string,
    selectedAcctKind: "fiat" as "fiat" | "stablecoin",
    selectedCardIdx: 0,
    /** "details" | "fund" — same coords modal, fund reframes copy for bank transfer. */
    acctDetailIntent: "details" as "details" | "fund",
    /** When set, Deposit OnRamp is funding this fiat account (African auto path). */
    fundAfricanTargetCurrency: null as string | null,
    fundConvertStatus: "" as string,
    fundConvertError: "" as string,
    apiKeyRevealed: {}, secretRevealed: {}, copiedField: "",
    apiKeyName: "", apiKeyEnvironment: "sandbox", apiKeyCreating: false, apiKeyError: "", newlyCreatedKey: null as any,
    addAccountMenu: false, createAccountKind: "bank", createAccountName: "",
    createAccountCurrency: "", createAccountStablecoin: "", createAccountNetwork: "",
    createAccountSaving: false, createAccountError: "",
    teamMembers: TEAM_MEMBERS, inviteOpen: false, inviteName: "", inviteEmail: "", inviteRole: "operator",
    newCardLabel: "", newCardDone: false,
    invClient: "", invAmount: "", invoiceDone: false, invoiceError: "", invoiceSubmitting: false,
    cardFrozen: false, tierDone: false,
    fundAmount: "250.00", fundCardDone: false,
    balanceView: "all", sendGroup: "country",
  }));
  const setState = useCallback((update: any) => {
    setStateRaw((prev: any) => ({ ...prev, ...(typeof update === "function" ? update(prev) : update) }));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setState((s: any) => ({ quoteSeconds: Math.max(0, s.quoteSeconds - 1) })), 1000);
    return () => clearInterval(timer);
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

  // Close the drawer when crossing into desktop chrome.
  useEffect(() => {
    if (!isCompact && state.sidebarOpen) setState({ sidebarOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact]);

  // Real backend data. Session-expiry from any of these bounces to /login —
  // registered once here rather than per-call, matching the mobile client's
  // single global session-lost handler.
  const queryClient = useQueryClient();
  const [saveRecipientBusy, setSaveRecipientBusy] = useState(false);
  const [saveRecipientMessage, setSaveRecipientMessage] = useState("");
  useEffect(() => {
    setSessionLostHandler(() => {
      queryClient.clear();
      router.push("/login");
    });
    return () => setSessionLostHandler(null);
  }, [router, queryClient]);

  const meQuery = useQuery({ queryKey: ["auth-me"], queryFn: authApi.me, retry: false });
  const businessId = meQuery.data?.business?.id ?? null;
  const kybWizard = useKybWizard({
    businessId,
    kybSummary: meQuery.data?.kyb_summary,
    business: meQuery.data?.business,
    enabled: state.modal === "kyb",
    onSubmitted: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      queryClient.invalidateQueries({ queryKey: ["deposit-accounts-eligibility"] });
    },
  });
  const summaryQuery = useQuery({ queryKey: ["dashboard-summary"], queryFn: dashboardApi.summary, retry: false });
  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: transactionsApi.list,
    retry: false,
    refetchInterval: 15_000,
  });
  const txFilterStatus = TX_FILTERS.find((f) => f.key === state.txFilter)?.status ?? "all";
  const transactionsPageQuery = useTransactionsPage(txFilterStatus);
  // Tx detail modal fetches by id, not by list index/position — the list can
  // reorder or refetch (15s poll above) while the modal is open, and an
  // index would silently point at a different transaction.
  const txDetailQuery = useQuery({
    queryKey: ["transaction", state.selectedTxId],
    queryFn: () => transactionsApi.get(state.selectedTxId as number),
    enabled: state.selectedTxId != null && state.modal === "txDetail",
    retry: false,
  });
  // Live order-status polling (backoff) for whichever order is currently
  // in view: the tx detail modal, or the send modal's just-accepted order.
  // See lib/hooks/useOrderStatus.ts for why this polls rather than using
  // the backend's WebSocket (which requires a JWT in the browser).
  const txStatusQuery = useOrderStatus(state.selectedTxId, {
    enabled: state.modal === "txDetail" && state.selectedTxId != null,
  });
  const sendStatusQuery = useOrderStatus(state.sendAccept?.merchant_order_id, {
    enabled: state.screen === "send" && state.sendDone && !!state.sendAccept,
  });
  const depositStatusQuery = useOrderStatus(state.depositAccept?.merchant_order_id, {
    enabled:
      (state.screen === "deposit" || !!state.fundAfricanTargetCurrency) &&
      state.depositDone &&
      !!state.depositAccept,
  });
  const invoicesQuery = useQuery({

    queryKey: ["invoices"],
    queryFn: () => invoicesApi.list(),
    retry: false,
  });
  const apiKeysQuery = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiKeysApi.list(),
    retry: false,
  });
  // Public supported-catalog, used by the Send ("by country") flow to
  // resolve a real aggregator networkId per provider instead of relying on
  // the hardcoded corridor list alone. See lib/services/catalog.ts.
  const sendCatalogQuery = useSendCatalog();

  // Settled once the first catalog fetch finishes (success or error). Until
  // then, Send provider chips must not fall back to hardcoded rail.options.
  const sendCatalogSettled = sendCatalogQuery.isFetched;

  // When the catalog (or corridor) changes the provider list, clamp the
  // selection so sendProviderIdx never points past the active options.
  useEffect(() => {
    const country = COUNTRIES[state.sendCountryIdx];
    if (!country) return;
    const rail = country.rails[state.sendRailIdx] || country.rails[0];
    if (!rail) return;
    const catalogProviders = offRampProvidersForRail(
      sendCatalogQuery.data,
      country.iso,
      rail.type,
      country.code,
    );
    const options = providerNamesFromCatalog(
      catalogProviders,
      rail.options,
      sendCatalogSettled,
    );
    if (!options.length) return;
    setState((s: any) => {
      if (s.sendProviderIdx < options.length) return {};
      return { sendProviderIdx: options.length - 1 };
    });
  }, [sendCatalogQuery.data, sendCatalogSettled, state.sendCountryIdx, state.sendRailIdx, setState]);

  useEffect(() => {
    const country = COUNTRIES[state.depositCountryIdx];
    if (!country) return;
    const rail = country.rails[state.depositRailIdx] || country.rails[0];
    if (!rail) return;
    const catalogProviders = onRampProvidersForRail(
      sendCatalogQuery.data,
      country.iso,
      rail.type,
      country.code,
    );
    const options =
      catalogProviders && catalogProviders.length > 0
        ? catalogProviders.map((p) => p.name)
        : rail.options;
    if (!options.length) return;
    setState((s: any) => {
      if (s.depositProviderIdx < options.length) return {};
      return { depositProviderIdx: options.length - 1 };
    });
  }, [sendCatalogQuery.data, state.depositCountryIdx, state.depositRailIdx, setState]);

  // Listing/creating deposit accounts requires KYB approval — check eligibility
  // first so an unverified business sees a clear gate instead of a raw 400
  // from `GET /v1/iban/accounts` (see docs/api-contract.md).
  const depositEligibilityQuery = useQuery({
    queryKey: ["deposit-accounts-eligibility"],
    queryFn: depositAccountsApi.eligibility,
    retry: false,
  });
  const depositAccountsQuery = useQuery({
    queryKey: ["deposit-accounts"],
    queryFn: depositAccountsApi.list,
    retry: false,
    enabled: depositEligibilityQuery.data?.eligible === true,
  });
  const stablecoinAccountsQuery = useQuery({
    queryKey: ["stablecoin-accounts"],
    queryFn: listStablecoinAccounts,
    retry: false,
  });

  // Best-effort post-OnRamp convert status (skipped until entity fiat id + FX network_id exist).
  useEffect(() => {
    const order = depositStatusQuery.data;
    const targetFiat = state.fundAfricanTargetCurrency;
    if (!targetFiat || !order || order.status !== "completed") return;
    if (state.fundConvertStatus) return;

    const usdcAccount =
      (stablecoinAccountsQuery.data ?? []).find(
        (a) => isReadyStatus(a.status) && a.currency === "USDC" && a.walletAddress,
      ) ??
      (stablecoinAccountsQuery.data ?? []).find(
        (a) => isReadyStatus(a.status) && a.currency === "USDC",
      );
    const plan = planAfricanFundOrchestration({
      fiatCurrency: targetFiat,
      fiatAccountId: null,
      entityId: usdcAccount?.entityId ?? null,
      usdcAccountId: usdcAccount?.id ?? null,
      usdcWalletAddress: usdcAccount?.walletAddress ?? null,
      treasuryWalletAddress: summaryQuery.data?.totals.wallet_address ?? null,
      convertNetworkId: null,
    });
    setState({
      fundConvertStatus: `skipped: ${plan.blockers[0] || "Auto-convert not ready"}`,
      fundConvertError: plan.blockers.join(" "),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositStatusQuery.data?.status, depositStatusQuery.data?.id, state.fundAfricanTargetCurrency, stablecoinAccountsQuery.data]);

  // The list endpoint deliberately omits webhook_url / webhook_secret
  // (ApiKeyListOut); only the per-key detail endpoint returns them. Fetch
  // details so the Developer screen's webhook rows show real values.
  const apiKeyDetailQueries = useQueries({
    queries: (apiKeysQuery.data ?? []).map((k) => ({
      queryKey: ["api-key", k.id],
      queryFn: () => apiKeysApi.get(k.id),
      retry: false,
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
  const toggleSidebar = () => setState(s => ({ sidebarOpen: !s.sidebarOpen }));
  const closeSidebar = () => setState({ sidebarOpen: false });
  const setScreen = (s) => () => setState({ screen: s, sidebarOpen: false });
  const goTransactions = () => setState({ screen: "transactions" });

  const moneyFlowReset = {
    sendStep: 1, sendDone: false, sendRecipient: "", sendRecipientName: "", sendAmount: "", sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0, sendGroup: "country", sendMethod: null,
    sendQuote: null, sendQuoteLoading: false, sendQuoteError: "", sendQuoteErrorTitle: "", sendQuoteErrorAction: null, sendAccept: null, sendAccepting: false, sendAcceptError: "",
    sendPreview: null, sendConfirm: null, sendAccountId: "", sendAsset: "usdc", sendChain: "base",
    bulkLoaded: false, bulkDone: false, depositStep: 1, depositPromptSent: false, depositCountryIdx: 0, depositRailIdx: 0, depositProviderIdx: 0, depositGroup: "country",
    depositAmount: "", depositQuote: null, depositQuoteLoading: false, depositQuoteError: "", depositAccept: null, depositAccepting: false, depositAcceptError: "", depositDone: false, depositIdempotencyKey: "",
    receiveGroup: "fiat", receiveAcctIdx: 0, receiveAsset: "usdc", receiveNetwork: "base", copiedKey: "",
    swapAccepted: false, onrampDir: "onramp", quoteSeconds: 87,
    newCardLabel: "", newCardDone: false, invClient: "", invAmount: "", invoiceDone: false, invoiceError: "", invoiceSubmitting: false,
    fundAfricanTargetCurrency: null, fundConvertStatus: "", fundConvertError: "",
  };
  /** Non-money overlays (tx detail, KYB, cards, …). Money moves use screens. */
  const openModal = (name) => () => setState({
    modal: name,
    ...moneyFlowReset,
  });
  const isMoneyFlowScreen = (screen: string) =>
    screen === "send" || screen === "deposit" || screen === "receive" || screen === "convert";
  /** In-shell money UX: Send / Top up / Receive / Convert as full pages. */
  const openMoneyFlow = (name: "send" | "deposit" | "receive" | "convert") => () =>
    setState((prev: any) => ({
      screen: name,
      modal: null,
      sidebarOpen: false,
      moneyFlowReturn: isMoneyFlowScreen(prev.screen)
        ? (prev.moneyFlowReturn || "home")
        : prev.screen || "home",
      ...moneyFlowReset,
      ...(name === "convert"
        ? { swapAccepted: false, onrampDir: "onramp", quoteSeconds: 87 }
        : {}),
    }));
  const exitMoneyFlow = () =>
    setState((prev: any) => ({
      screen: prev.moneyFlowReturn || "home",
      moneyFlowReturn: null,
      fundAfricanTargetCurrency: null,
      fundConvertStatus: "",
      fundConvertError: "",
    }));

  // Ready USDC Base/Polygon FinancialAccounts for the Stablecoin send tab
  // (Phase 4 `/v1/accounts/{id}/sends`). Fetched when the Send screen opens.
  const sendableAccountsQuery = useQuery({
    queryKey: ["sendable-stablecoin-accounts"],
    queryFn: listSendableStablecoinAccounts,
    enabled: state.screen === "send",
    retry: false,
    staleTime: 30_000,
  });
  const savedRecipientsQuery = useQuery({
    queryKey: ["saved-recipients"],
    queryFn: listSavedRecipients,
    enabled: state.screen === "send",
    retry: false,
    staleTime: 30_000,
  });

  const sendNext = async () => {
    // Country tab step 1: wait for catalog so provider chips / networkId match.
    if (state.sendStep === 1 && state.sendGroup === "country" && !sendCatalogSettled) {
      return;
    }
    // Stablecoin tab step 1 → 2: require a ready USDC account on the chosen
    // network before collecting the recipient (Phase 4).
    if (state.sendStep === 1 && state.sendGroup === "crypto") {
      const accounts = sendableAccountsQuery.data ?? [];
      const account = accountForNetwork(accounts, state.sendChain);
      if (!account) {
        setState({
          sendQuoteError: sendableAccountsQuery.isLoading
            ? "Loading your USDC accounts…"
            : `No ready USDC account on ${SEND_STABLECOIN_NETWORKS.find((n) => n.key === state.sendChain)?.label || state.sendChain}. Open a Base or Polygon USDC account first.`,
        });
        return;
      }
      setState({
        sendStep: 2,
        sendAccountId: account.id,
        sendQuoteError: "",
        sendPreview: null,
        sendAcceptError: "",
      });
      return;
    }
    // Step 2 -> 3: OffRamp quote (by country) or account-send preview (stablecoin).
    if (state.sendStep === 2 && state.sendGroup === "country") {
      if (!state.sendRecipient.trim() || !state.sendRecipientName.trim() || !state.sendAmount.trim()) return;
      setState({ sendQuoteLoading: true, sendQuoteError: "", sendQuoteErrorTitle: "", sendQuoteErrorAction: null });
      try {
        const refundAddress = summaryQuery.data?.totals.wallet_address;
        if (!refundAddress) {
          throw new Error("No treasury wallet is provisioned for this business yet.");
        }
        const country = COUNTRIES[state.sendCountryIdx];
        const rail = country.rails[state.sendRailIdx] || country.rails[0];
        // Real catalog providers for this corridor, when available, carry
        // the aggregator's networkId — falling back to the hardcoded
        // option list (and no networkId, same as pre-catalog behavior)
        // when the catalog has no match yet. Must mirror the same lookup
        // used to build the provider chips below so the id sent on quote
        // always matches what the user actually selected.
        const catalogProviders = offRampProvidersForRail(
          sendCatalogQuery.data,
          country.iso,
          rail.type,
          country.code,
        );
        const providerOptions = providerNamesFromCatalog(
          catalogProviders,
          rail.options,
          sendCatalogSettled,
        );
        if (!providerOptions.length) {
          throw new Error("Providers are still loading. Try again in a moment.");
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
          amount: state.sendAmount.trim(),
          refundAddress,
          // Mobile rails need E.164; the field's placeholder is local format.
          dialCode: country.dialCode,
          networkId,
        });
        const quote = await ordersApi.quote(payload);
        setState({ sendQuoteLoading: false, sendQuote: quote, sendStep: 3 });
      } catch (err) {
        const info = describeSendQuoteError(err);
        setState({
          sendQuoteLoading: false,
          sendQuoteError: info.message,
          sendQuoteErrorTitle: info.title || "",
          sendQuoteErrorAction: info.action,
        });
      }
      return;
    }
    if (state.sendStep === 2 && state.sendGroup === "crypto") {
      if (!state.sendRecipient.trim() || !state.sendAmount.trim()) return;
      setState({ sendQuoteLoading: true, sendQuoteError: "" });
      try {
        const accounts = sendableAccountsQuery.data ?? [];
        const account =
          accountForNetwork(accounts, state.sendChain) ||
          accounts.find((a) => a.id === state.sendAccountId);
        if (!account) {
          throw new Error("No ready USDC account on this network.");
        }
        const payload = buildSendPreviewPayload({
          toAddress: state.sendRecipient.trim(),
          amount: state.sendAmount.trim(),
          networkKey: state.sendChain,
        });
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
          sendQuoteError:
            err instanceof ApiRequestError || err instanceof Error
              ? err.message
              : "Couldn't preview this send. Try again.",
          sendQuoteErrorTitle: "",
          sendQuoteErrorAction: null,
        });
      }
      return;
    }
    setState((s: any) => ({ sendStep: Math.min(3, s.sendStep + 1) }));
  };
  const sendBack = () =>
    setState((s: any) => {
      // Recipient form is the first step after the method chooser — Back
      // returns to the chooser instead of the old country-chip step.
      if (s.sendStep <= 2) {
        return {
          sendMethod: null,
          sendStep: 1,
          sendQuoteError: "",
          sendAcceptError: "",
          sendPreview: null,
          sendQuote: null,
          sendRecipient: "",
          sendRecipientName: "",
          sendAmount: "",
        };
      }
      return {
        sendStep: s.sendStep - 1,
        sendQuoteError: "",
        sendAcceptError: "",
        sendPreview: null,
        sendQuote: null,
      };
    });
  const depositNext = async () => {
    if (state.depositGroup === "crypto") {
      setState((s: any) => ({ depositStep: Math.min(2, s.depositStep + 1) }));
      return;
    }
    if (state.depositStep === 2) {
      if (!state.depositPhone.trim() || !state.depositAmount.trim()) return;
      setState({ depositQuoteLoading: true, depositQuoteError: "" });
      try {
        const walletAddress =
          (state.fundAfricanTargetCurrency
            ? (stablecoinAccountsQuery.data ?? []).find(
                (a) => isReadyStatus(a.status) && a.currency === "USDC" && a.walletAddress,
              )?.walletAddress
            : null) || summaryQuery.data?.totals.wallet_address;
        if (!walletAddress) {
          throw new Error(
            state.fundAfricanTargetCurrency
              ? "No USDC deposit wallet or treasury wallet is available to receive this OnRamp."
              : "No treasury wallet is provisioned for this business yet.",
          );
        }
        const country = COUNTRIES[state.depositCountryIdx];
        const rail = country.rails[state.depositRailIdx] || country.rails[0];
        const catalogProviders = onRampProvidersForRail(
          sendCatalogQuery.data,
          country.iso,
          rail.type,
          country.code,
        );
        const providerOptions =
          catalogProviders && catalogProviders.length > 0
            ? catalogProviders.map((p) => p.name)
            : rail.options;
        const providerIdx =
          providerOptions.length === 0
            ? 0
            : Math.min(state.depositProviderIdx, providerOptions.length - 1);
        const providerName = providerOptions[providerIdx] || providerOptions[0];
        const networkId = networkIdForProvider(catalogProviders, providerName);
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
          dialCode: country.dialCode,
          networkId,
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
            err instanceof ApiRequestError || err instanceof Error
              ? err.message
              : "Couldn't get a quote. Try again.",
        });
      }
      return;
    }
    setState((s: any) => ({ depositStep: Math.min(3, s.depositStep + 1) }));
  };
  const depositBack = () =>
    setState((s: any) => ({
      depositStep: Math.max(1, s.depositStep - 1),
      depositQuoteError: "",
      depositAcceptError: "",
    }));
  const closeModal = () => {
    if (isMoneyFlowScreen(state.screen)) {
      exitMoneyFlow();
      return;
    }
    setState({
      modal: null,
      fundAfricanTargetCurrency: null,
      fundConvertStatus: "",
      fundConvertError: "",
    });
  };
  const stopClick = (e) => e.stopPropagation();
  const openTxDetail = (id: number) => () => setState({ modal: "txDetail", selectedTxId: id });
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
    });
  const openAfricanFundOnRamp = () => {
    const fiatList = depositAccountsQuery.data?.accounts ?? [];
    const currencyKey =
      state.selectedAcctKind === "fiat" && state.selectedAcctKey.startsWith("fiat:")
        ? state.selectedAcctKey.slice("fiat:".length)
        : "";
    const currency =
      state.selectedAcctKind === "fiat"
        ? fiatList.find((a) => a.currency.toUpperCase() === currencyKey)?.currency ||
          currencyKey ||
          "EUR"
        : "EUR";
    setState((prev: any) => ({
      screen: "deposit",
      modal: null,
      sidebarOpen: false,
      moneyFlowReturn: isMoneyFlowScreen(prev.screen)
        ? (prev.moneyFlowReturn || "accountDetail")
        : prev.screen || "accountDetail",
      depositStep: 1,
      depositGroup: "country",
      depositDone: false,
      depositQuote: null,
      depositAccept: null,
      depositQuoteError: "",
      depositAcceptError: "",
      fundAfricanTargetCurrency: String(currency).toUpperCase(),
      fundConvertStatus: "",
      fundConvertError: "",
    }));
  };
  const backToWallets = () => setState({ screen: "wallets", modal: null });
  const openCardDetail = (i) => () => setState({ modal: "cardDetail", selectedCardIdx: i });
  const openNewCard = () => setState({ modal: "newCard", newCardLabel: "", newCardDone: false });
  const openModalInvoice = () => setState({ modal: "invoice", invClient: "", invAmount: "", invoiceDone: false, invoiceError: "", invoiceSubmitting: false });
  const openModalTier = () => setState({ modal: "tier", tierDone: false });
  const openModalKyb = () => setState({ modal: "kyb" });
  const goVerification = () => setState({ screen: "verification", sidebarOpen: false });
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

  /** Changing country keeps the rail the chosen method implies, so a "Mobile
   *  money" send does not silently become a bank transfer when the user picks
   *  a different country. Falls back to the first rail where the country has
   *  no rail of that type. */
  const selectSendCountry = (i) => () =>
    setState((prev: any) => ({
      sendCountryIdx: i,
      sendRailIdx: railIndexForMethod(COUNTRIES[i].rails, prev.sendMethod),
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
      sendRecipientName: "",
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
  const openModalSwapFromAcct = openConvert;
  const setSendRecipient = (e) => setState({ sendRecipient: e.target.value });
  const setSendRecipientName = (e) => setState({ sendRecipientName: e.target.value });
  const setSendAmount = (e) => setState({ sendAmount: e.target.value });
  /** Mobile money: rewrite local numbers (07…) to E.164 (+254…) in the field. */
  const normalizeSendRecipientPhone = (e?: React.FocusEvent<HTMLInputElement>) => {
    setState((prev: any) => {
      if (prev.sendGroup !== "country") return {};
      const country = COUNTRIES[prev.sendCountryIdx] || COUNTRIES[0];
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
    };
    let countryIdx = state.sendCountryIdx;
    if (state.sendGroup === "country" && (r.countryCode || r.currency)) {
      const match = COUNTRIES.findIndex((c) => {
        if (r.countryCode && c.iso.toUpperCase() === String(r.countryCode).toUpperCase()) return true;
        if (r.currency && c.code.toUpperCase() === String(r.currency).toUpperCase()) return true;
        return false;
      });
      if (match >= 0) {
        countryIdx = match;
        patch.sendCountryIdx = match;
        patch.sendRailIdx = railIndexForMethod(COUNTRIES[match].rails, state.sendMethod);
        patch.sendProviderIdx = 0;
      }
    }
    const country = COUNTRIES[countryIdx] || COUNTRIES[0];
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
      const options = providerNamesFromCatalog(
        catalogProviders,
        rail.options,
        sendCatalogSettled,
      );
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
    const country = COUNTRIES[state.sendCountryIdx] || COUNTRIES[0];
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
    const providerOptions = providerNamesFromCatalog(
      catalogProviders,
      countryRail.options,
      sendCatalogSettled,
    );
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
        countryCode: state.sendGroup === "country" ? country.code : undefined,
        countryName: state.sendGroup === "country" ? country.name : undefined,
        currency: state.sendGroup === "country" ? country.code : state.sendAsset.toUpperCase(),
        provider,
        network: state.sendGroup === "crypto" ? state.sendChain : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["saved-recipients"] });
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
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions-page"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["sendable-stablecoin-accounts"] });
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
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-page"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
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
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["transactions-page"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        setState({ sendAccepting: false, sendAccept: null, sendDone: true });
        return;
      }
      setState({
        sendAccepting: false,
        sendAcceptError: err instanceof ApiRequestError ? err.message : "Couldn't send the payment. Try again.",
      });
    }
  };

  const setDepositGroup = (g) => () => setState({ depositGroup: g, depositCountryIdx: 0, depositRailIdx: 0, depositProviderIdx: 0, depositPromptSent: false, depositStep: 1, depositQuote: null, depositQuoteError: "", depositAccept: null, depositAcceptError: "", depositDone: false });
  const selectDepositCountry = (i) => () => setState({ depositCountryIdx: i, depositRailIdx: 0, depositProviderIdx: 0, depositPromptSent: false, depositQuote: null, depositQuoteError: "" });
  const selectDepositRail = (i) => () => setState({ depositRailIdx: i, depositProviderIdx: 0, depositPromptSent: false, depositQuote: null, depositQuoteError: "" });
  const selectDepositProvider = (i) => () => setState({ depositProviderIdx: i, depositQuote: null, depositQuoteError: "" });
  const setDepositPhone = (e) => setState({ depositPhone: e.target.value });
  const setDepositAmount = (e) => setState({ depositAmount: e.target.value });
  const submitDeposit = async () => {
    if (state.depositGroup !== "country") return;
    if (!state.depositQuote) return;
    const country = COUNTRIES[state.depositCountryIdx];
    const rail = country.rails[state.depositRailIdx] || country.rails[0];
    setState({ depositAccepting: true, depositAcceptError: "" });
    try {
      const accepted = await ordersApi.accept(
        state.depositQuote.quote_id,
        undefined,
        state.depositQuote.quote_id,
      );
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
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
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
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
          err instanceof ApiRequestError ? err.message : "Couldn't confirm the top-up. Try again.",
      });
    }
  };
  const setSendAsset = (k) => () => setState({ sendAsset: k, sendPreview: null, sendQuoteError: "" });
  const setSendChain = (k) => () => setState({ sendChain: k, sendPreview: null, sendAccountId: "", sendQuoteError: "" });
  const setDepositAsset = (k) => () => setState({ depositAsset: k });
  const setDepositNetwork = (k) => () => setState({ depositNetwork: k });

  const setReceiveGroup = (g) => () => setState({ receiveGroup: g, copiedKey: "" });
  const selectReceiveAcct = (i) => () => setState({ receiveAcctIdx: i, copiedKey: "" });
  const setReceiveAsset = (k) => () => setState({ receiveAsset: k, copiedKey: "" });
  const setReceiveNetwork = (k) => () => setState({ receiveNetwork: k, copiedKey: "" });
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
  const simulateBulkUpload = () => setState({ bulkLoaded: true });
  const runBulkPayout = () => setState({ bulkDone: true });

  const setStable = (k) => () => setState({ stableSel: k });
  const setOnramp = () => setState({ onrampDir: "onramp" });
  const setOfframp = () => setState({ onrampDir: "offramp" });
  const refreshQuote = () => setState({ quoteSeconds: 87 });
  const acceptQuote = () => { if (state.quoteSeconds > 0) setState({ swapAccepted: true }); };
  const setTxFilter = (f) => () => setState({ txFilter: f });
  // Add Account: a small menu that branches into two create modals.
  const toggleAddAccountMenu = () => setState(s => ({ addAccountMenu: !s.addAccountMenu }));
  const closeAddAccountMenu = () => setState({ addAccountMenu: false });
  const openCreateAccount = (kind) => () => {
    const stableOccupied = occupiedStablecoinNetworkCodes(
      stablecoinAccountsQuery.data ?? [],
    );
    const fiatOccupied = occupiedFiatCurrencyCodes(
      depositAccountsQuery.data?.accounts ?? [],
    );
    if (kind === "stablecoin") {
      const available = (["BASE", "POLYGON"] as const).filter(
        (code) => !stableOccupied.has(code),
      );
      setState({
        modal: "createAccount",
        addAccountMenu: false,
        createAccountKind: "stablecoin",
        createAccountName: "",
        createAccountCurrency: "",
        createAccountStablecoin: available.length > 0 ? "USDC" : "",
        createAccountNetwork: available.length === 1 ? available[0] : "",
        createAccountError:
          available.length === 0
            ? "You already have USDC accounts on Base and Polygon."
            : "",
      });
      return;
    }
    const availableFiat = SUPPORTED_IBAN_CURRENCIES.filter(
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
  const setCreateAccountStablecoin = (e) => setState({ createAccountStablecoin: e.target.value, createAccountError: "" });
  const setCreateAccountNetwork = (e) => setState({ createAccountNetwork: e.target.value, createAccountError: "" });

  const copyField = (fieldKey, val) => () => { if (navigator.clipboard) navigator.clipboard.writeText(val).catch(()=>{}); setState({ copiedField: fieldKey }); };
  const toggleRevealKey = (id) => () => setState(s => ({ apiKeyRevealed: { ...s.apiKeyRevealed, [id]: !s.apiKeyRevealed[id] } }));
  const toggleRevealSecret = (id) => () => setState(s => ({ secretRevealed: { ...s.secretRevealed, [id]: !s.secretRevealed[id] } }));

  // Cards + Team have no backend yet, so these stay local/simulated exactly
  // as the original design prototype had them. See docs/api-contract.md.
  const setNewCardLabel = (e) => setState({ newCardLabel: e.target.value });
  const issueCard = () => { if (state.newCardLabel.trim()) setState({ newCardDone: true }); };
  const toggleFreezeCard = () => setState(s => ({ cardFrozen: !s.cardFrozen }));
  const fundCard = () => setState({ modal: "fundCard", fundCardDone: false });
  const withdrawCard = () => setState({ modal: "fundCard", fundCardDone: false });
  const openFundCardDirect = (i) => (e) => { e.stopPropagation(); setState({ modal: "fundCard", fundCardDone: false, selectedCardIdx: i }); };
  const openWithdrawDirect = (i) => (e) => { e.stopPropagation(); setState({ modal: "fundCard", fundCardDone: false, selectedCardIdx: i }); };
  const terminateCard = () => setState({ modal: null });
  const setFundAmount = (e) => setState({ fundAmount: e.target.value });
  const submitFundCard = () => { if (state.fundAmount.trim()) setState({ fundCardDone: true }); };

  const openInvite = () => setState({ inviteOpen: true, inviteName: "", inviteEmail: "", inviteRole: "operator" });
  const closeInvite = () => setState({ inviteOpen: false });
  const setInviteName = (e) => setState({ inviteName: e.target.value });
  const setInviteEmail = (e) => setState({ inviteEmail: e.target.value });
  const setInviteRole = (k) => () => setState({ inviteRole: k });
  const submitInvite = () => {
    const { inviteName, inviteEmail, inviteRole, teamMembers } = state;
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const id = "u" + (teamMembers.length + 1) + "_" + Date.now();
    setState({
      teamMembers: [...teamMembers, { id, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole, status: "invited" }],
      inviteOpen: false,
    });
  };
  const setMemberRole = (id) => (e) => {
    const role = e.target.value;
    setState(s => ({ teamMembers: s.teamMembers.map(m => m.id === id ? { ...m, role } : m) }));
  };
  const removeMember = (id) => () => setState(s => ({ teamMembers: s.teamMembers.filter(m => m.id !== id) }));

  const openCreateApiKeyModal = () => setState({ modal: "apiKey", apiKeyName: "", apiKeyEnvironment: "sandbox", apiKeyError: "" });
  const setApiKeyName = (e) => setState({ apiKeyName: e.target.value });
  const setApiKeyEnvironment = (env: string) => () => setState({ apiKeyEnvironment: env });
  const submitApiKey = async () => {
    if (!state.apiKeyName.trim()) return;
    setState({ apiKeyCreating: true, apiKeyError: "" });
    try {
      const created = await apiKeysApi.create({ name: state.apiKeyName.trim(), environment: state.apiKeyEnvironment });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
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
    if (depositEligibilityQuery.data?.eligible !== true) {
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
      const occupied = occupiedStablecoinNetworkCodes(
        stablecoinAccountsQuery.data ?? [],
      );
      if (occupied.has(state.createAccountNetwork.trim().toUpperCase())) {
        return setState({
          createAccountError:
            "You already have a USDC account on this network — one per Base/Polygon.",
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
        queryClient.invalidateQueries({ queryKey: ["stablecoin-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["sendable-stablecoin-accounts"] });
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
      await depositAccountsApi.create({
        currency: state.createAccountCurrency,
        accountName: state.createAccountName.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["deposit-accounts"] });
      setState({ createAccountSaving: false, modal: null });
    } catch (err) {
      setState({
        createAccountSaving: false,
        createAccountError: err instanceof Error ? err.message : "Couldn't create the account.",
      });
    }
  };
  const revokeApiKey = (id: number) => async () => {
    await apiKeysApi.revoke(id);
    queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  };
  const deleteApiKey = (id: number) => async () => {
    await apiKeysApi.remove(id);
    queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  };

  const setInvClient = (e) => setState({ invClient: e.target.value });
  const setInvAmount = (e) => setState({ invAmount: e.target.value });
  const submitInvoice = async () => {
    if (!state.invClient.trim() || !state.invAmount.trim()) return;
    setState({ invoiceSubmitting: true, invoiceError: "" });
    try {
      const draft = await invoicesApi.createDraft(null, buildSimpleDraftPayload(state.invClient, state.invAmount));
      await invoicesApi.issue(draft.id, "none");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setState({ invoiceDone: true, invoiceSubmitting: false });
    } catch (err) {
      setState({
        invoiceSubmitting: false,
        invoiceError: err instanceof ApiRequestError ? err.message : "Couldn't create the invoice. Try again.",
      });
    }
  };
  const uploadTierDoc = () => {};
  const submitTier = () => setState({ tierDone: true });
  const setBalanceView = (v) => () => setState({ balanceView: v });
  /** Send opens on a method chooser. Bank/mobile preselect that rail; jump
   *  straight into recipient details (country/currency/account on one form). */
  const chooseSendMethod = (m) => () => {
    if (m === "internal") return;
    const common = {
      sendMethod: m,
      sendStep: 2,
      sendCountryIdx: 0,
      sendProviderIdx: 0,
      sendRecipient: "",
      sendRecipientName: "",
      sendAmount: "",
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
    const countryIdx = COUNTRIES.findIndex((c) => c.rails.some((r) => r.type === prefer));
    const idx = countryIdx >= 0 ? countryIdx : 0;
    setState({
      ...common,
      sendGroup: "country",
      sendCountryIdx: idx,
      sendRailIdx: railIndexForMethod(COUNTRIES[idx].rails, m),
    });
  };

    const s = state;
    const boostDark = props.boostDarkContrast ?? true;
    const vars = s.theme === "dark" ? (boostDark ? { ...DARK, ...DARK_HC_OVERRIDES } : DARK) : LIGHT;

    const navMap = [
      { key: "home", label: "Home", group: "Overview" },
      { key: "wallets", label: "Accounts", group: null },
      { key: "cards", label: "Cards", group: null },
      { key: "transactions", label: "Transactions", group: "Money" },
      { key: "invoices", label: "Invoices", group: null },
      { key: "reports", label: "Reports", group: null },
      { key: "verification", label: "Verification", group: "Account" },
      { key: "team", label: "Team", group: null },
      { key: "developer", label: "Developer", group: null },
    ];
    const titles: Record<string, [string, string]> = {
      home: ["Home", "Your balances, actions, and activity at a glance"],
      wallets: ["Accounts", "One main stablecoin wallet, currency accounts around it"],
      accountDetail: ["Account", "Balance, details, and activity for this account"],
      cards: ["Cards", "Virtual USD cards for team spend"],
      transactions: ["Transactions", "Every payout, deposit, and swap across rails"],
      invoices: ["Invoices", "Request and track incoming payments"],
      reports: ["Reports", "Volume, corridors, and settlement performance"],
      verification: ["Verification", "Higher tiers unlock higher limits"],
      team: ["Team", "Invite teammates and manage their access"],
      developer: ["Developer", "API keys and webhooks"],
      send: ["Send money", "Pick a method, recipient, and amount"],
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

    const sendCountryChips = COUNTRIES.map((c, i) => ({
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
    const allCountryChips = (selIdx, selectFn) => COUNTRIES.map((c, i) => ({
      flagUrl: flagUrl(c.iso), name: c.name, code: c.code, select: selectFn(i),
      bg: i === selIdx ? "var(--indigo-tint)" : "var(--surface2)", border: i === selIdx ? "var(--indigo)" : "transparent",
    }));
    const sendCountry = COUNTRIES[s.sendCountryIdx];
    const sendRailChips = sendCountry.rails.map((r, i) => ({ label: r.label, select: selectSendRail(i), bg: i === s.sendRailIdx ? "var(--ink)" : "var(--surface2)", color: i === s.sendRailIdx ? "var(--bg)" : "var(--ink)" }));
    const sendRail = sendCountry.rails[s.sendRailIdx] || sendCountry.rails[0];
    // Real catalog providers for this corridor when the aggregator has one
    // (carries a real networkId — see sendNext). While the first catalog
    // fetch is in flight, show no chips (not hardcoded fallback); after
    // settle with no match, fall back so un-onboarded corridors still render.
    const sendCatalogProviders = offRampProvidersForRail(
      sendCatalogQuery.data,
      sendCountry.iso,
      sendRail.type,
      sendCountry.code,
    );
    const sendProviderOptions = providerNamesFromCatalog(
      sendCatalogProviders,
      sendRail.options,
      sendCatalogSettled,
    );
    const sendCatalogLoading = !sendCatalogSettled;
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

    const depositCountryChips = allCountryChips(s.depositCountryIdx, selectDepositCountry).map(c => ({ ...c, selectDeposit: c.select, depositBg: c.bg, depositBorder: c.border }));
    const depositCountry = COUNTRIES[s.depositCountryIdx];
    const depositRailChips = depositCountry.rails.map((r, i) => ({ label: r.label, select: selectDepositRail(i), bg: i === s.depositRailIdx ? "var(--ink)" : "var(--surface2)", color: i === s.depositRailIdx ? "var(--bg)" : "var(--ink)" }));
    const depositRail = depositCountry.rails[s.depositRailIdx] || depositCountry.rails[0];
    const depositCatalogProviders = onRampProvidersForRail(
      sendCatalogQuery.data,
      depositCountry.iso,
      depositRail.type,
      depositCountry.code,
    );
    const depositProviderOptions =
      depositCatalogProviders && depositCatalogProviders.length > 0
        ? depositCatalogProviders.map((p) => p.name)
        : depositRail.options;
    const depositProviderIdx =
      depositProviderOptions.length === 0
        ? 0
        : Math.min(s.depositProviderIdx, depositProviderOptions.length - 1);
    const depositProvider = depositProviderOptions[depositProviderIdx] || depositProviderOptions[0];
    const depositProviderChips = depositProviderOptions.map((name, i) => ({
      name,
      select: selectDepositProvider(i),
      bg: i === depositProviderIdx ? "var(--indigo-tint)" : "var(--surface2)",
      border: i === depositProviderIdx ? "var(--indigo)" : "transparent",
    }));

    const bulkCountryChips = COUNTRIES.slice(0, 10).map((c, i) => ({
      flagUrl: flagUrl(c.iso), code: c.code, toggleBulk: toggleBulkCountry(i),
      bulkBg: s.bulkSelected.includes(i) ? "var(--indigo-tint)" : "var(--surface2)",
      bulkBorder: s.bulkSelected.includes(i) ? "var(--indigo)" : "transparent",
    }));

    const quoteExpired = s.quoteSeconds <= 0;
    const isOnrampDir = s.onrampDir === "onramp";

    // Real transactions from the backend (thin read-view over merchant_orders).
    // TransactionOut has no counterparty name/country — those fields are
    // display-only stand-ins, not fabricated financial data.
    const TX_STATUS_DISPLAY: Record<string, [string, string, string]> = {
      processing: ["Pending", "var(--amber)", "var(--amber-tint)"],
      completed: ["Settled", "var(--indigo-text)", "var(--indigo-tint)"],
      failed: ["Failed", "var(--red)", "var(--red-tint)"],
      refunded: ["Refunded", "var(--amber)", "var(--amber-tint)"],
      canceled: ["Canceled", "var(--muted)", "var(--surface2)"],
      frozen: ["Frozen", "var(--red)", "var(--red-tint)"],
    };
    const decorateTx = (t: Transaction) => {
      const [label, color, soft] = TX_STATUS_DISPLAY[t.status] || ["Unknown", "var(--muted)", "var(--surface2)"];
      const sign = t.direction === "out" ? "-" : t.direction === "in" ? "+" : "";
      const clientLabel = t.external_order_id || t.aggregator_order_id || `Order #${t.id}`;
      const typeLabel = t.direction === "in" ? "Deposit" : t.direction === "out" ? "Payout" : "Transaction";
      return {
        ...t,
        flagUrl: null,
        client: clientLabel,
        type: typeLabel,
        amount: `${sign}${t.currency} ${t.amount_fiat}`,
        ref: t.aggregator_order_id || t.external_order_id || `EP-${t.id}`,
        statusLabel: label,
        statusColor: color,
        statusSoft: soft,
        amountColor: sign === "+" ? "var(--success)" : "var(--ink)",
        openDetail: openTxDetail(t.id),
      };
    };
    const decoratedAll = (transactionsQuery.data?.items ?? []).map(decorateTx);
    const filteredTransactions = transactionsPageQuery.items.map(decorateTx);
    // Fetched by id (txDetailQuery), independent of the list above — see
    // openTxDetail. Falls back to the list's cached copy while the detail
    // fetch is in flight so the modal isn't blank on first open.
    const txDetail = txDetailQuery.data
      ? decorateTx(txDetailQuery.data)
      : decoratedAll.find((t) => t.id === s.selectedTxId)
        ?? filteredTransactions.find((t) => t.id === s.selectedTxId);
    const txLiveStatus =
      s.modal === "txDetail" && txDetail && !txStatusQuery.isTerminal
        ? {
            label: txStatusQuery.isFrozen ? "Frozen — needs review" : "Tracking live — updates automatically",
            isFetching: txStatusQuery.isFetching,
          }
        : null;
    // Deposit accounts have no balance field (see docs/api-contract.md) — the
    // color/soft pair below drives the status pill only, never a number.
    const depositStatusPalette: Record<string, [string, string]> = {
      active: ["var(--indigo-text)", "var(--indigo-tint)"],
      pending: ["var(--amber)", "var(--amber-tint)"],
      unavailable: ["var(--red)", "var(--red-tint)"],
    };
    const depositStatusColors = (status: string): [string, string] =>
      depositStatusPalette[status] || ["var(--muted)", "var(--surface2)"];
    const depositAccountsList = depositAccountsQuery.data?.accounts ?? [];
    const stablecoinAccountsList = stablecoinAccountsQuery.data ?? [];
    const selectedDepositAccount =
      s.selectedAcctKind === "fiat" && s.selectedAcctKey.startsWith("fiat:")
        ? depositAccountsList.find(
            (a) => a.currency.toUpperCase() === s.selectedAcctKey.slice("fiat:".length),
          ) ?? null
        : null;
    const selectedStablecoinAccount =
      s.selectedAcctKind === "stablecoin" && s.selectedAcctKey.startsWith("stablecoin:")
        ? stablecoinAccountsList.find(
            (a) => a.id === s.selectedAcctKey.slice("stablecoin:".length),
          ) ?? null
        : null;
    const acctDetail = selectedDepositAccount
      ? (() => {
          const view = mapDepositAccountToCardView(selectedDepositAccount);
          const [statusColor, statusSoft] = depositStatusColors(view.status);
          const rows = buildDepositAccountDetailRows(selectedDepositAccount);
          const bankRows = rows.filter((r) =>
            /^(iban|bic|swift|bank|account name)/i.test(r.label),
          );
          const settleRows = rows.filter(
            (r) => !/^(iban|bic|swift|bank|account name)/i.test(r.label),
          );
          return {
            currency: view.currency,
            name: view.name,
            beneficiary: selectedDepositAccount.account_holder_name || view.name,
            flagUrl: view.iso ? flagUrl(view.iso) : null,
            statusLabel: view.statusLabel,
            statusColor,
            statusSoft,
            rows,
            sections: [
              ...(bankRows.length ? [{ title: "Bank details", rows: bankRows }] : []),
              ...(settleRows.length ? [{ title: "Settlement", rows: settleRows }] : []),
            ],
            instructions: selectedDepositAccount.instructions,
            railLabel: fiatRailForCurrency(view.currency),
            showConvert: true,
            showDownloadLetter: rows.length > 0,
          };
        })()
      : selectedStablecoinAccount
        ? (() => {
            const networkLabel = formatNetworkLabel(selectedStablecoinAccount.network);
            const statusKey = isReadyStatus(selectedStablecoinAccount.status)
              ? "active"
              : selectedStablecoinAccount.status?.toLowerCase().includes("fail")
                ? "unavailable"
                : "pending";
            const [statusColor, statusSoft] = depositStatusColors(statusKey);
            const rows = buildStablecoinAccountDetailRows(selectedStablecoinAccount);
            return {
              currency: selectedStablecoinAccount.currency,
              name: `${selectedStablecoinAccount.currency} · ${networkLabel}`,
              beneficiary: `${selectedStablecoinAccount.currency} · ${networkLabel}`,
              flagUrl: null as string | null,
              statusLabel: describeStablecoinAccountStatus(selectedStablecoinAccount.status),
              statusColor,
              statusSoft,
              rows,
              sections: [{ title: "Account", rows }],
              instructions: null as string | null,
              railLabel: `Stablecoin · ${networkLabel}`,
              showConvert: false,
              showDownloadLetter: false,
            };
          })()
      : null;
    const acctSummaryLines = (acctDetail?.rows ?? [])
      .filter((row) => !row.copyValue)
      .slice(0, 3)
      .map((row) => ({ k: row.label, v: row.value }));
    // Prefer a short readable summary when coords-only rows would leave the strip empty.
    const acctDetailLines =
      acctSummaryLines.length > 0
        ? acctSummaryLines
        : acctDetail
          ? [
              { k: "Rail", v: acctDetail.railLabel ?? acctDetail.currency },
              { k: "Status", v: acctDetail.statusLabel },
              ...(acctDetail.rows[0]
                ? [{ k: acctDetail.rows[0].label, v: acctDetail.rows[0].value }]
                : []),
            ]
          : [];
    const cardSel = CARDS[s.selectedCardIdx];
  const rootStyle: React.CSSProperties = { minHeight: "100vh", position: "relative", background: "var(--bg)", color: "var(--ink)", fontFamily: "'DM Sans',sans-serif", ...vars };
  const themeIcon = s.theme === "dark" ? "☀" : "☾";
  const mainNavItems = navMap.map(n => {
        const active =
          n.key === "wallets"
            ? s.screen === "wallets" || s.screen === "accountDetail"
            : s.screen === n.key;
        return { label: n.label, groupLabel: n.group, select: setScreen(n.key), bg: active ? "var(--indigo)" : "transparent", color: active ? "var(--indigo-on)" : "var(--muted)", weight: active ? 700 : 600, shadow: active ? "0 8px 18px -8px rgba(59,46,211,0.5)" : "none" };
      });
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
  const bottomNavItems = [
        { key: "home", label: "Home", icon: "⌂", elevated: false },
        { key: "wallets", label: "Accounts", icon: "▦", elevated: false },
        { key: "__pay", label: "Send", icon: "⇄", elevated: true },
        { key: "transactions", label: "Activity", icon: "≣", elevated: false },
        { key: "__more", label: "More", icon: "⋯", elevated: false },
      ].map(n => {
        const active =
          n.key === "__pay"
            ? s.screen === "send"
            : n.key === "__more"
              ? s.sidebarOpen
              : n.key === "wallets"
                ? s.screen === "wallets" || s.screen === "accountDetail"
                : s.screen === n.key;
        const select = n.key === "__pay" ? guardMoneyModal("send") : n.key === "__more" ? toggleSidebar : setScreen(n.key);
        return { key: n.key, label: n.label, icon: n.icon, elevated: n.elevated, select, active, color: active ? "var(--indigo-text)" : "var(--muted2)", weight: active ? 700 : 600 };
      });
  const balanceViewTabs = ["all","fiat","stablecoin"].map(v => ({ key: v, label: v === "all" ? "All" : v === "fiat" ? "Fiat" : "Stablecoin", select: setBalanceView(v), bg: s.balanceView === v ? "#fff" : "transparent", color: s.balanceView === v ? "var(--indigo)" : "#fff" }));
  // No real total-balance source exists yet: it is a currency-accounts
  // aggregate (IBAN/Wallets scope, deferred), and the only backend field in
  // this neighborhood — `totals.user_balance` — is an untyped Privy
  // passthrough that reports null whenever Privy has no balance to give.
  //
  // So this renders an em dash rather than a number. It previously showed a
  // hardcoded "$548,830.55", which is worse than showing nothing: on a real
  // account with no money in it, an invented balance is indistinguishable
  // from a true one. Restore a figure here only when it is computed from a
  // real source. See docs/api-contract.md.
  const homeTotalBalance = "—";
  const balanceViewSub = s.balanceView === "stablecoin" ? "Stablecoin balance not yet available" : s.balanceView === "fiat" ? "Fiat account balance not yet available" : "Balance not yet available";
  // Fiat IBAN chips + partner USDC Base/Polygon chips. No invented balances.
  const fiatBalanceRows = depositAccountsList.map((a) => {
    const view = mapDepositAccountToCardView(a);
    return { flagUrl: view.iso ? flagUrl(view.iso) : null, code: view.currency, balance: "—" };
  });
  const stableBalanceRows = stablecoinAccountsList.map((a) => ({
    flagUrl: null as string | null,
    code: `${a.currency}/${formatNetworkLabel(a.network)}`,
    balance: "—",
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
  const quickActionTiles = [
        { label: "Send", icon: "↗", desc: "Mobile money, bank, SEPA or stablecoin.", open: guardMoneyModal("send"), iconBg: "var(--indigo)", iconColor: "var(--indigo-on)" },
        { label: "Bulk payouts", icon: "⇉", desc: "Pay up to 1,000 recipients from a CSV.", open: guardMoneyModal("bulk"), iconBg: "var(--ink-panel)", iconColor: "#fff" },
        { label: "Receive globally", icon: "↙", desc: "Share your IBAN, Paybill or wallet details.", open: openMoneyFlow("receive"), iconBg: "var(--amber)", iconColor: "#fff" },
        { label: "Top up", icon: "＋", desc: "Fund your balance from any rail.", open: guardMoneyModal("deposit"), iconBg: "var(--indigo-tint)", iconColor: "var(--indigo-text)" },
      ];
  const totals = summaryQuery.data?.totals;
  const liveRates = liveRateRowsFromSummary(summaryQuery.data?.fx_rates);
  const fmtUsd = (v: string | number | undefined) =>
    v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const homeStats = [
        { label: "Money in · 30 days", value: fmtUsd(totals?.money_in_30d), icon: "↑", iconBg: "var(--indigo-tint)", iconColor: "var(--indigo-text)" },
        { label: "Money out · 30 days", value: fmtUsd(totals?.money_out_30d), icon: "↓", iconBg: "var(--surface2)", iconColor: "var(--muted)" },
        { label: "Awaiting settlement", value: totals ? String(totals.pending_count) : "—", icon: "◔", iconBg: "var(--amber-tint)", iconColor: "var(--amber)" },
      ];
  const homeRecent = decoratedAll.slice(0, 4);
  // No real stablecoin settlement-wallet balance source exists yet — same
  // reasoning as `homeTotalBalance` above. Previously hardcoded to
  // "USDC 180,860.00", which read as live on an account with none. Restore
  // a figure here only once it's computed from a real source.
  const mainWalletBalance = "—";
  const mainWalletSub = "Stablecoin balance not yet available";
  const stableTabs = ["USDC","USDT"].map(k => ({ label: k, select: setStable(k), bg: s.stableSel === k ? "var(--indigo)" : "transparent", color: s.stableSel === k ? "var(--indigo-on)" : "var(--muted)" }));
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
      balance: "—",
      detail: view.primaryDetail,
      statusLabel: view.statusLabel,
      statusColor,
      statusSoft,
      openDetail: openAcctDetail("fiat", key),
    };
  });
  const stablecoinAccountCards = stablecoinAccountsList.map((a) => {
    const networkLabel = formatNetworkLabel(a.network);
    const statusKey = isReadyStatus(a.status)
      ? "active"
      : a.status?.toLowerCase().includes("fail")
        ? "unavailable"
        : "pending";
    const [statusColor, statusSoft] = depositStatusColors(statusKey);
    const key = `stablecoin:${a.id}`;
    return {
      key,
      currency: a.currency,
      name: a.currency,
      label: `${a.currency} · ${networkLabel}`,
      flagUrl: null as string | null,
      rail: `Stablecoin · ${networkLabel}`,
      balance: "—",
      detail: networkLabel,
      statusLabel: describeStablecoinAccountStatus(a.status),
      statusColor,
      statusSoft,
      openDetail: openAcctDetail("stablecoin", key),
    };
  });
  const accounts = [...fiatAccountCards, ...stablecoinAccountCards];
  const accountsCount = accounts.length;
  const depositEligible = depositEligibilityQuery.data?.eligible === true;
  const depositEligibilityErrorMessage = depositEligibilityQuery.isError
    ? (depositEligibilityQuery.error instanceof Error
        ? depositEligibilityQuery.error.message
        : "Couldn't check account eligibility. Try again.")
    : undefined;
  const depositAccountsErrorMessage =
    depositAccountsQuery.isError || stablecoinAccountsQuery.isError
      ? (depositAccountsQuery.error instanceof Error
          ? depositAccountsQuery.error.message
          : stablecoinAccountsQuery.error instanceof Error
            ? stablecoinAccountsQuery.error.message
            : "Couldn't load currency accounts. Try again.")
      : undefined;
  const walletsRecent = decoratedAll.slice(0, 5);
  const fundingUsdcAccount =
    stablecoinAccountsList.find(
      (a) => isFundableStablecoinAccount(a) && a.currency === "USDC",
    ) ??
    stablecoinAccountsList.find((a) => isFundableStablecoinAccount(a)) ??
    null;
  const fundStablecoinRails = buildFundStablecoinRails(stablecoinAccountsList);
  const africanFundPlan = acctDetail
    ? planAfricanFundOrchestration({
        fiatCurrency: acctDetail.currency,
        fiatAccountId: null,
        entityId: fundingUsdcAccount?.entityId ?? null,
        usdcAccountId: fundingUsdcAccount?.id ?? null,
        usdcWalletAddress: fundingUsdcAccount?.walletAddress ?? null,
        treasuryWalletAddress: summaryQuery.data?.totals.wallet_address ?? null,
        convertNetworkId: null,
      })
    : null;
  const cardsRecent = decoratedAll.slice(0, 5);
  const corridors = CORRIDORS.map(c => ({
        ...c,
        flagUrl: flagUrl(c.iso),
        statusLabel: c.status === "live" ? "Live" : "Degraded",
        statusColor: c.status === "live" ? "var(--indigo-text)" : "var(--amber)",
        statusSoft: c.status === "live" ? "var(--indigo-tint)" : "var(--amber-tint)",
      }));
  const cards = CARDS.map((c,i) => ({ ...c, openDetail: openCardDetail(i), statusLabel: c.status === "active" ? "Active" : "Frozen", filter: c.status === "frozen" ? "saturate(0.2) opacity(0.7)" : "none", fund: openFundCardDirect(i), withdraw: openWithdrawDirect(i), freeze: openCardDetail(i) }));
  const txFilters = TX_FILTERS.map((f) => ({ label: f.label, select: setTxFilter(f.key), bg: s.txFilter === f.key ? "var(--indigo)" : "var(--surface2)", color: s.txFilter === f.key ? "var(--indigo-on)" : "var(--muted)" }));
  const invoices = (invoicesQuery.data?.items ?? []).map((inv) => {
    const [l, c, soft] = STATUS_MAP[inv.status] || ["Draft", "var(--muted)", "var(--surface2)"];
    const clientName = inv.payload?.client_name || "—";
    const lineItem = inv.payload?.line_items?.[0];
    const amount = lineItem
      ? `${inv.payload.currency} ${lineItem.unit_amount ?? lineItem.amount ?? ""}`.trim()
      : inv.payload?.currency || "";
    return { id: inv.invoice_number, client: clientName, amount, statusLabel: l, statusColor: c, statusSoft: soft };
  });

  // Reports: computed from real transactions rather than fabricated numbers.
  // "Avg settlement time" derives from updated_at - created_at on completed
  // orders (a genuine proxy for settlement duration); anything we can't
  // honestly compute from what the backend returns (e.g. real per-day
  // volume beyond what's in the fetched page) is shown as "—" rather than
  // invented.
  const allTx = transactionsQuery.data?.items ?? [];
  const completedTx = allTx.filter((t) => t.status === "completed");
  const totalVolume30d = totals ? Number(totals.money_in_30d) + Number(totals.money_out_30d) : null;
  const successRate = allTx.length ? Math.round((completedTx.length / allTx.length) * 100) : null;
  const avgSettlementMs = completedTx.length
    ? completedTx.reduce((sum, t) => sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()), 0) /
      completedTx.length
    : null;
  const fmtDuration = (ms: number | null) => {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
    const totalSeconds = Math.round(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${m}m ${sec}s`;
  };
  const reportStats = [
        { label: "Total volume · 30d", value: totalVolume30d == null ? "—" : fmtUsd(totalVolume30d), color: "var(--ink)" },
        { label: "Avg settlement time", value: fmtDuration(avgSettlementMs), color: "var(--ink)" },
        { label: "Success rate", value: successRate == null ? "—" : `${successRate}%`, color: "var(--indigo-text)" },
      ];
  const reportBars = (() => {
    const days: { key: string; total: number }[] = [];
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), total: 0 });
    }
    for (const t of allTx) {
      const key = new Date(t.created_at).toISOString().slice(0, 10);
      const bucket = days.find((d) => d.key === key);
      if (bucket) bucket.total += Number(t.amount_fiat) || 0;
    }
    const max = Math.max(1, ...days.map((d) => d.total));
    const hasVolume = days.some((d) => d.total > 0);
    return days.map((d) => {
      const date = new Date(d.key + "T12:00:00");
      const dayLabel = date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
      return {
        h: hasVolume ? Math.round((d.total / max) * 100) : 0,
        dayLabel,
        amountLabel: d.total > 0 ? fmtUsd(d.total) : "—",
        title: `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.total > 0 ? fmtUsd(d.total) : "No volume"}`,
      };
    });
  })();
  const reportBarsEmpty = reportBars.every((b) => b.h === 0);
  const coverageChips = CURRENCIES.map(c => ({ flagUrl: flagUrl(c.iso), code: c.code }));
  // Tier 1 reflects real account/email verification. Tier 2 is the real Mboka
  // KYB wizard (`/api/businesses/{id}/kyb/*`). Tier 3 has no backend yet.
  const emailVerified = !!meQuery.data?.user.email_verified;
  const tier2Display = kybStatusLoading
    ? { label: "Loading…", color: "var(--muted)", soft: "var(--surface2)" }
    : kybTierDisplay(kybStatus);
  const tier2Approved = kybApproved;
  const tiers = [
        { num: "TIER 1", title: "Basic", reqs: ["Business email verified","Director ID verified","Phone linked"], limit: "Limit · $1,000 / day", statusLabel: emailVerified ? "Complete" : "Pending", statusColor: emailVerified ? "var(--indigo-text)" : "var(--muted)", statusSoft: emailVerified ? "var(--indigo-tint)" : "var(--surface2)", locked: false },
        { num: "TIER 2", title: "Registered Business", reqs: ["Business profile & address","Beneficial owner (UBO)","Supporting documents"], limit: "Limit · $25,000 / day", statusLabel: tier2Display.label, statusColor: tier2Display.color, statusSoft: tier2Display.soft, locked: false, showKybAction: !kybStatusLoading && canOpenKybWizard(kybStatus), kybActionLabel: kybStatus === "rejected" || kybStatus === "expired" ? "Continue verification" : "Start verification" },
        { num: "TIER 3", title: "Institutional", reqs: ["Audited financials","AML/CFT policy","Beneficial ownership"], limit: "Limit · $250,000 / day", statusLabel: kybStatusLoading ? "…" : !tier2Approved ? "Requires Tier 2" : s.tierDone ? "In review" : "Locked", statusColor: s.tierDone ? "var(--amber)" : "var(--muted)", statusSoft: s.tierDone ? "var(--amber-tint)" : "var(--surface2)", locked: !tier2Approved || !s.tierDone },
      ];
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
        events: detail?.scopes?.length ? detail.scopes.join(" · ") : "No scopes set",

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
  // Team has no backend yet — these stay local/simulated exactly as the
  // original design prototype had them. See docs/api-contract.md.
  const roleOptions = ROLES;
  const teamCount = s.teamMembers.length;
  const inviteOpen = s.inviteOpen;
  const inviteName = s.inviteName;
  const inviteEmail = s.inviteEmail;
  const inviteRoleChips = ROLES.map(r => ({
    key: r.key,
    label: r.label,
    desc: r.desc,
    select: setInviteRole(r.key),
    selected: s.inviteRole === r.key,
    bg: s.inviteRole === r.key ? "var(--indigo)" : "var(--surface2)",
    color: s.inviteRole === r.key ? "var(--indigo-on)" : "var(--ink)",
  }));
  const inviteCanSubmit = !!(s.inviteName.trim() && s.inviteEmail.trim());
  const inviteCannotSubmit = !(s.inviteName.trim() && s.inviteEmail.trim());
  const teamRows = s.teamMembers.map(m => ({
        ...m,
        initials: m.name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase(),
        statusLabel: m.status === "active" ? "Active" : "Invited",
        statusColor: m.status === "active" ? "var(--indigo-text)" : "var(--amber)",
        statusSoft: m.status === "active" ? "var(--indigo-tint)" : "var(--amber-tint)",
        roleLabel: ROLES.find((r) => r.key === m.role)?.label ?? m.role,
        roleOptions: ROLES,
        setRole: setMemberRole(m.id),
        remove: removeMember(m.id),
      }));
  const modalOpen = !!s.modal;
  const modalTitle = { send: "Send money", deposit: s.fundAfricanTargetCurrency ? `Fund ${s.fundAfricanTargetCurrency} via African rails` : "Top up balance", receive: "Receive globally", bulk: "Bulk payouts", swap: "Convert", txDetail: "Transaction", acctDetail: s.acctDetailIntent === "fund" ? "Fund via bank transfer" : "Account details", fundChooser: "Fund account", fundStablecoin: "Fund account", cardDetail: "Card", newCard: "Create virtual card", invoice: "Create invoice", tier: "Upgrade to Tier 3", kyb: "Business verification", fundCard: "Fund card", apiKey: "Create API key",
    createAccount: s.createAccountKind === "stablecoin" ? "Create Stablecoin Account" : "Create Account" }[s.modal] || "";
  const isModalCreateAccount = s.modal === "createAccount";
  const isSendFlow = s.screen === "send";
  const isDepositFlow = s.screen === "deposit";
  const isReceiveFlow = s.screen === "receive";
  const isConvertFlow = s.screen === "convert";
  const isMoneyFlow = isSendFlow || isDepositFlow || isReceiveFlow || isConvertFlow;
  const isModalBulk = s.modal === "bulk";
  const isModalTxDetail = s.modal === "txDetail";
  const isModalAcctDetail = s.modal === "acctDetail";
  const isModalFundChooser = s.modal === "fundChooser";
  const isModalFundStablecoin = s.modal === "fundStablecoin";
  const isModalCardDetail = s.modal === "cardDetail";
  const isModalNewCard = s.modal === "newCard";
  const isModalInvoice = s.modal === "invoice";
  const isModalTier = s.modal === "tier";
  const isModalKyb = s.modal === "kyb";
  const isModalFundCard = s.modal === "fundCard";
  const fundAmount = s.fundAmount;
  const fundCardNotDone = !s.fundCardDone;
  const fundCardDone = s.fundCardDone;
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
      // No account-to-account transfer endpoint exists yet — the backend has
      // OffRamp orders and account-native sends only (docs/api-contract.md).
      // Shown but disabled rather than hidden, so the option set still reads
      // like the design and the reason is stated instead of guessed at.
      key: "internal",
      label: "Internal transfer",
      desc: "Move funds between your own accounts",
      disabled: true,
      disabledReason: "Not available yet",
      select: () => {},
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
    ? `${s.sendConfirm.amount} ${s.sendConfirm.currency} · ${s.sendConfirm.status}${s.sendConfirm.id ? ` · ${s.sendConfirm.id}` : ""}`
    : s.sendAccept
      ? `Order #${s.sendAccept.merchant_order_id} · ${s.sendAccept.status}`
      : null;
  // Live status on the send-success step, via the same polling hook the tx
  // detail modal uses. `sendStatusQuery.data` starts undefined right after
  // accept (first poll hasn't landed yet) — fall back to the accept
  // response's own "processing" status rather than showing nothing.
  const sendLiveOrderStatus = s.sendAccept ? sendStatusQuery.data?.status ?? "processing" : null;
  const [sendLiveLabel, sendLiveColor, sendLiveSoft] = sendLiveOrderStatus
    ? TX_STATUS_DISPLAY[sendLiveOrderStatus] || ["Unknown", "var(--muted)", "var(--surface2)"]
    : [null, null, null];
  const sendLiveStatus = sendLiveOrderStatus
    ? { label: sendLiveLabel as string, color: sendLiveColor as string, soft: sendLiveSoft as string, isSettling: !sendStatusQuery.isTerminal }
    : null;
  const sendRecipientLabel = s.sendGroup === "crypto" ? "Recipient wallet address" : sendRail.field;
  const sendRecipientPlaceholder =
    s.sendGroup === "crypto"
      ? "0x… (EVM address)"
      : sendRail.type === "mobile" && sendCountry.dialCode
        ? `+${sendCountry.dialCode}712345678`
        : sendRail.placeholder;
  const sendCorridorText = s.sendGroup === "crypto"
    ? `Sends USDC on ${SEND_STABLECOIN_NETWORKS.find((n) => n.key === s.sendChain)?.label || "Base/Polygon"} via account send — min 1.00 USDC.`
    : `${sendCountry.name} via ${sendProvider} · ${sendRail.arrival}`;
  const sendProviderHasChoice = sendProviderOptions.length > 1;
  const depositMethods = ["country","crypto"].map(g => ({ key: g, label: g === "country" ? "By country" : "Stablecoin", select: setDepositGroup(g), bg: s.depositGroup === g ? "var(--ink)" : "var(--surface2)", color: s.depositGroup === g ? "var(--bg)" : "var(--muted)" }));
  const depositIsCountry = s.depositGroup === "country";
  const depositIsCrypto = s.depositGroup === "crypto";
  const depositRailHasChoice = depositCountry.rails.length > 1;
  const depositIsMobileRail = depositRail.type === "mobile";
  const depositIsBankRail = depositRail.type === "bank";
  const depositOperator = depositProvider;
  const depositMobileCode = depositCountry.code;
  const depositProviderHasChoice = depositProviderOptions.length > 1;
  const depositPhone = s.depositPhone;
  const depositAmount = s.depositAmount;
  const depositPromptSent = s.depositPromptSent;
  const depositBankLabel = depositRail.label;
  const depositBankArrival = depositRail.arrival;
  const depositPaymentInstructionRows = s.depositAccept
    ? buildPaymentInstructionRows(s.depositAccept.payment_instructions).map((row) => ({
        k: row.k,
        v: row.v,
      }))
    : [];
  const depositBankLines =
    s.depositAccept?.payment_instructions?.type === "bank"
      ? depositPaymentInstructionRows
      : depositRail.type === "bank" && !s.depositAccept
        ? [{ k: "Account number", v: depositRail.placeholder }, { k: "Bank", v: depositProvider }]
        : depositPaymentInstructionRows;
  const depositNetworks = DEPOSIT_NETWORKS.map(n => ({ key: n.key, label: n.label, select: setDepositNetwork(n.key), bg: s.depositNetwork === n.key ? "var(--indigo-tint)" : "var(--surface2)", border: s.depositNetwork === n.key ? "var(--indigo)" : "transparent", color: s.depositNetwork === n.key ? "var(--indigo-text)" : "var(--ink)" }));
  const treasuryWalletAddress = summaryQuery.data?.totals.wallet_address ?? null;
  const depositAssets = ["usdc","usdt"].map(k => ({ key: k, label: k.toUpperCase(), select: setDepositAsset(k), bg: s.depositAsset === k ? "var(--ink)" : "var(--surface2)", color: s.depositAsset === k ? "var(--bg)" : "var(--ink)" }));
  const depositAssetCode = s.depositAsset.toUpperCase();
  const sendStep = s.sendStep;
  const sendStepDots = buildSendStepDots(s.sendStep >= 3 ? 2 : 1, 2);
  const sendStepIs1 = s.sendStep === 1;
  const sendStepIs2 = s.sendStep === 2;
  const sendStepIs3 = s.sendStep === 3;
  // Phase 4: USDC only (USDT has no account-send path).
  const sendAssets = ["usdc"].map(k => ({ key: k, label: k.toUpperCase(), select: setSendAsset(k), bg: s.sendAsset === k ? "var(--ink)" : "var(--surface2)", color: s.sendAsset === k ? "var(--bg)" : "var(--ink)" }));
  const sendChains = SEND_STABLECOIN_NETWORKS.map(n => ({ key: n.key, label: n.label, select: setSendChain(n.key), bg: s.sendChain === n.key ? "var(--indigo-tint)" : "var(--surface2)", border: s.sendChain === n.key ? "var(--indigo)" : "transparent", color: s.sendChain === n.key ? "var(--indigo-text)" : "var(--ink)" }));
  const sendAssetCode = s.sendAsset.toUpperCase();
  const sendChainLabel = SEND_STABLECOIN_NETWORKS.find(n => n.key === s.sendChain)?.label || s.sendChain;
  const sendDestinationSummary = buildSendDestinationSummary({
    sendGroup: s.sendGroup,
    sendAsset: s.sendAsset,
    sendChainLabel,
    countryName: sendCountry.name,
    providerName: sendProvider,
  });
  // OffRamp quote (by country) or account-send preview (stablecoin).
  const sendQuote = s.sendQuote;
  const sendPreview = s.sendPreview;
  const sendFeeText = s.sendGroup === "crypto"
    ? (sendPreview?.fee_amount != null ? `${sendPreview.fee_amount} USDC` : "Fee from preview")
    : sendQuote
      ? formatQuoteFees(sendQuote.amounts.fees)
      : (sendRail.type === "mobile" ? "No fee · instant local transfer" : "Fee ≈ $1.20 · bank transfer");
  const sendArrivalText = s.sendGroup === "crypto"
    ? (sendPreview?.expires_at
      ? `Preview valid until ${new Date(sendPreview.expires_at).toLocaleTimeString()}`
      : "On-chain settlement · status via account.send.* webhooks")
    : sendQuote?.expires_at
      ? `Quote valid until ${new Date(sendQuote.expires_at).toLocaleTimeString()}`
      : sendRail.arrival;
  const sendQuoteRateText = s.sendGroup === "crypto"
    ? (sendPreview?.receive_amount != null ? `${sendPreview.receive_amount} ${sendPreview.currency || "USDC"}` : null)
    : sendQuote?.amounts.rate
      ? `${sendQuote.amounts.user_receives.amount} ${sendQuote.amounts.user_receives.currency}`
      : null;
  const depositStep = s.depositStep;
  const depositStepDots = buildDepositStepDots(s.depositStep, s.depositGroup === "country" ? 3 : 2);
  const depositStepIs1 = s.depositStep === 1;
  const depositStepIs2 = s.depositStep === 2;
  const depositStepIs3 = s.depositStep === 3;
  const depositNetworkLabel = DEPOSIT_NETWORKS.find(n => n.key === s.depositNetwork).label;
  const depositAddress = treasuryWalletAddress || DEPOSIT_ADDRESSES[s.depositNetwork] || "—";
  const depositDestinationSummary = buildDepositDestinationSummary({
    depositGroup: s.depositGroup,
    depositAsset: s.depositAsset,
    depositNetworkLabel,
    countryName: depositCountry.name,
    providerName: depositProvider,
  });
  const depositNotDone = !s.depositDone;
  const depositDone = s.depositDone;
  const depositPayerLabel = depositIsMobileRail ? "Your mobile number" : "Your bank account number";
  const depositPayerPlaceholder = depositIsMobileRail ? "712 345 678" : depositRail.placeholder;
  const depositAmountLabel = `Amount (${depositCountry.code})`;
  const depositQuote = s.depositQuote;
  const depositQuoteLoading = s.depositQuoteLoading;
  const depositQuoteError = s.depositQuoteError;
  const depositAccepting = s.depositAccepting;
  const depositAcceptError = s.depositAcceptError;
  const depositFeeText = depositQuote ? formatQuoteFees(depositQuote.amounts.fees) : (depositRail.type === "mobile" ? "No fee · instant local transfer" : "Fee ≈ $1.20 · bank transfer");
  const depositArrivalText = depositQuote?.expires_at
    ? new Date(depositQuote.expires_at).toLocaleTimeString()
    : depositRail.arrival;
  const depositQuoteRateText = depositQuote?.amounts.rate
    ? `${depositQuote.amounts.user_receives.amount} ${depositQuote.amounts.user_receives.currency}`
    : null;
  const depositResultText = s.depositAccept
    ? `Order #${s.depositAccept.merchant_order_id} · ${s.depositAccept.status}`
    : null;
  const depositLiveOrderStatus = s.depositAccept ? depositStatusQuery.data?.status ?? "processing" : null;
  const [depositLiveLabel, depositLiveColor, depositLiveSoft] = depositLiveOrderStatus
    ? TX_STATUS_DISPLAY[depositLiveOrderStatus] || ["Unknown", "var(--muted)", "var(--surface2)"]
    : [null, null, null];
  const depositLiveStatus = depositLiveOrderStatus
    ? { label: depositLiveLabel as string, color: depositLiveColor as string, soft: depositLiveSoft as string, isSettling: !depositStatusQuery.isTerminal }
    : null;
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
  const receiveNetworks = DEPOSIT_NETWORKS.map(n => ({ key: n.key, label: n.label, select: setReceiveNetwork(n.key), bg: s.receiveNetwork === n.key ? "var(--indigo-tint)" : "var(--surface2)", border: s.receiveNetwork === n.key ? "var(--indigo)" : "transparent", color: s.receiveNetwork === n.key ? "var(--indigo-text)" : "var(--ink)" }));
  const receiveNetworkLabel = DEPOSIT_NETWORKS.find(n => n.key === s.receiveNetwork).label;
  const receiveAssetCode = s.receiveAsset.toUpperCase();
  const receiveAddress = treasuryWalletAddress || "—";
  const copyReceiveAddress = treasuryWalletAddress
    ? copyReceiveField("addr", treasuryWalletAddress)
    : () => {};
  const receiveAddressCopied = s.copiedKey === "addr";
  const bulkRows = BULK_ROWS.map(r => ({ ...r, flagUrl: flagUrl(r.iso) }));
  const bulkCountryLabel = "KE, GH, NG, DE, RW";
  const bulkNotLoaded = !s.bulkLoaded;
  const bulkLoaded = s.bulkLoaded;
  const bulkNotDone = !s.bulkDone;
  const bulkDone = s.bulkDone;
  const onrampTabBg = isOnrampDir ? "var(--indigo-tint)" : "transparent";
  const onrampTabBorder = isOnrampDir ? "var(--indigo)" : "var(--border)";
  const onrampTabColor = isOnrampDir ? "var(--indigo-text)" : "var(--muted)";
  const offrampTabBg = !isOnrampDir ? "var(--indigo-tint)" : "transparent";
  const offrampTabBorder = !isOnrampDir ? "var(--indigo)" : "var(--border)";
  const offrampTabColor = !isOnrampDir ? "var(--indigo-text)" : "var(--muted)";
  const swapAmountFrom = isOnrampDir ? "10,000.00" : "5,000.00";
  const swapFromCcy = isOnrampDir ? "KES" : "USDC";
  const swapAmountTo = isOnrampDir ? "77.34" : "645,300.00";
  const swapToCcy = isOnrampDir ? "USDC" : "KES";
  const swapRate = "1 USDC = 129.32 KES";
  const swapSettle = isOnrampDir ? "Base · USDC" : "M-Pesa (Safaricom)";
  const quoteLive = !quoteExpired;
  const quoteProgress = Math.round((s.quoteSeconds / 90) * 100);
  const acceptBg = quoteExpired ? "var(--surface3)" : "var(--indigo)";
  const acceptColor = quoteExpired ? "var(--muted)" : "var(--indigo-on)";
  const acceptCursor = quoteExpired ? "not-allowed" : "pointer";
  const swapNotAccepted = !s.swapAccepted;
  const swapAccepted = s.swapAccepted;
  const cardDetail: any = cardSel ? { ...cardSel, freezeTrack: s.cardFrozen ? "var(--indigo)" : "var(--surface3)", freezeKnobLeft: s.cardFrozen ? "23px" : "3px" } : {};
  const newCardLabel = s.newCardLabel;
  const newCardNotDone = !s.newCardDone;
  const newCardDone = s.newCardDone;
  const invClient = s.invClient;
  const invAmount = s.invAmount;
  const invoiceNotDone = !s.invoiceDone;
  const invoiceDone = s.invoiceDone;
  const invoiceError = s.invoiceError;
  const invoiceSubmitting = s.invoiceSubmitting;
  const tierDocs = ["Audited financial statements","AML/CFT policy document","Beneficial ownership register"];
  const tierNotDone = !s.tierDone;
  const tierDone = s.tierDone;


  return (
    <div ref={rootRef} style={rootStyle}>
<div data-screen-label="App" className={`ep-shell${s.sidebarOpen ? " ep-shell--drawer-open" : ""}`}>

<div className="ep-shell__overlay" onClick={closeSidebar} aria-hidden={!s.sidebarOpen} />
<aside className="ep-sidebar" aria-label="Main navigation">
<button onClick={exitApp} className="ep-sidebar__brand">
<img src="/logo-elementpay.png" alt="" width={32} height={32} className="ep-sidebar__logo" />
<div style={{minWidth: 0}}><div style={{fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "13.5px", letterSpacing: "-0.01em", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>ElementPay</div><div style={{fontSize: "10px", color: "var(--muted2)", fontWeight: "600"}}>Business</div></div>
</button>

<nav className="ep-sidebar__nav">
{(mainNavItems || []).map((item: any, __i1: number) => (
<React.Fragment key={__i1}>
{(item.groupLabel) ? (<>
<div className="ep-sidebar__group">{item.groupLabel}</div>
</>) : null}
<button onClick={item.select} className="ep-sidebar__nav-btn" style={{background: (item.bg), color: (item.color), boxShadow: (item.shadow)}}>
<span style={{fontSize: "13px", fontWeight: (item.weight)}}>{item.label}</span>
</button>
</React.Fragment>
))}
</nav>

<div className="ep-sidebar__rates">
<div style={{display: "flex", alignItems: "center", gap: "6px", fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "9.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted3)", marginBottom: "6px"}}><span style={{width: "6px", height: "6px", borderRadius: "50%", background: "var(--indigo-bright)"}} />Live rates</div>
{(liveRates || []).map((row: { pair: string; value: string }, __iLive: number) => (
<div key={__iLive} style={{display: "flex", justifyContent: "space-between", padding: "1px 0"}}><span>{row.pair}</span><b style={{color: "#fff", fontWeight: "500"}}>{row.value}</b></div>
))}
</div>

<div className="ep-sidebar__profile">
<span style={{width: "30px", height: "30px", borderRadius: "50%", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: "11px", fontWeight: "700", flexShrink: "0"}}>{(meQuery.data?.business?.name || "?").slice(0,2).toUpperCase()}</span>
<div style={{minWidth: "0", flex: 1}}><div style={{fontSize: "11.5px", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{meQuery.data?.business?.name || "Loading…"}</div><div style={{fontSize: "10px", color: "var(--indigo-text)", fontWeight: "700"}}>{meQuery.data?.role || ""}</div></div>
<button onClick={toggleTheme} aria-label="Toggle theme" style={{width: isCompact ? "44px" : "34px", height: isCompact ? "44px" : "34px", borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: "13px", flexShrink: "0"}}>{themeIcon}</button>
<button onClick={logout} title="Log out" aria-label="Log out" style={{width: isCompact ? "44px" : "34px", height: isCompact ? "44px" : "34px", borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: "12px", flexShrink: "0"}}>⏻</button>
</div>
</aside>

<main className="ep-main">
<header className="ep-header">
<div className="ep-header__lead">
{isMoneyFlow ? (
<button type="button" className="ep-header__back" onClick={exitMoneyFlow} aria-label="Back">←</button>
) : (
<button type="button" className="ep-header__menu" onClick={toggleSidebar} aria-label="Open navigation">☰</button>
)}
<div className="ep-header__titles">
<h1>{currentTitle}</h1>
<p>{currentSubtitle}</p>
</div>
</div>
<div className="ep-header__actions">
<button
  type="button"
  className="ep-header__icon-btn"
  onClick={toggleTheme}
  aria-label="Toggle theme"
  title="Toggle theme"
>
  {themeIcon}
</button>
<button
  type="button"
  className="ep-header__signout"
  onClick={logout}
  aria-label="Sign out"
  title="Sign out"
>
  Sign out
</button>
{!isCompact ? (
<button type="button" onClick={guardMoneyModal("send")} className="ep-btn-primary ep-header__cta">
Create payment
</button>
) : null}
</div>
</header>

<div className="ep-content ep-content-cap">

{(isHome) ? (<>
<div data-screen-label="Home" className="ep-home">

{/* Hero balance — leads the screen, per the design's Home. The identity
    strip and rates marquee sit below the quick actions; on desktop they
    are suppressed entirely, where the sidebar already carries both. */}
<div className="ep-grid-home-balance">
<div className="ep-home__balance">
<div className="ep-home__balance-top">
<span className="ep-home__balance-label">Total balance</span>
<div className="ep-home__balance-tabs">
{(balanceViewTabs || []).map((bv: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={bv.select} className="ep-home__balance-tab" style={{background: (bv.bg), color: (bv.color)}}>{bv.label}</button>
</React.Fragment>
))}
</div>
</div>
<div className="ep-home__balance-value">{homeTotalBalance}</div>
<div className="ep-home__balance-sub">{balanceViewSub}</div>
</div>

<div className="ep-home__stats-desktop">
{(homeStats || []).map((hs: any, __i1: number) => (
<div key={__i1} className="ep-home__stat">
<span className="ep-home__stat-icon" style={{background: (hs.iconBg), color: (hs.iconColor)}}>{hs.icon}</span>
<div><div className="ep-home__stat-label">{hs.label}</div><div className="ep-home__stat-value">{hs.value}</div></div>
</div>
))}
</div>
</div>

{/* Same three money stats, stacked below the hero on phones. The desktop
    copy above sits beside the hero inside the balance grid, so the two
    containers differ in position, not content — only one is ever rendered
    (the other is display:none, which also drops it from the a11y tree). */}
<div className="ep-home__stats-mobile">
{(homeStats || []).map((hs: any, __i1: number) => (
<div key={__i1} className="ep-home__stat">
<span className="ep-home__stat-icon" style={{background: (hs.iconBg), color: (hs.iconColor)}}>{hs.icon}</span>
<div><div className="ep-home__stat-label">{hs.label}</div><div className="ep-home__stat-value">{hs.value}</div></div>
</div>
))}
</div>

{!kybStatusLoading && !kybApproved ? (
<KybGateBanner verificationStatus={describeKybStatus(kybStatus)} showAction={canOpenKybWizard(kybStatus)} onStartVerification={() => { goVerification(); openModalKyb(); }} />
) : null}

<SectionHeader title="Quick Actions" />
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

<HomeIdentity
  businessName={meQuery.data?.business?.name || "Loading…"}
  role={meQuery.data?.role}
  kybApproved={kybApproved}
  kybLabel={describeKybStatus(kybStatus)}
  kybLoading={kybStatusLoading}
/>
<RatesMarquee rates={liveRates} />

{(homeCurrencyChips?.length) ? (
<>
<SectionHeader title="Balances" actionLabel="See All" onAction={setScreen("wallets")} />
<div className="ep-home__balance-rows" aria-label="Currency balances">
{(homeCurrencyChips || []).map((hc: any, __i1: number) => (
<button key={__i1} type="button" className="ep-home__balance-row" onClick={setScreen("wallets")}>
<span className="ep-home__balance-row-left">
{hc.flagUrl ? (
  <span className="ep-flag" style={{backgroundImage: `url(${hc.flagUrl})`}} aria-hidden />
) : (
  <span className="ep-home__balance-row-avatar" aria-hidden>{String(hc.code).slice(0, 2)}</span>
)}
<span className="ep-home__balance-row-code">{hc.code}</span>
</span>
<span className="ep-home__balance-row-amt">{hc.balance}</span>
</button>
))}
</div>
</>
) : null}

<SectionHeader title="Recent Activity" actionLabel="See All" onAction={goTransactions} />
<ActivityList title="Recent activity" items={homeRecent} showHeader={false} emptyLabel={transactionsQuery.isLoading ? "Loading…" : "No recent activity"} />

</div>
</>) : null}

{(isWallets) ? (<>
<WalletsScreen
  isMobile={isMobile}
  mainWalletBalance={mainWalletBalance}
  mainWalletSub={mainWalletSub}
  stableTabs={stableTabs}
  accountsCount={accountsCount}
  addAccountMenu={s.addAccountMenu}
  toggleAddAccountMenu={toggleAddAccountMenu}
  closeAddAccountMenu={closeAddAccountMenu}
  openCreateAccount={openCreateAccount}
  canCreateStablecoin={
    occupiedStablecoinNetworkCodes(stablecoinAccountsList).size < 2
  }
  canCreateBank={
    occupiedFiatCurrencyCodes(depositAccountsList).size <
    SUPPORTED_IBAN_CURRENCIES.length
  }
  accounts={accounts}
  eligible={depositEligible}
  eligibilityLoading={depositEligibilityQuery.isLoading}
  verificationStatus={depositEligibilityQuery.data?.verification_status}
  eligibilityErrorMessage={depositEligibilityErrorMessage}
  accountsLoading={
    (depositEligible && depositAccountsQuery.isLoading) ||
    stablecoinAccountsQuery.isLoading
  }
  accountsErrorMessage={depositAccountsErrorMessage}
  onRetryAccounts={() => {
    queryClient.invalidateQueries({ queryKey: ["deposit-accounts-eligibility"] });
    queryClient.invalidateQueries({ queryKey: ["deposit-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["stablecoin-accounts"] });
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
  balance="—"
  balanceSub="Balance not yet available"
  summaryLines={acctDetailLines}
  recent={walletsRecent}
  canConvert={Boolean(acctDetail.showConvert)}
  onBack={backToWallets}
  onOpenDetails={openAcctDetailsModal}
  onFund={openAcctFundChooser}
  onSend={guardMoneyModal("send")}
  onConvert={openConvert}
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
<div className="ep-cards__preview" role="note">
<span className="ep-cards__preview-badge">Preview</span>
<span className="ep-cards__preview-text">Card balances and numbers are simulated demo data — not live accounts.</span>
</div>
<div className="ep-cards__head">
<h2 className="ep-cards__title">Virtual cards · {cards.length}</h2>
<button type="button" onClick={openNewCard} className="ep-cards__cta">+ New card</button>
</div>
<div className="ep-cards__grid">
{(cards || []).map((c: any, __i1: number) => (
<div key={__i1} className="ep-cards__item">
<button type="button" onClick={c.openDetail} className="ep-cards__plastic" style={{background: c.bg, filter: c.filter}} aria-label={`${c.label}, ${c.balance} available`}>
<div className="ep-cards__plastic-top">
<span className="ep-cards__plastic-label">{c.label}</span>
<span className="ep-cards__plastic-status">{c.statusLabel}</span>
</div>
<div className="ep-cards__plastic-body">
<span className="ep-cards__plastic-eyebrow">Available to spend</span>
<span className="ep-cards__plastic-balance">{c.balance}</span>
<span className="ep-cards__plastic-pan">•••• •••• •••• {c.last4}</span>
</div>
</button>
<div className="ep-cards__actions">
<button type="button" onClick={c.fund} className="ep-cards__action">Fund</button>
<button type="button" onClick={c.withdraw} className="ep-cards__action">Withdraw</button>
<button type="button" onClick={c.freeze} className="ep-cards__action">Manage</button>
</div>
</div>
))}
</div>

<ActivityList title="Recent transactions" items={cardsRecent} onViewAll={goTransactions} />
</div>
</>) : null}

{(isTransactions) ? (<>
<TransactionsScreen
  txFilters={txFilters}
  filteredTransactions={filteredTransactions}
  emptyLabel={
    transactionsPageQuery.isLoading
      ? "Loading…"
      : transactionsPageQuery.isError
        ? "Couldn't load transactions"
        : "No transactions match this filter"
  }
  pageNumber={transactionsPageQuery.pageNumber}
  pageCount={transactionsPageQuery.pageCount}
  total={transactionsPageQuery.total}
  hasNext={transactionsPageQuery.hasNext}
  hasPrev={transactionsPageQuery.hasPrev}
  onNextPage={transactionsPageQuery.nextPage}
  onPrevPage={transactionsPageQuery.prevPage}
  isFetching={transactionsPageQuery.isFetching}
/>
</>) : null}

{(isInvoices) ? (<>
<div data-screen-label="Invoices" style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", justifyContent: "flex-end"}}>
<button onClick={openModalInvoice} style={{padding: "10px 18px", borderRadius: "999px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ New invoice</button>
</div>
<InvoiceList items={invoices} emptyLabel={invoicesQuery.isLoading ? "Loading…" : "No invoices yet"} />
</div>
</>) : null}

{(isReports) ? (<>
<div data-screen-label="Reports" className="ep-reports">
<div className="ep-reports__stats">
{(reportStats || []).map((rs: any, __i1: number) => (
<div key={__i1} className="ep-reports__stat">
<div className="ep-reports__stat-label">{rs.label}</div>
<div className="ep-reports__stat-value" style={{color: rs.color}}>{rs.value}</div>
</div>
))}
</div>
<section className="ep-reports__panel">
<div className="ep-reports__panel-head">
<h2 className="ep-reports__panel-title">Daily volume · last 10 days</h2>
<span className="ep-reports__panel-meta">From loaded activity</span>
</div>
{reportBarsEmpty ? (
<div className="ep-reports__empty" role="status">No volume in the last 10 days yet.</div>
) : (
<div className="ep-reports__chart" role="img" aria-label="Daily volume chart for the last 10 days">
{(reportBars || []).map((b: any, __i1: number) => (
<div key={__i1} className="ep-reports__bar-col" title={b.title}>
<div className="ep-reports__bar-track">
<div className="ep-reports__bar-fill" style={{height: `${Math.max(b.h, b.h > 0 ? 8 : 0)}%`}} />
</div>
<span className="ep-reports__bar-day">{b.dayLabel}</span>
</div>
))}
</div>
)}
</section>
<section className="ep-reports__panel">
<div className="ep-reports__panel-head">
<h2 className="ep-reports__panel-title">Payout coverage</h2>
<span className="ep-reports__panel-meta">{coverageChips.length} corridors</span>
</div>
<div className="ep-reports__coverage">
{(coverageChips || []).map((cc: any, __i1: number) => (
<div key={__i1} className="ep-reports__chip">
<span className="ep-flag" style={{backgroundImage: `url(${cc.flagUrl})`}} aria-hidden />
<span className="ep-reports__chip-code">{cc.code}</span>
</div>
))}
</div>
</section>
</div>
</>) : null}

{(isVerification) ? (<>
<VerificationScreen tiers={tiers} onUpgradeTier3={openModalTier} onStartKyb={openModalKyb} />
</>) : null}

{(isTeam) ? (<>
<div data-screen-label="Team" className="ep-team">
<div className="ep-team__preview" role="note">
<span className="ep-team__preview-badge">Preview</span>
<span className="ep-team__preview-text">Team members are simulated demo data — invites stay local to this session.</span>
</div>
<div className="ep-team__head">
<h2 className="ep-team__title">Members · {teamCount}</h2>
<button type="button" onClick={openInvite} className="ep-team__cta">+ Invite person</button>
</div>

<section className="ep-panel ep-team__list">
{(teamRows || []).map((m: any, __i1: number) => (
<div key={__i1} className="ep-team-row">
<span className="ep-team__avatar" aria-hidden>{m.initials}</span>
<div className="ep-team__identity">
<div className="ep-team__name">{m.name}</div>
<div className="ep-team__email">{m.email}</div>
</div>
<div className="ep-team__meta">
<StatusBadge label={m.statusLabel} color={m.statusColor} soft={m.statusSoft} />
<span className="ep-team__role-pill">{m.roleLabel}</span>
</div>
<div className="ep-team-row__actions">
<select value={m.role} onChange={m.setRole} aria-label={`Role for ${m.name}`}>
{(m.roleOptions || []).map((ro: any, __i2: number) => (
<option key={__i2} value={ro.key}>{ro.label}</option>
))}
</select>
<button type="button" onClick={m.remove} className="ep-team__remove" aria-label={`Remove ${m.name}`}>✕</button>
</div>
</div>
))}
</section>

{(inviteOpen) ? (<>
<div className="ep-team__invite-overlay" onClick={closeInvite} role="presentation">
<div className="ep-team__invite" onClick={stopClick} role="dialog" aria-modal="true" aria-labelledby="ep-team-invite-title">
<div className="ep-team__invite-head">
<h3 id="ep-team-invite-title" className="ep-team__invite-title">Invite a teammate</h3>
<button type="button" onClick={closeInvite} className="ep-team__invite-close" aria-label="Close invite">✕</button>
</div>
<label className="ep-team__field">
<span className="ep-team__field-label">Full name</span>
<input value={inviteName} onChange={setInviteName} placeholder="e.g. Amina Bello" className="ep-team__input" autoComplete="name" />
</label>
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
<button type="button" onClick={submitInvite} disabled={inviteCannotSubmit} className="ep-team__invite-submit">Send invite</button>
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
</div>
</>) : null}


{(isSendFlow) ? (<section className="ep-flow" data-screen-label="Send">
<SendModal
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
  sendAssets={sendAssets}
  sendChains={sendChains}
  sendAssetCode={sendAssetCode}
  sendChainLabel={sendChainLabel}
  sendNext={sendNext}
  sendBack={sendBack}
  sendDestinationSummary={sendDestinationSummary}
  sendCountryName={sendCountry.name}
  sendCountryFlagUrl={flagUrl(sendCountry.iso)}
  sendCurrencyCode={sendCountry.code}
  sendCurrencyName={currencyLabel(sendCountry.code)}
  sendCountryIdx={s.sendCountryIdx}
  selectSendCountry={(i) => selectSendCountry(i)()}
  sendProviderLabel={sendProvider}
  sendProviderOptions={sendProviderOptions}
  selectSendProvider={pickSendProvider}
  sendProviderIdx={sendProviderIdx}
  savedRecipients={(savedRecipientsQuery.data ?? []).filter((r) => {
    if (sendIsCrypto) return r.railType === "crypto";
    if (s.sendMethod === "mobile") return r.railType === "mobile";
    if (s.sendMethod === "bank") return r.railType === "bank";
    return r.railType !== "crypto";
  })}
  savedRecipientsLoading={savedRecipientsQuery.isLoading}
  onSelectSavedRecipient={applySavedRecipient}
  onSaveRecipientDetails={saveCurrentRecipientDetails}
  saveRecipientBusy={saveRecipientBusy}
  saveRecipientMessage={saveRecipientMessage}
  sendRecipientName={sendRecipientName}
  setSendRecipientName={setSendRecipientName}
  sendRecipientLabel={sendRecipientLabel}
  sendRecipient={sendRecipient}
  setSendRecipient={setSendRecipient}
  normalizeSendRecipientPhone={normalizeSendRecipientPhone}
  sendRecipientPlaceholder={sendRecipientPlaceholder}
  sendAmount={sendAmount}
  setSendAmount={setSendAmount}
  sendQuoteError={sendQuoteError}
  sendQuoteErrorTitle={s.sendQuoteErrorTitle || undefined}
  onFixSendQuoteError={
    s.sendQuoteErrorAction === "verification"
      ? () => {
          goVerification();
        }
      : undefined
  }
  sendQuoteLoading={sendQuoteLoading}
  sendQuoteRateText={sendQuoteRateText}
  sendFeeText={sendFeeText}
  sendArrivalText={sendArrivalText}
  sendAcceptError={sendAcceptError}
  sendAccepting={sendAccepting}
  submitSend={submitSend}
  sendResultText={sendResultText}
  sendLiveStatus={sendLiveStatus}
  closeModal={closeModal}
/>
</section>) : null}

{(isDepositFlow) ? (<section className="ep-flow" data-screen-label="Top up">
<DepositModal
  depositNotDone={depositNotDone}
  depositDone={depositDone}
  depositStepDots={depositStepDots}
  depositStepIs1={depositStepIs1}
  depositStepIs2={depositStepIs2}
  depositStepIs3={depositStepIs3}
  depositMethods={depositMethods}
  depositIsCountry={depositIsCountry}
  depositIsCrypto={depositIsCrypto}
  depositCountryChips={depositCountryChips}
  depositRailHasChoice={depositRailHasChoice}
  depositRailChips={depositRailChips}
  depositProviderHasChoice={depositProviderHasChoice}
  depositProviderChips={depositProviderChips}
  depositAssets={depositAssets}
  depositNetworks={depositNetworks}
  depositNext={depositNext}
  depositBack={depositBack}
  depositDestinationSummary={depositDestinationSummary}
  depositIsMobileRail={depositIsMobileRail}
  depositIsBankRail={depositIsBankRail}
  depositPayerLabel={depositPayerLabel}
  depositPayerPlaceholder={depositPayerPlaceholder}
  depositOperator={depositOperator}
  depositMobileCode={depositMobileCode}
  depositPhone={depositPhone}
  setDepositPhone={setDepositPhone}
  depositAmount={depositAmount}
  setDepositAmount={setDepositAmount}
  depositAmountLabel={depositAmountLabel}
  depositQuoteError={depositQuoteError}
  depositQuoteLoading={depositQuoteLoading}
  depositQuoteRateText={depositQuoteRateText}
  depositFeeText={depositFeeText}
  depositArrivalText={depositArrivalText}
  depositAcceptError={depositAcceptError}
  depositAccepting={depositAccepting}
  submitDeposit={submitDeposit}
  depositResultText={depositResultText}
  depositLiveStatus={depositLiveStatus}
  depositPromptSent={depositPromptSent}
  depositBankLabel={depositBankLabel}
  depositBankArrival={depositBankArrival}
  depositBankLines={depositBankLines}
  depositAssetCode={depositAssetCode}
  depositNetworkLabel={depositNetworkLabel}
  depositAddress={depositAddress}
  closeModal={closeModal}
  fundTargetCurrency={s.fundAfricanTargetCurrency}
  fundConvertStatus={s.fundConvertStatus}
  fundConvertError={s.fundConvertError}
/>
</section>) : null}

{(isReceiveFlow) ? (<section className="ep-flow" data-screen-label="Receive">
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
  receiveNetworkLabel={receiveNetworkLabel}
  receiveAddress={receiveAddress}
  copyReceiveAddress={copyReceiveAddress}
  receiveAddressCopied={receiveAddressCopied}
/>
</section>) : null}

{(isConvertFlow) ? (<section className="ep-flow" data-screen-label="Convert">
{(swapNotAccepted) ? (<>
<div className="ep-convert">
<div className="ep-convert__tabs" role="tablist" aria-label="Convert direction">
<button type="button" role="tab" aria-selected={s.onrampDir === "onramp"} data-active={s.onrampDir === "onramp" ? "true" : "false"} className="ep-convert__tab" onClick={setOnramp}>Fiat → Stablecoin</button>
<button type="button" role="tab" aria-selected={s.onrampDir === "offramp"} data-active={s.onrampDir === "offramp" ? "true" : "false"} className="ep-convert__tab" onClick={setOfframp}>Stablecoin → Fiat</button>
</div>
<div className="ep-convert__quote">
<div className="ep-convert__row">
<span className="ep-convert__amount">{swapAmountFrom}</span>
<span className="ep-convert__ccy">{swapFromCcy}</span>
</div>
<div className="ep-convert__arrow" aria-hidden>↓</div>
<div className="ep-convert__row">
<span className="ep-convert__amount ep-convert__amount--out">{swapAmountTo}</span>
<span className="ep-convert__ccy">{swapToCcy}</span>
</div>
</div>
<div className="ep-convert__meta">
<div className="ep-convert__meta-row"><span className="ep-convert__meta-k">Rate</span><span className="ep-convert__meta-v ep-convert__meta-v--mono">{swapRate}</span></div>
<div className="ep-convert__meta-row"><span className="ep-convert__meta-k">Settles via</span><span className="ep-convert__meta-v">{swapSettle}</span></div>
</div>
{(quoteExpired) ? (<>
<div className="ep-convert__expired" role="alert"><span className="ep-convert__expired-title">Rate expired</span><span className="ep-convert__expired-body">Refresh to fetch an up-to-date rate. A stale quote cannot be accepted.</span></div>
</>) : null}
{(quoteLive) ? (<>
<div className="ep-convert__timer" role="timer" aria-live="off">
<span className="ep-convert__timer-label">Quote locks for {s.quoteSeconds}s</span>
<div className="ep-convert__timer-track"><div className="ep-convert__timer-fill" style={{width: `${quoteProgress}%`}} /></div>
</div>
</>) : null}
<div className="ep-convert__actions">
<button type="button" className="ep-convert__btn ep-convert__btn--ghost" onClick={refreshQuote}>Refresh quote</button>
<button type="button" className="ep-convert__btn ep-convert__btn--primary" onClick={acceptQuote} disabled={quoteExpired}>Accept &amp; settle</button>
</div>
</div>
</>) : null}
{(swapAccepted) ? (<>
<div className="ep-convert__success">
<span className="ep-convert__success-icon" aria-hidden>✓</span>
<span className="ep-convert__success-title">Swap complete</span>
<span className="ep-convert__success-body">Settled via {swapSettle}.</span>
<button type="button" className="ep-convert__btn ep-convert__btn--ghost" style={{width: "auto", minWidth: 120, marginTop: 6}} onClick={closeModal}>Done</button>
</div>
</>) : null}
</section>) : null}


</div>

{(isCompact) ? (<>
<nav className="ep-bottom-nav" aria-label="Primary mobile">
{(bottomNavItems || []).map((bn: any, __i1: number) => (
bn.elevated ? (
<button key={bn.key || __i1} type="button" className="ep-bottom-nav__pay" data-active={bn.active ? "true" : "false"} onClick={bn.select} aria-label={bn.label}>
<span className="ep-bottom-nav__pay-orb" aria-hidden>{bn.icon}</span>
<span className="ep-bottom-nav__label" style={{fontWeight: bn.weight}}>{bn.label}</span>
</button>
) : (
<button key={bn.key || __i1} type="button" data-active={bn.active ? "true" : "false"} onClick={bn.select} style={{color: bn.color}}>
<span className="ep-bottom-nav__icon" aria-hidden>{bn.icon}</span>
<span className="ep-bottom-nav__label" style={{fontWeight: bn.weight}}>{bn.label}</span>
</button>
)
))}
</nav>
</>) : null}
</main>
</div>

{modalOpen ? (<>
<div onClick={closeModal} className="ep-modal-overlay" role="presentation">
<div onClick={stopClick} className="ep-modal" role="dialog" aria-modal="true" aria-labelledby="ep-modal-title">

<div className="ep-modal__grabber" aria-hidden="true">
<span className="ep-modal__grabber-bar" />
</div>

<div className="ep-modal__header">
<h3 id="ep-modal-title" className="ep-modal__title">{modalTitle}</h3>
<button type="button" onClick={closeModal} className="ep-modal__close" aria-label="Close">✕</button>
</div>

{(isModalBulk) ? (<>
{(bulkNotDone) ? (<>
{(bulkNotLoaded) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 1 · Upload recipients</span>
<p style={{margin: "0", fontSize: "12.5px", color: "var(--muted)"}}>Upload a CSV with recipient name, country, phone/account and amount. We detect the country and rail per row automatically.</p>
<button onClick={simulateBulkUpload} style={{padding: "14px 20px", borderRadius: "14px", border: "1.5px dashed var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>⬆ Simulate CSV upload</button>
</div>
</>) : null}
{(bulkLoaded) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 2 · Review & confirm</span>
<div style={{display: "flex", flexDirection: "column", gap: "6px"}}>
{(bulkRows || []).map((row: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "12px", background: "var(--surface2)", fontSize: "12px"}}>
<div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(row.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} />
<span style={{flex: "1", fontWeight: "600"}}>{row.name}</span>
<span style={{color: "var(--muted)"}}>{row.rail}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "700"}}>{row.amount}</span>
</div>
</React.Fragment>
))}
</div>
<div style={{display: "flex", flexDirection: "column", gap: "8px", padding: "14px", borderRadius: "14px", background: "var(--surface2)"}}>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Recipients</span><span style={{fontWeight: "700"}}>143</span></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Countries detected</span><span style={{fontWeight: "700"}}>{bulkCountryLabel}</span></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Total value</span><span style={{fontFamily: "'DM Mono',monospace", fontWeight: "700"}}>≈ $84,210</span></div>
</div>
<button onClick={runBulkPayout} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Confirm & run bulk payout ↗</button>
</div>
</>) : null}
</>) : null}
{(bulkDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>143 payouts queued</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Routing across live corridors now.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalTxDetail) ? (<>
<TxDetailModal txDetail={txDetail} isLoading={txDetailQuery.isLoading} liveStatus={txLiveStatus} />
</>) : null}

{(isModalFundChooser && acctDetail) ? (<>
<FundChooserModal
  currency={acctDetail.currency}
  accountName={acctDetail.name}
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
/>
</>) : null}

{(isModalFundStablecoin && acctDetail) ? (<>
<FundStablecoinModal
  targetCurrency={acctDetail.currency}
  targetName={acctDetail.name}
  rails={fundStablecoinRails}
  onBack={() => setState({ modal: "fundChooser" })}
/>
</>) : null}

{(isModalAcctDetail) ? (<>
<AccountDetailModal
  acctDetail={acctDetail}
  intent={s.acctDetailIntent === "fund" ? "fund" : "details"}
  copiedField={s.copiedField}
  copyField={copyField}
  openModalSwapFromAcct={openModalSwapFromAcct}
/>
</>) : null}

{(isModalCardDetail) ? (<>
<div className="ep-cards__modal">
<div className="ep-cards__modal-plastic" style={{background: cardDetail.bg}}>
<span className="ep-cards__plastic-label">{cardDetail.label}</span>
<span className="ep-cards__plastic-pan">•••• •••• •••• {cardDetail.last4}</span>
</div>
<div className="ep-cards__modal-row">
<span>Available to spend</span>
<b className="ep-mono">{cardDetail.balance}</b>
</div>
<div className="ep-cards__modal-actions">
<button type="button" onClick={fundCard} className="ep-cards__modal-primary">Fund card</button>
<button type="button" onClick={withdrawCard} className="ep-cards__modal-secondary">Withdraw</button>
</div>
<div className="ep-cards__modal-row">
<span className="ep-cards__freeze-label">Freeze card</span>
<button type="button" onClick={toggleFreezeCard} className="ep-cards__toggle" style={{background: cardDetail.freezeTrack}} aria-pressed={!!s.cardFrozen} aria-label={s.cardFrozen ? "Unfreeze card" : "Freeze card"}>
<span className="ep-cards__toggle-knob" style={{left: cardDetail.freezeKnobLeft}} />
</button>
</div>
<button type="button" onClick={terminateCard} className="ep-cards__modal-danger">Terminate card</button>
</div>
</>) : null}

{(isModalFundCard) ? (<>
{(fundCardNotDone) ? (<>
<div className="ep-cards__modal">
<label className="ep-cards__field">
<span className="ep-cards__field-label">Amount (USD)</span>
<input value={fundAmount} onChange={setFundAmount} placeholder="250.00" className="ep-cards__input" inputMode="decimal" />
</label>
<div className="ep-cards__note">Funded from your main USDC wallet. Demo only — balances won’t change.</div>
<button type="button" onClick={submitFundCard} className="ep-cards__modal-primary">Load funds</button>
</div>
</>) : null}
{(fundCardDone) ? (<>
<div className="ep-cards__success">
<span className="ep-cards__success-icon" aria-hidden>✓</span>
<span className="ep-cards__success-title">Card funded</span>
<span className="ep-cards__success-text">${fundAmount} loaded, available immediately.</span>
<button type="button" onClick={closeModal} className="ep-cards__modal-secondary">Done</button>
</div>
</>) : null}
</>) : null}

{(isModalNewCard) ? (<>
{(newCardNotDone) ? (<>
<div className="ep-cards__modal">
<label className="ep-cards__field">
<span className="ep-cards__field-label">Card label</span>
<input value={newCardLabel} onChange={setNewCardLabel} placeholder="e.g. Marketing Ads" className="ep-cards__input" />
</label>
<div className="ep-cards__note">Issues a virtual USD card for team spend. Preview — not a live card.</div>
<button type="button" onClick={issueCard} className="ep-cards__modal-primary">Issue card</button>
</div>
</>) : null}
{(newCardDone) ? (<>
<div className="ep-cards__success">
<span className="ep-cards__success-icon" aria-hidden>✓</span>
<span className="ep-cards__success-title">Card issued</span>
<span className="ep-cards__success-text">Ready to use immediately.</span>
<button type="button" onClick={closeModal} className="ep-cards__modal-secondary">Done</button>
</div>
</>) : null}
</>) : null}

{(isModalInvoice) ? (<>
{(invoiceNotDone) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div><span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Client name</span><input value={invClient} onChange={setInvClient} placeholder="e.g. Acme GmbH" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} /></div>
<div><span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Amount (USD)</span><input value={invAmount} onChange={setInvAmount} placeholder="0.00" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} /></div>
{invoiceError ? (<div style={{padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: 600}}>{invoiceError}</div>) : null}
<button onClick={submitInvoice} disabled={invoiceSubmitting} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: invoiceSubmitting ? "wait" : "pointer", opacity: invoiceSubmitting ? 0.7 : 1}}>{invoiceSubmitting ? "Creating…" : "Create & get link"}</button>
</div>
</>) : null}
{(invoiceDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Invoice created</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>{invClient} will get a payment link by email.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalKyb) ? (<>
<KybWizardModal
  step={kybWizard.step}
  stepDots={kybWizard.stepDots}
  draft={kybWizard.draft}
  patchDraft={kybWizard.patchDraft}
  patchAssociate={kybWizard.patchAssociate}
  error={kybWizard.error}
  busy={kybWizard.busy}
  docRows={kybWizard.docRows}
  setDocumentFile={kybWizard.setDocumentFile}
  uploadDocumentRow={kybWizard.uploadDocumentRow}
  docsComplete={kybWizard.docsComplete}
  submitted={kybWizard.submitted}
  nextStep={kybWizard.nextStep}
  backStep={kybWizard.backStep}
  closeModal={closeModal}
/>
</>) : null}

{(isModalTier) ? (<>
{(tierNotDone) ? (<>
<div className="ep-cards__tier">
<p className="ep-cards__tier-intro">Upload three documents. Review usually takes 1–2 business days.</p>
{(tierDocs || []).map((d: any, __i2: number) => (
<div key={__i2} className="ep-cards__tier-doc">
<span className="ep-cards__tier-doc-title">{d}</span>
<button type="button" onClick={uploadTierDoc} className="ep-cards__tier-upload">Upload</button>
</div>
))}
<button type="button" onClick={submitTier} className="ep-cards__submit">Submit for review</button>
</div>
</>) : null}
{(tierDone) ? (<>
<div className="ep-cards__success">
<span className="ep-cards__success-icon" aria-hidden>✓</span>
<span className="ep-cards__success-title">Documents submitted</span>
<span className="ep-cards__success-text">Compliance will follow up within 1–2 business days.</span>
<button type="button" onClick={closeModal} className="ep-cards__modal-secondary">Done</button>
</div>
</>) : null}
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
  occupiedNetworks={[...occupiedStablecoinNetworkCodes(stablecoinAccountsList)]}
  occupiedCurrencies={[...occupiedFiatCurrencyCodes(depositAccountsList)]}
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

</div>
</div>

</>) : null}
    </div>
  );
}
