import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field } from "./Field";
import { Input } from "./Input";

const meta = {
  title: "UI/Field",
  component: Field,
  args: { label: "Recipient phone number", children: <Input placeholder="0712 345 678" inputMode="tel" /> },
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: "M-Pesa or Airtel Money number" } };
export const WithError: Story = { args: { error: "Enter a valid Kenyan mobile number" } };
export const MonoAmount: Story = {
  args: { label: "Amount", hint: "Min 1.00 USDC", children: <Input mono inputMode="decimal" placeholder="0.00" /> },
};
export const Disabled: Story = { args: { children: <Input disabled value="Mboka Business Ltd" readOnly /> } };
