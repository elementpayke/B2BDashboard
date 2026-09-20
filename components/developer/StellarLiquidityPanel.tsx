"use client";

import { useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/apiClient";
import {
  liquidityApi,
  type StellarLiquiditySnapshot,
} from "@/lib/services/liquidity";

function formatRefreshTime(value: string | null): string {
  if (!value) return "Refresh time unavailable";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString();
}

export default function StellarLiquidityPanel() {
  const [snapshot, setSnapshot] = useState<StellarLiquiditySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const next = await liquidityApi.stellar();
        if (!cancelled) setSnapshot(next);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : "Couldn't load Stellar liquidity.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="ep-developer__card" aria-labelledby="stellar-liquidity-title">
      <div className="ep-developer__card-head">
        <div className="ep-developer__card-identity">
          <b id="stellar-liquidity-title" className="ep-developer__card-name">
            Ops liquidity
          </b>
          <span className="ep-developer__env">Stellar</span>
        </div>
      </div>

      <div className="ep-developer__field">
        <span className="ep-developer__field-label">Status</span>
        <span className="ep-developer__hint">
          {loading
            ? "Refreshing liquidity snapshot..."
            : `Updated ${formatRefreshTime(snapshot?.refreshed_at || null)}`}
        </span>
      </div>

      {error ? (
        <div className="ep-developer__empty" role="alert">
          {error}
        </div>
      ) : null}

      {!error && !loading && (snapshot?.pairs.length || 0) === 0 ? (
        <div className="ep-developer__empty" role="status">
          No Stellar liquidity pairs available right now.
        </div>
      ) : null}

      {(snapshot?.pairs || []).map((pair) => (
        <div key={pair.id} className="ep-developer__field">
          <span className="ep-developer__field-label">{pair.pair}</span>
          <div className="ep-secret-row">
            <span className="ep-secret-row__value">
              Bid {pair.bid || "-"} | Ask {pair.ask || "-"}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
