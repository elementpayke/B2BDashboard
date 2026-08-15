import { beforeAll, describe, expect, it } from "vitest";
import {
  connectStellarWallet,
  describeMemoRequirement,
  describeStellarStatus,
  formatStellarAddress,
  formatStellarTxHash,
  getStellarDeposit,
  initialDepositState,
  isValidStellarAddress,
  listStellarAccounts,
  listStellarActivity,
  previewStellarDeposit,
  stellarExplorerUrl,
  StellarSimulationError,
  submitStellarDeposit,
  setStellarSimulationLatency,
  type StellarScenario,
} from "@/lib/services/stellarSimulation";

// The adapter's delay is a UI affordance, not behaviour under test.
beforeAll(() => setStellarSimulationLatency(0));

const ADDRESS = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
const HASH = "3f1a9c47d2b85e60a1c4f8d93e27b5061a8c4f2d9e73b16a5c08d4f291e6b73a";

/** Drive connect → preflight → review → approve for a given scenario. */
async function runToPending(scenario: StellarScenario) {
  let state = initialDepositState(scenario);
  state = await connectStellarWallet(state, "freighter");
  state = await previewStellarDeposit(state, "18400");
  return submitStellarDeposit(state);
}

describe("simulated account and activity", () => {
  it("exposes exactly one managed account, flagged as simulated", async () => {
    const accounts = await listStellarAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe("USDC Account");
    // The guard that stops this ever being folded into real totals.
    expect(accounts[0].isSimulated).toBe(true);
    expect(isValidStellarAddress(accounts[0].receivingAddress)).toBe(true);
  });

  it("covers the operational states the account can be in", async () => {
    const statuses = new Set((await listStellarActivity()).map((a) => a.status));
    expect(statuses).toEqual(
      new Set(["pending_deposit", "settled", "processing_payout", "review_required"]),
    );
  });

  it("only attaches a transaction hash once there is a transaction", async () => {
    for (const item of await listStellarActivity()) {
      if (item.status === "pending_deposit" || item.status === "processing_payout") {
        expect(item.txHash).toBeNull();
      } else {
        expect(item.txHash).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });
});

describe("deposit state machine", () => {
  it("walks connect → preflight → review → pending → credited on the happy path", async () => {
    let state = initialDepositState("happy");
    expect(state.stage).toBe("connect");

    state = await connectStellarWallet(state, "freighter");
    expect(state.stage).toBe("preflight");
    expect(state.walletName).toBe("Freighter");
    expect(state.trustlineReady).toBe(true);
    expect(isValidStellarAddress(state.walletAddress)).toBe(true);

    state = await previewStellarDeposit(state, "18400");
    expect(state.stage).toBe("review");

    state = await submitStellarDeposit(state);
    expect(state.stage).toBe("pending");
    expect(state.txHash).toMatch(/^[0-9a-f]{64}$/);

    state = await getStellarDeposit(state);
    expect(state.stage).toBe("credited");
    expect(state.error).toBeNull();
  });

  it("rejects an unknown wallet", async () => {
    await expect(
      connectStellarWallet(initialDepositState("happy"), "not-a-wallet"),
    ).rejects.toBeInstanceOf(StellarSimulationError);
  });

  it("surfaces a rejected connection without advancing", async () => {
    const state = initialDepositState("connection_rejected");
    await expect(connectStellarWallet(state, "freighter")).rejects.toThrow(/rejected in your wallet/i);
  });

  it("stops at preflight when the wallet has no USDC trustline", async () => {
    let state = initialDepositState("no_trustline");
    state = await connectStellarWallet(state, "lobstr");
    expect(state.stage).toBe("preflight");
    expect(state.trustlineReady).toBe(false);
    // Phrased as an action in their wallet, not a chain concept.
    expect(state.error).toMatch(/add usdc in your wallet/i);

    await expect(previewStellarDeposit(state, "100")).rejects.toThrow(/can't hold usdc/i);
  });

  it("refuses a non-positive or unparseable amount", async () => {
    const state = await connectStellarWallet(initialDepositState("happy"), "freighter");
    for (const bad of ["", "0", "-5", "abc"]) {
      await expect(previewStellarDeposit(state, bad)).rejects.toThrow(/greater than zero/i);
    }
  });

  it("accepts a formatted amount", async () => {
    const state = await connectStellarWallet(initialDepositState("happy"), "freighter");
    await expect(previewStellarDeposit(state, "18,400.00")).resolves.toMatchObject({
      stage: "review",
    });
  });

  it("reports a payment the user rejected in their wallet", async () => {
    let state = initialDepositState("payment_rejected");
    state = await connectStellarWallet(state, "freighter");
    state = await previewStellarDeposit(state, "500");
    await expect(submitStellarDeposit(state)).rejects.toThrow(/nothing was sent/i);
  });

  it("keeps a slow transfer in pending rather than calling it failed", async () => {
    const submitted = await runToPending("pending_too_long");
    const polled = await getStellarDeposit(submitted);
    expect(polled.stage).toBe("pending");
    expect(polled.needsReview).toBe(false);
    expect(polled.error).toMatch(/still waiting for confirmation/i);
  });

  it("routes a memo mismatch to review and does not blame the user", async () => {
    const submitted = await runToPending("memo_mismatch");
    const polled = await getStellarDeposit(submitted);
    expect(polled.stage).toBe("failed");
    expect(polled.needsReview).toBe(true);
    expect(polled.error).toMatch(/no action needed from you/i);
  });

  it("never leaks key, seed, gas or reserve vocabulary into user-facing copy", async () => {
    const scenarios: StellarScenario[] = [
      "happy",
      "no_trustline",
      "pending_too_long",
      "memo_mismatch",
    ];
    const messages: string[] = [];
    for (const scenario of scenarios) {
      let state = initialDepositState(scenario);
      state = await connectStellarWallet(state, "freighter");
      if (state.error) messages.push(state.error);
      if (!state.trustlineReady) continue;
      state = await previewStellarDeposit(state, "100");
      state = await submitStellarDeposit(state);
      const done = await getStellarDeposit(state);
      if (done.error) messages.push(done.error);
    }
    for (const message of messages) {
      expect(message).not.toMatch(/seed phrase|private key|secret key|xlm|gas|reserve|soroban/i);
    }
  });
});

describe("address, hash and memo presentation", () => {
  it("validates Stellar public keys", () => {
    expect(isValidStellarAddress(ADDRESS)).toBe(true);
    expect(isValidStellarAddress(`  ${ADDRESS}  `)).toBe(true);
    // Wrong prefix (secret key), too short, EVM address, empty.
    expect(isValidStellarAddress(ADDRESS.replace(/^G/, "S"))).toBe(false);
    expect(isValidStellarAddress("GABC")).toBe(false);
    expect(isValidStellarAddress("0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4")).toBe(false);
    expect(isValidStellarAddress(null)).toBe(false);
  });

  it("rejects base32-invalid characters", () => {
    // 0, 1, 8 and 9 are not in the base32 alphabet Stellar uses.
    expect(isValidStellarAddress(`G${"0".repeat(55)}`)).toBe(false);
  });

  it("middle-truncates addresses and hashes, leaving short values alone", () => {
    expect(formatStellarAddress(ADDRESS)).toBe("GA7QYN…UJVSGZ");
    expect(formatStellarTxHash(HASH)).toBe("3f1a9c47…91e6b73a");
    expect(formatStellarAddress("GSHORT")).toBe("GSHORT");
    expect(formatStellarAddress(null)).toBe("—");
    expect(formatStellarTxHash(undefined)).toBe("—");
  });

  it("states the memo requirement, naming the reference when there is one", () => {
    expect(describeMemoRequirement("MBOKA-4821")).toContain("MBOKA-4821");
    expect(describeMemoRequirement("MBOKA-4821")).toMatch(/held for review/i);
    expect(describeMemoRequirement(null)).toMatch(/required/i);
  });

  it("only builds an explorer link for a real transaction hash", () => {
    expect(stellarExplorerUrl(HASH)).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`);
    expect(stellarExplorerUrl(null)).toBeNull();
    expect(stellarExplorerUrl("")).toBeNull();
    expect(stellarExplorerUrl("not-a-hash")).toBeNull();
    expect(stellarExplorerUrl(HASH.slice(0, 40))).toBeNull();
  });

  it("gives every account status a label and colour", () => {
    for (const status of [
      "available",
      "pending_deposit",
      "processing_payout",
      "review_required",
      "failed",
    ] as const) {
      const descriptor = describeStellarStatus(status);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.color).toMatch(/^var\(--/);
    }
  });
});
