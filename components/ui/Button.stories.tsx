import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Send money" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "destructive", "link"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "Cancel" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Export CSV" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Close account" } };
export const Link: Story = { args: { variant: "link", children: "View all" } };
export const Loading: Story = { args: { loading: true, children: "Confirming" } };
export const Block: Story = { args: { block: true, size: "lg", children: "Continue" } };

/** The approved pairing: one primary per view, secondary beside it. */
export const ActionRow: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="secondary">Cancel</Button>
      <Button>Confirm transfer</Button>
    </div>
  ),
};
