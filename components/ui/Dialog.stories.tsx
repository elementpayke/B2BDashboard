import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";

const meta = { title: "UI/Dialog" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>Add account</Button>
      </DialogTrigger>
      <DialogContent
        title="Add a USD account"
        description="Issued in your business's name with real account details."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button>Create account</Button>
          </>
        }
      >
        <Field label="Account name" hint="Shown on statements">
          <Input placeholder="Operations" />
        </Field>
      </DialogContent>
    </Dialog>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="destructive">Revoke key</Button>
      </DialogTrigger>
      <DialogContent
        size="sm"
        title="Revoke API key?"
        description="Integrations using this key stop working immediately. This cannot be undone."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Keep key</Button>
            </DialogClose>
            <Button variant="destructive">Revoke</Button>
          </>
        }
      />
    </Dialog>
  ),
};
