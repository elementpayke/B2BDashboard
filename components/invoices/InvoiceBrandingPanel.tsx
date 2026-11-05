"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoiceBrandingApi, readLogoFile } from "@/lib/services/invoiceBranding";

export default function InvoiceBrandingPanel() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [issuerName, setIssuerName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const brandingQuery = useQuery({
    queryKey: ["invoice-branding"],
    queryFn: () => invoiceBrandingApi.get(),
    retry: false,
  });

  const branding = brandingQuery.data;

  useEffect(() => {
    if (!open || !branding) return;
    setIssuerName(branding.issuer_name ?? "");
    setAddressText((branding.address_lines ?? []).join("\n"));
  }, [open, branding]);

  const saveMutation = useMutation({
    mutationFn: async (input: { logo?: string; clearLogo?: boolean }) => {
      const lines = addressText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const body: Parameters<typeof invoiceBrandingApi.update>[0] = {
        issuer_name: issuerName.trim() || null,
        address_lines: lines,
      };
      if (input.clearLogo) body.clear_logo = true;
      if (input.logo) body.logo_data_url = input.logo;
      return invoiceBrandingApi.update(body);
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["invoice-branding"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save branding"),
  });

  async function onPickLogo(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readLogoFile(file);
      await saveMutation.mutateAsync({ logo: dataUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid logo");
    }
  }

  return (
    <section className="ep-panel ep-invoices-branding">
      <button
        type="button"
        className="ep-invoices-branding__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="ep-invoices-branding__toggle-main">
          {branding?.logo_data_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_data_url} alt="Your logo" className="ep-invoices-branding__toggle-logo" />
          ) : (
            <span className="ep-invoices-branding__toggle-logo ep-invoices-branding__toggle-logo--empty" aria-hidden>
              +
            </span>
          )}
          <span className="ep-invoices-branding__toggle-text">
            <strong>Invoice appearance</strong>
            <span className="ep-invoices-muted">
              {branding?.logo_data_url ? "Logo added — shown on every invoice" : "Add your logo — shown on every invoice"}
            </span>
          </span>
        </span>
        <span className="ep-invoices-muted">{open ? "Hide" : "Edit"}</span>
      </button>
      {open ? (
        <div className="ep-invoices-branding__body">
          {brandingQuery.isLoading ? (
            <p className="ep-invoices-muted">Loading…</p>
          ) : brandingQuery.isError ? (
            <p className="ep-invoices-muted">
              Company logo and PDF header settings need the latest Mboka backend (invoice branding API).
            </p>
          ) : (
            <>
              <p className="ep-invoices-muted">
                Shown in the &quot;Issued by&quot; block and at the top of downloaded PDFs.
              </p>
              <label className="ep-invoices-branding__field">
                <span className="ep-invoices-field-label">Company name on invoice</span>
                <input
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="Your legal or trading name"
                />
              </label>
              <label className="ep-invoices-branding__field">
                <span className="ep-invoices-field-label">Address (one line per row)</span>
                <textarea
                  rows={3}
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder={"Street\nCity, Country"}
                />
              </label>
              <div className="ep-invoices-branding__logo-row">
                {branding?.logo_data_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={branding.logo_data_url}
                    alt="Invoice logo preview"
                    className="ep-invoices-branding__logo-preview"
                  />
                ) : (
                  <div className="ep-invoices-branding__logo-placeholder">No logo</div>
                )}
                <div className="ep-invoices-branding__logo-actions">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="ep-sr-only"
                    onChange={(e) => void onPickLogo(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="ep-invoices-btn ep-invoices-btn--secondary"
                    onClick={() => fileRef.current?.click()}
                    disabled={saveMutation.isPending}
                  >
                    Upload logo
                  </button>
                  {branding?.logo_data_url ? (
                    <button
                      type="button"
                      className="ep-invoices-btn ep-invoices-btn--ghost"
                      disabled={saveMutation.isPending}
                      onClick={() => void saveMutation.mutateAsync({ clearLogo: true })}
                    >
                      Remove logo
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="ep-invoices-inline-actions">
                <button
                  type="button"
                  className="ep-invoices-btn ep-invoices-btn--primary"
                  disabled={saveMutation.isPending}
                  onClick={() => void saveMutation.mutateAsync({})}
                >
                  Save details
                </button>
              </div>
              {error ? (
                <p className="ep-invoices-error" role="alert">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
