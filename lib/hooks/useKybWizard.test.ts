/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pollVerifierStatus = vi.fn();
const submitForReview = vi.fn();
const initiate = vi.fn();
const summary = vi.fn();
const patchProfile = vi.fn();
const createProfile = vi.fn();
const upsertAddress = vi.fn();
const documentRequirements = vi.fn();

vi.mock("@/lib/services/kyb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/kyb")>();
  return {
    ...actual,
    kybApi: {
      ...actual.kybApi,
      pollVerifierStatus: (...args: unknown[]) => pollVerifierStatus(...args),
      submitForReview: (...args: unknown[]) => submitForReview(...args),
      initiate: (...args: unknown[]) => initiate(...args),
      summary: (...args: unknown[]) => summary(...args),
      patchProfile: (...args: unknown[]) => patchProfile(...args),
      createProfile: (...args: unknown[]) => createProfile(...args),
      upsertAddress: (...args: unknown[]) => upsertAddress(...args),
      documentRequirements: (...args: unknown[]) => documentRequirements(...args),
      listDocuments: vi.fn().mockResolvedValue({ documents: [] }),
      uploadDocument: vi.fn(),
      submitDocument: vi.fn(),
      listShareholders: vi.fn().mockResolvedValue({ shareholders: [] }),
      addShareholder: vi.fn(),
      submitShareholderDocument: vi.fn(),
      status: vi.fn(),
    },
  };
});

import { useKybWizard } from "./useKybWizard";
import { ApiRequestError } from "@/lib/apiClient";

beforeEach(() => {
  vi.clearAllMocks();
  pollVerifierStatus.mockResolvedValue({ kyb_status: "submitted", profile_exists: true });
  submitForReview.mockResolvedValue({});
});

