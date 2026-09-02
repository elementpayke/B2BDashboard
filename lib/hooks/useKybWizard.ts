"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildProfilePayload,
  buildShareholderPayload,
  buildUploadFormData,
  canOpenKybWizard,
  formatKybServiceError,
  helpForDocumentType,
  inferWizardStartStep,
  kybApi,
  labelForDocumentType,
  newKybIdempotencyKey,
  profileDraftFromSummary,
  resizeAssociates,
  validateAddressUboStep,
  validateBusinessStep,
  validateKybDocumentFile,
  validateProfileDraft,
  validateSubmitStep,
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
  /** Live KYB status from /auth/me — used to reset after reject/expire. */
  kybStatus?: string | null;
  enabled: boolean;
  onSubmitted?: () => void;
};

export type KybWizardStep = 1 | 2 | 3 | 4;

export type DocumentUploadState = {
  requirementType: string;
  label: string;
  description: string;
  helpText: string;
  category: "business" | "shareholder";
  associateRefId?: string;
  issuingCountryRequired: boolean;
  file: File | null;
  uploadedDocId: number | null;
  downloadable: boolean;
  submitted: boolean;
  uploading: boolean;
  error: string;
};

export type KybSubmitOutcome = "submitted" | "approved" | "rejected";

type ListedDoc = {
  id: number;
  provider_document_type: string;
  is_active: boolean;
  downloadable?: boolean;
};

const STEP_LABELS = ["Business", "Address & UBO", "Documents", "Submit"];

const POST_SUBMIT_POLL_ATTEMPTS = 3;
const POST_SUBMIT_POLL_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listedByType(listedDocs: ListedDoc[]): Map<string, ListedDoc> {
  const byType = new Map<string, ListedDoc>();
  for (const d of listedDocs) {
    if (!d.is_active) continue;
    const key = String(d.provider_document_type || "").trim().toLowerCase();
    if (key && !byType.has(key)) byType.set(key, d);
  }
  return byType;
}

