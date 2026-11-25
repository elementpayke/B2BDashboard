// Root segments of every TanStack Query key, in one place.
//
// Always build keys from QK (`[QK.transactions, filters]`) — never a string
// literal. A typo'd literal silently matches nothing: e.g. an invalidation of
// ["bootstrap"] meant the dashboard-bootstrap query (balances) never refreshed
// after a fund conversion settled.
export const QK = {
  apiKey: "api-key",
  apiKeys: "api-keys",
  authMe: "auth-me",
  cardColors: "card-colors",
  cardTransactions: "card-transactions",
  collectCctpSupportedChains: "collect-cctp-supported-chains",
  dashboardBootstrap: "dashboard-bootstrap",
  dashboardSummary: "dashboard-summary",
  depositAccounts: "deposit-accounts",
  depositAccountsEligibility: "deposit-accounts-eligibility",
  exchangeRates: "exchange-rates",
  invoice: "invoice",
  invoiceBranding: "invoice-branding",
  invoiceCustomers: "invoice-customers",
  invoiceDrafts: "invoice-drafts",
  invoicePayments: "invoice-payments",
  invoices: "invoices",
  invoicesSummary: "invoices-summary",
  issuedCards: "issued-cards",
  landingExchangeRates: "landing-exchange-rates",
  orderStatus: "order-status",
  paymentRequest: "payment-request",
  savedRecipients: "saved-recipients",
  sendEstimate: "send-estimate",
  sendOptions: "send-options",
  sendableStablecoinAccounts: "sendable-stablecoin-accounts",
  stablecoinAccounts: "stablecoin-accounts",
  stellarCreditWatch: "stellar-credit-watch",
  stellarWalletPayments: "stellar-wallet-payments",
  supportedCatalog: "supported-catalog",
  team: "team",
  transaction: "transaction",
  unifiedSend: "unified-send",
  transactions: "transactions",
  transactionsPage: "transactions-page",
} as const;

export type QueryRoot = (typeof QK)[keyof typeof QK];
