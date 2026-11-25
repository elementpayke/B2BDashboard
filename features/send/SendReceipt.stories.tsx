import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SendReceipt from "./SendReceipt";

const meta = {
  title: "Features/Send flow/Receipt",
  component: SendReceipt,
  args: {
    status: "delivered",
    getsText: "128.9 KES",
    recipientName: "Joseph Thuku",
    toLines: ["M-Pesa, Kenya", "0110919165"],
    sourceLabel: "USDT · Polygon",
    methodLabel: "Mobile money",
    paidAt: "2026-11-25T14:15:00Z",
    amountText: "1 USD",
    feeText: "Included in the rate",
    rateLine: "1 USD = 128.90 KES/USDT",
    channelText: "M-Pesa",
    accountText: "0110919165",
    totalText: "1.0 USDT",
    orderId: "92",
    onBack: () => {},
  },
} satisfies Meta<typeof SendReceipt>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Download PDF here produces the same layout as the page. */
export const MobileMoney: Story = {};

export const Processing: Story = { args: { status: "processing" } };

export const Wallet: Story = {
  args: {
    getsText: "250.00 USDC",
    recipientName: "Kito Logistics",
    toLines: ["USDC on Base", "0x9b44c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"],
    methodLabel: "Stablecoin",
    amountText: "250 USDC",
    feeText: "0.50 USDC",
    rateLine: null,
    channelText: "Base",
    accountText: "0x9b44c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
    totalText: "250.50 USDC",
  },
};
