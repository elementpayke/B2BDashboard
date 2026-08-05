import { apiEnvelope, apiUpload } from "@/lib/apiClient";

export type KybStatus = "pending" | "submitted" | "approved" | "rejected" | "expired";

export type BusinessType =
  | "SoleTrader"
  | "LimitedCompany"
  | "LimitedLiabilityCompany"
  | "Partnership"
  | "NonProfit"
  | "Other";

export type EmployeeRange = "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";
export type AnnualRevenueRange = "LessThan100k" | "100kTo1M" | "1MTo10M" | "MoreThan10M";
export type SourceOfFunds = "Revenue" | "Investment" | "Loans" | "Grants" | "Other";

export type BusinessAddress = {
  street: string;
  street2?: string | null;
  city: string;
  post_code: string;
  state?: string | null;
  country: string;
};

export type AssociateIdentity = {
  issuing_country: string;
  id_type: "Passport" | "NationalIDCard" | "DrivingLicense" | "ResidencePermit";
  id_number: string;
  issued_date?: string | null;
  expiry_date?: string | null;
};

export type AssociateInput = {
  id: string;
  relationship_types: ("UBO" | "Representative" | "Director" | "Shareholder")[];
  full_name: { first_name: string; last_name: string };
  date_of_birth: string;
  email?: string | null;
  phone_number?: string | null;
  tax_residence_country?: string | null;
  residential_address?: BusinessAddress | null;
  identities?: AssociateIdentity[];
  ubo?: { ownership_percentage: number } | null;
};

export type KybProfileInput = {
  legal_name?: string | null;
  registration_number?: string | null;
  country?: string | null;
  tax_id?: string | null;
  business_type?: BusinessType | null;
  industry?: string | null;
  website?: string | null;
  estimated_employees?: EmployeeRange | null;
  annual_revenue_range?: AnnualRevenueRange | null;
  source_of_funds?: SourceOfFunds | null;
  incorporation_date?: string | null;
  registered_address?: BusinessAddress | null;
  associates?: AssociateInput[] | null;
};

export type KybProfile = KybProfileInput & {
  business_id?: number;
  kyb_status?: KybStatus;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  registered_address?: BusinessAddress | null;
  associates?: AssociateInput[] | null;
};

export type KybSummary = { profile: KybProfile | null };

export type KybRequiredDocument = {
  type: string;
  category: "business" | "shareholder";
  label: string;
  requires_associate_ref_id: boolean;
  issuing_country_required: boolean;
  uploaded: boolean;
};

export type KybDocumentRequirements = {
  provider: "international_ramp";
  corridor: string | null;
  business_documents: KybRequiredDocument[];
  shareholder_documents: KybRequiredDocument[];
  disclaimer: string | null;
};

export type KybInitiateResult = {
  provider: "international_ramp" | "noah";
  kyb_status: KybStatus;
  document_requirements: KybDocumentRequirements | null;
};

export type KybDocument = {
  id: number;
  document_type: string;
  provider_document_type: string;
  issuing_country?: string | null;
  associate_ref_id?: string | null;
  is_active: boolean;
};

export type KybDocumentList = { documents: KybDocument[] };

export type KybStatusResult = {
  kyb_status: KybStatus;
  profile_exists: boolean;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
};

export type KybShareholderList = { shareholders: Record<string, unknown>[] };

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "SoleTrader", label: "Sole trader" },
  { value: "LimitedCompany", label: "Limited company" },
  { value: "LimitedLiabilityCompany", label: "LLC" },
  { value: "Partnership", label: "Partnership" },
  { value: "NonProfit", label: "Non-profit" },
  { value: "Other", label: "Other" },
];

export const EMPLOYEE_RANGE_OPTIONS: { value: EmployeeRange; label: string }[] = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-1000", label: "201–1,000" },
  { value: "1000+", label: "1,000+" },
];

