import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ConvertAccountOption } from "@/components/convert/ConvertFlow";
import type { ConversionOut } from "@/lib/services/conversions";
import { resolveConvertRoute } from "@/lib/services/convertRoutes";
import ConvertComposer, { type ConvertComposerProps } from "./ConvertComposer";

const meta = { title: "Features/Convert flow" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const accounts: ConvertAccountOption[] = [
  { id: "usd", currency: "USD", label: "USD account", balanceLabel: "12,480.00", balanceAmount: 12480, flagUrl: "https://flagcdn.com/w80/us.png" },
  { id: "eur", currency: "EUR", label: "EUR account", balanceLabel: "3,210.55", balanceAmount: 3210.55, flagUrl: "https://flagcdn.com/w80/eu.png" },
  { id: "kes", currency: "KES", label: "KES account", balanceLabel: "1,250,000.00", balanceAmount: 1250000, flagUrl: "https://flagcdn.com/w80/ke.png" },
  { id: "usdc-base", currency: "USDC", label: "USDC wallet · Base", balanceLabel: "1,240.50", balanceAmount: 1240.5, network: "Base" },
  { id: "usdc-polygon", currency: "USDC", label: "USDC wallet · Polygon", balanceLabel: "40.00", balanceAmount: 40, network: "Polygon" },
  { id: "usdc-stellar", currency: "USDC", label: "USDC wallet · Stellar", balanceLabel: "310.00", balanceAmount: 310, network: "Stellar" },
];

const quote: ConversionOut = {
  id: "CNV-4B81-0C6E",
  status: "quoted",
  direction: "ledger_fx",
  source_account_id: "usd",
  destination_account_id: "eur",
  source_currency: "USD",
  destination_currency: "EUR",
  source_amount: "1000.00",
  destination_amount: "921.30",
  fee_amount: "4.00",
  fee_currency: "USD",
  quote_id: "q1",
  order_id: null,
  ledger_journal_reference: null,
  expires_at: null,
};

function props(overrides: Partial<ConvertComposerProps> = {}): ConvertComposerProps {
  const noop = () => {};
  const src = overrides.sourceAccountId ?? "usd";
  const dst = overrides.destinationAccountId ?? "eur";
  return {
    route: resolveConvertRoute(
      accounts.find((a) => a.id === src),
      accounts.find((a) => a.id === dst),
    ),
    sourceAccounts: accounts,
    destinationAccounts: accounts.filter((a) => a.id !== src),
    sourceAccountId: src,
    destinationAccountId: dst,
    onSourceAccount: noop,
    onDestinationAccount: noop,
    amount: "1000",
    onAmount: noop,
    quote: null,
    quoteSeconds: 42,
    quoteLoading: false,
    acceptLoading: false,
    error: "",
    done: false,
    onRefreshQuote: noop,
    onAccept: noop,
    onDone: noop,
    ...overrides,
  };
}

export const GettingTheRate: Story = { render: () => <ConvertComposer {...props({ quoteLoading: true })} /> };
export const LivePrice: Story = { render: () => <ConvertComposer {...props({ quote })} /> };
export const OverTheBalance: Story = { render: () => <ConvertComposer {...props({ amount: "20000" })} /> };
export const PairWeCantConvert: Story = {
  render: () => <ConvertComposer {...props({ sourceAccountId: "usdc-base", destinationAccountId: "usdc-polygon" })} />,
};
export const NoAccounts: Story = {
  render: () => <ConvertComposer {...props({ sourceAccounts: [accounts[0]], destinationAccounts: [] })} />,
};
export const Converted: Story = {
  render: () => <ConvertComposer {...props({ quote: { ...quote, status: "completed" }, done: true })} />,
};
export const ConvertingInStages: Story = {
  render: () => (
    <ConvertComposer
      {...props({
        sourceAccountId: "usdc-stellar",
        quote: {
          ...quote,
          route: "bridged",
          status: "processing_onchain",
          stages: ["pending", "processing_onchain", "processing_to_fiat", "completed"],
          source_currency: "USDC",
          source_amount: "300.00",
          destination_amount: "274.10",
          destination_amount_estimated: true,
        },
        done: true,
      })}
    />
  ),
};
export const Returned: Story = {
  render: () => (
    <ConvertComposer
      {...props({
        sourceAccountId: "usdc-stellar",
        quote: {
          ...quote,
          route: "bridged",
          status: "returned",
          source_currency: "USDC",
          source_amount: "300.00",
          return_reason: "The rate moved too far.",
        },
        done: true,
      })}
    />
  ),
};
