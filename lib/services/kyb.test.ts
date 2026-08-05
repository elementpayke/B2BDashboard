import { describe, expect, it } from "vitest";
import {
  buildProfilePayload,
  buildShareholderPayload,
  buildUploadFormData,
  canOpenKybWizard,
  describeKybStatus,
  emptyKybWizardDraft,
  isKybApproved,
  kybTierDisplay,
  profileDraftFromSummary,
  validateProfileDraft,
  type KybWizardProfileDraft,
} from "./kyb";

function validDraft(): KybWizardProfileDraft {
  const draft = emptyKybWizardDraft("KE");
  draft.legalName = "ElementPay Ltd";
  draft.registrationNumber = "BN123456";
  draft.businessType = "LimitedCompany";
  draft.street = "1 Finance Street";
  draft.city = "Nairobi";
  draft.postCode = "00100";
  draft.associates[0].firstName = "Jane";
  draft.associates[0].lastName = "Doe";
  draft.associates[0].dateOfBirth = "1985-03-15";
  draft.associates[0].ownershipPercentage = "60";
  return draft;
}

describe("kyb status helpers", () => {
  it("maps known statuses to tier display labels", () => {
    expect(describeKybStatus("approved")).toBe("Complete");
    expect(describeKybStatus("submitted")).toBe("In review");
    expect(kybTierDisplay("rejected").label).toBe("Rejected");
  });

  it("treats only approved as cleared for money actions", () => {
    expect(isKybApproved("approved")).toBe(true);
    expect(isKybApproved("submitted")).toBe(false);
    expect(isKybApproved("pending")).toBe(false);
  });

  it("allows the wizard for pending, rejected, and expired", () => {
    expect(canOpenKybWizard("pending")).toBe(true);
    expect(canOpenKybWizard("rejected")).toBe(true);
    expect(canOpenKybWizard("expired")).toBe(true);
    expect(canOpenKybWizard("submitted")).toBe(false);
    expect(canOpenKybWizard("approved")).toBe(false);
  });
});

describe("validateProfileDraft", () => {
  it("accepts a minimally complete draft", () => {
    expect(validateProfileDraft(validDraft())).toBeNull();
  });

  it("requires core business and UBO fields", () => {
    const draft = validDraft();
    draft.legalName = "";
    expect(validateProfileDraft(draft)).toMatch(/legal business name/i);
  });
});

describe("buildProfilePayload", () => {
  it("maps the wizard draft to Mboka KybProfileIn shape", () => {
    const payload = buildProfilePayload(validDraft());
    expect(payload.legal_name).toBe("ElementPay Ltd");
    expect(payload.country).toBe("KE");
    expect(payload.registered_address?.city).toBe("Nairobi");
    expect(payload.associates?.[0].relationship_types).toContain("UBO");
    expect(payload.associates?.[0].ubo?.ownership_percentage).toBe(60);
  });
});

describe("buildShareholderPayload", () => {
  it("uses camelCase keys expected by the aggregator pass-through", () => {
    const associate = validDraft().associates[0];
    expect(buildShareholderPayload(associate)).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      birthDate: "1985-03-15",
      email: undefined,
      phoneNumber: undefined,
      ownershipPercentage: 60,
    });
  });
});

describe("buildUploadFormData", () => {
  it("sets multipart fields for KYB document upload", () => {
    const file = new File(["x"], "coi.pdf", { type: "application/pdf" });
    const form = buildUploadFormData({
      file,
      documentType: "certificate_of_incorporation",
      issuingCountry: "KE",
    });
    expect(form.get("document_type")).toBe("certificate_of_incorporation");
    expect(form.get("issuing_country")).toBe("KE");
    expect(form.get("file")).toBe(file);
  });
});

describe("profileDraftFromSummary", () => {
  it("prefills from an existing KYB profile", () => {
    const draft = profileDraftFromSummary(
      {
        profile: {
          legal_name: "Acme",
          registration_number: "R1",
          country: "NG",
          business_type: "Partnership",
          registered_address: {
            street: "Main",
            city: "Lagos",
            post_code: "100001",
            country: "NG",
          },
          associates: [
            {
              id: "a1",
              relationship_types: ["UBO"],
              full_name: { first_name: "Sam", last_name: "Lee" },
              date_of_birth: "1990-01-01",
              ubo: { ownership_percentage: 100 },
            },
          ],
        },
      },
      { legal_name: "Fallback", country: "KE" },
    );
    expect(draft.legalName).toBe("Acme");
    expect(draft.city).toBe("Lagos");
    expect(draft.associates[0].firstName).toBe("Sam");
  });
});