export const REVENUE_RANGE_OPTIONS: { value: AnnualRevenueRange; label: string }[] = [
  { value: "LessThan100k", label: "Under $100k" },
  { value: "100kTo1M", label: "$100k – $1M" },
  { value: "1MTo10M", label: "$1M – $10M" },
  { value: "MoreThan10M", label: "Over $10M" },
];

export const SOURCE_OF_FUNDS_OPTIONS: { value: SourceOfFunds; label: string }[] = [
  { value: "Revenue", label: "Revenue" },
  { value: "Investment", label: "Investment" },
  { value: "Loans", label: "Loans" },
  { value: "Grants", label: "Grants" },
  { value: "Other", label: "Other" },
];

export type KybTierDisplay = { label: string; color: string; soft: string };

const KYB_TIER_DISPLAY: Record<KybStatus, KybTierDisplay> = {
  approved: { label: "Complete", color: "var(--indigo-text)", soft: "var(--indigo-tint)" },
  submitted: { label: "In review", color: "var(--amber)", soft: "var(--amber-tint)" },
  rejected: { label: "Rejected", color: "var(--red)", soft: "var(--red-tint)" },
  expired: { label: "Expired", color: "var(--red)", soft: "var(--red-tint)" },
  pending: { label: "Not started", color: "var(--muted)", soft: "var(--surface2)" },
};

export function kybTierDisplay(status: string | null | undefined): KybTierDisplay {
  return KYB_TIER_DISPLAY[(status as KybStatus) || "pending"] ?? KYB_TIER_DISPLAY.pending;
}

export function isKybApproved(status: string | null | undefined): boolean {
  return status === "approved";
}

export function canOpenKybWizard(status: string | null | undefined): boolean {
  return status === "pending" || status === "rejected" || status === "expired";
}

export function describeKybStatus(status: string | null | undefined): string {
  return kybTierDisplay(status).label;
}

