import * as React from "react";
import { cn } from "@/lib/utils";

type FieldControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

export type FieldProps = {
  label: React.ReactNode;
  /** Help text under the control. Hidden while an error is shown. */
  hint?: React.ReactNode;
  /** Error message. Sets aria-invalid on the control and is announced. */
  error?: React.ReactNode;
  /** Explicit id; otherwise one is generated. */
  id?: string;
  className?: string;
  /**
   * The control. Either an element (props are injected) or a render function
   * receiving the a11y props — use the function form for custom controls.
   */
  children: React.ReactElement<FieldControlProps> | ((props: FieldControlProps) => React.ReactNode);
};

/**
 * Label + control + hint/error, with the id / aria-describedby / aria-invalid
 * wiring done for you. Every form control in new code goes through Field.
 */
export function Field({ label, hint, error, id, className, children }: FieldProps) {
  const autoId = React.useId();
  const controlId = id ?? `field-${autoId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const controlProps: FieldControlProps = {
    id: controlId,
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={controlId}
        className="text-label font-bold uppercase tracking-label text-subtle-foreground"
      >
        {label}
      </label>
      {typeof children === "function"
        ? children(controlProps)
        : React.cloneElement(children, controlProps)}
      {error ? (
        <p id={errorId} role="alert" className="text-caption font-semibold text-destructive-text">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-subtle-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
