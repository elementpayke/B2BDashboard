/** Parse dashboard BFF JSON once (avoids double `Response.json()` and empty bodies). */

export type BffEnvelope<T> = {
  status: "success" | "error";
  message?: string;
  data: T | null;
};

export async function readBffEnvelope<T>(res: Response): Promise<{
  ok: boolean;
  status: number;
  envelope: BffEnvelope<T> | null;
}> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: res.ok,
      status: res.status,
      envelope: null,
    };
  }
  try {
    const envelope = JSON.parse(text) as BffEnvelope<T>;
    const ok = res.ok && envelope.status === "success";
    return { ok, status: res.status, envelope };
  } catch {
    return { ok: false, status: res.status, envelope: null };
  }
}

export function bffErrorMessage(
  status: number,
  envelope: BffEnvelope<unknown> | null,
  fallback: string,
): string {
  return envelope?.message?.trim() || fallback || `Request failed (${status})`;
}
