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
import { dashboardApi } from "@/lib/services/dashboard";
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
} from "@/lib/services/depositAccounts";
import {
  ordersApi,
  buildSendQuotePayload,
  buildDepositQuotePayload,
  buildPaymentInstructionRows,
  formatQuoteFees,
  isQuoteExpiredError,
  isQuoteAlreadyAcceptedError,
  newIdempotencyKey,
} from "@/lib/services/orders";
import { useOrderStatus } from "@/lib/hooks/useOrderStatus";
import { offRampProvidersForRail, onRampProvidersForRail, networkIdForProvider } from "@/lib/services/catalog";
import { setSessionLostHandler, ApiRequestError } from "@/lib/apiClient";
import { useViewport } from "@/lib/responsive";
import { buildSendDestinationSummary, buildSendStepDots } from "@/lib/hooks/sendFlowHelpers";
import { buildDepositDestinationSummary, buildDepositStepDots } from "@/lib/hooks/depositFlowHelpers";
import { useSendCatalog } from "@/lib/hooks/useSendCatalog";
import ActivityList from "@/components/ui/ActivityList";
import InvoiceList from "@/components/ui/InvoiceList";
import StatusBadge from "@/components/ui/StatusBadge";
import SendModal from "@/components/send/SendModal";
import TransactionsScreen from "@/components/transactions/TransactionsScreen";
import TxDetailModal from "@/components/transactions/TxDetailModal";
import WalletsScreen from "@/components/wallets/WalletsScreen";
import CreateAccountModal from "@/components/wallets/CreateAccountModal";
import AccountDetailModal from "@/components/wallets/AccountDetailModal";
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
    theme: qp("theme") || props.startTheme || "light", screen: qp("screen") || props.startScreen || "home",
    sidebarOpen: false,
    modal: qp("modal") || null,
    sendStep: 1, sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0, sendRecipient: "", sendRecipientName: "", sendAmount: "", sendDone: false, sendAsset: "usdc", sendChain: "base",
    sendQuote: null as any, sendQuoteLoading: false, sendQuoteError: "", sendAccept: null as any, sendAccepting: false, sendAcceptError: "",
    depositStep: 1, depositGroup: "country", depositCountryIdx: 0, depositRailIdx: 0, depositProviderIdx: 0, depositPhone: "", depositAmount: "", depositPromptSent: false, depositAsset: "usdc", depositNetwork: "base",
    depositQuote: null as any, depositQuoteLoading: false, depositQuoteError: "", depositAccept: null as any, depositAccepting: false, depositAcceptError: "", depositDone: false, depositIdempotencyKey: "",
    receiveGroup: "fiat", receiveAcctIdx: 0, receiveAsset: "usdc", receiveNetwork: "base", copiedKey: "",
    bulkSelected: [0,3,6], bulkLoaded: false, bulkDone: false,
    onrampDir: "onramp", quoteSeconds: 87, swapAccepted: false,
    stableSel: "USDC", txFilter: "all",
    selectedTxId: null as number | null, selectedAcctIdx: 0, selectedCardIdx: 0,
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

  // Close the drawer when crossing into desktop chrome.
  useEffect(() => {
    if (!isCompact && state.sidebarOpen) setState({ sidebarOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact]);

  // Real backend data. Session-expiry from any of these bounces to /login —
  // registered once here rather than per-call, matching the mobile client's
  // single global session-lost handler.
  const queryClient = useQueryClient();
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
    enabled: state.modal === "send" && state.sendDone && !!state.sendAccept,
  });
  const depositStatusQuery = useOrderStatus(state.depositAccept?.merchant_order_id, {
    enabled: state.modal === "deposit" && state.depositDone && !!state.depositAccept,
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
    const options =
      catalogProviders && catalogProviders.length > 0
        ? catalogProviders.map((p) => p.name)
        : rail.options;
    if (!options.length) return;
    setState((s: any) => {
      if (s.sendProviderIdx < options.length) return {};
      return { sendProviderIdx: options.length - 1 };
    });
  }, [sendCatalogQuery.data, state.sendCountryIdx, state.sendRailIdx, setState]);

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

  const openModal = (name) => () => setState({
    modal: name, sendStep: 1, sendDone: false, sendRecipient: "", sendRecipientName: "", sendAmount: "", sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0, sendGroup: "country",
    sendQuote: null, sendQuoteLoading: false, sendQuoteError: "", sendAccept: null, sendAccepting: false, sendAcceptError: "",
    bulkLoaded: false, bulkDone: false, depositStep: 1, depositPromptSent: false, depositCountryIdx: 0, depositRailIdx: 0, depositProviderIdx: 0, depositGroup: "country",
    depositAmount: "", depositQuote: null, depositQuoteLoading: false, depositQuoteError: "", depositAccept: null, depositAccepting: false, depositAcceptError: "", depositDone: false, depositIdempotencyKey: "",
    receiveGroup: "fiat", receiveAcctIdx: 0, receiveAsset: "usdc", receiveNetwork: "base", copiedKey: "",
    swapAccepted: false, onrampDir: "onramp", quoteSeconds: 87,
    newCardLabel: "", newCardDone: false, invClient: "", invAmount: "", invoiceDone: false, invoiceError: "", invoiceSubmitting: false,
  });
  const sendNext = async () => {
    // Step 2 -> 3 is where a real payout ("by country") fetches a real
    // quote; step 1 -> 2 is just gathering rail/country choice, and the
    // simulated crypto tab never calls the backend (no such endpoint).
    if (state.sendStep === 2 && state.sendGroup === "country") {
      if (!state.sendRecipient.trim() || !state.sendRecipientName.trim() || !state.sendAmount.trim()) return;
      setState({ sendQuoteLoading: true, sendQuoteError: "" });
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
        const providerOptions =
          catalogProviders && catalogProviders.length > 0
            ? catalogProviders.map((p) => p.name)
            : rail.options;
        const providerIdx =
          providerOptions.length === 0
            ? 0
            : Math.min(state.sendProviderIdx, providerOptions.length - 1);
        const providerName = providerOptions[providerIdx] || providerOptions[0];
        const networkId = networkIdForProvider(catalogProviders, providerName);
        const payload = buildSendQuotePayload({
          currency: country.code,
          countryIso: country.iso,
          railType: rail.type,
          recipientAccountNumber: state.sendRecipient.trim(),
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
        setState({
          sendQuoteLoading: false,
          sendQuoteError: err instanceof ApiRequestError || err instanceof Error ? err.message : "Couldn't get a quote. Try again.",
        });
      }
      return;
    }
    setState((s: any) => ({ sendStep: Math.min(3, s.sendStep + 1) }));
  };
  const sendBack = () => setState((s: any) => ({ sendStep: Math.max(1, s.sendStep - 1), sendQuoteError: "" }));
  const depositNext = async () => {
    if (state.depositGroup === "crypto") {
      setState((s: any) => ({ depositStep: Math.min(2, s.depositStep + 1) }));
      return;
    }
    if (state.depositStep === 2) {
      if (!state.depositPhone.trim() || !state.depositAmount.trim()) return;
      setState({ depositQuoteLoading: true, depositQuoteError: "" });
      try {
        const walletAddress = summaryQuery.data?.totals.wallet_address;
        if (!walletAddress) {
          throw new Error("No treasury wallet is provisioned for this business yet.");
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
  const closeModal = () => setState({ modal: null });
  const stopClick = (e) => e.stopPropagation();
  const openTxDetail = (id: number) => () => setState({ modal: "txDetail", selectedTxId: id });
  const openAcctDetail = (i) => () => setState({ modal: "acctDetail", selectedAcctIdx: i });
  const openCardDetail = (i) => () => setState({ modal: "cardDetail", selectedCardIdx: i });
  const openNewCard = () => setState({ modal: "newCard", newCardLabel: "", newCardDone: false });
  const openModalInvoice = () => setState({ modal: "invoice", invClient: "", invAmount: "", invoiceDone: false, invoiceError: "", invoiceSubmitting: false });
  const openModalTier = () => setState({ modal: "tier", tierDone: false });
  const openModalKyb = () => setState({ modal: "kyb" });
  const goVerification = () => setState({ screen: "verification", sidebarOpen: false });
  const guardMoneyModal = (name: string) => () => {
    const status = (meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? "pending";
    if (!isKybApproved(status)) {
      goVerification();
      if (canOpenKybWizard(status)) openModalKyb();
      return;
    }
    openModal(name)();
  };
  const openModalSwapFromAcct = () => setState({ modal: "swap", swapAccepted: false, onrampDir: "onramp", quoteSeconds: 87 });

  const selectSendCountry = (i) => () => setState({ sendCountryIdx: i, sendRailIdx: 0, sendProviderIdx: 0 });
  const selectSendRail = (i) => () => setState({ sendRailIdx: i, sendProviderIdx: 0 });
  const selectSendProvider = (i) => () => setState({ sendProviderIdx: i });
  const setSendRecipient = (e) => setState({ sendRecipient: e.target.value });
  const setSendRecipientName = (e) => setState({ sendRecipientName: e.target.value });
  const setSendAmount = (e) => setState({ sendAmount: e.target.value });
  const submitSend = async () => {
    if (state.sendGroup !== "country") {
      // Direct stablecoin transfers have no backend endpoint yet — stays
      // a local simulation (see docs/api-contract.md).
      if (state.sendRecipient.trim() && state.sendAmount.trim()) setState({ sendDone: true });
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
  const setSendAsset = (k) => () => setState({ sendAsset: k });
  const setSendChain = (k) => () => setState({ sendChain: k });
  const setDepositAsset = (k) => () => setState({ depositAsset: k });
  const setDepositNetwork = (k) => () => setState({ depositNetwork: k });

  const setReceiveGroup = (g) => () => setState({ receiveGroup: g, copiedKey: "" });
  const selectReceiveAcct = (i) => () => setState({ receiveAcctIdx: i, copiedKey: "" });
  const setReceiveAsset = (k) => () => setState({ receiveAsset: k, copiedKey: "" });
  const setReceiveNetwork = (k) => () => setState({ receiveNetwork: k, copiedKey: "" });
  const copyReceiveField = (key, val) => () => { if (navigator.clipboard) navigator.clipboard.writeText(val).catch(()=>{}); setState({ copiedKey: key }); };

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
  const openCreateAccount = (kind) => () => setState({
    modal: "createAccount", addAccountMenu: false, createAccountKind: kind,
    createAccountName: "", createAccountCurrency: "", createAccountStablecoin: "",
    createAccountNetwork: "", createAccountError: "",
  });
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
    // Stablecoin accounts have no backend concept yet — there is no endpoint
    // that issues one, so this branch stays local rather than pretending.
    if (state.createAccountKind === "stablecoin") {
      if (!state.createAccountStablecoin || !state.createAccountNetwork) {
        return setState({ createAccountError: "Choose a stablecoin and a network." });
      }
      return setState({ createAccountError: "Stablecoin accounts aren't available yet — the API doesn't issue them." });
    }
    if (!state.createAccountCurrency) {
      return setState({ createAccountError: "Choose a currency." });
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
  const setSendGroup = (g) => () => setState({ sendGroup: g, sendCountryIdx: 0 });


    const s = state;
    const boostDark = props.boostDarkContrast ?? true;
    const vars = s.theme === "dark" ? (boostDark ? { ...DARK, ...DARK_HC_OVERRIDES } : DARK) : LIGHT;

    const navMap = [
      { key: "home", label: "Home", group: "Overview" },
      { key: "wallets", label: "Wallets", group: null },
      { key: "cards", label: "Cards", group: null },
      { key: "transactions", label: "Transactions", group: "Money" },
      { key: "invoices", label: "Invoices", group: null },
      { key: "reports", label: "Reports", group: null },
      { key: "verification", label: "Verification", group: "Account" },
      { key: "team", label: "Team", group: null },
      { key: "developer", label: "Developer", group: null },
    ];
    const titles = {
      home: ["Home", "Your balances, actions, and activity at a glance"],
      wallets: ["Wallets", "One main stablecoin wallet, currency accounts around it"],
      cards: ["Cards", "Virtual USD cards for team spend"],
      transactions: ["Transactions", "Every payout, deposit, and swap across rails"],
      invoices: ["Invoices", "Request and track incoming payments"],
      reports: ["Reports", "Volume, corridors, and settlement performance"],
      verification: ["Verification", "Higher tiers unlock higher limits"],
      team: ["Team", "Invite teammates and manage their access"],
      developer: ["Developer", "API keys and webhooks"],
    };
    const [currentTitle, currentSubtitle] = titles[s.screen];

    const allCountryChips = (selIdx, selectFn) => COUNTRIES.map((c, i) => ({
      flagUrl: flagUrl(c.iso), name: c.name, code: c.code, select: selectFn(i),
      bg: i === selIdx ? "var(--indigo-tint)" : "var(--surface2)", border: i === selIdx ? "var(--indigo)" : "transparent",
    }));
    const sendCountryChips = allCountryChips(s.sendCountryIdx, selectSendCountry).map(c => ({ ...c, selectSend: c.select, sendBg: c.bg, sendBorder: c.border }));
    const sendCountry = COUNTRIES[s.sendCountryIdx];
    const sendRailChips = sendCountry.rails.map((r, i) => ({ label: r.label, select: selectSendRail(i), bg: i === s.sendRailIdx ? "var(--ink)" : "var(--surface2)", color: i === s.sendRailIdx ? "var(--bg)" : "var(--ink)" }));
    const sendRail = sendCountry.rails[s.sendRailIdx] || sendCountry.rails[0];
    // Real catalog providers for this corridor when the aggregator has one
    // (carries a real networkId — see sendNext); otherwise the existing
    // hardcoded option list, so an un-onboarded corridor still renders.
    const sendCatalogProviders = offRampProvidersForRail(
      sendCatalogQuery.data,
      sendCountry.iso,
      sendRail.type,
      sendCountry.code,
    );
    const sendProviderOptions =
      sendCatalogProviders && sendCatalogProviders.length > 0
        ? sendCatalogProviders.map((p) => p.name)
        : sendRail.options;
    const sendProviderIdx =
      sendProviderOptions.length === 0
        ? 0
        : Math.min(s.sendProviderIdx, sendProviderOptions.length - 1);
    const sendProvider = sendProviderOptions[sendProviderIdx] || sendProviderOptions[0];
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
        amountColor: sign === "+" ? "var(--indigo-text)" : "var(--ink)",
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
    const selectedDepositAccount = depositAccountsList[s.selectedAcctIdx] ?? null;
    const acctDetail = selectedDepositAccount
      ? (() => {
          const view = mapDepositAccountToCardView(selectedDepositAccount);
          const [statusColor, statusSoft] = depositStatusColors(view.status);
          return {
            currency: view.currency,
            name: view.name,
            flagUrl: view.iso ? flagUrl(view.iso) : null,
            statusLabel: view.statusLabel,
            statusColor,
            statusSoft,
            rows: buildDepositAccountDetailRows(selectedDepositAccount),
            instructions: selectedDepositAccount.instructions,
          };
        })()
      : null;
    const cardSel = CARDS[s.selectedCardIdx];
  const rootStyle: React.CSSProperties = { minHeight: "100vh", position: "relative", background: "var(--bg)", color: "var(--ink)", fontFamily: "'DM Sans',sans-serif", ...vars };
  const themeIcon = s.theme === "dark" ? "☀" : "☾";
  const mainNavItems = navMap.map(n => {
        const active = s.screen === n.key;
        return { label: n.label, groupLabel: n.group, select: setScreen(n.key), bg: active ? "var(--indigo)" : "transparent", color: active ? "var(--indigo-on)" : "var(--muted)", weight: active ? 700 : 600, shadow: active ? "0 8px 18px -8px rgba(59,46,211,0.5)" : "none" };
      });
  const isHome = s.screen === "home";
  const isWallets = s.screen === "wallets";
  const isCards = s.screen === "cards";
  const isTransactions = s.screen === "transactions";
  const isInvoices = s.screen === "invoices";
  const isReports = s.screen === "reports";
  const isVerification = s.screen === "verification";
  const isTeam = s.screen === "team";
  const isDeveloper = s.screen === "developer";
  const bottomNavItems = [
        { key: "home", label: "Home", icon: "⌂" },
        { key: "wallets", label: "Accounts", icon: "▦" },
        { key: "__send", label: "Send", icon: "↗" },
        { key: "transactions", label: "Activity", icon: "≣" },
        { key: "__more", label: "More", icon: "⋯" },
      ].map(n => {
        const active = s.screen === n.key;
        const select = n.key === "__send" ? openModal("send") : n.key === "__more" ? toggleSidebar : setScreen(n.key);
        return { label: n.label, icon: n.icon, select, color: active ? "var(--indigo-text)" : "var(--muted2)", weight: active ? 700 : 600 };
      });
  const balanceViewTabs = ["all","fiat","stablecoin"].map(v => ({ key: v, label: v === "all" ? "All" : v === "fiat" ? "Fiat" : "Stablecoin", select: setBalanceView(v), bg: s.balanceView === v ? "#fff" : "transparent", color: s.balanceView === v ? "var(--indigo)" : "var(--indigo-on)" }));
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
  // Real currency accounts only — no stablecoin account has a real backend
  // source (see docs/api-contract.md), so the "Stablecoin" balance-view tab
  // shows no chips rather than the old mock USDC/USDT entries.
  const homeCurrencyChips = s.balanceView === "stablecoin"
    ? []
    : (depositAccountsQuery.data?.accounts ?? []).map((a) => {
        const view = mapDepositAccountToCardView(a);
        return { flagUrl: view.iso ? flagUrl(view.iso) : null, code: view.currency, balance: "—" };
      });
  const kybStatus = (meQuery.data?.kyb_summary?.profile?.kyb_status as string | undefined) ?? "pending";
  const kybApproved = isKybApproved(kybStatus);
  const quickActionTiles = [
        { label: "Send", icon: "↗", desc: "Mobile money, bank, SEPA or stablecoin.", open: guardMoneyModal("send"), iconBg: "var(--indigo)", iconColor: "var(--indigo-on)" },
        { label: "Bulk payouts", icon: "⇉", desc: "Pay up to 1,000 recipients from a CSV.", open: guardMoneyModal("bulk"), iconBg: "var(--ink-panel)", iconColor: "#fff" },
        { label: "Receive globally", icon: "↙", desc: "Share your IBAN, Paybill or wallet details.", open: openModal("receive"), iconBg: "var(--amber)", iconColor: "#fff" },
        { label: "Top up", icon: "＋", desc: "Fund your balance from any rail.", open: guardMoneyModal("deposit"), iconBg: "var(--indigo-tint)", iconColor: "var(--indigo-text)" },
      ];
  const totals = summaryQuery.data?.totals;
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
  const accounts = depositAccountsList.map((a, i) => {
    const view = mapDepositAccountToCardView(a);
    const [statusColor, statusSoft] = depositStatusColors(view.status);
    return {
      currency: view.currency,
      name: view.name,
      flagUrl: view.iso ? flagUrl(view.iso) : null,
      statusLabel: view.statusLabel,
      statusColor,
      statusSoft,
      primaryDetail: view.primaryDetail,
      secondaryDetail: view.secondaryDetail,
      openDetail: openAcctDetail(i),
    };
  });
  const accountsCount = depositAccountsList.length;
  const depositEligible = depositEligibilityQuery.data?.eligible === true;
  const depositEligibilityErrorMessage = depositEligibilityQuery.isError
    ? (depositEligibilityQuery.error instanceof Error
        ? depositEligibilityQuery.error.message
        : "Couldn't check account eligibility. Try again.")
    : undefined;
  const depositAccountsErrorMessage = depositAccountsQuery.isError
    ? (depositAccountsQuery.error instanceof Error
        ? depositAccountsQuery.error.message
        : "Couldn't load currency accounts. Try again.")
    : undefined;
  const walletsRecent = decoratedAll.slice(0, 5);
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
    return days.map((d) => ({ h: Math.round((d.total / max) * 100) }));
  })();
  const coverageChips = CURRENCIES.map(c => ({ flagUrl: flagUrl(c.iso), code: c.code }));
  // Tier 1 reflects real account/email verification. Tier 2 is the real Mboka
  // KYB wizard (`/api/businesses/{id}/kyb/*`). Tier 3 has no backend yet.
  const emailVerified = !!meQuery.data?.user.email_verified;
  const tier2Display = kybTierDisplay(kybStatus);
  const tier2Approved = kybApproved;
  const tiers = [
        { num: "TIER 1", title: "Basic", reqs: ["Business email verified","Director ID verified","Phone linked"], limit: "Limit · $1,000 / day", statusLabel: emailVerified ? "Complete" : "Pending", statusColor: emailVerified ? "var(--indigo-text)" : "var(--muted)", statusSoft: emailVerified ? "var(--indigo-tint)" : "var(--surface2)", locked: false },
        { num: "TIER 2", title: "Registered Business", reqs: ["Business profile & address","Beneficial owner (UBO)","Supporting documents"], limit: "Limit · $25,000 / day", statusLabel: tier2Display.label, statusColor: tier2Display.color, statusSoft: tier2Display.soft, locked: false, showKybAction: canOpenKybWizard(kybStatus), kybActionLabel: kybStatus === "rejected" || kybStatus === "expired" ? "Continue verification" : "Start verification" },
        { num: "TIER 3", title: "Institutional", reqs: ["Audited financials","AML/CFT policy","Beneficial ownership"], limit: "Limit · $250,000 / day", statusLabel: !tier2Approved ? "Requires Tier 2" : s.tierDone ? "In review" : "Locked", statusColor: s.tierDone ? "var(--amber)" : "var(--muted)", statusSoft: s.tierDone ? "var(--amber-tint)" : "var(--surface2)", locked: !tier2Approved || !s.tierDone },
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

        revoke: revokeApiKey(k.id),
      };
    });
  const isModalApiKey = s.modal === "apiKey";
  const apiKeyName = s.apiKeyName;
  const apiKeyError = s.apiKeyError;
  const apiKeyCreating = s.apiKeyCreating;
  const apiKeyEnvironmentChips = ["sandbox", "live"].map((env) => ({
    key: env,
    label: env === "live" ? "Live" : "Sandbox",
    select: setApiKeyEnvironment(env),
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
  const inviteRoleChips = ROLES.map(r => ({ key: r.key, label: r.label, desc: r.desc, select: setInviteRole(r.key), bg: s.inviteRole === r.key ? "var(--indigo)" : "var(--surface2)", color: s.inviteRole === r.key ? "var(--indigo-on)" : "var(--ink)" }));
  const inviteCanSubmit = !!(s.inviteName.trim() && s.inviteEmail.trim());
  const inviteCannotSubmit = !(s.inviteName.trim() && s.inviteEmail.trim());
  const teamRows = s.teamMembers.map(m => ({
        ...m,
        initials: m.name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase(),
        statusLabel: m.status === "active" ? "Active" : "Invited",
        statusColor: m.status === "active" ? "var(--indigo-text)" : "var(--amber)",
        statusSoft: m.status === "active" ? "var(--indigo-tint)" : "var(--amber-tint)",
        roleOptions: ROLES,
        setRole: setMemberRole(m.id),
        remove: removeMember(m.id),
      }));
  const modalOpen = !!s.modal;
  const modalTitle = { send: "Send money", deposit: "Top up balance", receive: "Receive globally", bulk: "Bulk payouts", swap: "Convert", txDetail: "Transaction", acctDetail: "Account", cardDetail: "Card", newCard: "Create virtual card", invoice: "Create invoice", tier: "Upgrade to Tier 3", kyb: "Business verification", fundCard: "Fund card", apiKey: "Create API key",
    createAccount: s.createAccountKind === "stablecoin" ? "Create Stablecoin Account" : "Create Account" }[s.modal] || "";
  const isModalCreateAccount = s.modal === "createAccount";
  const isModalSend = s.modal === "send";
  const isModalDeposit = s.modal === "deposit";
  const isModalReceive = s.modal === "receive";
  const isModalBulk = s.modal === "bulk";
  const isModalSwap = s.modal === "swap";
  const isModalTxDetail = s.modal === "txDetail";
  const isModalAcctDetail = s.modal === "acctDetail";
  const isModalCardDetail = s.modal === "cardDetail";
  const isModalNewCard = s.modal === "newCard";
  const isModalInvoice = s.modal === "invoice";
  const isModalTier = s.modal === "tier";
  const isModalKyb = s.modal === "kyb";
  const isModalFundCard = s.modal === "fundCard";
  const fundAmount = s.fundAmount;
  const fundCardNotDone = !s.fundCardDone;
  const fundCardDone = s.fundCardDone;
  const sendGroups = ["country","crypto"].map(g => ({ key: g, label: g === "country" ? "By country" : "Stablecoin", select: setSendGroup(g), bg: s.sendGroup === g ? "var(--ink)" : "var(--surface2)", color: s.sendGroup === g ? "var(--bg)" : "var(--muted)" }));
  const sendIsCountry = s.sendGroup === "country";
  const sendIsCrypto = s.sendGroup === "crypto";
  const sendRailHasChoice = sendCountry.rails.length > 1;
  const sendRecipient = s.sendRecipient;
  const sendRecipientName = s.sendRecipientName;
  const sendAmount = s.sendAmount;
  const sendDone = s.sendDone;
  const sendNotDone = !s.sendDone;
  const sendQuoteLoading = s.sendQuoteLoading;
  const sendQuoteError = s.sendQuoteError;
  const sendAccepting = s.sendAccepting;
  const sendAcceptError = s.sendAcceptError;
  const sendResultText = s.sendAccept
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
  const sendRecipientPlaceholder = s.sendGroup === "crypto" ? "e.g. 0x9F2c... or .eth" : sendRail.placeholder;
  const sendCorridorText = s.sendGroup === "crypto" ? "Sends USDC directly on Base — no FX conversion." : `${sendCountry.name} via ${sendProvider} · ${sendRail.arrival}`;
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
  const sendStepDots = buildSendStepDots(s.sendStep);
  const sendStepIs1 = s.sendStep === 1;
  const sendStepIs2 = s.sendStep === 2;
  const sendStepIs3 = s.sendStep === 3;
  const sendAssets = ["usdc","usdt"].map(k => ({ key: k, label: k.toUpperCase(), select: setSendAsset(k), bg: s.sendAsset === k ? "var(--ink)" : "var(--surface2)", color: s.sendAsset === k ? "var(--bg)" : "var(--ink)" }));
  const sendChains = DEPOSIT_NETWORKS.map(n => ({ key: n.key, label: n.label, select: setSendChain(n.key), bg: s.sendChain === n.key ? "var(--indigo-tint)" : "var(--surface2)", border: s.sendChain === n.key ? "var(--indigo)" : "transparent", color: s.sendChain === n.key ? "var(--indigo-text)" : "var(--ink)" }));
  const sendAssetCode = s.sendAsset.toUpperCase();
  const sendChainLabel = DEPOSIT_NETWORKS.find(n => n.key === s.sendChain).label;
  const sendDestinationSummary = buildSendDestinationSummary({
    sendGroup: s.sendGroup,
    sendAsset: s.sendAsset,
    sendChainLabel,
    countryName: sendCountry.name,
    providerName: sendProvider,
  });
  // Real quote fields for the "by country" flow once a quote has been
  // fetched; the crypto tab has no backend quote at all (stays simulated).
  const sendQuote = s.sendQuote;
  const sendFeeText = s.sendGroup === "crypto"
    ? "Network fee ≈ $0.85"
    : sendQuote
      ? formatQuoteFees(sendQuote.amounts.fees)
      : (sendRail.type === "mobile" ? "No fee · instant local transfer" : "Fee ≈ $1.20 · bank transfer");
  const sendArrivalText = s.sendGroup === "crypto"
    ? "Arrives in ~30 seconds"
    : sendQuote?.expires_at
      ? `Quote valid until ${new Date(sendQuote.expires_at).toLocaleTimeString()}`
      : sendRail.arrival;
  const sendQuoteRateText = sendQuote?.amounts.rate ? `${sendQuote.amounts.user_receives.amount} ${sendQuote.amounts.user_receives.currency}` : null;
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
      ? "Issue a currency account from Wallets to receive bank transfers."
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
<button onClick={exitApp} style={{display: "flex", alignItems: "center", gap: "10px", padding: "6px 8px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", minHeight: "44px"}}>
<span style={{width: "32px", height: "32px", borderRadius: "10px", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: "14px", fontWeight: "700", flexShrink: "0"}}>E</span>
<div><div style={{fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "14.5px", letterSpacing: "-0.01em", color: "var(--ink)"}}>ElementPay</div><div style={{fontSize: "10.5px", color: "var(--muted2)", fontWeight: "600"}}>Business</div></div>
</button>

<nav style={{display: "flex", flexDirection: "column", gap: "2px", flex: "1"}}>
{(mainNavItems || []).map((item: any, __i1: number) => (
<React.Fragment key={__i1}>
{(item.groupLabel) ? (<>
<div style={{fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)", fontWeight: "700", padding: "14px 12px 6px"}}>{item.groupLabel}</div>
</>) : null}
<button onClick={item.select} style={{display: "flex", alignItems: "center", gap: "10px", padding: "12px", minHeight: "44px", borderRadius: "12px", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", textAlign: "left", background: (item.bg), color: (item.color), boxShadow: (item.shadow)}}>
<span style={{fontSize: "13.5px", fontWeight: (item.weight)}}>{item.label}</span>
</button>
</React.Fragment>
))}
</nav>

<div style={{marginTop: "auto", padding: "13px 14px", borderRadius: "16px", background: "var(--ink-panel)", color: "var(--ink-panel-text)", fontFamily: "'DM Mono',monospace", fontSize: "11px"}}>
<div style={{display: "flex", alignItems: "center", gap: "6px", fontFamily: "'DM Sans',sans-serif", fontWeight: "700", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted3)", marginBottom: "8px"}}><span style={{width: "6px", height: "6px", borderRadius: "50%", background: "var(--indigo-bright)"}} />Live rates</div>
<div style={{display: "flex", justifyContent: "space-between", padding: "2px 0"}}><span>USD/KES</span><b style={{color: "#fff", fontWeight: "500"}}>131.64</b></div>
<div style={{display: "flex", justifyContent: "space-between", padding: "2px 0"}}><span>USD/NGN</span><b style={{color: "#fff", fontWeight: "500"}}>1,382.84</b></div>
<div style={{display: "flex", justifyContent: "space-between", padding: "2px 0"}}><span>USDC/USD</span><b style={{color: "#fff", fontWeight: "500"}}>1.0001</b></div>
</div>

<div style={{display: "flex", alignItems: "center", gap: "10px", padding: "14px 6px 4px"}}>
<span style={{width: "32px", height: "32px", borderRadius: "50%", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: "11.5px", fontWeight: "700", flexShrink: "0"}}>{(meQuery.data?.business?.name || "?").slice(0,2).toUpperCase()}</span>
<div style={{minWidth: "0"}}><div style={{fontSize: "12px", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{meQuery.data?.business?.name || "Loading…"}</div><div style={{fontSize: "10.5px", color: "var(--indigo-text)", fontWeight: "700"}}>{meQuery.data?.role || ""}</div></div>
<button onClick={toggleTheme} aria-label="Toggle theme" style={{marginLeft: "auto", width: "44px", height: "44px", borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: "14px", flexShrink: "0"}}>{themeIcon}</button>
<button onClick={logout} title="Log out" aria-label="Log out" style={{width: "44px", height: "44px", borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: "13px", flexShrink: "0"}}>⏻</button>
</div>
</aside>

<main className="ep-main">
<header className="ep-header">
<div style={{display: "flex", alignItems: "center", gap: "12px", minWidth: "0"}}>
<button type="button" className="ep-header__menu" onClick={toggleSidebar} aria-label="Open navigation">☰</button>
<div style={{minWidth: "0"}}>
<h1>{currentTitle}</h1>
<p>{currentSubtitle}</p>
</div>
</div>
{!isCompact ? (
<button type="button" onClick={guardMoneyModal("send")} className="ep-btn-primary" style={{width: "auto", padding: "10px 18px", minHeight: "44px", flexShrink: 0}}>
Create payment
</button>
) : null}
</header>

<div className="ep-content ep-content-cap">

{(isHome) ? (<>
<div data-screen-label="Home" className="ep-home">

{/* 1. Available balance */}
<div className="ep-grid-home-balance">
<div style={{borderRadius: "24px", padding: isMobile ? "18px 18px" : "22px 26px", color: "var(--indigo-on)", background: "var(--indigo)", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: "0 22px 48px -20px rgba(59,46,211,0.4)"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", position: "relative"}}>
<span style={{fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", opacity: "0.75", fontWeight: "700"}}>Available balance</span>
<div style={{display: "flex", gap: "4px", background: "rgba(255,255,255,0.14)", padding: "3px", borderRadius: "999px"}}>
{(balanceViewTabs || []).map((bv: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={bv.select} style={{padding: "8px 12px", minHeight: "36px", borderRadius: "999px", border: "none", background: (bv.bg), color: (bv.color), fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>{bv.label}</button>
</React.Fragment>
))}
</div>
</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "clamp(26px,3.4vw,36px)", fontWeight: "500", margin: "8px 0 2px", letterSpacing: "-0.02em", position: "relative"}}>{homeTotalBalance}</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "12px", opacity: "0.7", position: "relative"}}>{balanceViewSub}</div>
</div>

{/* Desktop/tablet: full stats column beside balance */}
<div className="ep-home__stats-desktop">
{(homeStats || []).map((hs: any, __i1: number) => (
<div key={__i1} style={{flex: "1", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "16px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px"}}>
<span style={{width: "34px", height: "34px", borderRadius: "50%", background: (hs.iconBg), color: (hs.iconColor), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: "0"}}>{hs.icon}</span>
<div><div style={{fontSize: "10.5px", fontWeight: "700", color: "var(--muted)"}}>{hs.label}</div><div style={{fontFamily: "'DM Mono',monospace", fontSize: "17px", fontWeight: "500"}}>{hs.value}</div></div>
</div>
))}
</div>
</div>

{/* Mobile: compact status chips (transaction status / pending) */}
<div className="ep-home__stats-mobile" aria-label="Key metrics">
{(homeStats || []).map((hs: any, __i1: number) => (
<div key={__i1} className="ep-home__stat-chip">
<div className="label">{hs.label}</div>
<div className="value">{hs.value}</div>
</div>
))}
</div>

{!kybApproved ? (
<KybGateBanner verificationStatus={describeKybStatus(kybStatus)} showAction={canOpenKybWizard(kybStatus)} onStartVerification={() => { goVerification(); openModalKyb(); }} />
) : null}

{/* 2. Create payment / quick actions */}
<div className="ep-grid-quick">
{(quickActionTiles || []).map((qa: any, __i1: number) => (
<button key={__i1} onClick={qa.open} className={__i1 === 0 ? undefined : "ep-quick-secondary"} style={{textAlign: "left", border: "1px solid var(--border)", background: "var(--panel)", borderRadius: "20px", padding: "16px", display: __i1 === 0 ? "flex" : undefined, flexDirection: "column", gap: "10px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", position: "relative", minHeight: "44px", gridColumn: isMobile && __i1 === 0 ? "1 / -1" : undefined}}>
<span style={{width: "40px", height: "40px", borderRadius: "13px", background: (qa.iconBg), color: (qa.iconColor), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px"}}>{qa.icon}</span>
<div><b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700", color: "var(--ink)", display: "block"}}>{qa.label === "Send" ? "Create payment" : qa.label}</b><span style={{fontSize: "11.5px", color: "var(--muted)", lineHeight: "1.5"}}>{qa.desc}</span></div>
</button>
))}
</div>

<div className="ep-hide-mobile" style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
{(homeCurrencyChips || []).map((hc: any, __i1: number) => (
<div key={__i1} style={{display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "999px", background: "var(--surface2)", border: "1px solid var(--glass-border)"}}>
<span className="ep-flag" style={{backgroundImage: `url(${hc.flagUrl})`}} aria-hidden />
<span style={{fontSize: "12px", fontWeight: "700"}}>{hc.code}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "11.5px", color: "var(--muted)"}}>{hc.balance}</span>
</div>
))}
</div>

{/* 4. Recent activity */}
<ActivityList title="Recent activity" items={homeRecent} onViewAll={goTransactions} emptyLabel={transactionsQuery.isLoading ? "Loading…" : "No recent activity"} />

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
  accounts={accounts}
  eligible={depositEligible}
  eligibilityLoading={depositEligibilityQuery.isLoading}
  verificationStatus={depositEligibilityQuery.data?.verification_status}
  eligibilityErrorMessage={depositEligibilityErrorMessage}
  accountsLoading={depositEligible && depositAccountsQuery.isLoading}
  accountsErrorMessage={depositAccountsErrorMessage}
  walletsRecent={walletsRecent}
  goTransactions={goTransactions}
/>
</>) : null}

{(isCards) ? (<>
<div data-screen-label="Cards" style={{display: "flex", flexDirection: "column", gap: "16px"}}>
<div role="note" style={{display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "12px 14px", borderRadius: "14px", background: "var(--amber-tint)", border: "1px solid var(--border)", color: "var(--amber)"}}>
<span style={{fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "999px", background: "var(--amber)", color: "#fff"}}>Preview</span>
<span style={{fontSize: "12.5px", fontWeight: 600, color: "var(--ink)"}}>Card balances and numbers are simulated demo data — not live accounts.</span>
</div>
<div style={{display: "flex", justifyContent: "flex-end"}}>
<button onClick={openNewCard} style={{padding: "10px 18px", borderRadius: "999px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ New card</button>
</div>
<div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "16px"}}>
{(cards || []).map((c: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
<div onClick={c.openDetail} style={{aspectRatio: "1.586", borderRadius: "22px", position: "relative", overflow: "hidden", padding: "20px", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer", background: (c.bg), filter: (c.filter)}}>
<div style={{display: "flex", justifyContent: "space-between", position: "relative"}}><b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px"}}>{c.label}</b><span style={{fontSize: "9px", fontWeight: "800", letterSpacing: "0.1em", padding: "4px 10px", borderRadius: "999px", background: "rgba(255,255,255,0.2)"}}>{c.statusLabel}</span></div>
<div style={{position: "relative"}}><span style={{display: "block", fontSize: "9.5px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", opacity: "0.6"}}>Available</span><span style={{fontFamily: "'DM Mono',monospace", fontSize: "19px", fontWeight: "500"}}>{c.balance}</span><div style={{fontFamily: "'DM Mono',monospace", fontSize: "14px", letterSpacing: "0.14em", marginTop: "10px"}}>•••• •••• •••• {c.last4}</div></div>
</div>
<div style={{display: "flex", gap: "6px"}}>
<button onClick={c.fund} style={{flex: "1", padding: "10px", minHeight: "44px", borderRadius: "10px", border: "1px solid var(--glass-border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12px", fontWeight: "700", cursor: "pointer"}}>Fund</button>
<button onClick={c.withdraw} style={{flex: "1", padding: "10px", minHeight: "44px", borderRadius: "10px", border: "1px solid var(--glass-border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12px", fontWeight: "700", cursor: "pointer"}}>Withdraw</button>
<button onClick={c.freeze} style={{flex: "1", padding: "10px", minHeight: "44px", borderRadius: "10px", border: "1px solid var(--glass-border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12px", fontWeight: "700", cursor: "pointer"}}>Freeze</button>
</div>
</div>
</React.Fragment>
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
<div data-screen-label="Reports" style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div className="ep-grid-stats">
{(reportStats || []).map((rs: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "18px", padding: "18px 20px"}}>
<div style={{fontSize: "11px", fontWeight: "700", color: "var(--muted)"}}>{rs.label}</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "23px", fontWeight: "500", marginTop: "4px", color: (rs.color)}}>{rs.value}</div>
</div>
</React.Fragment>
))}
</div>
<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", padding: "20px"}}>
<h2 style={{margin: "0 0 14px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700"}}>Daily volume · last 10 days</h2>
<div className="ep-chart-bars" role="img" aria-label="Daily volume chart">
{(reportBars || []).map((b: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{flex: "1", background: "var(--surface3)", borderRadius: "8px 8px 3px 3px", minHeight: "4px", height: "100%", position: "relative"}}>
<div style={{position: "absolute", bottom: "0", left: "0", right: "0", height: `${(b.h)}%`, background: "var(--indigo)", borderRadius: "8px 8px 3px 3px"}} />
</div>
</React.Fragment>
))}
</div>
</section>
<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", padding: "20px"}}>
<h2 style={{margin: "0 0 14px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700"}}>Payout coverage</h2>
<div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
{(coverageChips || []).map((cc: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "12px", background: "var(--surface2)"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(cc.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontSize: "12px", fontWeight: "700"}}>{cc.code}</span></div>
</React.Fragment>
))}
</div>
</section>
</div>
</>) : null}

{(isVerification) ? (<>
<VerificationScreen tiers={tiers} onUpgradeTier3={openModalTier} onStartKyb={openModalKyb} />
</>) : null}

{(isTeam) ? (<>
<div data-screen-label="Team" style={{display: "flex", flexDirection: "column", gap: "14px", maxWidth: "760px"}}>
<div role="note" style={{display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "12px 14px", borderRadius: "14px", background: "var(--amber-tint)", border: "1px solid var(--border)", color: "var(--amber)"}}>
<span style={{fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "999px", background: "var(--amber)", color: "#fff"}}>Preview</span>
<span style={{fontSize: "12.5px", fontWeight: 600, color: "var(--ink)"}}>Team members are simulated demo data — invites stay local to this session.</span>
</div>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap"}}>
<h2 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "0.02em", color: "var(--muted)", textTransform: "uppercase"}}>Members · {teamCount}</h2>
<button onClick={openInvite} style={{padding: "10px 16px", minHeight: "44px", borderRadius: "999px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ Invite person</button>
</div>

<section className="ep-panel">
{(teamRows || []).map((m: any, __i1: number) => (
<div key={__i1} className="ep-team-row">
<span style={{width: "38px", height: "38px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", flexShrink: "0"}}>{m.initials}</span>
<div style={{flex: "1", minWidth: "0"}}>
<div style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700"}}>{m.name}</div>
<div style={{fontSize: "11.5px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{m.email}</div>
</div>
<StatusBadge label={m.statusLabel} color={m.statusColor} soft={m.statusSoft} />
<div className="ep-team-row__actions">
<select value={m.role} onChange={m.setRole} aria-label={`Role for ${m.name}`}>
{(m.roleOptions || []).map((ro: any, __i2: number) => (
<option key={__i2} value={ro.key}>{ro.label}</option>
))}
</select>
<button onClick={m.remove} aria-label={`Remove ${m.name}`} style={{flexShrink: "0", background: "none", border: "none", padding: "10px", minWidth: "44px", minHeight: "44px", color: "var(--muted2)", fontSize: "15px", cursor: "pointer", lineHeight: "1"}}>✕</button>
</div>
</div>
))}
</section>

{(inviteOpen) ? (<>
<div onClick={closeInvite} style={{position: "fixed", inset: "0", background: "var(--overlay-bg)", backdropFilter: "blur(6px)", zIndex: "60", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"}}>
<div onClick={stopClick} style={{background: "var(--modal-bg)", border: "1px solid var(--border)", borderRadius: "22px", padding: "24px", width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<h3 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "17px", fontWeight: "700"}}>Invite a teammate</h3>
<button onClick={closeInvite} style={{background: "none", border: "none", color: "var(--muted2)", fontSize: "17px", cursor: "pointer", lineHeight: "1"}}>✕</button>
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Full name</span>
<input value={inviteName} onChange={setInviteName} placeholder="e.g. Amina Bello" style={{width: "100%", marginTop: "6px", padding: "11px 13px", borderRadius: "12px", background: "var(--input-bg)", border: "1.5px solid var(--input-border)", outline: "none", fontSize: "13px", fontWeight: "600", color: "var(--ink)", boxSizing: "border-box"}} />
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Email address</span>
<input value={inviteEmail} onChange={setInviteEmail} placeholder="name@company.com" style={{width: "100%", marginTop: "6px", padding: "11px 13px", borderRadius: "12px", background: "var(--input-bg)", border: "1.5px solid var(--input-border)", outline: "none", fontSize: "13px", fontWeight: "600", color: "var(--ink)", boxSizing: "border-box"}} />
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Role</span>
<div style={{display: "flex", flexDirection: "column", gap: "7px", marginTop: "8px"}}>
{(inviteRoleChips || []).map((r: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={r.select} style={{textAlign: "left", display: "flex", flexDirection: "column", gap: "2px", padding: "10px 13px", borderRadius: "12px", border: "none", background: (r.bg), color: (r.color), cursor: "pointer"}}>
<b style={{fontFamily: "'Sora',sans-serif", fontSize: "12.5px"}}>{r.label}</b><span style={{fontSize: "11px", opacity: "0.8"}}>{r.desc}</span>
</button>
</React.Fragment>
))}
</div>
</div>
<button onClick={submitInvite} disabled={inviteCannotSubmit} style={{marginTop: "4px", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Sora',sans-serif", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>Send invite</button>
</div>
</div>
</>) : null}
</div>
</>) : null}

{(isDeveloper) ? (<>
<div data-screen-label="Developer" style={{display: "flex", flexDirection: "column", gap: "14px", maxWidth: "720px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<h2 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "0.02em", color: "var(--muted)", textTransform: "uppercase"}}>API keys</h2>
<button onClick={openCreateApiKeyModal} style={{background: "none", border: "none", padding: "0", color: "var(--indigo-text)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ Create key</button>
</div>
{(apiKeys || []).map((k: any, __i2: number) => (
<React.Fragment key={__i2}>
<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"}}>
<div style={{display: "flex", alignItems: "center", gap: "10px"}}><b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px"}}>{k.label}</b><span style={{fontFamily: "'DM Mono',monospace", fontSize: "10.5px", fontWeight: "700", background: (k.modeBg), color: (k.modeColor), padding: "4px 10px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.04em"}}>{k.modeLabel}</span></div>
<button onClick={k.revoke} style={{background: "none", border: "none", padding: "0", color: "var(--red)", fontSize: "11.5px", fontWeight: "700", cursor: "pointer"}}>Revoke</button>
</div>

<div>
<span style={{fontSize: "10.5px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Secret key</span>
<div className="ep-secret-row">
<span className="ep-secret-row__value">{k.keyDisplay}</span>
<div className="ep-secret-row__actions">
<button onClick={k.toggleReveal} disabled={!k.canRevealKey} title={k.revealTitle} style={{background: "var(--indigo-tint)", color: "var(--indigo-text)", cursor: k.canRevealKey ? "pointer" : "not-allowed", opacity: k.canRevealKey ? 1 : 0.5}}>{k.revealLabel}</button>
<button onClick={k.copyKey} disabled={!k.canRevealKey} title={k.revealTitle} style={{background: "var(--ink)", color: "var(--bg)", cursor: k.canRevealKey ? "pointer" : "not-allowed", opacity: k.canRevealKey ? 1 : 0.5}}>{k.copyKeyLabel}</button>
</div>
</div>
</div>

<div>
<span style={{fontSize: "10.5px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Webhook URL</span>
<div className="ep-secret-row">
<span className="ep-secret-row__value">{k.webhookUrl}</span>
<div className="ep-secret-row__actions">
<button onClick={k.copyWebhook} disabled={!k.canCopyWebhook} style={{background: "var(--ink)", color: "var(--bg)", cursor: k.canCopyWebhook ? "pointer" : "not-allowed", opacity: k.canCopyWebhook ? 1 : 0.5}}>{k.copyWebhookLabel}</button>
</div>
</div>
<span style={{display: "block", marginTop: "6px", fontSize: "11px", color: "var(--muted)"}}>{k.events}</span>
</div>

<div>
<span style={{fontSize: "10.5px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Webhook signing secret</span>
<div className="ep-secret-row">
<span className="ep-secret-row__value">{k.webhookSecretDisplay}</span>
<div className="ep-secret-row__actions">
<button onClick={k.toggleRevealSecret} disabled={!k.canRevealSecret} style={{background: "var(--indigo-tint)", color: "var(--indigo-text)", cursor: k.canRevealSecret ? "pointer" : "not-allowed", opacity: k.canRevealSecret ? 1 : 0.5}}>{k.revealSecretLabel}</button>
</div>
</div>
</div>
</section>
</React.Fragment>
))}
</div>
</>) : null}

</div>

{(isCompact) ? (<>
<nav className="ep-bottom-nav" aria-label="Primary mobile">
{(bottomNavItems || []).map((bn: any, __i1: number) => (
<button key={__i1} type="button" onClick={bn.select} style={{color: bn.color}}>
<span className="ep-bottom-nav__icon" aria-hidden>{bn.icon}</span>
<span className="ep-bottom-nav__label" style={{fontWeight: bn.weight}}>{bn.label}</span>
</button>
))}
</nav>
{!modalOpen ? (
<button type="button" className="ep-fab" onClick={guardMoneyModal("send")} aria-label="Create payment">
<span aria-hidden>↗</span> Create payment
</button>
) : null}
</>) : null}
</main>
</div>

{modalOpen ? (<>
<div onClick={closeModal} className="ep-modal-overlay" role="presentation">
<div onClick={stopClick} className="ep-modal" role="dialog" aria-modal="true" aria-labelledby="ep-modal-title">

<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
<h3 id="ep-modal-title" style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "16px", fontWeight: "700"}}>{modalTitle}</h3>
<button type="button" onClick={closeModal} className="ep-modal__close" aria-label="Close">✕</button>
</div>

{(isModalSend) ? (<>
<SendModal
  sendNotDone={sendNotDone}
  sendDone={sendDone}
  sendStepDots={sendStepDots}
  sendStepIs1={sendStepIs1}
  sendStepIs2={sendStepIs2}
  sendStepIs3={sendStepIs3}
  sendGroups={sendGroups}
  sendIsCountry={sendIsCountry}
  sendIsCrypto={sendIsCrypto}
  sendCountryChips={sendCountryChips}
  sendRailHasChoice={sendRailHasChoice}
  sendRailChips={sendRailChips}
  sendProviderHasChoice={sendProviderHasChoice}
  sendProviderChips={sendProviderChips}
  sendAssets={sendAssets}
  sendChains={sendChains}
  sendAssetCode={sendAssetCode}
  sendChainLabel={sendChainLabel}
  sendNext={sendNext}
  sendBack={sendBack}
  sendDestinationSummary={sendDestinationSummary}
  sendRecipientName={sendRecipientName}
  setSendRecipientName={setSendRecipientName}
  sendRecipientLabel={sendRecipientLabel}
  sendRecipient={sendRecipient}
  setSendRecipient={setSendRecipient}
  sendRecipientPlaceholder={sendRecipientPlaceholder}
  sendAmount={sendAmount}
  setSendAmount={setSendAmount}
  sendQuoteError={sendQuoteError}
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
</>) : null}


{(isModalDeposit) ? (<>
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
/>
</>) : null}


{(isModalReceive) ? (<>
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
</>) : null}

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

{(isModalSwap) ? (<>
{(swapNotAccepted) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", gap: "8px"}}>
<button onClick={setOnramp} style={{flex: "1", padding: "10px", borderRadius: "12px", border: `1.5px solid ${(onrampTabBorder)}`, background: (onrampTabBg), color: (onrampTabColor), fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Fiat → Stablecoin</button>
<button onClick={setOfframp} style={{flex: "1", padding: "10px", borderRadius: "12px", border: `1.5px solid ${(offrampTabBorder)}`, background: (offrampTabBg), color: (offrampTabColor), fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Stablecoin → Fiat</button>
</div>
<div style={{background: "var(--surface2)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "6px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "24px", fontWeight: "500"}}>{swapAmountFrom}</span>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)", padding: "5px 10px", background: "var(--surface3)", borderRadius: "8px"}}>{swapFromCcy}</span>
</div>
<div style={{textAlign: "center", color: "var(--muted2)", fontSize: "13px"}}>↓</div>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "24px", fontWeight: "500", color: "var(--indigo-text)"}}>{swapAmountTo}</span>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)", padding: "5px 10px", background: "var(--surface3)", borderRadius: "8px"}}>{swapToCcy}</span>
</div>
</div>
<div style={{display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px"}}>
<div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--muted)"}}>Rate</span><span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600"}}>{swapRate}</span></div>
<div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--muted)"}}>Settles via</span><span style={{fontWeight: "600"}}>{swapSettle}</span></div>
</div>
{(quoteExpired) ? (<>
<div style={{padding: "12px 14px", borderRadius: "12px", background: "var(--red-tint)", display: "flex", flexDirection: "column", gap: "2px"}}><span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--red)"}}>Rate expired</span><span style={{fontSize: "11.5px", color: "var(--muted)"}}>Refresh to fetch an up-to-date rate.</span></div>
</>) : null}
{(quoteLive) ? (<>
<div style={{height: "4px", borderRadius: "2px", background: "var(--surface3)", overflow: "hidden"}}><div style={{height: "100%", background: "var(--indigo)", width: `${(quoteProgress)}%`, transition: "width 1s linear"}} /></div>
</>) : null}
<div style={{display: "flex", gap: "8px"}}>
<button onClick={refreshQuote} style={{flex: "1", padding: "10px", borderRadius: "12px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Refresh quote</button>
<button onClick={acceptQuote} disabled={quoteExpired} style={{flex: "1", padding: "10px", borderRadius: "12px", border: "none", background: (acceptBg), color: (acceptColor), fontSize: "12.5px", fontWeight: "700", cursor: (acceptCursor)}}>Accept & settle</button>
</div>
</div>
</>) : null}
{(swapAccepted) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Swap complete</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Settled via {swapSettle}.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalTxDetail) ? (<>
<TxDetailModal txDetail={txDetail} isLoading={txDetailQuery.isLoading} liveStatus={txLiveStatus} />
</>) : null}

{(isModalAcctDetail) ? (<>
<AccountDetailModal acctDetail={acctDetail} copiedField={s.copiedField} copyField={copyField} openModalSwapFromAcct={openModalSwapFromAcct} />
</>) : null}

{(isModalCardDetail) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div style={{aspectRatio: "1.586", maxWidth: "280px", margin: "0 auto", borderRadius: "20px", background: (cardDetail.bg), color: "#fff", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
<b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "12.5px"}}>{cardDetail.label}</b>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "13px", letterSpacing: "0.1em"}}>•••• •••• •••• {cardDetail.last4}</div>
</div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "9px 0", borderBottom: "1px dashed var(--border)"}}><span style={{color: "var(--muted)"}}>Available to spend</span><b style={{fontFamily: "'DM Mono',monospace"}}>{cardDetail.balance}</b></div>
<div style={{display: "flex", gap: "8px"}}>
<button onClick={fundCard} style={{flex: "1", padding: "11px", borderRadius: "12px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Fund card</button>
<button onClick={withdrawCard} style={{flex: "1", padding: "11px", borderRadius: "12px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Withdraw</button>
</div>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0"}}><span style={{fontSize: "12.5px", fontWeight: "700"}}>Freeze card</span><button onClick={toggleFreezeCard} style={{width: "44px", height: "24px", borderRadius: "999px", border: "none", background: (cardDetail.freezeTrack), position: "relative", cursor: "pointer"}}><span style={{position: "absolute", top: "3px", left: (cardDetail.freezeKnobLeft), width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s"}} /></button></div>
<button onClick={terminateCard} style={{padding: "10px", borderRadius: "12px", border: "1.5px solid var(--red-tint)", background: "none", color: "var(--red)", fontSize: "12px", fontWeight: "700", cursor: "pointer"}}>Terminate card</button>
</div>
</>) : null}

{(isModalFundCard) ? (<>
{(fundCardNotDone) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div><span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Amount (USD)</span><input value={fundAmount} onChange={setFundAmount} placeholder="250.00" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} /></div>
<div style={{padding: "10px 12px", borderRadius: "12px", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontSize: "12px", fontWeight: "600"}}>Funded from your main USDC wallet.</div>
<button onClick={submitFundCard} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Load funds</button>
</div>
</>) : null}
{(fundCardDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Card funded</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>${fundAmount} loaded, available immediately.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalNewCard) ? (<>
{(newCardNotDone) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div><span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Card label</span><input value={newCardLabel} onChange={setNewCardLabel} placeholder="e.g. Marketing Ads" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} /></div>
<button onClick={issueCard} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Issue card</button>
</div>
</>) : null}
{(newCardDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Card issued</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Ready to use immediately.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
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
<div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
<p style={{margin: "0", fontSize: "12.5px", color: "var(--muted)"}}>Upload three documents. Review usually takes 1-2 business days.</p>
{(tierDocs || []).map((d: any, __i2: number) => (
<React.Fragment key={__i2}>
<div style={{display: "flex", alignItems: "center", gap: "12px", padding: "14px", borderRadius: "14px", background: "var(--surface2)"}}><div style={{flex: "1"}}><b style={{fontSize: "13px"}}>{d}</b></div><button onClick={uploadTierDoc} style={{padding: "6px 13px", borderRadius: "999px", border: "none", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>Upload</button></div>
</React.Fragment>
))}
<button onClick={submitTier} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Submit for review</button>
</div>
</>) : null}
{(tierDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Documents submitted</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Compliance will follow up within 1-2 business days.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
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
  closeModal={closeModal}
  submitCreateAccount={submitCreateAccount}
/>
</>) : null}

{(isModalApiKey) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Key name</span>
<input value={apiKeyName} onChange={setApiKeyName} placeholder="e.g. Server integration" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} />
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Environment</span>
<div style={{display: "flex", gap: "6px", marginTop: "6px"}}>
{(apiKeyEnvironmentChips || []).map((e: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={e.select} style={{padding: "9px 16px", borderRadius: "999px", border: "none", background: (e.bg), color: (e.color), fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>{e.label}</button>
</React.Fragment>
))}
</div>
</div>
{apiKeyError ? (<div style={{padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: 600}}>{apiKeyError}</div>) : null}
<button onClick={submitApiKey} disabled={apiKeyCreating} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: apiKeyCreating ? "wait" : "pointer", opacity: apiKeyCreating ? 0.7 : 1}}>{apiKeyCreating ? "Creating…" : "Create key"}</button>
</div>
</>) : null}

</div>
</div>

</>) : null}
    </div>
  );
}
