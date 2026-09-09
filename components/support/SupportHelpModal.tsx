"use client";

import { useState } from "react";
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_DISPLAY,
  supportMailtoHref,
  supportWhatsAppHref,
} from "@/lib/support/contacts";
import {
  SUPPORT_CATEGORIES,
  isSupportCategory,
  submitSupportIssue,
  type SupportCategory,
} from "@/lib/services/support";
import { ApiRequestError, isSessionExpiredError } from "@/lib/apiClient";

export type SupportHelpModalProps = {
  businessName: string;
  userEmail: string;
  screen: string;
  /** Prefill category when opened from a contextual CTA. */
  initialCategory?: SupportCategory;
  /** Prefill related transaction / order id when known. */
  initialReferenceId?: string;
  onDone: () => void;
};

export default function SupportHelpModal({
  businessName,
  userEmail,
  screen,
  initialCategory = "other",
  initialReferenceId = "",
  onDone,
}: SupportHelpModalProps) {
  const [category, setCategory] = useState<SupportCategory>(
    isSupportCategory(initialCategory) ? initialCategory : "other",
  );
  const [message, setMessage] = useState("");
  const [referenceId, setReferenceId] = useState(initialReferenceId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState<string | null>(null);

  const whatsappPrefill = [
    `Hi ElementPay support — I need help with my business dashboard.`,
    businessName ? `Business: ${businessName}` : "",
    userEmail ? `Email: ${userEmail}` : "",
    category ? `Topic: ${category}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError("Describe the issue in at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await submitSupportIssue({
        category,
        message: trimmed,
        screen,
        reference_id: referenceId.trim() || null,
      });
      setReference(result.reference);
    } catch (err) {
      if (isSessionExpiredError(err)) {
        setError("Your session expired. Sign in again, then retry.");
      } else if (err instanceof ApiRequestError) {
        setError(err.message || "Could not submit your message.");
      } else {
        setError("Could not submit your message. Try email or WhatsApp below.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <section className="ep-flow ep-flow--sheet ep-support" data-screen-label="Help">
        <div className="ep-support__success" role="status">
          <p className="ep-support__success-title">Message sent</p>
          <p className="ep-support__success-body">
            We received your issue. Reply reference{" "}
            <strong>{reference}</strong>. We’ll follow up by email
            {userEmail ? ` (${userEmail})` : ""}.
          </p>
        </div>
        <button type="button" className="ep-btn-primary" onClick={onDone}>
          Done
        </button>
      </section>
    );
  }

  return (
    <section className="ep-flow ep-flow--sheet ep-support" data-screen-label="Help">
      <p className="ep-support__intro">
        Reach us directly, or send a short report and we’ll email you back.
      </p>

      <div className="ep-support__channels" aria-label="Contact channels">
        <a className="ep-support__channel" href={supportMailtoHref("ElementPay support")}>
          <span className="ep-support__channel-label">Email</span>
          <span className="ep-support__channel-value">{SUPPORT_EMAIL}</span>
        </a>
        <a
          className="ep-support__channel"
          href={supportWhatsAppHref(whatsappPrefill)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="ep-support__channel-label">WhatsApp</span>
          <span className="ep-support__channel-value">{SUPPORT_WHATSAPP_DISPLAY}</span>
        </a>
      </div>

      <form className="ep-support__form" onSubmit={onSubmit}>
        <label className="ep-field">
          <span>Topic</span>
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              if (isSupportCategory(next)) setCategory(next);
            }}
          >
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="ep-field">
          <span>Related id (optional)</span>
          <input
            type="text"
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder="Transaction or order id"
            autoComplete="off"
          />
        </label>

        <label className="ep-field">
          <span>What happened?</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Tell us what went wrong and what you expected…"
            required
            minLength={10}
          />
        </label>

        {error ? (
          <div className="ep-money-banner ep-money-banner--danger" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" className="ep-btn-primary" disabled={submitting}>
          {submitting ? "Sending…" : "Send to support"}
        </button>
      </form>
    </section>
  );
}