describe("useKybWizard restore + submit poll", () => {
  it("restores to step 2 when pending profile has address and associates", async () => {
    const { result } = renderHook(() =>
      useKybWizard({
        businessId: 1,
        enabled: true,
        kybSummary: {
          profile: {
            kyb_status: "pending",
            legal_name: "Acme",
            registration_number: "R1",
            business_type: "LimitedCompany",
            industry: "Fintech",
            estimated_employees: "1-10",
            annual_revenue_range: "100kTo1M",
            source_of_funds: "Revenue",
            country: "KE",
            registered_address: {
              street: "1 Main",
              city: "Nairobi",
              post_code: "00100",
              country: "KE",
            },
            associates: [
              {
                id: "a1",
                relationship_types: ["UBO"],
                full_name: { first_name: "Jane", last_name: "Doe" },
                date_of_birth: "1985-03-15",
                email: "jane@example.com",
                phone_number: "+254700000000",
                ubo: { ownership_percentage: 60 },
              },
            ],
          },
        },
        business: { legal_name: "Acme", country: "KE", registration_number: "R1" },
      }),
    );

    await waitFor(() => {
      expect(result.current.step).toBe(2);
    });
    expect(result.current.draft.legalName).toBe("Acme");
    expect(result.current.draft.city).toBe("Nairobi");
  });

  it("does not wipe step when reopening the same business mid-flow", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useKybWizard({
          businessId: 1,
          enabled,
          kybSummary: { profile: { kyb_status: "pending", legal_name: "Acme" } },
          business: { legal_name: "Acme", country: "KE" },
        }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.step).toBe(1));

    act(() => {
      result.current.patchDraft({ legalName: "Edited Name" });
    });
    // Advance locally without API (step 1 → 2 only validates business fields — incomplete).
    // Simulate mid-flow by closing and reopening.
    rerender({ enabled: false });
    rerender({ enabled: true });

    expect(result.current.draft.legalName).toBe("Edited Name");
    expect(result.current.step).toBe(1);
  });

  it("polls verifier status after submitForReview succeeds", async () => {
    const onSubmitted = vi.fn();
    const { result } = renderHook(() =>
      useKybWizard({
        businessId: 5,
        enabled: true,
        kybSummary: { profile: null },
        onSubmitted,
      }),
    );

    // Force step 4 path by calling submit via nextStep after mocking docsComplete.
    // Directly exercise the submit path by advancing to step 4 through internal nextStep
    // is heavy — call through the returned submit by finishing step 4.
    // The hook exposes submit only via nextStep at step 4; set up doc rows via prepare path.
    await act(async () => {
      // Jump: use nextStep only works from current step. Manually invoke by
      // setting draft valid and walking — instead spy on internal by calling
      // the public API after forcing step with a second open that has docs.
    });

    // Minimal path: reopen with address+associates+requirements flag via second render
    // that lands on step 3 is tested elsewhere. Here call submit by walking to step 4
    // after preparing empty doc rows that are already submitted.
    documentRequirements.mockResolvedValue({
      provider: "international_ramp",
      corridor: "KE",
      business_documents: [
        {
          type: "certificate_of_incorporation",
          category: "business",
          label: "Certificate of incorporation",
          requires_associate_ref_id: false,
          issuing_country_required: false,
          uploaded: true,
        },
      ],
      shareholder_documents: [],
      disclaimer: null,
    });
    initiate.mockResolvedValue({
      provider: "international_ramp",
      kyb_status: "pending",
      document_requirements: null,
    });
    summary.mockResolvedValue({
      profile: {
        legal_name: "Acme",
        registration_number: "R1",
        country: "KE",
        business_type: "LimitedCompany",
        industry: "Fintech",
        estimated_employees: "1-10",
        annual_revenue_range: "100kTo1M",
        source_of_funds: "Revenue",
        registered_address: {
          street: "1 Main",
          city: "Nairobi",
          post_code: "00100",
          country: "KE",
        },
        associates: [
          {
            id: "a1",
            relationship_types: ["UBO"],
            full_name: { first_name: "Jane", last_name: "Doe" },
            date_of_birth: "1985-03-15",
            email: "jane@example.com",
            phone_number: "+254700000000",
            ubo: { ownership_percentage: 60 },
          },
        ],
      },
    });
    patchProfile.mockResolvedValue({});
    upsertAddress.mockResolvedValue({});

    const full = renderHook(() =>
      useKybWizard({
        businessId: 5,
        enabled: true,
        kybSummary: {
          profile: {
            kyb_status: "pending",
            legal_name: "Acme",
            registration_number: "R1",
            business_type: "LimitedCompany",
            industry: "Fintech",
            estimated_employees: "1-10",
            annual_revenue_range: "100kTo1M",
            source_of_funds: "Revenue",
            country: "KE",
            registered_address: {
              street: "1 Main",
              city: "Nairobi",
              post_code: "00100",
              country: "KE",
            },
            associates: [
              {
                id: "a1",
                relationship_types: ["UBO"],
                full_name: { first_name: "Jane", last_name: "Doe" },
                date_of_birth: "1985-03-15",
                email: "jane@example.com",
                phone_number: "+254700000000",
                tax_residence_country: "KE",
                ubo: { ownership_percentage: 60 },
              },
            ],
          },
        },
        business: { legal_name: "Acme", country: "KE", registration_number: "R1" },
        onSubmitted,
      }),
    );

    await waitFor(() => expect(full.result.current.step).toBe(2));
    await act(async () => {
      await full.result.current.nextStep();
    });
    await waitFor(() => expect(full.result.current.step).toBe(3));
    expect(full.result.current.docsComplete).toBe(true);
    await act(async () => {
      await full.result.current.nextStep();
    });
    await waitFor(() => expect(full.result.current.step).toBe(4));
    await act(async () => {
      await full.result.current.nextStep();
    });

    await waitFor(() => {
      expect(submitForReview).toHaveBeenCalled();
      expect(pollVerifierStatus).toHaveBeenCalledWith(5);
      expect(onSubmitted).toHaveBeenCalled();
      expect(full.result.current.submitted).toBe(true);
    });
  });

  it("surfaces 422 missing[] on submit failure", async () => {
    submitForReview.mockRejectedValue(
      new ApiRequestError("Incomplete", 422, { missing: ["identity", "tax_id"] }),
    );

    documentRequirements.mockResolvedValue({
      provider: "international_ramp",
      corridor: null,
      business_documents: [
        {
          type: "identity",
          category: "business",
          label: "Identity",
          requires_associate_ref_id: false,
          issuing_country_required: false,
          uploaded: true,
        },
      ],
      shareholder_documents: [],
      disclaimer: null,
    });
    initiate.mockResolvedValue({
      provider: "international_ramp",
      kyb_status: "pending",
      document_requirements: null,
    });
    summary.mockResolvedValue({ profile: { legal_name: "Acme" } });
    patchProfile.mockResolvedValue({});
    upsertAddress.mockResolvedValue({});

    const { result } = renderHook(() =>
      useKybWizard({
        businessId: 3,
        enabled: true,
        kybSummary: {
          profile: {
            kyb_status: "pending",
            legal_name: "Acme",
            registration_number: "R1",
            business_type: "LimitedCompany",
            industry: "Fintech",
            estimated_employees: "1-10",
            annual_revenue_range: "100kTo1M",
            source_of_funds: "Revenue",
            country: "KE",
            registered_address: {
              street: "1 Main",
              city: "Nairobi",
              post_code: "00100",
              country: "KE",
            },
            associates: [
              {
                id: "a1",
                relationship_types: ["UBO"],
                full_name: { first_name: "Jane", last_name: "Doe" },
                date_of_birth: "1985-03-15",
                email: "jane@example.com",
                phone_number: "+254700000000",
                tax_residence_country: "KE",
                ubo: { ownership_percentage: 60 },
              },
            ],
          },
        },
        business: { legal_name: "Acme", country: "KE", registration_number: "R1" },
      }),
    );

    await waitFor(() => expect(result.current.step).toBe(2));
    await act(async () => {
      await result.current.nextStep();
    });
    await waitFor(() => expect(result.current.step).toBe(3));
    await act(async () => {
      await result.current.nextStep();
    });
    await waitFor(() => expect(result.current.step).toBe(4));
    await act(async () => {
      await result.current.nextStep();
    });

    await waitFor(() => {
      expect(result.current.error).toMatch(/identity.*tax_id/i);
      expect(result.current.submitted).toBe(false);
    });
  });
});
