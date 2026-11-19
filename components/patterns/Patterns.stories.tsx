import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "./PageHeader";
import { StatTile } from "./StatTile";

const meta = { title: "Patterns/Screen" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Skeleton of a dashboard screen built only from primitives + patterns. */
export const ScreenTop: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Volume and success rate across all accounts."
        actions={
          <>
            <Button variant="secondary">Export CSV</Button>
            <Button>Download statement</Button>
          </>
        }
      />
      <div className="grid gap-3 desktop:grid-cols-3">
        <StatTile label="Volume (30d)" value={<Amount value="1284000" currency="USD" size="lg" />} meta="+12% vs last month" />
        <StatTile label="Payouts" value={<Amount value="402" currency="txns" decimals={0} size="lg" />} />
        <StatTile label="Pending" value={null} loading />
      </div>
    </div>
  ),
};
