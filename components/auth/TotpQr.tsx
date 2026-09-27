"use client";

// Renders an `otpauth://` URI as a scannable QR code. Mirrors
// components/wallets/DepositAddressQr.tsx's client-side rendering approach
// with the already-installed `qrcode` package.

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function TotpQr({ otpauthUri }: { otpauthUri: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDataUrl(null);
    QRCode.toDataURL(otpauthUri, {
      width: 200,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#131126", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  if (failed) {
    return (
      <p style={{ fontSize: "13px", color: "var(--ink-muted, #6b7280)" }}>
        Couldn&apos;t generate a QR code. Enter the setup key manually below instead.
      </p>
    );
  }

  if (!dataUrl) {
    return (
      <div
        aria-hidden
        style={{
          width: 200,
          height: 200,
          borderRadius: 12,
          background: "var(--surface-muted, rgba(0,0,0,0.04))",
        }}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={200}
      height={200}
      alt="Scan this QR code with your authenticator app"
      style={{ borderRadius: 12, display: "block" }}
    />
  );
}
