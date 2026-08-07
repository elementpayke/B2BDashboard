"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/apiClient";
import {
  buildProfilePayload,
  buildShareholderPayload,
  buildUploadFormData,
  formatKybServiceError,
  kybApi,
  profileDraftFromSummary,
  validateAddressUboStep,
  validateBusinessStep,
  validateProfileDraft,
  type KybDocumentRequirements,
  type KybWizardProfileDraft,
} from "@/lib/services/kyb";

export type UseKybWizardOptions = {
  businessId: number | null | undefined;
  defaultCountry?: string;
  /** Prefill from auth/me kyb_summary + business. */
  kybSummary?: { profile: Record<string, unknown> | null } | null;
  business?: {
    legal_name?: string | null;
    country?: string;
    registration_number?: string | null;
  } | null;
  enabled: boolean;
  onSubmitted?: () => void;
};

export type KybWizardStep = 1 | 2 | 3 | 4;

export type DocumentUploadState = {
  requirementType: string;
  label: string;
  category: "business" | "shareholder";
  associateRefId?: string;
  issuingCountryRequired: boolean;
  file: File | null;
  uploadedDocId: number | null;
  submitted: boolean;
  uploading: boolean;
  error: string;
};

const STEP_LABELS = ["Business", "Address & UBO", "Documents", "Submit"];

