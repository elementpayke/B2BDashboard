"use client";
import * as React from "react";
import CoinMark, { isCoinMarkAsset } from "@/components/brand/CoinMark";
import MbokaLogo from "@/components/brand/MbokaLogo";
import MbokaMark from "@/components/brand/MbokaMark";
import { NetworkListIcon } from "@/components/brand/NetworkMark";
import MobileMoneyMark from "@/components/money/MobileMoneyMark";
import { Button } from "@/components/ui/Button";
import ChoicePicker from "@/components/ui/ChoicePicker";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { mobileMoneyDisplayLabel } from "@/lib/services/mobileMoneyBrands";
import { cn } from "@/lib/utils";
import SendReceipt from "./SendReceipt";
import SendStatus, { type SendStatusKind } from "./SendStatus";
import {
  ChoiceChip,
  DetailRow,
  Flag,
  GlyphTile,
  Initials,
  LogoTile,
  MoneyText,
  Notice,
  PickList,
  PickRow,
  SearchBox,
  SectionLabel,
  StepHeading,
} from "./parts";
import type { SavedRecipient, SendFlowProps } from "./types";

type Step = "who" | "saved" | "place" | "provider" | "account" | "amount";

/** The screens before Check and send, in order. "saved" is a side screen of "who". */
const STEPS: Step[] = ["who", "place", "provider", "account", "amount"];
const TOTAL_STEPS = STEPS.length + 1;

