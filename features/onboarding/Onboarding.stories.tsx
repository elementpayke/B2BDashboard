import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GetStartedChecklist from "./GetStartedChecklist";
import KybGateDialog from "./KybGateDialog";

const meta = { title: "Features/Onboarding" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const GetStartedJustApproved: Story = {
  render: () => (
    <GetStartedChecklist
      hasAccount={false}
      hasMoneyIn={false}
      hasMoneyOut={false}
      storageKey="story:get-started:fresh"
      onOpenAccount={noop}
      onAddMoney={noop}
      onSend={noop}
    />
  ),
};

export const GetStartedOneLeft: Story = {
  render: () => (
    <GetStartedChecklist
      hasAccount
      hasMoneyIn
      hasMoneyOut={false}
      storageKey="story:get-started:one-left"
      onOpenAccount={noop}
      onAddMoney={noop}
      onSend={noop}
    />
  ),
};

const gate = (status: string) => (
  <KybGateDialog open status={status} action="send money" onStartVerification={noop} onViewStatus={noop} onClose={noop} />
);

export const GateNotVerified: Story = { render: () => gate("pending") };
export const GateInReview: Story = { render: () => gate("submitted") };
export const GateNeedsFixes: Story = { render: () => gate("rejected") };
