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
  const [qr, setQr] = useState<{ payload: string; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const payload = buildDepositQrValue({ address, currency, network, amount });

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    QRCode.toDataURL(payload, {
      width: 176,
      margin: 4,
      errorCorrectionLevel: "M",
      color: { dark: "#131126", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQr({ payload, url });
      })
      .catch(() => {
        if (!cancelled) {
          setQr(null);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (failed) {
    return (
      <figure className="ep-fund-sc__qr">
        <figcaption className="ep-fund-sc__qr-caption">
          Couldn't generate a QR code. Copy the address instead.
        </figcaption>
      </figure>
    );
  }

  const dataUrl = qr && qr.payload === payload ? qr.url : null;
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