// Phosphor duotone paths (MIT): bank and arrows-left-right.
const BANK_GLYPH = {
  back: "M232,96H24L128,32Z",
  front:
    "M24,104H48v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16H208V104h24a8,8,0,0,0,4.19-14.81l-104-64a8,8,0,0,0-8.38,0l-104,64A8,8,0,0,0,24,104Zm40,0H96v64H64Zm80,0v64H112V104Zm48,64H160V104h32ZM128,41.39,203.74,88H52.26ZM248,208a8,8,0,0,1-8,8H16a8,8,0,0,1,0-16H240A8,8,0,0,1,248,208Z",
};
const COIN_GLYPH = {
  back: "M128,32a96,96,0,1,0,96,96A96,96,0,0,0,128,32Z",
  front:
    "M128,24A104,104,0,1,0,232,128,104,104,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88,88,0,0,1,128,216Zm0-136a48,48,0,1,0,48,48A48,48,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z",
};
const SWAP_GLYPH = {
  back: "M208,80v96H48V80Z",
  front:
    "M213.66,181.66l-32,32a8,8,0,0,1-11.32-11.32L188.69,184H48a8,8,0,0,1,0-16H188.69l-18.35-18.34a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,213.66,181.66Zm-139.32-64a8,8,0,0,0,11.32-11.32L67.31,88H208a8,8,0,0,0,0-16H67.31L85.66,53.66A8,8,0,0,0,74.34,42.34l-32,32a8,8,0,0,0,0,11.32Z",
};

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code}.png`;

/** Named by where the money lands. `formal` is the name used on the receipt. */
const METHOD_COPY: Record<string, { label: string; formal: string; desc: string }> = {
  bank: { label: "Bank account", formal: "Bank transfer", desc: "To a bank account, in the local currency" },
  mobile: { label: "Mobile money", formal: "Mobile money", desc: "M-Pesa, Airtel Money and other phone wallets" },
  crypto: { label: "Stablecoins", formal: "Stablecoin", desc: "USDC or USDT to a wallet address" },
};

const SAVED_KIND: Record<string, string> = { bank: "Bank", mobile: "Mobile money", crypto: "Stablecoin" };
const SAVED_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bank", label: "Bank" },
  { key: "mobile", label: "Mobile money" },
  { key: "crypto", label: "Stablecoin" },
];

function MethodMark({ method }: { method: string }) {
  if (method === "bank") return <GlyphTile {...BANK_GLYPH} />;
  if (method === "mobile") return <LogoTile src="/brand/methods/mpesa.png" />;
  if (method === "crypto") return <GlyphTile {...COIN_GLYPH} />;
  if (method === "direct") return <MbokaMark size={44} title={null} />;
  if (method === "interac") return <LogoTile src="/brand/methods/interac.png" />;
  return <GlyphTile {...SWAP_GLYPH} />;
}

/** Small overlapped icons at the end of a method row: what the method can send. */
function MethodAssets({ method }: { method: string }) {
  let items: React.ReactNode[] = [];
  if (method === "bank") {
    items = ["ke", "ng", "eu", "us"].map((code) => <Flag key={code} url={flagUrl(code)} className="size-6.5" />);
  } else if (method === "mobile") {
    items = [
      <LogoTile key="mtn" small src="/brand/methods/mtn.png" />,
      <LogoTile key="airtel" small src="/brand/methods/airtel.png" />,
    ];
  } else if (method === "crypto") {
    items = [
      <CoinMark key="usdc" asset="USDC" size={26} title={null} />,
      <CoinMark key="usdt" asset="USDT" size={26} title={null} />,
      <NetworkListIcon key="base" network="Base" label="Base" size={26} />,
      <NetworkListIcon key="polygon" network="Polygon" label="Polygon" size={26} />,
    ];
  } else if (method === "interac") {
    items = [<Flag key="ca" url={flagUrl("ca")} className="size-6.5" />];
  }
  if (items.length === 0) return null;
  return (
    <span aria-hidden className="hidden shrink-0 items-center desktop:flex">
      {items.map((item, i) => (
        <span key={i} className={cn("flex rounded-pill ring-2 ring-card", i > 0 && "-ml-1.5")}>
          {item}
        </span>
      ))}
    </span>
  );
}

function tail(value: string): string {
  const clean = value.replace(/\s+/g, "");
  return clean.length > 4 ? `•••• ${clean.slice(-4)}` : clean;
}

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(f ?? "").toLowerCase().includes(q));
}

function savedTag(r: SavedRecipient): string {
  if (r.railType === "crypto") return r.network || "Stablecoin";
  if (r.railType === "mobile") return mobileMoneyDisplayLabel(r.provider) || r.provider || "Mobile money";
  return r.provider || "Bank";
}

function savedMeta(r: SavedRecipient): string {
  return `${SAVED_KIND[r.railType] || "Transfer"} · ${savedTag(r)} ${tail(r.accountNumber)}`;
}

function byRecent(a: SavedRecipient, b: SavedRecipient): number {
  return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
}

/** "Rate held for 0:24" — counts down to the quote's expiry. Silent when no expiry is known. */
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

/**
 * Full-screen Send flow: one question per screen (who → where → which
 * provider → which account → how much → check), then one simple ending and a
 * receipt. Presentational — every value and action comes from DashboardApp's
 * send state.
 */
export default function SendFlow({ containerRef, ...p }: SendFlowProps) {
  const [ui, setUi] = React.useState<Step>("who");
  const [query, setQuery] = React.useState("");
  const [savedFilter, setSavedFilter] = React.useState("all");
  const [savedAz, setSavedAz] = React.useState(false);
  const [showReceipt, setShowReceipt] = React.useState(false);
  // The parent always holds a country, provider and network. These record
  // whether the user chose them here, so a default is never sent by accident.
  const [picked, setPicked] = React.useState({ place: false, provider: false });
  const [fromSavedId, setFromSavedId] = React.useState<string | null>(null);
  const [saveForLater, setSaveForLater] = React.useState(true);
  // A saved recipient picked before its payout method is active: the method
  // is selected first, and the recipient applied once the parent re-renders
  // with that method (its handler reads the method from state).
  const pendingRecipient = React.useRef<SavedRecipient | null>(null);
  const { sendMethodKey, onSelectSavedRecipient } = p;
  React.useEffect(() => {
    const pending = pendingRecipient.current;
    if (!pending || sendMethodKey !== pending.railType) return;
    pendingRecipient.current = null;
    onSelectSavedRecipient(pending);
  }, [sendMethodKey, onSelectSavedRecipient]);

  const go = (step: Step, keepQuery = false) => {
    if (!keepQuery) setQuery("");
    setUi(step);
  };

  const step: Step = p.sendMethodChosen || ui === "saved" ? ui : "who";
  const reviewing = p.sendNotDone && p.sendStepIs3;
  const submitted = p.sendDone || p.sendAccepting;
  const position = reviewing ? TOTAL_STEPS : Math.max(1, STEPS.indexOf(step) + 1);

  const methodOptions = p.sendMethodOptions || [];
  const payMethods = methodOptions.filter((m) => m.key !== "internal");
  const internalMethod = methodOptions.find((m) => m.key === "internal");
  const methodCopy = METHOD_COPY[p.sendMethodKey || ""];
  const methodLabel = methodCopy?.label || "Payment method";

  const catalogBusy = p.sendIsCountry && p.sendCatalogLoading;
  const countries = p.sendCountryChips || [];
  const catalogEmpty = p.sendIsCountry && !catalogBusy && countries.length === 0;
  const providers = p.sendProviderOptions || [];
  const providerName = providers[p.sendProviderIdx] || "";
  const providerDisplay = p.sendIsMobileRail ? mobileMoneyDisplayLabel(providerName) || providerName : providerName;
  const destinationLabel = p.sendIsCrypto ? p.sendChainLabel : providerDisplay || p.sendCountryName;
  const assets = p.sendAssets || [];
  const chains = p.sendChains || [];

  const placePicked = picked.place || (p.sendIsCrypto ? assets.length === 1 : countries.length === 1);
  const providerPicked =
    picked.provider || (p.sendIsCrypto ? chains.length === 1 : providers.length <= 1);

  const isPhone = /phone|mobile/i.test(p.sendRecipientLabel || "");
  const extraFields = p.sendExtraFields || [];
  const renderExtraField = (f: (typeof extraFields)[number]) => (
    <Field key={f.key} label={f.label} error={f.error || undefined}>
      <Input
        className="h-14"
        value={f.value}
        onChange={(e) => p.setSendExtraField?.(f.key, e.target.value)}
        placeholder={f.placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </Field>
  );
  const accountReady =
    Boolean(p.sendRecipient.trim()) &&
    (p.sendIsCrypto || Boolean(p.sendRecipientName.trim())) &&
    !p.sendRecipientError &&
    extraFields.every((f) => Boolean(f.value.trim()) && !f.error);
  const amountReady =
    accountReady &&
    Boolean(p.sendAmount.trim()) &&
    !catalogBusy &&
    !catalogEmpty &&
    !p.sendBlockedNoNetworkId &&
    !p.sendLimitError &&
    !p.sendBalanceError &&
    !(p.sendIsCrypto && chains.length === 0);

  const recipientName = p.sendRecipientName.trim();
  const recipientShort = recipientName.split(/\s+/)[0] || "";
  const sourceOption = (p.sendRefundWalletOptions || []).find((o) => o.value === p.sendRefundWalletId);
  const sourceLabel = p.sendIsCrypto
    ? `${p.sendAssetCode} balance`
    : sourceOption
      ? sourceOption.label.split(" · ").slice(0, 2).join(" · ")
      : "your balance";
  const maxAction = p.onMaxSendAmount || p.setSendAmountToMax;
  const getsText = p.sendQuoteRateText || p.sendYouPayText;
  const totalText = p.sendTotalDebitText || p.sendYouPayText;

  const saved = p.savedRecipients || [];
  const recent = [...saved].sort(byRecent);
  const current = fromSavedId ? saved.find((r) => r.id === fromSavedId) || null : null;
  const routes = current ? saved.filter((r) => r.label === current.label) : [];

  const pickSaved = (recipient: SavedRecipient) => {
    const method = payMethods.find((m) => m.key === recipient.railType);
    if (!method || method.disabled) return;
    if (p.sendMethodKey === recipient.railType) {
      p.onSelectSavedRecipient(recipient);
    } else {
      pendingRecipient.current = recipient;
      method.select();
    }
    setPicked({ place: true, provider: true });
    setFromSavedId(recipient.id);
    go("amount");
  };

  const pickMethod = (select: () => void) => {
    select();
    setPicked({ place: false, provider: false });
    setFromSavedId(null);
    go("place");
  };

  const close = () => {
    setShowReceipt(false);
    p.closeModal();
  };

  const leaveAccount = () => {
    const account = p.sendRecipient.replace(/\s+/g, "");
    const known = saved.some(
      (r) => r.railType === p.sendMethodKey && r.accountNumber.replace(/\s+/g, "") === account,
    );
    if (saveForLater && !known && recipientName) p.onSaveRecipientDetails();
    go("amount");
  };

  const chips = (
    <>
      <ChoiceChip label="payment method" onChange={() => go("who")}>
        {methodLabel}
      </ChoiceChip>
      {step !== "place" && p.sendIsCountry ? (
        <ChoiceChip label="country" onChange={() => go("place")}>
          <Flag url={p.sendCountryFlagUrl} className="size-4" />
          {p.sendCountryName} · {p.sendCurrencyCode}
        </ChoiceChip>
      ) : null}
      {step !== "place" && p.sendIsCrypto ? (
        <ChoiceChip label="stablecoin" onChange={() => go("place")}>
          {p.sendAssetCode}
        </ChoiceChip>
      ) : null}
      {step === "account" && destinationLabel && (p.sendIsCrypto || providerDisplay) ? (
        <ChoiceChip
          label={p.sendIsCrypto ? "network" : p.sendIsMobileRail ? "provider" : "bank"}
          onChange={() => go("provider")}
        >
          {destinationLabel}
        </ChoiceChip>
      ) : null}
    </>
  );

  const savedRow = (r: SavedRecipient) => (
    <PickRow
      key={r.id}
      leading={<Initials name={r.label} small />}
      title={r.label}
      meta={savedMeta(r)}
      onClick={() => pickSaved(r)}
    />
  );

  let body: React.ReactNode;

  if (submitted && showReceipt && (p.sendOutcome === "delivered" || p.sendOutcome === "processing")) {
    body = (
      <SendReceipt
        status={p.sendOutcome}
        getsText={getsText}
        recipientName={recipientName}
        toLines={[
          p.sendIsCrypto
            ? `${p.sendAssetCode} on ${p.sendChainLabel}`
            : [providerDisplay, p.sendCountryName].filter(Boolean).join(", "),
          p.sendRecipient,
        ].filter(Boolean)}
        sourceLabel={sourceLabel}
        methodLabel={methodCopy?.formal || "Transfer"}
        paidAt={p.sendUpdatedAt ?? null}
        amountText={`${p.sendAmount} ${p.sendIsCrypto ? p.sendAssetCode : p.sendAmountCurrency}`}
        feeText={p.sendFeeText || null}
        rateLine={p.sendQuotedRateLine}
        totalText={totalText}
        orderId={p.sendOrderId}
        onBack={() => setShowReceipt(false)}
      />
    );
  } else if (submitted) {
    const status: SendStatusKind = p.sendDone ? p.sendOutcome : "sending";
    body = (
      <SendStatus
        status={status}
        getsText={getsText}
        totalText={totalText}
        recipientShort={recipientShort}
        recipientName={recipientName}
        sourceLabel={sourceLabel}
        providerLabel={destinationLabel || "The provider"}
        explorerUrl={p.sendExplorerUrl}
        explorerLabel={p.sendSuccessDetails?.explorerLabel}
        failureMessage={p.sendFailureMessage}
        refundText={p.sendRefundText}
        onClose={close}
        onViewTransactions={p.onViewTransactions}
        onViewReceipt={() => setShowReceipt(true)}
        onFix={() => {
          p.sendRetry();
          go("account");
        }}
        onHelp={p.onContactSupport}
      />
    );
  } else if (reviewing) {
    body = (
      <>
        <StepHeading title="Check and send" centered />
        <section
          aria-label="Payment summary"
          className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="min-w-0">
              <p className="text-dense text-muted-foreground">You send</p>
              <MoneyText text={p.sendYouPayText} size="lg" />
              <p className="truncate text-dense text-muted-foreground">from {sourceLabel}</p>
            </div>
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <div className="min-w-0 text-right">
              <p className="text-dense text-muted-foreground">{recipientShort || "Recipient"} gets</p>
              <MoneyText text={getsText} size="lg" className="text-link" />
              <p className="truncate text-dense text-muted-foreground">{destinationLabel}</p>
            </div>
          </div>
          <dl className="divide-y divide-border border-t border-border">
            <DetailRow label="To">
              {recipientName ? <strong className="block font-semibold">{recipientName}</strong> : null}
              <span className="block break-all font-mono text-muted-foreground">
                {[p.sendIsCrypto ? "" : providerDisplay, p.sendRecipient].filter(Boolean).join(" · ")}
              </span>
            </DetailRow>
            {p.sendIsCrypto ? <DetailRow label="Network">{p.sendChainLabel}</DetailRow> : null}
            {p.sendMemoApplies && p.sendMemo.trim() ? (
              <DetailRow label="Memo">
                <span className="font-mono">{p.sendMemo.trim()}</span>
              </DetailRow>
            ) : null}
            <DetailRow label="Fee">
              <span className="font-mono">{p.sendFeeText}</span>
            </DetailRow>
            {p.sendQuotedRateLine ? (
              <DetailRow label="Rate">
                <span className="font-mono">{p.sendQuotedRateLine}</span>
              </DetailRow>
            ) : null}
            {p.sendReference?.trim() ? (
              <DetailRow label="Reference">
                <span className="break-all">{p.sendReference.trim()}</span>
              </DetailRow>
            ) : null}
            {p.sendIsCrypto ? (
              <DetailRow label="Total debit" strong>
                {p.sendTotalDebitText ? (
                  <MoneyText text={p.sendTotalDebitText} size="sm" />
                ) : (
                  "Shown once confirmed"
                )}
              </DetailRow>
            ) : null}
          </dl>
        </section>

        {p.sendAcceptError ? <Notice tone="danger">{p.sendAcceptError}</Notice> : null}
        <RateHeld expiresAt={p.sendQuoteExpiresAt} />

        <div className="flex justify-center gap-2.5">
          <Button variant="secondary" className="rounded-pill px-5" onClick={p.sendBack}>
            <span aria-hidden>←</span> Back
          </Button>
          <Button className="rounded-pill px-7" onClick={p.submitSend}>
            Send {totalText}
          </Button>
        </div>
      </>
    );
  } else if (step === "saved") {
    const rows = saved
      .filter((r) => savedFilter === "all" || r.railType === savedFilter)
      .filter((r) => matches(query, r.label, savedMeta(r), r.accountNumber))
      .sort(savedAz ? (a, b) => a.label.localeCompare(b.label) : byRecent);
    body = (
      <>
        <StepHeading
          title="Saved recipients"
          sub={
            rows.length === saved.length
              ? `${saved.length} recipients`
              : `${rows.length} of ${saved.length} recipients`
          }
          onBack={() => go("who")}
        />
        <SearchBox
          label="Search saved recipients"
          placeholder="Search by name, bank, account or phone"
          value={query}
          onChange={setQuery}
        />
        <div role="group" aria-label="Filter recipients" className="flex flex-wrap gap-1.5">
          {SAVED_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={savedFilter === f.key ? "primary" : "secondary"}
              aria-pressed={savedFilter === f.key}
              className="min-h-11 rounded-pill"
              onClick={() => setSavedFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="secondary"
            className="min-h-11 rounded-pill"
            onClick={() => setSavedAz((v) => !v)}
          >
            {savedAz ? "Sorted A to Z" : "Sorted by recent"}
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-body-lg text-muted-foreground">
            No saved recipient matches. Go back and pay someone new.
          </p>
        ) : (
          <PickList label="Saved recipients">{rows.map(savedRow)}</PickList>
        )}
      </>
    );
  } else if (step === "who") {
    const hits = recent.filter((r) => matches(query, r.label, savedMeta(r), r.accountNumber));
    const shown = hits.slice(0, query.trim() ? 5 : 1);
    body = (
      <>
        <StepHeading title="Send money" sub="Who are you paying?" />
        <SearchBox
          label="Search recipients"
          placeholder="Search recipients by name, account or phone"
          value={query}
          onChange={setQuery}
        />
        <section aria-labelledby="send-saved" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel id="send-saved">Pay again</SectionLabel>
            {saved.length > 1 ? (
              <Button variant="link" onClick={() => go("saved", true)}>
                {query.trim() ? `See all ${hits.length} matches` : `All ${saved.length} recipients`}
              </Button>
            ) : null}
          </div>
          {p.savedRecipientsLoading ? (
            <p role="status" className="text-body-lg text-muted-foreground">
              Loading saved recipients…
            </p>
          ) : shown.length === 0 ? (
            <p className="text-body-lg text-muted-foreground">
              {query.trim()
                ? "No saved recipient matches that search."
                : "No saved recipients yet. Pay someone new and they’re saved for next time."}
            </p>
          ) : (
            <PickList labelledBy="send-saved">{shown.map(savedRow)}</PickList>
          )}
        </section>
        <section aria-labelledby="send-new" className="flex flex-col gap-2">
          <SectionLabel id="send-new">Where is the money going?</SectionLabel>
          <PickList labelledBy="send-new">
            {payMethods.map((m) => {
              const copy = METHOD_COPY[m.key];
              return (
                <PickRow
                  key={m.key}
                  leading={<MethodMark method={m.key} />}
                  title={copy?.label || m.label}
                  meta={copy?.desc || m.desc}
                  trailing={<MethodAssets method={m.key} />}
                  disabled={m.disabled}
                  hint={m.disabledReason}
                  onClick={() => pickMethod(m.select)}
                />
              );
            })}
            <PickRow
              leading={<MethodMark method="direct" />}
              title="Mboka to Mboka"
              meta="Another business on Mboka"
              soon
              onClick={() => {}}
            />
            {internalMethod ? (
              <PickRow
                leading={<MethodMark method="internal" />}
                title="Between my accounts"
                meta="Move or convert your own balances"
                disabled={internalMethod.disabled}
                hint={internalMethod.disabledReason}
                onClick={internalMethod.select}
              />
            ) : null}
            <PickRow
              leading={<MethodMark method="interac" />}
              title="Interac"
              meta="To a recipient in Canada, by email, in CAD"
              soon
              onClick={() => {}}
            />
          </PickList>
        </section>
      </>
    );
  } else if (step === "place" && p.sendIsCrypto) {
    const selected = assets.find((a) => a.selected);
    body = (
      <>
        <StepHeading
          title="Which stablecoin?"
          sub="The asset the recipient’s wallet should receive."
          onBack={() => go("who")}
          chips={chips}
        />
        <ChoicePicker
          id="send-asset"
          label="Stablecoin"
          title="Choose a stablecoin"
          placeholder="Select a stablecoin"
          value={placePicked && selected ? selected.key : ""}
          options={assets.map((a) => ({
            value: a.key,
            label: a.label,
            leading: isCoinMarkAsset(a.label) ? <CoinMark asset={a.label} size={28} title={null} /> : undefined,
          }))}
          onChange={(key) => {
            assets.find((a) => a.key === key)?.select();
            setPicked({ place: true, provider: false });
          }}
        />
        <div className="flex justify-center">
          <Button className="rounded-pill px-8" disabled={!placePicked} onClick={() => go("provider")}>
            Continue
          </Button>
        </div>
      </>
    );
  } else if (step === "place") {
    // Countries the saved recipients are in, most used first.
    const counts = new Map<string, number>();
    for (const r of saved) {
      if (r.currency) counts.set(r.currency, (counts.get(r.currency) || 0) + 1);
    }
    const frequent = countries
      .filter((c) => counts.has(c.code))
      .sort((a, b) => (counts.get(b.code) || 0) - (counts.get(a.code) || 0))
      .slice(0, 3);
    const chooseCountry = (idx: number) => {
      p.selectSendCountry(idx);
      setPicked({ place: true, provider: false });
    };
    body = (
      <>
        <StepHeading
          title="Which country?"
          sub={
            p.sendMethodKey === "mobile"
              ? "Where the wallet is registered. We pay out in that country’s currency."
              : "Where the bank account is. We pay out in that country’s currency."
          }
          onBack={() => go("who")}
          chips={chips}
        />
        {catalogBusy && countries.length === 0 ? (
          <p role="status" className="text-body-lg text-muted-foreground">
            Loading countries…
          </p>
        ) : catalogEmpty && p.sendCatalogError ? (
          <Notice tone="danger">
            <p>Couldn’t load destination countries. {p.sendCatalogError}</p>
            {p.onRetrySendCatalog ? (
              <Button variant="secondary" size="sm" className="mt-2" onClick={p.onRetrySendCatalog}>
                Retry
              </Button>
            ) : null}
          </Notice>
        ) : catalogEmpty ? (
          <Notice tone="info" role="status">
            No countries are available for this payment method right now.
          </Notice>
        ) : (
          <>
            <ChoicePicker
              id="send-country"
              label="Country"
              title="Choose a country"
              placeholder="Select a country"
              searchable
              value={placePicked ? String(p.sendCountryIdx) : ""}
              options={countries.map((c) => ({
                value: String(c.idx),
                label: `${c.name} · ${c.code}`,
                leading: <Flag url={c.flagUrl} className="size-6" />,
              }))}
              onChange={(value) => chooseCountry(Number(value))}
            />
            {frequent.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <SectionLabel>From your saved recipients</SectionLabel>
                {frequent.map((c) => (
                  <Button
                    key={c.idx}
                    size="sm"
                    variant="secondary"
                    className="min-h-11 rounded-pill"
                    onClick={() => chooseCountry(c.idx)}
                  >
                    <Flag url={c.flagUrl} className="size-4" />
                    {c.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex justify-center">
              <Button className="rounded-pill px-8" disabled={!placePicked} onClick={() => go("provider")}>
                Continue
              </Button>
            </div>
          </>
        )}
      </>
    );
  } else if (step === "provider" && p.sendIsCrypto) {
    const selected = chains.find((n) => n.selected);
    body = (
      <>
        <StepHeading
          title="Which network?"
          sub={`The network the recipient’s ${p.sendAssetCode} wallet is on.`}
          onBack={() => go("place")}
          chips={chips}
        />
        {chains.length === 0 ? (
          <Notice tone="danger" role="status">
            No ready {p.sendAssetCode} wallet to send from. Open a {p.sendAssetCode} account on Base,
            Polygon or Stellar first.
          </Notice>
        ) : (
          <>
            <ChoicePicker
              id="send-network"
              label="Network"
              title="Choose a network"
              placeholder="Select a network"
              value={providerPicked && selected ? selected.key : ""}
              options={chains.map((n) => ({
                value: n.key,
                label: n.label,
                leading: <NetworkListIcon network={n.key} label={n.label} size={28} />,
              }))}
              onChange={(key) => {
                chains.find((n) => n.key === key)?.select();
                setPicked({ place: true, provider: true });
              }}
            />
            <Notice tone="warning" role="note">
              Check the recipient accepts {p.sendAssetCode} on the network you pick. Sending to the
              wrong network can lose funds.
            </Notice>
            <div className="flex justify-center">
              <Button className="rounded-pill px-8" disabled={!providerPicked} onClick={() => go("account")}>
                Continue
              </Button>
            </div>
          </>
        )}
      </>
    );
  } else if (step === "provider") {
    const noun = p.sendIsMobileRail ? "provider" : p.sendProviderIsRail ? "transfer type" : "bank";
    body = (
      <>
        <StepHeading
          title={
            p.sendIsMobileRail
              ? "Which provider?"
              : p.sendProviderIsRail
                ? "How should it be sent?"
                : "Which bank?"
          }
          sub={
            p.sendProviderIsRail
              ? `Pick the transfer type for this ${p.sendCountryName} payment. It is paid from your balance.`
              : `Pick the recipient’s ${p.sendIsMobileRail ? "mobile money provider" : "bank"} in ${p.sendCountryName}.`
          }
          onBack={() => go("place")}
          chips={chips}
        />
        {p.sendRailHasChoice ? (
          <div role="group" aria-label="Payout type" className="flex flex-wrap gap-2">
            {(p.sendRailChips || []).map((r) => (
              <Button
                key={r.label}
                size="sm"
                variant={r.selected ? "primary" : "secondary"}
                aria-pressed={r.selected}
                onClick={() => {
                  r.select();
                  setPicked({ place: true, provider: false });
                }}
              >
                {r.label}
              </Button>
            ))}
          </div>
        ) : null}
        {p.sendBlockedNoNetworkId ? (
          <Notice tone="danger">
            We can’t price this route right now. Our provider list is unavailable. Please try again
            shortly.
          </Notice>
        ) : null}
        {catalogBusy && providers.length === 0 ? (
          <p role="status" className="text-body-lg text-muted-foreground">
            Loading {noun}s…
          </p>
        ) : providers.length === 0 ? (
          <Notice tone="info" role="status">
            There’s no {noun} to choose for {p.sendCountryName}. Continue to enter the account.
          </Notice>
        ) : (
          <ChoicePicker
            id="send-provider"
            label={p.sendIsMobileRail ? "Provider" : p.sendProviderIsRail ? "Transfer type" : "Bank"}
            title={
              p.sendIsMobileRail
                ? "Choose a provider"
                : p.sendProviderIsRail
                  ? "Choose a transfer type"
                  : "Choose a bank"
            }
            placeholder={`Select a ${noun}`}
            searchable={providers.length > 5}
            value={providerPicked ? String(p.sendProviderIdx) : ""}
            options={providers.map((name, idx) => {
              const label = p.sendIsMobileRail ? mobileMoneyDisplayLabel(name) || name : name;
              return {
                value: String(idx),
                label,
                leading: p.sendIsMobileRail ? (
                  <MobileMoneyMark name={name} size={28} />
                ) : (
                  <Initials name={label} square small />
                ),
              };
            })}
            onChange={(value) => {
              p.selectSendProvider(Number(value));
              setPicked({ place: true, provider: true });
            }}
          />
        )}
        <p className="text-body text-muted-foreground">
          {p.sendIsMobileRail ? "Provider" : "Bank"} not listed? We can’t pay it out yet.
          {p.onContactSupport ? (
            <>
              {" "}
              <Button variant="link" onClick={p.onContactSupport}>
                Ask support
              </Button>
            </>
          ) : null}
        </p>
        <div className="flex justify-center">
          <Button
            className="rounded-pill px-8"
            disabled={!providerPicked || (catalogBusy && providers.length === 0)}
            onClick={() => go("account")}
          >
            Continue
          </Button>
        </div>
      </>
    );
  } else if (step === "account") {
    body = (
      <>
        <StepHeading
          title="Who gets it?"
          sub={
            p.sendIsCrypto
              ? `Enter the ${p.sendAssetCode} wallet on ${p.sendChainLabel}.`
              : p.sendIsMobileRail
                ? `Enter the ${providerDisplay || p.sendCountryName} number you’re paying.`
                : `Enter the ${providerDisplay || p.sendCountryName} account you’re paying.`
          }
          onBack={() => go("provider")}
          chips={chips}
        />
        {extraFields.filter((f) => f.lead).map(renderExtraField)}
        <Field
          label={p.sendIsCrypto ? "Wallet address" : p.sendRecipientLabel || "Account number"}
          error={p.sendRecipientError || undefined}
          hint={
            p.sendIsCrypto
              ? `Check it accepts ${p.sendAssetCode} on ${p.sendChainLabel}.`
              : isPhone
                ? "Local numbers like 07… switch to international format when you leave the field."
                : "Check the number with the recipient."
          }
        >
          <Input
            mono
            className="h-14"
            value={p.sendRecipient}
            onChange={p.setSendRecipient}
            onBlur={p.normalizeSendRecipientPhone}
            placeholder={p.sendRecipientPlaceholder}
            autoComplete="off"
            spellCheck={false}
            inputMode={isPhone ? "tel" : undefined}
          />
        </Field>
        <Field
          label={
            p.sendIsCrypto
              ? "Name for this wallet (optional)"
              : p.sendIsBankRail
                ? "Name on the account"
                : "Registered name"
          }
          hint={
            p.sendIsCrypto
              ? "For your own records."
              : "A wrong name can delay the payment or send it back."
          }
        >
          <Input
            className="h-14"
            value={p.sendRecipientName}
            onChange={p.setSendRecipientName}
            placeholder={p.sendIsCrypto ? "e.g. Kito Logistics" : "As the bank or provider has it"}
            autoComplete="off"
          />
        </Field>
        {extraFields.filter((f) => !f.lead).map(renderExtraField)}
        {p.sendMemoApplies ? (
          <Field
            label="Memo (optional)"
            hint="Exchanges and pooled wallets often need a memo to credit the right account. Check before leaving this blank."
          >
            <Input
              mono
              className="h-14"
              value={p.sendMemo}
              onChange={p.setSendMemo}
              placeholder="e.g. 123456"
              autoComplete="off"
              spellCheck={false}
              maxLength={28}
            />
          </Field>
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-body-lg text-foreground">
          <input
            type="checkbox"
            checked={saveForLater}
            onChange={(e) => setSaveForLater(e.target.checked)}
            className="size-5 accent-primary"
          />
          Save to recipients for next time
        </label>
        <div className="flex justify-center">
          <Button className="rounded-pill px-8" disabled={!accountReady} onClick={leaveAccount}>
            Continue
          </Button>
        </div>
      </>
    );
  } else {
    const amountInvalid = Boolean(p.sendLimitError || p.sendBalanceError);
    const unit = p.sendIsCrypto ? p.sendAssetCode : p.sendAmountCurrency;
    body = (
      <>
        <StepHeading
          title="How much?"
          centered
          sub={
            <>
              To <strong className="font-semibold text-foreground">{recipientName || "recipient"}</strong>
              {destinationLabel ? ` · ${destinationLabel}` : ""} {tail(p.sendRecipient)}
            </>
          }
        />
        {routes.length > 1 && current ? (
          <ChoicePicker
            id="send-route"
            label="Pay to"
            title={`Ways to pay ${current.label}`}
            value={current.id}
            options={routes.map((r) => ({
              value: r.id,
              label: `${METHOD_COPY[r.railType]?.formal || "Transfer"} · ${savedTag(r)} ${tail(r.accountNumber)}`,
            }))}
            onChange={(id) => {
              const route = routes.find((r) => r.id === id);
              if (route) pickSaved(route);
            }}
          />
        ) : null}
        <div className="flex flex-col items-center gap-3">
          <span className="rounded-pill bg-accent px-2.5 py-1 font-display text-caption font-bold uppercase tracking-overline text-accent-foreground">
            You send <span aria-hidden>↗</span>
          </span>
          {p.sendCanEnterLocal ? (
            <div role="group" aria-label="Amount currency" className="flex gap-1.5">
              {Array.from(new Set(["USD", p.sendLocalCurrency])).map((code) => (
                <Button
                  key={code}
                  size="sm"
                  variant={p.sendAmountCurrency === code ? "primary" : "secondary"}
                  aria-pressed={p.sendAmountCurrency === code}
                  onClick={() => p.setSendAmountCurrency(code)}
                >
                  {code}
                </Button>
              ))}
            </div>
          ) : null}
          <Field
            className="w-full items-center"
            label={`Amount (${unit})`}
            // With the breakdown card the reason is shown as a panel under it.
            error={p.sendBreakdown ? undefined : p.sendLimitError || p.sendBalanceError || undefined}
          >
            <Input
              className={cn(
                "h-16 border-0 bg-transparent text-center font-display text-hero font-bold tracking-display desktop:text-hero",
                amountInvalid && "text-destructive-text",
              )}
              value={p.sendAmount}
              onChange={p.setSendAmount}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
          {p.sendMaxAmount && maxAction ? (
            <Button
              variant="link"
              onClick={maxAction}
              aria-label={`Send the maximum of ${p.sendMaxAmount} ${p.sendAmountCurrency}`}
            >
              {amountInvalid ? "Send " : "Use max · "}
              <span className="font-mono">{p.sendMaxAmount}</span>
              {amountInvalid ? " instead" : ""}
            </Button>
          ) : null}
          {p.sendBreakdown?.headline && !p.sendBreakdown.error ? (
            <div
              className={cn(
                "flex flex-col items-center gap-2 transition-opacity",
                p.sendBreakdown.pending && "opacity-60",
              )}
            >
              <span className="rounded-pill bg-secondary px-2.5 py-1 font-display text-caption font-bold uppercase tracking-overline text-secondary-foreground">
                {p.sendBreakdown.headline.label} <span aria-hidden>↘</span>
              </span>
              <MoneyText text={p.sendBreakdown.headline.value} size="lg" className="text-link" />
            </div>
          ) : !p.sendBreakdown && p.sendAmountEquivalent ? (
            <p className="inline-flex flex-wrap items-center justify-center gap-x-2 rounded-pill border border-border bg-card px-3.5 py-2 text-body-lg">
              <span className="text-muted-foreground">
                {p.sendAmountCurrency.toUpperCase() === "USD" ? `${recipientShort || "Recipient"} gets` : "You send"}
              </span>
              <strong className="font-mono font-medium">{p.sendAmountEquivalent}</strong>
              {p.sendIndicativeRateLine ? (
                <span className="text-dense text-muted-foreground">· {p.sendIndicativeRateLine}</span>
              ) : null}
            </p>
          ) : null}
        </div>

        {p.sendIsCountry ? (
          p.selectSendRefundWallet &&
          (p.sendRefundWalletsLoading || (p.sendRefundWalletOptions || []).length > 0) ? (
            <ChoicePicker
              id="send-refund-wallet"
              label="Pay from"
              title="Choose account"
              value={p.sendRefundWalletId || ""}
              options={p.sendRefundWalletOptions || []}
              onChange={p.selectSendRefundWallet}
              loading={p.sendRefundWalletsLoading}
              loadingLabel="Loading accounts…"
              placeholder="Select an account to pay from"
            />
          ) : (
            <Notice tone="warning" role="note">
              You have no account to pay from yet. Open one under Accounts and wait until it is
              active.
            </Notice>
          )
        ) : null}

        {p.sendBreakdown ? (
          <section
            aria-label="Price breakdown"
            aria-live="polite"
            aria-busy={p.sendBreakdown.pending}
            className={cn(
              "w-full rounded-3xl border border-border bg-card px-5 py-2 transition-opacity",
              p.sendBreakdown.pending && p.sendBreakdown.rows.length > 0 && "opacity-60",
            )}
          >
            {p.sendBreakdown.error ? (
              <p className="py-3 text-body text-destructive-text">{p.sendBreakdown.error}</p>
            ) : p.sendBreakdown.rows.length === 0 ? (
              <p className="py-3 text-center text-body text-muted-foreground">
                Working out the fee and rate…
              </p>
            ) : (
              <dl>
                {p.sendBreakdown.rows.map((row) => (
                  <div key={row.key} className={cn(row.divider && "mt-1 border-t border-border pt-1")}>
                    <DetailRow label={row.label} strong={row.strong}>
                      <span className="font-mono">{row.value}</span>
                    </DetailRow>
                  </div>
                ))}
              </dl>
            )}
            {p.sendBreakdown.rows.length > 0 && !p.sendBreakdown.error ? (
              <p className="pb-2 text-right text-dense text-muted-foreground">
                Estimate · locked on the next step
              </p>
            ) : null}
          </section>
        ) : null}

        {p.sendBreakdown && (p.sendLimitError || p.sendBalanceError) ? (
          <Notice tone="danger">{p.sendLimitError || p.sendBalanceError}</Notice>
        ) : null}

        {p.setSendReference ? (
          <Field
            label="Reference (optional)"
            hint="A short note for the payment, like an invoice number. Shown to the recipient where their bank or provider supports it."
          >
            <Input
              className="h-14"
              value={p.sendReference || ""}
              onChange={p.setSendReference}
              placeholder="e.g. INV-0042"
              autoComplete="off"
              maxLength={140}
            />
          </Field>
        ) : null}

        {p.sendBlockedNoNetworkId ? (
          <Notice tone="danger">
            We can’t price this route right now. Our provider list is unavailable. Please try again
            shortly.
          </Notice>
        ) : p.sendQuoteError ? (
          <Notice tone="danger" id="send-quote-error">
            <p>{p.sendQuoteError}</p>
            {p.onContactSupport && /contact support/i.test(p.sendQuoteError) ? (
              <Button variant="link" onClick={p.onContactSupport}>
                Get help
              </Button>
            ) : null}
          </Notice>
        ) : null}

        <p className="text-center text-body text-muted-foreground">
          {p.sendBreakdown
            ? "Nothing is sent yet. You confirm the locked rate and fee on the next step."
            : "The fee and final rate are shown on the next step, before anything is sent."}
        </p>

        <div className="flex justify-center gap-2.5">
          <Button
            variant="secondary"
            className="rounded-pill px-5"
            onClick={() => go(current ? "who" : "account")}
          >
            <span aria-hidden>←</span> Back
          </Button>
          <Button
            className="rounded-pill px-7"
            disabled={!amountReady}
            loading={p.sendQuoteLoading}
            onClick={p.sendReview}
          >
            {p.sendQuoteLoading ? "Getting quote…" : "Continue"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      data-slot="send-flow"
      data-screen-label="Send"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-flow-title"
      className="fixed inset-0 z-100 flex flex-col overflow-y-auto bg-background font-body text-foreground"
    >
      {submitted ? null : (
        <>
          <header className="flex items-center justify-between px-3 py-2.5 desktop:px-6 desktop:py-4">
            <MbokaLogo size={28} />
            <span className="text-dense font-semibold text-muted-foreground">
              Step {position} of {TOTAL_STEPS}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex size-11 cursor-pointer items-center justify-center rounded-pill bg-muted text-foreground outline-none focus-visible:shadow-focus"
            >
              <span aria-hidden>✕</span>
            </button>
          </header>
          <div
            role="progressbar"
            aria-label="Send progress"
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={position}
            className="h-0.75 shrink-0 bg-muted"
          >
            <div
              className="h-full bg-primary transition-[width] duration-250 ease-standard"
              style={{ width: `${Math.round((position / TOTAL_STEPS) * 100)}%` }}
            />
          </div>
        </>
      )}
      <main
        className={cn(
          "mx-auto flex w-full flex-col gap-5 px-4 pb-12 pt-6 desktop:px-6",
          submitted ? "my-auto max-w-145" : "max-w-130 desktop:pt-10",
        )}
      >
        {body}
      </main>
    </div>
  );
}
