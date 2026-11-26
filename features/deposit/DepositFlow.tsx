"use client";
import * as React from "react";
import CoinMark, { isCoinMarkAsset } from "@/components/brand/CoinMark";
import MbokaLogo from "@/components/brand/MbokaLogo";
import MobileMoneyMark from "@/components/money/MobileMoneyMark";
import { NetworkListIcon } from "@/components/brand/NetworkMark";
import {
  ChoiceChip,
  DetailRow,
  Flag,
  GlyphTile,
  Initials,
  MoneyText,
  Notice,
  PickList,
  PickRow,
  SearchBox,
  StepHeading,
} from "@/components/patterns/flow";
import { formatAmount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import ChoicePicker from "@/components/ui/ChoicePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { BANK_SEARCH_THRESHOLD } from "@/lib/hooks/depositFlowHelpers";
import { cn } from "@/lib/utils";
import BankDetails from "./BankDetails";
import DepositStatus from "./DepositStatus";
import FiatAccountDetails from "./FiatAccountDetails";
import InteracFund from "./InteracFund";
import StablecoinAddress from "./StablecoinAddress";
import type { DepositFlowProps, DepositMethod } from "./types";

type View = "account" | "method" | "country" | "provider" | "network" | "interac" | "fiat";
type Screen = View | "amount" | "review" | "address";

const TITLE_ID = "deposit-flow-title";

// Phosphor duotone paths (MIT): device-mobile, bank, coin, envelope.
const GLYPHS: Record<DepositMethod, { back: string; front: string }> = {
  mobile: {
    back: "M184,24H72A16,16,0,0,0,56,40V216a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V40A16,16,0,0,0,184,24Z",
    front:
      "M184,16H72A24,24,0,0,0,48,40V216a24,24,0,0,0,24,24H184a24,24,0,0,0,24-24V40A24,24,0,0,0,184,16Zm8,200a8,8,0,0,1-8,8H72a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8ZM140,60a12,12,0,1,1-12-12A12,12,0,0,1,140,60Z",
  },
  bank: {
    back: "M232,96H24L128,32Z",
    front:
      "M24,104H48v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16H208V104h24a8,8,0,0,0,4.19-14.81l-104-64a8,8,0,0,0-8.38,0l-104,64A8,8,0,0,0,24,104Zm40,0H96v64H64Zm80,0v64H112V104Zm48,64H160V104h32ZM128,41.39,203.74,88H52.26ZM248,208a8,8,0,0,1-8,8H16a8,8,0,0,1,0-16H240A8,8,0,0,1,248,208Z",
  },
  crypto: {
    back: "M128,32a96,96,0,1,0,96,96A96,96,0,0,0,128,32Z",
    front:
      "M128,24A104,104,0,1,0,232,128,104,104,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88,88,0,0,1,128,216Zm0-136a48,48,0,1,0,48,48A48,48,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z",
  },
  interac: {
    back: "M224,56l-96,88L32,56Z",
    front:
      "M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z",
  },
};

const METHOD_COPY: Record<DepositMethod, { label: string; desc: string }> = {
  mobile: { label: "Mobile money", desc: "Pay from a mobile money wallet with a prompt to approve" },
  bank: { label: "Bank transfer", desc: "Pay from your business bank to details we give you" },
  crypto: { label: "Stablecoin", desc: "USDC, EURC or USDT from another wallet or exchange" },
  interac: { label: "Interac e-Transfer", desc: "Request CAD from a Canadian bank by email" },
};

function RateHeld({ expiresAt }: { expiresAt: string | null | undefined }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  const end = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  if (Number.isNaN(end)) return null;
  const left = Math.max(0, Math.round((end - now) / 1000));
  return (
    <p role="status" className="text-center text-body text-warning-text">
      {left > 0 ? (
        <>
          Rate held for{" "}
          <span className="font-mono">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        </>
      ) : (
        "This rate has run out. Go back and continue again for a new one."
      )}
    </p>
  );
}

function useExpired(expiresAt: string | null | undefined): boolean {
  const end = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (Number.isNaN(end)) return undefined;
    const t = window.setTimeout(() => setNow(Date.now()), Math.max(0, end - Date.now()) + 50);
    return () => window.clearTimeout(t);
  }, [end]);
  return !Number.isNaN(end) && end <= now;
}

