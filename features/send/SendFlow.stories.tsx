import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SendFlow from "./SendFlow";
import { baseProps, cryptoProps } from "./SendFlow.fixtures";
import type { SavedRecipient } from "./types";

const meta = { title: "Features/Send flow" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const stamp = "2026-11-20T14:05:00Z";
const saved: SavedRecipient[] = [
  {
    id: "r1",
    businessId: 1,
    label: "Jane Mukami",
    accountNumber: "1234567890",
    railType: "bank",
    countryCode: "KE",
    currency: "KES",
    provider: "KCB Bank",
    createdAt: stamp,
    updatedAt: stamp,
  },
  {
    id: "r2",
    businessId: 1,
    label: "Kito Logistics",
    accountNumber: "0x9b44c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
    railType: "crypto",
    network: "Base",
    createdAt: stamp,
    updatedAt: stamp,
  },
];

const review = { sendStepIs1: false, sendStepIs3: true };
const done = { ...review, sendNotDone: false, sendDone: true, sendOrderId: "4821", sendUpdatedAt: stamp };

/** Click through the steps: method → country → bank → account → amount. */
export const Steps: Story = {
  render: () => (
    <SendFlow {...baseProps({ savedRecipients: saved, sendAmountEquivalent: "≈ 64,600.00 KES", sendIndicativeRateLine: "1 USD = 129.20 KES", sendMaxAmount: "900.00", onMaxSendAmount: () => {} })} />
  ),
};

export const Stablecoin: Story = { render: () => <SendFlow {...cryptoProps()} /> };

export const CheckAndSend: Story = { render: () => <SendFlow {...baseProps(review)} /> };

export const Sending: Story = { render: () => <SendFlow {...baseProps({ ...review, sendAccepting: true })} /> };

export const OnItsWay: Story = { render: () => <SendFlow {...baseProps(done)} /> };

export const Delivered: Story = {
  render: () => <SendFlow {...baseProps({ ...done, sendOutcome: "delivered" })} />,
};

export const Failed: Story = {
  render: () => <SendFlow {...baseProps({ ...done, sendOutcome: "failed", onContactSupport: () => {} })} />,
};

export const Refunded: Story = {
  render: () => <SendFlow {...baseProps({ ...done, sendOutcome: "refunded", onContactSupport: () => {} })} />,
};