export function useKybWizard(opts: UseKybWizardOptions) {
  const [step, setStep] = useState<KybWizardStep>(1);
  const [draft, setDraft] = useState<KybWizardProfileDraft>(() =>
    profileDraftFromSummary(opts.kybSummary, opts.business),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requirements, setRequirements] = useState<KybDocumentRequirements | null>(null);
  const [docRows, setDocRows] = useState<DocumentUploadState[]>([]);
  const [shareholderId, setShareholderId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!opts.enabled) return;
    setDraft(profileDraftFromSummary(opts.kybSummary, opts.business));
    setStep(1);
    setError("");
    setSubmitted(false);
    setRequirements(null);
    setDocRows([]);
    setShareholderId(null);
  }, [opts.enabled, opts.businessId, opts.kybSummary, opts.business]);

  const patchDraft = useCallback((patch: Partial<KybWizardProfileDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      // Keep address + UBO tax country aligned when the business country changes
      // and those fields still match the previous business country (or are empty).
      if (patch.country && patch.country !== prev.country) {
        if (!prev.addressCountry || prev.addressCountry === prev.country) {
          next.addressCountry = patch.country;
        }
        next.associates = next.associates.map((a) =>
          !a.country || a.country === prev.country ? { ...a, country: patch.country! } : a,
        );
      }
      return next;
    });
  }, []);

  const patchAssociate = useCallback((index: number, patch: Partial<KybWizardProfileDraft["associates"][0]>) => {
    setDraft((prev) => ({
      ...prev,
      associates: prev.associates.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  }, []);

  const saveProfile = useCallback(async (): Promise<boolean> => {
    const validationError = validateProfileDraft(draft);
    if (validationError) {
      setError(validationError);
      return false;
    }
    if (!opts.businessId) {
      setError("No business is linked to this session.");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      const payload = buildProfilePayload(draft);
      const summary = await kybApi.summary(opts.businessId);
      if (summary.profile) {
        await kybApi.patchProfile(opts.businessId, payload);
      } else {
        await kybApi.createProfile(opts.businessId, payload);
      }
      await kybApi.upsertAddress(opts.businessId, payload.registered_address!);
      setBusy(false);
      return true;
    } catch (err) {
      setBusy(false);
      setError(formatKybServiceError(err));
      return false;
    }
  }, [draft, opts.businessId]);

  const prepareDocuments = useCallback(async (): Promise<boolean> => {
    if (!opts.businessId) return false;
    setBusy(true);
    setError("");
    try {
      let reqs = requirements;
      if (!reqs) {
        try {
          const initiated = await kybApi.initiate(opts.businessId);
          reqs = initiated.document_requirements ?? null;
        } catch (initiateErr) {
          // Aggregator/sandbox can 502 on enroll while profile is already saved.
          // Fall back to the requirements endpoint so the user can continue.
          try {
            reqs = await kybApi.documentRequirements(opts.businessId, draft.country || undefined);
          } catch {
            setBusy(false);
            setError(formatKybServiceError(initiateErr));
            return false;
          }
        }
        if (!reqs) {
          reqs = await kybApi.documentRequirements(opts.businessId, draft.country || undefined);
        }
        setRequirements(reqs);
      }
      const associateRef = draft.associates[0]?.id;
      const rows: DocumentUploadState[] = [
        ...reqs.business_documents.map((d) => ({
          requirementType: d.type,
          label: d.label,
          category: "business" as const,
          issuingCountryRequired: d.issuing_country_required,
          file: null,
          uploadedDocId: null,
          submitted: d.uploaded,
          uploading: false,
          error: "",
        })),
        ...reqs.shareholder_documents.map((d) => ({
          requirementType: d.type,
          label: d.label,
          category: "shareholder" as const,
          associateRefId: associateRef,
          issuingCountryRequired: d.issuing_country_required,
          file: null,
          uploadedDocId: null,
          submitted: false,
          uploading: false,
          error: "",
        })),
      ];
      setDocRows(rows);
      setBusy(false);
      return true;
    } catch (err) {
      setBusy(false);
      setError(formatKybServiceError(err));
      return false;
    }
  }, [draft.associates, draft.country, opts.businessId, requirements]);

  const ensureShareholderRegistered = useCallback(async (): Promise<string | null> => {
    if (!opts.businessId) return null;
    if (shareholderId) return shareholderId;
    const associate = draft.associates[0];
    await kybApi.addShareholder(opts.businessId, buildShareholderPayload(associate));
    const list = await kybApi.listShareholders(opts.businessId);
    const match = list.shareholders.find((sh) => {
      const first = String(sh.firstName ?? sh.first_name ?? "").toLowerCase();
      const last = String(sh.lastName ?? sh.last_name ?? "").toLowerCase();
      return (
        first === associate.firstName.trim().toLowerCase() &&
        last === associate.lastName.trim().toLowerCase()
      );
    });
    const id = String(match?.id ?? match?.shareholderId ?? match?.shareholder_id ?? "");
    if (id) setShareholderId(id);
    return id || null;
  }, [draft.associates, opts.businessId, shareholderId]);

  const uploadDocumentRow = useCallback(
    async (index: number) => {
      if (!opts.businessId) return;
      const row = docRows[index];
      if (!row?.file) {
        setDocRows((rows) =>
          rows.map((r, i) => (i === index ? { ...r, error: "Choose a file first." } : r)),
        );
        return;
      }
      setDocRows((rows) => rows.map((r, i) => (i === index ? { ...r, uploading: true, error: "" } : r)));
      try {
        const form = buildUploadFormData({
          file: row.file,
          documentType: row.requirementType,
          issuingCountry: row.issuingCountryRequired ? draft.country : undefined,
          associateRefId: row.associateRefId,
        });
        const uploaded = await kybApi.uploadDocument(opts.businessId, form);
        if (row.category === "business") {
          await kybApi.submitDocument(opts.businessId, uploaded.id);
        } else {
          const shId = await ensureShareholderRegistered();
          if (!shId) throw new Error("Register the beneficial owner with the verifier first.");
          await kybApi.submitShareholderDocument(opts.businessId, uploaded.id, shId);
        }
        setDocRows((rows) =>
          rows.map((r, i) =>
            i === index
              ? { ...r, uploading: false, uploadedDocId: uploaded.id, submitted: true, error: "" }
              : r,
          ),
        );
      } catch (err) {
        setDocRows((rows) =>
          rows.map((r, i) =>
            i === index
              ? {
                  ...r,
                  uploading: false,
                  error:
                    err instanceof ApiRequestError || err instanceof Error
                      ? err.message
                      : "Upload failed.",
                }
              : r,
          ),
        );
      }
    },
    [docRows, draft.country, ensureShareholderRegistered, opts.businessId],
  );

  const setDocumentFile = useCallback((index: number, file: File | null) => {
    setDocRows((rows) => rows.map((r, i) => (i === index ? { ...r, file, error: "" } : r)));
  }, []);

  const submitForReview = useCallback(async (): Promise<boolean> => {
    if (!opts.businessId) return false;
    setBusy(true);
    setError("");
    try {
      await kybApi.submitForReview(opts.businessId);
      setSubmitted(true);
      setBusy(false);
      opts.onSubmitted?.();
      return true;
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiRequestError || err instanceof Error ? err.message : "Submit failed.");
      return false;
    }
  }, [opts]);

  const nextStep = useCallback(async () => {
    if (step === 1) {
      const validationError = validateBusinessStep(draft);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (step === 2) {
      const validationError = validateAddressUboStep(draft);
      if (validationError) {
        setError(validationError);
        return;
      }
      const ok = await saveProfile();
      if (!ok) return;
      const docsOk = await prepareDocuments();
      if (!docsOk) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      const pending = docRows.some((r) => !r.submitted);
      if (pending) {
        setError("Upload and submit every required document before continuing.");
        return;
      }
      setStep(4);
      return;
    }
    await submitForReview();
  }, [docRows, prepareDocuments, saveProfile, step, submitForReview]);

  const backStep = useCallback(() => {
    setError("");
    setStep((s) => Math.max(1, s - 1) as KybWizardStep);
  }, []);

  const stepDots = STEP_LABELS.map((_, i) => ({ on: i + 1 <= step }));
  const docsComplete = docRows.length > 0 && docRows.every((r) => r.submitted);

  return {
    step,
    stepLabels: STEP_LABELS,
    stepDots,
    draft,
    patchDraft,
    patchAssociate,
    error,
    busy,
    docRows,
    setDocumentFile,
    uploadDocumentRow,
    docsComplete,
    submitted,
    nextStep,
    backStep,
  };
}
