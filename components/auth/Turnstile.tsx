"use client";

import { useEffect, useId, useRef } from "react";
import Script from "next/script";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type TurnstileWidgetId = string;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => TurnstileWidgetId;
  remove: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Renders a Cloudflare Turnstile challenge and reports the resulting token
 * (or its loss, on expiry/error) to the caller. Mounting is skipped entirely
 * when `siteKey` is empty so local dev without Cloudflare keys isn't blocked
 * — pair with `lib/server/turnstile.ts`, which treats a missing secret key
 * the same way on the server side.
 */
export default function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const containerId = useId();
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);

  // `onReady` fires once the script has loaded and again on every mount —
  // exactly when a widget needs (re-)rendering into our container.
  function renderWidget() {
    const container = document.getElementById(containerId);
    const api = window.turnstile;
    if (!container || !api) return;
    widgetIdRef.current = api.render(container, {
      sitekey: siteKey,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
  }

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  if (!siteKey) return null;

  return (
    <>
      <Script src={SCRIPT_SRC} strategy="afterInteractive" onReady={renderWidget} />
      <div id={containerId} />
    </>
  );
}