/** A network's brand mark with the coin as a small badge, or the coin alone. */
function AssetMark({ asset, network, label }: { asset?: string; network?: string; label: string }) {
  const coin = isCoinMarkAsset(asset) ? asset.toUpperCase() : null;
  if (network) {
    return (
      <span aria-hidden className="relative flex size-11 shrink-0 items-center justify-center">
        <NetworkListIcon network={network} label={network} size={44} />
        {coin && isCoinMarkAsset(coin) ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex rounded-pill bg-card p-0.5">
            <CoinMark asset={coin} size={18} title={null} />
          </span>
        ) : null}
      </span>
    );
  }
  if (coin && isCoinMarkAsset(coin)) {
    return (
      <span aria-hidden className="flex shrink-0">
        <CoinMark asset={coin} size={44} title={null} />
      </span>
    );
  }
  return <Initials name={label} />;
}

function money(amount: string, currency: string): string {
  const n = formatAmount(amount.replace(/,/g, ""), 2);
  return n ? `${n} ${currency}` : "";
}

/**
 * Full-screen Add money flow: which account → how the money comes in → where
 * from → how much → check and pay, then one ending. Same shell as Send.
 * Presentational for mobile money, bank and stablecoin (state lives in
 * DashboardApp); Interac drives its own payment request.
 */
