export type DisbursementStatusDescriptor = {
  label: string;
  icon: string;
  color: string;
  soft: string;
  terminal: boolean;
};

const DISBURSEMENT_STATUS: Record<string, DisbursementStatusDescriptor> = {
  pending: {
    label: "Pending",
    icon: "●",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
    terminal: false,
  },
  submitting: {
    label: "Submitting",
    icon: "●",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
    terminal: false,
  },
  parked: {
    label: "Parked",
    icon: "‖",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
    terminal: false,
  },
  submitted: {
    label: "Submitted",
    icon: "●",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
    terminal: false,
  },
  processing: {
    label: "Processing",
    icon: "●",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
    terminal: false,
  },
  completed: {
    label: "Completed",
    icon: "✓",
    color: "var(--success)",
    soft: "color-mix(in srgb, var(--success) 10%, transparent)",
    terminal: true,
  },
  failed: {
    label: "Failed",
    icon: "✕",
    color: "var(--red)",
    soft: "var(--red-tint)",
    terminal: true,
  },
  partially_failed: {
    label: "Partially failed",
    icon: "!",
    color: "var(--red)",
    soft: "var(--red-tint)",
    terminal: true,
  },
};

const FALLBACK: DisbursementStatusDescriptor = {
  label: "Unknown",
  icon: "?",
  color: "var(--muted)",
  soft: "var(--surface2)",
  terminal: true,
};

export function describeDisbursementStatus(status: string | null | undefined): DisbursementStatusDescriptor {
  const key = (status || "").trim().toLowerCase();
  return DISBURSEMENT_STATUS[key] || FALLBACK;
}

export function isTerminalDisbursementStatus(status: string | null | undefined): boolean {
  return describeDisbursementStatus(status).terminal;
}
