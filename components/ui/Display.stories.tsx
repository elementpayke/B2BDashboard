import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Amount } from "./Amount";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card, CardBody, CardFooter, CardHeader } from "./Card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

const meta = { title: "UI/Display" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Amounts: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Amount value="2481300" currency="KES" size="hero" />
      <Amount value="150.5" currency="USDC" direction="in" />
      <Amount value="42" currency="USD" direction="out" />
      <Amount value={null} currency="EUR" />
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="success">Settled</Badge>
      <Badge tone="warning">Processing</Badge>
      <Badge tone="danger">Failed</Badge>
      <Badge tone="brand">Paid</Badge>
      <Badge>Canceled</Badge>
    </div>
  ),
};

export const Panel: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader
        title="USD account"
        description="IBAN · SWIFT"
        action={<Button variant="link" size="sm">Details</Button>}
      />
      <CardBody>
        <Amount value="184220.55" currency="USD" size="lg" />
      </CardBody>
      <CardFooter>
        <Button variant="secondary">Receive</Button>
        <Button>Send</Button>
      </CardFooter>
    </Card>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-56" />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <Card className="max-w-md">
      <EmptyState
        title="No transactions yet"
        description="Payments you send and receive will appear here."
        action={<Button>Send money</Button>}
      />
    </Card>
  ),
};

export const Error: Story = {
  render: () => (
    <Card className="max-w-md">
      <EmptyState
        tone="error"
        title="Couldn't load transactions"
        description="We couldn't reach Mboka. Nothing is shown rather than stale data."
        action={<Button variant="secondary">Try again</Button>}
      />
    </Card>
  ),
};