/** Stable UUID v4-ish id for a new associate row. */
export function newAssociateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `assoc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type KybWizardAssociateDraft = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phoneNumber: string;
  ownershipPercentage: string;
  country: string;
};

export type KybWizardProfileDraft = {
  legalName: string;
  registrationNumber: string;
  country: string;
  taxId: string;
  businessType: BusinessType | "";
  industry: string;
  website: string;
  estimatedEmployees: EmployeeRange | "";
  annualRevenueRange: AnnualRevenueRange | "";
  sourceOfFunds: SourceOfFunds | "";
  street: string;
  street2: string;
  city: string;
  postCode: string;
  state: string;
  addressCountry: string;
  associates: KybWizardAssociateDraft[];
};

export function emptyKybWizardDraft(defaultCountry = "KE"): KybWizardProfileDraft {
  return {
    legalName: "",
    registrationNumber: "",
    country: defaultCountry,
    taxId: "",
    businessType: "",
    industry: "",
    website: "",
    estimatedEmployees: "",
    annualRevenueRange: "",
    sourceOfFunds: "",
    street: "",
    street2: "",
    city: "",
    postCode: "",
    state: "",
    addressCountry: defaultCountry,
    associates: [
      {
        id: newAssociateId(),
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        email: "",
        phoneNumber: "",
        ownershipPercentage: "",
        country: defaultCountry,
      },
    ],
  };
}

export function profileDraftFromSummary(
  summary: KybSummary | null | undefined,
  business?: { legal_name?: string | null; country?: string; registration_number?: string | null } | null,
): KybWizardProfileDraft {
  const draft = emptyKybWizardDraft(business?.country || "KE");
  const profile = summary?.profile;
  if (!profile) {
    if (business?.legal_name) draft.legalName = business.legal_name;
    if (business?.registration_number) draft.registrationNumber = business.registration_number;
    if (business?.country) draft.country = business.country;
    return draft;
  }
  draft.legalName = (profile.legal_name as string) || business?.legal_name || "";
  draft.registrationNumber = (profile.registration_number as string) || business?.registration_number || "";
  draft.country = (profile.country as string) || business?.country || draft.country;
  draft.taxId = (profile.tax_id as string) || "";
  draft.businessType = (profile.business_type as BusinessType) || "";
  draft.industry = (profile.industry as string) || "";
  draft.website = (profile.website as string) || "";
  draft.estimatedEmployees = (profile.estimated_employees as EmployeeRange) || "";
  draft.annualRevenueRange = (profile.annual_revenue_range as AnnualRevenueRange) || "";
  draft.sourceOfFunds = (profile.source_of_funds as SourceOfFunds) || "";
  const addr = profile.registered_address as BusinessAddress | null | undefined;
  if (addr) {
    draft.street = addr.street || "";
    draft.street2 = addr.street2 || "";
    draft.city = addr.city || "";
    draft.postCode = addr.post_code || "";
    draft.state = addr.state || "";
    draft.addressCountry = addr.country || draft.addressCountry;
  }
  const associates = (profile.associates as AssociateInput[] | null | undefined) ?? [];
  if (associates.length > 0) {
    draft.associates = associates.map((a) => ({
      id: a.id,
      firstName: a.full_name?.first_name || "",
      lastName: a.full_name?.last_name || "",
      dateOfBirth: a.date_of_birth || "",
      email: a.email || "",
      phoneNumber: a.phone_number || "",
      ownershipPercentage: a.ubo?.ownership_percentage != null ? String(a.ubo.ownership_percentage) : "",
      country: a.tax_residence_country || a.residential_address?.country || draft.country,
    }));
  }
  return draft;
}

export function validateBusinessStep(draft: KybWizardProfileDraft): string | null {
  if (!draft.legalName.trim()) return "Legal business name is required.";
  if (!draft.registrationNumber.trim()) return "Registration number is required.";
  if (!draft.country.trim() || draft.country.trim().length !== 2) return "Country must be a 2-letter ISO code.";
  if (!draft.businessType) return "Choose a business type.";
  return null;
}

export function validateAddressUboStep(draft: KybWizardProfileDraft): string | null {
  if (!draft.street.trim() || !draft.city.trim() || !draft.postCode.trim()) {
    return "Registered address (street, city, post code) is required.";
  }
  if (!draft.addressCountry.trim() || draft.addressCountry.trim().length !== 2) {
    return "Address country must be a 2-letter ISO code.";
  }
  const associate = draft.associates[0];
  if (!associate?.firstName.trim() || !associate.lastName.trim()) {
    return "At least one beneficial owner name is required.";
  }
  if (!associate.dateOfBirth.trim()) return "Beneficial owner date of birth is required.";
  const ownership = Number(associate.ownershipPercentage);
  if (!Number.isFinite(ownership) || ownership <= 0 || ownership > 100) {
    return "Beneficial owner ownership must be between 1 and 100.";
  }
  return null;
}

export function validateProfileDraft(draft: KybWizardProfileDraft): string | null {
  return validateBusinessStep(draft) ?? validateAddressUboStep(draft);
}

export function buildProfilePayload(draft: KybWizardProfileDraft): KybProfileInput {
  const associate = draft.associates[0];
  const registered_address: BusinessAddress = {
    street: draft.street.trim(),
    street2: draft.street2.trim() || undefined,
    city: draft.city.trim(),
    post_code: draft.postCode.trim(),
    state: draft.state.trim() || undefined,
    country: draft.addressCountry.trim().toUpperCase(),
  };
  const associates: AssociateInput[] = [
    {
      id: associate.id,
      relationship_types: ["UBO", "Representative"],
      full_name: {
        first_name: associate.firstName.trim(),
        last_name: associate.lastName.trim(),
      },
      date_of_birth: associate.dateOfBirth.trim(),
      email: associate.email.trim() || undefined,
      phone_number: associate.phoneNumber.trim() || undefined,
      tax_residence_country: associate.country.trim().toUpperCase(),
      ubo: { ownership_percentage: Number(associate.ownershipPercentage) },
    },
  ];
  return {
    legal_name: draft.legalName.trim(),
    registration_number: draft.registrationNumber.trim(),
    country: draft.country.trim().toUpperCase(),
    tax_id: draft.taxId.trim() || undefined,
    business_type: draft.businessType || undefined,
    industry: draft.industry.trim() || undefined,
    website: draft.website.trim() || undefined,
    estimated_employees: draft.estimatedEmployees || undefined,
    annual_revenue_range: draft.annualRevenueRange || undefined,
    source_of_funds: draft.sourceOfFunds || undefined,
    registered_address,
    associates,
  };
}

export function buildShareholderPayload(associate: KybWizardAssociateDraft): Record<string, unknown> {
  return {
    firstName: associate.firstName.trim(),
    lastName: associate.lastName.trim(),
    birthDate: associate.dateOfBirth.trim(),
    email: associate.email.trim() || undefined,
    phoneNumber: associate.phoneNumber.trim() || undefined,
    ownershipPercentage: Number(associate.ownershipPercentage),
  };
}

export function buildUploadFormData(input: {
  file: File;
  documentType: string;
  issuingCountry?: string;
  associateRefId?: string;
}): FormData {
  const form = new FormData();
  form.set("file", input.file);
  form.set("document_type", input.documentType);
  if (input.issuingCountry) form.set("issuing_country", input.issuingCountry);
  if (input.associateRefId) form.set("associate_ref_id", input.associateRefId);
  return form;
}

function businessPath(businessId: number, suffix: string): string {
  return `/businesses/${businessId}/kyb${suffix}`;
}

export const kybApi = {
  summary: (businessId: number) => apiEnvelope<KybSummary>("GET", businessPath(businessId, "")),
  status: (businessId: number) => apiEnvelope<KybStatusResult>("GET", businessPath(businessId, "/status")),
  createProfile: (businessId: number, payload: KybProfileInput) =>
    apiEnvelope<KybProfile>("POST", businessPath(businessId, "/profile"), payload),
  patchProfile: (businessId: number, payload: Partial<KybProfileInput>) =>
    apiEnvelope<KybProfile>("PATCH", businessPath(businessId, "/profile"), payload),
  upsertAddress: (businessId: number, payload: BusinessAddress) =>
    apiEnvelope<BusinessAddress & { id: number }>("PUT", businessPath(businessId, "/address"), payload),
  initiate: (businessId: number) =>
    apiEnvelope<KybInitiateResult>("POST", businessPath(businessId, "/initiate"), { provider: "international_ramp" }),
  documentRequirements: (businessId: number, corridor?: string) => {
    const qs = corridor ? `?corridor=${encodeURIComponent(corridor)}` : "";
    return apiEnvelope<KybDocumentRequirements>(
      "GET",
      `/businesses/${businessId}/kyb/document-requirements${qs}`,
    );
  },
  listDocuments: (businessId: number) =>
    apiEnvelope<KybDocumentList>("GET", businessPath(businessId, "/documents")),
  uploadDocument: (businessId: number, formData: FormData) =>
    apiUpload<KybDocument>("POST", businessPath(businessId, "/documents"), formData),
  submitDocument: (businessId: number, docId: number) =>
    apiEnvelope<unknown>("POST", businessPath(businessId, "/documents/submit"), { doc_id: docId }),
  listShareholders: (businessId: number) =>
    apiEnvelope<KybShareholderList>("GET", businessPath(businessId, "/shareholders")),
  addShareholder: (businessId: number, shareholder: Record<string, unknown>) =>
    apiEnvelope<unknown>("POST", businessPath(businessId, "/shareholders"), { shareholder }),
  submitShareholderDocument: (businessId: number, docId: number, shareholderId: string) =>
    apiEnvelope<unknown>("POST", businessPath(businessId, "/shareholders/documents"), {
      doc_id: docId,
      shareholder_id: shareholderId,
    }),
  submitForReview: (businessId: number) =>
    apiEnvelope<unknown>("POST", businessPath(businessId, "/submit"), {}),
};
