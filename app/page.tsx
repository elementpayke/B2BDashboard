import type { Metadata } from "next";
import Landing from "@/components/Landing";

const TITLE = "Business Banking, Cards & Payouts for Africa";
const DESCRIPTION =
  "Local business bank accounts, USD virtual cards, collections, payouts and stablecoin settlement for companies across Kenya, Nigeria, Ghana, Uganda, Tanzania, South Africa and beyond.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${TITLE} · Mboka`,
    description: DESCRIPTION,
    url: "/",
    siteName: "Mboka",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Mboka`,
    description: DESCRIPTION,
  },
};

// Organization schema only — no social profile URLs are confirmed yet, so
// `sameAs` is left out rather than guessing handles that may not exist.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Mboka",
  url: "https://mboka.finance",
  logo: "https://mboka.finance/brand/mboka-logo.svg",
  description: DESCRIPTION,
  parentOrganization: {
    "@type": "Organization",
    name: "ElementPay",
  },
};

export default function Home() {
  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- static, non-user-derived JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />
      <Landing />
    </>
  );
}
