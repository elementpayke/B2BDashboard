function readMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const rec = err as { message?: unknown; error?: { message?: unknown } };
    if (typeof rec.message === "string") return rec.message;
    if (typeof rec.error?.message === "string") return rec.error.message;
  }
  return "";
}

function readOpCodes(err: unknown): string[] {
  if (!err || typeof err !== "object") return [];
  const withCodes = err as { getResultCodes?: () => { operations?: string[] } };
  if (typeof withCodes.getResultCodes !== "function") return [];
  try {
    return withCodes.getResultCodes()?.operations ?? [];
  } catch {
    return [];
  }
}

export function isWalletModalClosed(err: unknown): boolean {
  const message = readMessage(err).toLowerCase();
  return (
    message.includes("closed the modal") ||
    message.includes("user declined") ||
    message.includes("user rejected") ||
    message.includes("request rejected by user") ||
    message.includes("user cancelled") ||
    message.includes("user canceled")
  );
}

export function isHorizonNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const rec = err as { name?: string; response?: { status?: number } };
  return rec.name === "NotFoundError" || rec.response?.status === 404;
}

export function formatStellarWalletError(err: unknown): string {
  if (isWalletModalClosed(err)) return "";
  const message = readMessage(err);
  const ops = readOpCodes(err);
  const codes = ops.join(" ").toLowerCase();
  if (codes.includes("op_underfunded")) {
    return "Not enough USDC (or XLM for fees) in the connected wallet.";
  }
  if (codes.includes("op_no_trust") || codes.includes("op_no_destination")) {
    return "The destination cannot receive USDC on Stellar yet.";
  }
  if (codes.includes("op_line_full")) {
    return "The destination USDC balance is at its limit. Try a smaller amount.";
  }
  if (message.toLowerCase().includes("no wallet has been connected")) {
    return "Connect a Stellar wallet first.";
  }
  return message || "Could not complete the Stellar payment.";
}
