"use client";
import React from "react";

export type ReceiveModalProps = {
  receiveGroups: any[];
  receiveIsFiat: boolean;
  receiveIsCrypto: boolean;
  receiveAcctChips: any[];
  receiveAcctRail: string;
  receiveAcctLines: any[];
  receiveAssets: any[];
  receiveNetworks: any[];
  receiveAssetCode: string;
  receiveNetworkLabel: string;
  receiveAddress: string;
  copyReceiveAddress: () => void;
  receiveAddressCopied: boolean;
};

export default function ReceiveModal(p: ReceiveModalProps) {
  const hasAddress = Boolean(p.receiveAddress && p.receiveAddress !== "—");
  const hasFiatLines = (p.receiveAcctLines || []).length > 0;

  return (
    <div className="ep-money-flow">
      <p className="ep-money-lede">
        Share these coordinates with whoever is paying you — no action needed on your end until
        funds land.
      </p>

      <div className="ep-chip-row" role="group" aria-label="Receive method">
        {(p.receiveGroups || []).map((rg: any, i: number) => (
          <button
            key={i}
            type="button"
            onClick={rg.select}
            className="ep-money-choice"
            style={{ background: rg.bg, color: rg.color }}
          >
            {rg.label}
          </button>
        ))}
      </div>

      {p.receiveIsFiat ? (
        <>
          <div className="ep-money-field">
            <span className="ep-money-label" id="receive-country-label">
              Account country
            </span>
            <div className="ep-chip-row" role="group" aria-labelledby="receive-country-label">
              {(p.receiveAcctChips || []).map((c: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={c.select}
                  className="ep-money-choice ep-money-choice--flag ep-money-choice--outlined"
                  style={{
                    borderColor: c.border,
                    background: c.bg,
                    color: "var(--ink)",
                  }}
                >
                  <span
                    className="ep-flag"
                    style={{ backgroundImage: `url(${c.flagUrl})` }}
                    aria-hidden
                  />
                  <span>{c.code}</span>
                </button>
              ))}
            </div>
          </div>

          {p.receiveAcctRail ? <p className="ep-money-hint">{p.receiveAcctRail}</p> : null}

          {hasFiatLines ? (
            <div className="ep-money-acct" role="group" aria-label="Receive account details">
              {(p.receiveAcctLines || []).map((ln: any, i: number) => (
                <div key={i} className="ep-money-acct__row">
                  <span className="ep-money-acct__key">{ln.k}</span>
                  <span className="ep-money-acct__val">{ln.v}</span>
                  <button
                    type="button"
                    className="ep-money-copy"
                    onClick={ln.copy}
                    aria-label={`Copy ${ln.k}`}
                  >
                    {ln.copied ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="ep-money-empty" role="status">
              No local receive account for this selection yet.
            </div>
          )}
        </>
      ) : null}

      {p.receiveIsCrypto ? (
        <div className="ep-money-section ep-money-section--tight">
          <div className="ep-money-row-between">
            <span className="ep-money-label" id="receive-asset-label">
              Asset
            </span>
            <div className="ep-money-segment" role="group" aria-labelledby="receive-asset-label">
              {(p.receiveAssets || []).map((as: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={as.select}
                  className="ep-money-segment__btn"
                  style={{ background: as.bg, color: as.color }}
                >
                  {as.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-money-field">
            <span className="ep-money-label" id="receive-network-label">
              Network
            </span>
            <div className="ep-chip-row" role="group" aria-labelledby="receive-network-label">
              {(p.receiveNetworks || []).map((net: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={net.select}
                  className="ep-money-choice ep-money-choice--rail ep-money-choice--outlined"
                  style={{
                    borderColor: net.border,
                    background: net.bg,
                    color: net.color,
                  }}
                >
                  {net.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-money-alert ep-money-alert--warn" role="note">
            Only accept {p.receiveAssetCode} on {p.receiveNetworkLabel} — funds sent on other
            networks cannot be recovered.
          </div>

          {hasAddress ? (
            <div className="ep-money-address">
              <span className="ep-money-address__value" id="receive-address-value">
                {p.receiveAddress}
              </span>
              <button
                type="button"
                className="ep-money-copy"
                onClick={p.copyReceiveAddress}
                aria-describedby="receive-address-value"
              >
                <span aria-hidden>⧉</span>
                {p.receiveAddressCopied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : (
            <div className="ep-money-empty" role="status">
              Receive address unavailable. Connect a treasury wallet or try again later.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