export default function DepositFlow({ containerRef, ...p }: DepositFlowProps) {
  const interacAccounts = p.interacAccounts ?? [];
  const lockedInterac = p.interacLockedAccountId
    ? interacAccounts.find((a) => a.id === p.interacLockedAccountId) ?? null
    : null;
  const fiatAccounts = p.fiatAccounts ?? [];
  const lockedFiat = p.fiatLockedAccountId
    ? fiatAccounts.find((a) => a.id === p.fiatLockedAccountId) ?? null
    : null;
  const locked = Boolean(p.walletLocked || lockedInterac || lockedFiat);

  const resumeFiat = !locked && p.fiatResumeAccountId
    ? fiatAccounts.find((a) => a.id === p.fiatResumeAccountId) ?? null
    : null;
  const [view, setView] = React.useState<View>(locked || resumeFiat ? "method" : "account");
  const [fiatId, setFiatId] = React.useState<string | null>(lockedFiat?.id ?? resumeFiat?.id ?? null);
  const [method, setMethod] = React.useState<DepositMethod | null>(null);
  const [interacId, setInteracId] = React.useState<string | null>(lockedInterac?.id ?? null);
  const [query, setQuery] = React.useState("");

  const interacAccount = interacAccounts.find((a) => a.id === interacId) ?? null;
  const fiatAccount = fiatAccounts.find((a) => a.id === fiatId) ?? null;
  const onOpenFiatAccount = p.onOpenFiatAccount;
  const lockedFiatId = lockedFiat?.id ?? null;
  const syncedFiatRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    // Opened from inside the account: refresh its details once, as a pick does.
    if (!lockedFiatId || syncedFiatRef.current === lockedFiatId) return;
    syncedFiatRef.current = lockedFiatId;
    onOpenFiatAccount?.(lockedFiatId);
  }, [lockedFiatId, onOpenFiatAccount]);

  const selectedRail = p.railGroups.find((g) => g.providers.some((pr) => pr.selected));
  const railType: "mobile" | "bank" = selectedRail?.type ?? (method === "bank" ? "bank" : "mobile");
  const isBank = railType === "bank";

  const screen: Screen = p.stepIs3
    ? "review"
    : p.stepIs2 && p.group === "crypto"
      ? "address"
      : p.stepIs2
        ? "amount"
        : view;

  const fiatConverting = Boolean(fiatAccount && (method === "mobile" || method === "bank"));
  const path: Screen[] = fiatAccount && !fiatConverting ? [
    ...(locked ? [] : (["account"] as Screen[])),
    "method",
    "fiat",
  ] : [
    ...(locked ? [] : (["account"] as Screen[])),
    "method",
    ...((method === "crypto" || (method === null && p.group === "crypto" && p.stepIs2)
      ? ["network", "address"]
      : method === "interac"
        ? ["interac"]
        : ["country", "provider", "amount", "review"]) as Screen[]),
  ];
  const position = Math.max(1, path.indexOf(screen) + 1);

  const go = (next: View) => {
    setQuery("");
    setView(next);
  };

  const pickMethod = (m: DepositMethod) => {
    setMethod(m);
    if (m === "interac") return go("interac");
    if (m === "crypto") {
      p.setGroup("crypto");
      return go("network");
    }
    p.setGroup("country");
    go("country");
  };

  const intoLabel = interacAccount?.label || fiatAccount?.label || p.walletLabel || "account";
  const payText = money(p.amount, p.currency);
  const payerText = isBank ? p.phone.trim() : `${p.dialCode} ${p.phone.trim()}`.trim();
  const expired = useExpired(p.stepIs3 ? p.quoteExpiresAt : null);

  const intoChip = !locked ? (
    <ChoiceChip label="account" onChange={() => go("account")}>
      Into {intoLabel}
    </ChoiceChip>
  ) : null;
  const methodChip = method ? (
    <ChoiceChip label="method" onChange={() => go("method")}>
      {METHOD_COPY[method].label}
    </ChoiceChip>
  ) : null;

  let body: React.ReactNode;

  if (p.done && p.group === "country") {
    body = isBank ? (
      <BankDetails
        payText={payText}
        feeText={p.feeText}
        rateLine={p.rateLine}
        receiveText={p.receiveText}
        arrival={p.bankArrival}
        rows={p.bankLines}
        onSent={p.close}
      />
    ) : (
      <DepositStatus
        kind={p.outcome === "received" ? "received" : p.outcome === "failed" ? "failed" : "waiting-phone"}
        paidText={payText}
        receivedText={p.receiveText}
        intoLabel={intoLabel}
        payerLabel={payerText}
        providerLabel={p.providerLabel}
        reference={p.orderId ? `#${p.orderId}` : null}
        failureMessage={p.failureMessage}
        convertNote={p.fundTargetCurrency ? { currency: p.fundTargetCurrency, status: p.fundConvertStatus, error: p.fundConvertError } : null}
        onDone={p.close}
        onRetry={p.retry}
        onHelp={p.onHelp}
      />
    );
  } else if (screen === "fiat" && fiatAccount) {
    body = (
      <FiatAccountDetails
        account={fiatAccount}
        titleId={TITLE_ID}
        onBack={() => go("method")}
        onDone={p.close}
      />
    );
  } else if (screen === "interac" && interacAccount) {
    body = (
      <InteracFund
        account={interacAccount}
        payerName={p.interacPayerName || interacAccount.label}
        defaultEmail={p.interacDefaultEmail || ""}
        onBack={() => go("method")}
        onDone={p.close}
        onHelp={p.onHelp}
      />
    );
  } else if (screen === "review") {
    body = (
      <>
        <StepHeading title="Check and pay" centered titleId={TITLE_ID} />
        <section aria-label="Top-up summary" className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="min-w-0">
              <p className="text-dense text-muted-foreground">You pay</p>
              <MoneyText text={payText} size="lg" />
              <p className="truncate text-dense text-muted-foreground">from {p.providerLabel}</p>
            </div>
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <div className="min-w-0 text-right">
              <p className="text-dense text-muted-foreground">You get</p>
              <MoneyText text={p.receiveText} size="lg" className="text-link" />
              <p className="truncate text-dense text-muted-foreground">into {intoLabel}</p>
            </div>
          </div>
          <dl className="divide-y divide-border border-t border-border">
            <DetailRow label="From">
              <strong className="block font-semibold">
                {p.providerLabel}
                {p.countryName ? ` · ${p.countryName}` : ""}
              </strong>
              <span className="block font-mono text-muted-foreground">{payerText}</span>
            </DetailRow>
            <DetailRow label="Into">{intoLabel}</DetailRow>
            <DetailRow label="Fees · paid by you">
              <span className="font-mono">{p.feeText || "—"}</span>
            </DetailRow>
            {p.rateLine ? (
              <DetailRow label="Rate">
                <span className="font-mono">{p.rateLine}</span>
              </DetailRow>
            ) : null}
            <DetailRow label="Arrives">{isBank ? p.bankArrival : p.arrivalText}</DetailRow>
          </dl>
        </section>

        {p.acceptError ? <Notice tone="danger">{p.acceptError}</Notice> : null}
        <RateHeld expiresAt={p.quoteExpiresAt} />
        <p className="text-center text-body text-muted-foreground">
          {isBank
            ? "Next you get the bank details and a reference to pay with."
            : `We’ll send a ${p.providerLabel} prompt to ${payerText}. Approve it with the PIN to pay.`}
        </p>

        <div className="flex justify-center gap-2.5">
          <Button variant="secondary" className="rounded-pill px-5" onClick={p.back} disabled={p.accepting}>
            <span aria-hidden>←</span> Back
          </Button>
          <Button className="rounded-pill px-7" loading={p.accepting} disabled={expired} onClick={p.submit}>
            {isBank ? "Get bank details" : `Pay ${payText}`}
          </Button>
        </div>
      </>
    );
  } else if (screen === "amount") {
    const ready = Boolean(p.phone.trim() && p.amount.trim()) && !p.limitError && !p.quoteLoading;
    body = (
      <>
        <StepHeading
          title="How much?"
          centered
          titleId={TITLE_ID}
          sub={
            <>
              From <strong className="font-semibold text-foreground">{p.providerLabel}</strong>
              {p.countryName ? ` · ${p.countryName}` : ""} into{" "}
              <strong className="font-semibold text-foreground">{intoLabel}</strong>
            </>
          }
        />
        <section aria-label="Amount and payer" className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5">
          <Field label={p.payerLabel} hint={isBank ? undefined : "The prompt goes to this phone. It doesn’t have to be yours."}>
            {(a11y) =>
              isBank ? (
                <Input {...a11y} className="h-14" value={p.phone} onChange={p.setPhone} placeholder={p.payerPlaceholder} autoComplete="off" />
              ) : (
                <div className="flex h-14 items-center overflow-hidden rounded-md border border-input bg-input-background focus-within:shadow-focus">
                  <span className="flex h-full items-center border-r border-border px-3.5 font-mono text-lead text-muted-foreground">
                    {p.dialCode}
                  </span>
                  <input
                    {...a11y}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-3.5 font-mono text-title text-foreground outline-none"
                    value={p.phone}
                    onChange={p.setPhone}
                    placeholder={p.payerPlaceholder}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              )
            }
          </Field>
          <div className="flex flex-col items-center gap-2 border-t border-border pt-5">
            <span className="rounded-pill bg-accent px-2.5 py-1 font-display text-caption font-bold uppercase tracking-overline text-accent-foreground">
              You pay <span aria-hidden>↗</span>
            </span>
            <Field label={`Amount (${p.currency})`} className="w-full items-center" error={p.limitError || undefined}>
              <Input
                className={cn(
                  "h-16 border-0 bg-transparent text-center font-display text-hero font-bold tracking-display desktop:text-hero",
                  p.limitError && "text-destructive-text",
                )}
                value={p.amount}
                onChange={p.setAmount}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>
            {p.limitsText ? <p className="text-body text-muted-foreground">{p.limitsText}</p> : null}
          </div>
        </section>

        {p.quoteError ? <Notice tone="danger">{p.quoteError}</Notice> : null}
        <p className="text-center text-body text-muted-foreground">
          Nothing is charged yet. The fee and rate are shown on the next step, before anything is charged.
        </p>
        <div className="flex justify-center gap-2.5">
          <Button
            variant="secondary"
            className="rounded-pill px-5"
            onClick={() => {
              p.back();
              setView("provider");
            }}
          >
            <span aria-hidden>←</span> Back
          </Button>
          <Button className="rounded-pill px-7" disabled={!ready} loading={p.quoteLoading} onClick={p.next}>
            {p.quoteLoading ? "Getting quote…" : "Continue"}
          </Button>
        </div>
      </>
    );
  } else if (screen === "address") {
    body = (
      <StablecoinAddress
        assetCode={p.assetCode}
        networkKey={p.networkKey}
        networkLabel={p.networkLabel}
        address={p.address}
        addressEmptyMessage={p.addressEmptyMessage}
        createAccount={p.createAccount}
        createAccountLabel={p.createAccountLabel}
        intoLabel={intoLabel}
        onChangeNetwork={() => {
          p.back();
          setMethod("crypto");
          setView("network");
        }}
        onDone={p.close}
      />
    );
  } else if (screen === "network") {
    const picked = p.networks.some((n) => n.selected);
    body = (
      <>
        <StepHeading
          title="What are you sending?"
          titleId={TITLE_ID}
          onBack={() => go("method")}
          chips={
            <>
              {methodChip}
              {intoChip}
            </>
          }
          sub="Pick the coin and the network it’s on now."
        />
        {p.assets.length > 1 ? (
          <div role="group" aria-label="Coin" className="flex flex-wrap gap-1.5">
            {p.assets.map((a) => (
              <Button
                key={a.key}
                size="sm"
                variant={a.selected ? "primary" : "secondary"}
                aria-pressed={a.selected}
                onClick={a.select}
              >
                {a.label}
              </Button>
            ))}
          </div>
        ) : null}
        <PickList label="Network">
          {p.networks.map((n) => (
            <PickRow
              key={n.key}
              leading={<AssetMark asset={p.assetCode} network={n.label} label={n.label} />}
              title={`${p.assetCode} on ${n.label}`}
              meta={n.key === "stellar" ? "Scan, copy or connect a Stellar wallet" : "Scan or copy the address"}
              selected={n.selected}
              onClick={n.select}
            />
          ))}
        </PickList>
        <div className="flex justify-center">
          <Button className="rounded-pill px-8" disabled={!picked} onClick={p.next}>
            Continue
          </Button>
        </div>
      </>
    );
  } else if (screen === "provider") {
    const groups = p.railGroups.filter((g) => g.type === (method === "bank" ? "bank" : "mobile"));
    const providers = groups.flatMap((g) => g.providers);
    const picked = providers.some((pr) => pr.selected);
    body = (
      <>
        <StepHeading
          title={method === "bank" ? "Which bank?" : "Which provider?"}
          titleId={TITLE_ID}
          onBack={() => go("country")}
          chips={
            <>
              {methodChip}
              <ChoiceChip label="country" onChange={() => go("country")}>
                <Flag url={p.countryFlagUrl} className="size-4" />
                {p.countryName} · {p.currency}
              </ChoiceChip>
            </>
          }
          sub={method === "bank" ? "The bank you’ll pay from." : "We send a payment prompt to this account’s phone."}
        />
        {providers.length === 0 ? (
          <Notice tone="info" role="status">
            No {method === "bank" ? "banks" : "providers"} take top-ups here yet. Pick another country or method.
          </Notice>
        ) : providers.length > BANK_SEARCH_THRESHOLD ? (
          <ChoicePicker
            id="deposit-provider"
            label={method === "bank" ? "Bank" : "Provider"}
            title={method === "bank" ? "Choose a bank" : "Choose a provider"}
            placeholder={method === "bank" ? "Choose your bank" : "Choose your provider"}
            searchable
            value={providers.find((pr) => pr.selected)?.name ?? ""}
            options={providers.map((pr) => ({ value: pr.name, label: pr.displayLabel || pr.name }))}
            onChange={(name) => providers.find((pr) => pr.name === name)?.select()}
          />
        ) : (
          <PickList label={method === "bank" ? "Bank" : "Provider"}>
            {providers.map((pr) => (
              <PickRow
                key={pr.name}
                leading={
                  method === "bank" ? (
                    <Initials name={pr.displayLabel || pr.name} />
                  ) : (
                    <span aria-hidden className="flex shrink-0 overflow-hidden rounded-pill shadow-hairline">
                      <MobileMoneyMark name={pr.name} size={44} />
                    </span>
                  )
                }
                title={pr.displayLabel || pr.name}
                selected={pr.selected}
                onClick={pr.select}
              />
            ))}
          </PickList>
        )}
        {providers.length > 0 && p.limitsText ? (
          <p className="text-body text-muted-foreground">Limits: {p.limitsText}</p>
        ) : null}
        <div className="flex justify-center">
          <Button className="rounded-pill px-8" disabled={!picked} onClick={p.next}>
            Continue
          </Button>
        </div>
      </>
    );
  } else if (screen === "country") {
    const want = method === "bank" ? "bank" : "mobile";
    const q = query.trim().toLowerCase();
    const rows = p.countryRows
      .filter((r) => r.railTypes.includes(want))
      .filter((r) => !q || [r.name, r.code, ...r.providerNames].join(" ").toLowerCase().includes(q));
    body = (
      <>
        <StepHeading
          title="Which country?"
          titleId={TITLE_ID}
          onBack={() => go("method")}
          chips={
            <>
              {methodChip}
              {intoChip}
            </>
          }
          sub={method === "bank" ? "Where the bank account is." : "Where the mobile money account is registered."}
        />
        {p.catalogError && p.countryRows.length === 0 ? (
          <Notice tone="danger">
            <p>{p.catalogError}</p>
            {p.onRetryCatalog ? (
              <Button variant="secondary" size="sm" className="mt-2" onClick={p.onRetryCatalog}>
                Try again
              </Button>
            ) : null}
          </Notice>
        ) : p.catalogLoading && p.countryRows.length === 0 ? (
          <div role="status" aria-label="Loading countries" className="flex flex-col gap-2">
            <Skeleton className="h-18 rounded-2xl" />
            <Skeleton className="h-18 rounded-2xl" />
          </div>
        ) : (
          <>
            <SearchBox label="Search country or currency" placeholder="Search country or currency" value={query} onChange={setQuery} />
            {rows.length === 0 ? (
              <p role="status" className="text-center text-body text-muted-foreground">
                {q ? `No country matches “${query.trim()}”.` : "No countries take this method yet."}
              </p>
            ) : (
              <PickList label="Country">
                {rows.map((r) => (
                  <PickRow
                    key={r.idx}
                    leading={<Flag url={r.flagUrl} className="size-8" />}
                    title={r.name}
                    meta={[r.code, r.providerNames.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
                    selected={p.countryName === r.name}
                    onClick={() => {
                      r.select();
                      go("provider");
                    }}
                  />
                ))}
              </PickList>
            )}
          </>
        )}
      </>
    );
  } else if (screen === "method" && fiatAccount) {
    const cur = fiatAccount.currency;
    const ways: { key: string; glyph: DepositMethod; label: string; desc: string; pick: () => void }[] = [
      {
        key: "details",
        glyph: "bank",
        label: "Bank transfer",
        desc: `Send ${cur} from any bank to this account’s details`,
        pick: () => {
          setMethod(null);
          go("fiat");
        },
      },
    ];
    if (fiatAccount.convertFund) {
      const convert = (m: "mobile" | "bank") => () => {
        p.onFiatConvertFund?.(fiatAccount.id);
        pickMethod(m);
      };
      ways.push(
        {
          key: "mobile",
          glyph: "mobile",
          label: "Mobile money",
          desc: `Pay in local currency from a mobile wallet. We convert it to ${cur}.`,
          pick: convert("mobile"),
        },
        {
          key: "bank",
          glyph: "bank",
          label: "African bank",
          desc: `Pay in local currency from a bank in Africa. We convert it to ${cur}.`,
          pick: convert("bank"),
        },
      );
    }
    if (fiatAccount.openBanking) {
      ways.push({
        key: "open-banking",
        glyph: "interac",
        label: "Open banking",
        desc: `Send an open banking payment request for ${cur}`,
        pick: () => p.onFiatOpenBanking?.(fiatAccount.id),
      });
    }
    body = (
      <>
        <StepHeading
          title="Add money"
          titleId={TITLE_ID}
          sub="How is the money coming in?"
          onBack={locked ? undefined : () => go("account")}
          chips={intoChip}
        />
        <PickList label="Ways to add money">
          {ways.map((w) => (
            <PickRow
              key={w.key}
              leading={<GlyphTile {...GLYPHS[w.glyph]} />}
              title={w.label}
              meta={w.desc}
              onClick={w.pick}
            />
          ))}
        </PickList>
      </>
    );
  } else if (screen === "method") {
    const hasRail = (t: "mobile" | "bank") =>
      p.catalogLoading || Boolean(p.catalogError) || p.countryRows.some((r) => r.railTypes.includes(t));
    const methods: DepositMethod[] = interacAccount
      ? ["interac"]
      : ([hasRail("mobile") ? "mobile" : null, hasRail("bank") ? "bank" : null, "crypto"].filter(Boolean) as DepositMethod[]);
    body = (
      <>
        <StepHeading
          title="Add money"
          titleId={TITLE_ID}
          sub="How is the money coming in?"
          onBack={locked ? undefined : () => go("account")}
          chips={intoChip}
        />
        <PickList label="Ways to add money">
          {methods.map((m) => (
            <PickRow
              key={m}
              leading={<GlyphTile {...GLYPHS[m]} />}
              title={METHOD_COPY[m].label}
              meta={METHOD_COPY[m].desc}
              onClick={() => pickMethod(m)}
            />
          ))}
        </PickList>
        <p className="text-body text-muted-foreground">
          You see the fee, the rate and what lands in your account before you pay.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <StepHeading title="Add money" titleId={TITLE_ID} sub="Which account are you funding?" />
        {p.walletsError && p.walletOptions.length === 0 ? (
          <Notice tone="danger">
            <p>{p.walletsError}</p>
            {p.onRetryWallets ? (
              <Button variant="secondary" size="sm" className="mt-2" onClick={p.onRetryWallets}>
                Try again
              </Button>
            ) : null}
          </Notice>
        ) : p.walletsLoading && p.walletOptions.length === 0 ? (
          <div role="status" aria-label="Loading accounts" className="flex flex-col gap-2">
            <Skeleton className="h-18 rounded-2xl" />
            <Skeleton className="h-18 rounded-2xl" />
          </div>
        ) : (
          <PickList label="Account to fund">
            {p.walletOptions.map((w) => (
              <PickRow
                key={w.value}
                leading={<AssetMark asset={w.asset} network={w.network} label={w.label} />}
                title={w.label}
                meta={w.meta || undefined}
                selected={!interacId && !fiatId && p.walletId === w.value}
                trailing={<span className="font-mono text-body-lg text-foreground">{w.balanceText || "—"}</span>}
                onClick={() => {
                  setInteracId(null);
                  setFiatId(null);
                  p.selectWallet(w.value);
                  go("method");
                }}
              />
            ))}
            {interacAccounts.map((a) => (
              <PickRow
                key={a.id}
                leading={<Initials name={a.label} />}
                title={a.label}
                meta="Fund by Interac e-Transfer"
                selected={interacId === a.id}
                trailing={<span className="font-mono text-body-lg text-foreground">{a.balanceText || "—"}</span>}
                onClick={() => {
                  setInteracId(a.id);
                  setFiatId(null);
                  setMethod(null);
                  go("method");
                }}
              />
            ))}
            {fiatAccounts.map((a) => (
              <PickRow
                key={a.id}
                leading={<Initials name={a.label} />}
                title={a.label}
                selected={fiatId === a.id}
                trailing={<span className="font-mono text-body-lg text-foreground">{a.balanceText || "—"}</span>}
                onClick={() => {
                  setFiatId(a.id);
                  setInteracId(null);
                  setMethod(null);
                  p.onOpenFiatAccount?.(a.id);
                  go("method");
                }}
              />
            ))}
          </PickList>
        )}
      </>
    );
  }

  const ended = p.done && p.group === "country";

  return (
    <div
      ref={containerRef}
      data-slot="deposit-flow"
      data-screen-label="Add money"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      className="fixed inset-0 z-100 flex flex-col overflow-y-auto bg-background font-body text-foreground"
    >
      {ended ? null : (
        <>
          <header className="flex items-center justify-between px-3 py-2.5 desktop:px-6 desktop:py-4">
            <MbokaLogo size={28} />
            <span className="text-dense font-semibold text-muted-foreground">
              Step {position} of {path.length}
            </span>
            <button
              type="button"
              onClick={p.close}
              aria-label="Close"
              className="flex size-11 cursor-pointer items-center justify-center rounded-pill bg-muted text-foreground outline-none focus-visible:shadow-focus"
            >
              <span aria-hidden>✕</span>
            </button>
          </header>
          <div
            role="progressbar"
            aria-label="Add money progress"
            aria-valuemin={1}
            aria-valuemax={path.length}
            aria-valuenow={position}
            className="h-0.75 shrink-0 bg-muted"
          >
            <div
              className="h-full bg-primary transition-[width] duration-250 ease-standard"
              style={{ width: `${Math.round((position / path.length) * 100)}%` }}
            />
          </div>
        </>
      )}
      <main
        className={cn(
          "mx-auto flex w-full flex-col gap-5 px-4 pb-12 pt-6 desktop:px-6",
          ended ? "my-auto max-w-145" : "max-w-130 desktop:pt-10",
        )}
      >
        {body}
      </main>
    </div>
  );
}
