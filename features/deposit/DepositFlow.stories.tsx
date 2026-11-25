import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DepositFlow from "./DepositFlow";
import { baseProps, reviewProps } from "./DepositFlow.fixtures";
import type { DepositFlowProps } from "./types";

const meta = { title: "Features/Add money flow" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Flow = (p: DepositFlowProps) => (
  <QueryClientProvider client={client}>
    <DepositFlow {...p} />
  </QueryClientProvider>
);

const cad = { id: "cad-1", entityId: "e1", label: "CAD account", balanceText: "40.00 CAD" };
const bankPicked = baseProps().railGroups.map((g) => ({
  ...g,
  providers: g.providers.map((p) => ({ ...p, selected: g.type === "bank" })),
}));

/** Click through: account → method → country → provider. */
export const Steps: Story = { render: () => <Flow {...baseProps({ interacAccounts: [cad] })} /> };

export const FromInsideAnAccount: Story = { render: () => <Flow {...baseProps({ walletLocked: true })} /> };

export const HowMuch: Story = {
  render: () => <Flow {...baseProps({ walletLocked: true, stepIs2: true, phone: "712345678", amount: "13000" })} />,
};

export const CheckAndPay: Story = {
  render: () => <Flow {...reviewProps({ quoteExpiresAt: new Date(Date.now() + 42_000).toISOString() })} />,
};

export const CheckYourPhone: Story = {
  render: () => <Flow {...reviewProps({ stepIs3: false, done: true, outcome: "processing" })} />,
};

export const Received: Story = {
  render: () => <Flow {...reviewProps({ stepIs3: false, done: true, outcome: "received" })} />,
};

export const NotCompleted: Story = {
  render: () => (
    <Flow
      {...reviewProps({
        stepIs3: false,
        done: true,
        outcome: "failed",
        failureMessage: "The request was cancelled on the phone.",
        retry: () => {},
      })}
    />
  ),
};

export const BankDetails: Story = {
  render: () => (
    <Flow
      {...reviewProps({
        stepIs3: false,
        done: true,
        providerLabel: "KCB Bank",
        railGroups: bankPicked,
        bankLines: [
          { k: "Bank", v: "Equity Bank" },
          { k: "Account name", v: "Element Pay Ltd" },
          { k: "Account number", v: "0123456789" },
          { k: "Reference", v: "EP-4821" },
        ],
      })}
    />
  ),
};

export const UsdcOnBase: Story = {
  render: () => <Flow {...baseProps({ walletLocked: true, group: "crypto", stepIs2: true })} />,
};

export const UsdcOnStellar: Story = {
  render: () => (
    <Flow
      {...baseProps({
        walletLocked: true,
        group: "crypto",
        stepIs2: true,
        networkKey: "stellar",
        networkLabel: "Stellar",
        address: "GDX4ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP7QPL",
      })}
    />
  ),
};

export const Interac: Story = {
  render: () => (
    <Flow
      {...baseProps({
        interacAccounts: [cad],
        interacLockedAccountId: "cad-1",
        interacPayerName: "Acme Ltd",
        interacDefaultEmail: "ops@acme.test",
      })}
    />
  ),
};
