"use client";

import { useEffect, useState } from "react";

type ComingSoonPanelProps = {
  featureKey: string;
  title: string;
  description: string;
  /** Compact layout for modals */
  compact?: boolean;
};

function storageKey(featureKey: string) {
  return `ep-waitlist:${featureKey}`;
}

/**
 * Honest “not ready yet” surface with a local waitlist signup.
 * Persistence is device-local until a real waitlist API exists.
 */
export default function ComingSoonPanel({
  featureKey,
  title,
  description,
  compact = false,
}: ComingSoonPanelProps) {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(featureKey));
      if (raw) setJoined(true);
    } catch {
      /* ignore */
    }
  }, [featureKey]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid work email.");
      return;
    }
    try {
      window.localStorage.setItem(
        storageKey(featureKey),
        JSON.stringify({ email: value, at: new Date().toISOString() }),
      );
    } catch {
      /* still show success locally */
    }
    setError("");
    setJoined(true);
  };

  return (
    <div className={`ep-coming-soon${compact ? " ep-coming-soon--compact" : ""}`}>
      <span className="ep-coming-soon__badge">Coming soon</span>
      <h2 className="ep-coming-soon__title">{title}</h2>
      <p className="ep-coming-soon__body">{description}</p>

      {joined ? (
        <p className="ep-coming-soon__joined" role="status">
          You’re on the waitlist — we’ll email you when this ships.
        </p>
      ) : (
        <form className="ep-coming-soon__form" onSubmit={onSubmit}>
          <label className="ep-coming-soon__label">
            <span className="ep-activity__sr">Work email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>
          <button type="submit" className="ep-coming-soon__cta">
            Join waitlist
          </button>
          {error ? (
            <span className="ep-coming-soon__error" role="alert">
              {error}
            </span>
          ) : null}
        </form>
      )}
    </div>
  );
}
