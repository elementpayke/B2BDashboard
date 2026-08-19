"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildDepositQrValue } from "@/lib/deposit/qrPayload";

export type DepositAddressQrProps = {
  address: string;
  currency: string;
  network: string;
  networkLabel: string;
  amount?: string;
};

export default function DepositAddressQr({
  address,
  currency,
  network,
  networkLabel,
  amount,
}: DepositAddressQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const payload = buildDepositQrValue({ address, currency, network, amount });

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    QRCode.toDataURL(payload, {
      width: 176,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#131126", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (failed) return null;
  if (!dataUrl) {
    return <div className="ep-fund-sc__qr" aria-hidden />;
  }

  return (
    <figure className="ep-fund-sc__qr">
      <img
        className="ep-fund-sc__qr-img"
        src={dataUrl}
        width={176}
        height={176}
        alt={`QR code for ${currency} on ${networkLabel} deposit address`}
      />
      <figcaption className="ep-fund-sc__qr-caption">
        Scan with a {networkLabel} wallet
      </figcaption>
    </figure>
  );
}
