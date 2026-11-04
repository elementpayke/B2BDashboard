import { apiEnvelope } from "@/lib/apiClient";

export type InvoiceBranding = {
  issuer_name: string | null;
  address_lines: string[];
  logo_data_url: string | null;
};

export const invoiceBrandingApi = {
  get: () => apiEnvelope<InvoiceBranding>("GET", "/v1/invoices/branding"),
  update: (body: {
    issuer_name?: string | null;
    address_lines?: string[];
    logo_data_url?: string | null;
    clear_logo?: boolean;
  }) => apiEnvelope<InvoiceBranding>("PUT", "/v1/invoices/branding", body),
};

export function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
      reject(new Error("Use a PNG or JPEG logo."));
      return;
    }
    if (file.size > 650_000) {
      reject(new Error("Logo must be 650KB or smaller."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read logo file."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Could not read logo file."));
    reader.readAsDataURL(file);
  });
}