function mapRequirementRows(
  reqs: KybDocumentRequirements,
  listedDocs: ListedDoc[],
  associateRef: string | undefined,
  previous?: DocumentUploadState[],
): DocumentUploadState[] {
  const byType = listedByType(listedDocs);
  const prevByType = new Map(
    (previous || []).map((r) => [r.requirementType.trim().toLowerCase(), r]),
  );

  const mapDoc = (
    d: KybDocumentRequirements["business_documents"][number],
    category: "business" | "shareholder",
  ): DocumentUploadState => {
    const type = d.type;
    const key = type.trim().toLowerCase();
    const listed = byType.get(key);
    const uploadedId = d.uploaded_doc_id ?? listed?.id ?? null;
    const prev = prevByType.get(key);
    // Keep in-flight upload / local file when revisiting step 3.
    if (prev && (prev.uploading || prev.file) && !uploadedId) {
      return {
        ...prev,
        label: d.label?.trim() || labelForDocumentType(type),
        description: d.description?.trim() || labelForDocumentType(type),
        helpText: helpForDocumentType(type, d.help_text),
        category,
        associateRefId: category === "shareholder" ? associateRef : undefined,
        issuingCountryRequired: d.issuing_country_required,
      };
    }
    return {
      requirementType: type,
      label: d.label?.trim() || labelForDocumentType(type),
      description: d.description?.trim() || labelForDocumentType(type),
      helpText: helpForDocumentType(type, d.help_text),
      category,
      associateRefId: category === "shareholder" ? associateRef : undefined,
      issuingCountryRequired: d.issuing_country_required,
      file: null,
      uploadedDocId: uploadedId,
      downloadable: !!(listed?.downloadable ?? (uploadedId != null && d.uploaded)),
      submitted: !!d.uploaded || uploadedId != null,
      uploading: false,
      error: "",
    };
  };

  return [
    ...reqs.business_documents.map((d) => mapDoc(d, "business")),
    ...reqs.shareholder_documents.map((d) => mapDoc(d, "shareholder")),
  ];
}

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
  const [submitOutcome, setSubmitOutcome] = useState<KybSubmitOutcome>("submitted");

  /** Only full-reset when business changes, first open, or status becomes editable again. */
  const sessionBusinessIdRef = useRef<number | null | undefined>(undefined);
  const sessionInitializedRef = useRef(false);
  const sessionStatusRef = useRef<string | null | undefined>(undefined);
  const resumeLoadIdRef = useRef(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  useEffect(() => {
    if (!opts.enabled) return;

    const businessChanged = sessionBusinessIdRef.current !== opts.businessId;
    const firstOpen = !sessionInitializedRef.current;
    const status = opts.kybStatus ?? null;
    const prevStatus = sessionStatusRef.current;
    // Clear success UI when KYB becomes editable again after a submit
    // (reject/expire, or pending after a local submit while status was still locked).
    const wasLocked = prevStatus === "submitted" || prevStatus === "approved";
    const statusBecameEditable =
      !!sessionInitializedRef.current &&
      canOpenKybWizard(status) &&
      status !== prevStatus &&
      (wasLocked || submittedRef.current);

    if (!businessChanged && !firstOpen && !statusBecameEditable) {
      sessionStatusRef.current = status;
      return;
    }

    sessionBusinessIdRef.current = opts.businessId;
    sessionInitializedRef.current = true;
    sessionStatusRef.current = status;
    const loadId = ++resumeLoadIdRef.current;

    const businessId = opts.businessId;
    const business = opts.business;

    setError("");
    setSubmitted(false);
    setSubmitOutcome("submitted");
    setRequirements(null);
    setDocRows([]);
    setShareholderId(null);

    const cachedDraft = profileDraftFromSummary(opts.kybSummary, business);
    setDraft(cachedDraft);
    setStep(
      inferWizardStartStep({
        profile: opts.kybSummary?.profile ?? null,
        business,
      }),
    );

    if (!businessId) return;

    void (async () => {
      let summaryProfile: Record<string, unknown> | null =
        (opts.kybSummary?.profile as Record<string, unknown> | null) ?? null;

      try {
        const summary = await kybApi.summary(businessId);
        if (loadId !== resumeLoadIdRef.current) return;
        summaryProfile = (summary.profile as Record<string, unknown> | null) ?? null;
        setDraft(profileDraftFromSummary(summary, business));
      } catch {
        // Keep cached draft when summary fetch fails.
      }

      let reqs: KybDocumentRequirements | null = null;
      let hasUploadedDocuments = false;
      let listedDocs: ListedDoc[] = [];

      try {
        const listed = await kybApi.listDocuments(businessId);
        listedDocs = listed.documents;
        hasUploadedDocuments = listed.documents.some((d) => d.is_active);
      } catch {
        // Best-effort resume.
      }

      try {
        const country =
          String(summaryProfile?.country || business?.country || cachedDraft.country || "").trim() ||
          undefined;
        reqs = await kybApi.documentRequirements(businessId, country);
        if (
          reqs.business_documents.some((d) => d.uploaded) ||
          reqs.shareholder_documents.some((d) => d.uploaded)
        ) {
          hasUploadedDocuments = true;
        }
      } catch {
        // Requirements may be unavailable before initiate.
      }

      if (loadId !== resumeLoadIdRef.current) return;

      const hasDocumentRequirements = !!reqs && hasUploadedDocuments;
      if (reqs && (hasUploadedDocuments || reqs.business_documents.length || reqs.shareholder_documents.length)) {
        setRequirements(reqs);
        const associateRef = profileDraftFromSummary(
          summaryProfile ? { profile: summaryProfile } : opts.kybSummary,
          business,
        ).associates[0]?.id;
        setDocRows(mapRequirementRows(reqs, listedDocs, associateRef));
      }

      setStep(
        inferWizardStartStep({
          profile: summaryProfile,
          business,
          hasDocumentRequirements,
          hasUploadedDocuments,
        }),
      );
    })();
  }, [opts.enabled, opts.businessId, opts.kybSummary, opts.business, opts.kybStatus]);

  const patchDraft = useCallback((patch: Partial<KybWizardProfileDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
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

  const setUboCount = useCallback((count: number) => {
    setDraft((prev) => ({
      ...prev,
      associates: resizeAssociates(
        prev.associates,
        count,
        prev.addressCountry || prev.country || "KE",
      ),
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
          const initiated = await kybApi.initiate(opts.businessId, newKybIdempotencyKey());
          reqs = initiated.document_requirements ?? null;
        } catch (initiateErr) {
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

      let listedDocs: ListedDoc[] = [];
      try {
        const listed = await kybApi.listDocuments(opts.businessId);
        listedDocs = listed.documents;
      } catch {
        // Keep prior row state if list fails.
      }

      const associateRef = draft.associates[0]?.id;
      setDocRows((prev) => mapRequirementRows(reqs!, listedDocs, associateRef, prev));
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

  const officerIssuingCountry = useCallback(() => {
    const owner1 = draft.associates[0];
    return (owner1?.country || draft.addressCountry || draft.country || "").trim().toUpperCase() || undefined;
  }, [draft.addressCountry, draft.associates, draft.country]);

  const uploadDocumentRow = useCallback(
    async (index: number, fileOverride?: File | null): Promise<boolean> => {
      if (!opts.businessId) return false;
      const row = docRows[index];
      const file = fileOverride ?? row?.file ?? null;
      if (!row || !file) {
        setDocRows((rows) =>
          rows.map((r, i) => (i === index ? { ...r, error: "Choose a file first." } : r)),
        );
        return false;
      }
      const fileError = validateKybDocumentFile(file);
      if (fileError) {
        setDocRows((rows) =>
          rows.map((r, i) => (i === index ? { ...r, file: null, error: fileError, uploading: false } : r)),
        );
        return false;
      }
      setDocRows((rows) =>
        rows.map((r, i) =>
          i === index ? { ...r, file, uploading: true, error: "", submitted: false } : r,
        ),
      );
      try {
        const issuing =
          row.issuingCountryRequired
            ? row.category === "shareholder"
              ? officerIssuingCountry()
              : draft.country.trim().toUpperCase() || undefined
            : undefined;
        const form = buildUploadFormData({
          file,
          documentType: row.requirementType,
          issuingCountry: issuing,
          associateRefId: row.associateRefId,
        });
        const uploaded = await kybApi.uploadDocument(opts.businessId, form);
        setDocRows((rows) =>
          rows.map((r, i) =>
            i === index
              ? {
                  ...r,
                  file,
                  uploading: false,
                  uploadedDocId: uploaded.id,
                  downloadable: !!uploaded.downloadable,
                  submitted: true,
                  error: "",
                }
              : r,
          ),
        );
        return true;
      } catch (err) {
        setDocRows((rows) =>
          rows.map((r, i) =>
            i === index
              ? {
                  ...r,
                  file,
                  uploading: false,
                  error: formatKybServiceError(err),
                }
              : r,
          ),
        );
        return false;
      }
    },
    [docRows, draft.country, officerIssuingCountry, opts.businessId],
  );

  const setDocumentFile = useCallback(
    (index: number, file: File | null) => {
      if (file) {
        const fileError = validateKybDocumentFile(file);
        if (fileError) {
          setDocRows((rows) =>
            rows.map((r, i) => (i === index ? { ...r, file: null, error: fileError, submitted: false } : r)),
          );
          return;
        }
      }
      setDocRows((rows) =>
        rows.map((r, i) =>
          i === index ? { ...r, file, submitted: false, error: "" } : r,
        ),
      );
      if (file) {
        void uploadDocumentRow(index, file);
      }
    },
    [uploadDocumentRow],
  );

  const pollAfterSubmit = useCallback(async (businessId: number) => {
    for (let attempt = 0; attempt < POST_SUBMIT_POLL_ATTEMPTS; attempt += 1) {
      try {
        const status = await kybApi.pollVerifierStatus(businessId);
        if (status.kyb_status === "approved" || status.kyb_status === "rejected") {
          return status;
        }
      } catch {
        // Poll is best-effort after a successful submit.
      }
      if (attempt < POST_SUBMIT_POLL_ATTEMPTS - 1) {
        await sleep(POST_SUBMIT_POLL_DELAY_MS);
      }
    }
    return null;
  }, []);

  const submitForReview = useCallback(async (): Promise<boolean> => {
    if (!opts.businessId) return false;
    const attestationError = validateSubmitStep(draft);
    if (attestationError) {
      setError(attestationError);
      return false;
    }
    setBusy(true);
    setError("");
    try {
      await kybApi.submitForReview(opts.businessId, newKybIdempotencyKey());
      const polled = await pollAfterSubmit(opts.businessId);
      if (polled?.kyb_status === "approved") {
        setSubmitOutcome("approved");
      } else if (polled?.kyb_status === "rejected") {
        setSubmitOutcome("rejected");
      } else {
        setSubmitOutcome("submitted");
      }
      setSubmitted(true);
      setBusy(false);
      opts.onSubmitted?.();
      return true;
    } catch (err) {
      setBusy(false);
      setError(formatKybServiceError(err));
      return false;
    }
  }, [draft, opts, pollAfterSubmit]);

  const openDocument = useCallback(
    async (index: number, mode: "view" | "download") => {
      if (!opts.businessId) return;
      const row = docRows[index];
      if (!row?.uploadedDocId) {
        setError("No uploaded file to open yet.");
        return;
      }
      if (!row.downloadable) {
        setError("This document isn’t available to view or download yet.");
        return;
      }
      try {
        await kybApi.openDocument(opts.businessId, row.uploadedDocId, mode);
      } catch (err) {
        setError(formatKybServiceError(err));
      }
    },
    [docRows, opts.businessId],
  );

  const replaceDocumentRow = useCallback(
    async (index: number): Promise<boolean> => {
      if (!opts.businessId) return false;
      const row = docRows[index];
      const docId = row?.uploadedDocId;
      if (docId) {
        try {
          await kybApi.deleteDocument(opts.businessId, docId);
        } catch (err) {
          setError(formatKybServiceError(err));
          return false;
        }
      }
      setDocRows((rows) =>
        rows.map((r, i) =>
          i === index
            ? {
                ...r,
                file: null,
                uploadedDocId: null,
                downloadable: false,
                submitted: false,
                uploading: false,
                error: "",
              }
            : r,
        ),
      );
      return true;
    },
    [docRows, opts.businessId],
  );

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
      if (docRows.some((r) => r.uploading)) {
        setError("Wait for uploads to finish before continuing.");
        return;
      }
      const missingFile = docRows.some((r) => !r.submitted && !r.file);
      if (missingFile) {
        setError("Choose a file for every required document before continuing.");
        return;
      }
      const pending = docRows
        .map((r, i) => ({ row: r, index: i }))
        .filter(({ row }) => !row.submitted);
      if (pending.length) {
        setBusy(true);
        setError("");
        for (const { row, index } of pending) {
          const ok = await uploadDocumentRow(index, row.file);
          if (!ok) {
            setBusy(false);
            setError("Some documents failed to upload. Fix the errors above and try again.");
            return;
          }
        }
        setBusy(false);
      }
      setError("");
      setStep(4);
      return;
    }
    await submitForReview();
  }, [docRows, draft, prepareDocuments, saveProfile, step, submitForReview, uploadDocumentRow]);

  const backStep = useCallback(() => {
    setError("");
    setStep((s) => Math.max(1, s - 1) as KybWizardStep);
  }, []);

  const stepDots = STEP_LABELS.map((label, i) => ({ on: i + 1 <= step, label }));
  const docsComplete = docRows.length > 0 && docRows.every((r) => r.submitted);
  const docsUploading = docRows.some((r) => r.uploading);

  return {
    step,
    stepLabels: STEP_LABELS,
    stepDots,
    draft,
    patchDraft,
    patchAssociate,
    setUboCount,
    error,
    busy,
    docRows,
    setDocumentFile,
    uploadDocumentRow,
    openDocument,
    replaceDocumentRow,
    docsComplete,
    docsUploading,
    submitted,
    submitOutcome,
    nextStep,
    backStep,
    // Exposed for tests / advanced flows
    ensureShareholderRegistered,
  };
}
