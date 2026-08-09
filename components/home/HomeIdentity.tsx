"use client";

type HomeIdentityProps = {
  businessName: string;
  role?: string;
  kybApproved: boolean;
  kybLabel: string;
  kybLoading?: boolean;
};

/** Home identity strip — business avatar + KYB chip (B2B, not consumer KYC). */
export default function HomeIdentity({
  businessName,
  role,
  kybApproved,
  kybLabel,
  kybLoading,
}: HomeIdentityProps) {
  const initials = (businessName || "?").slice(0, 2).toUpperCase();

  return (
    <div className="ep-home-identity">
      <div className="ep-home-identity__left">
        <span className="ep-home-identity__avatar" aria-hidden>
          {initials}
        </span>
        <div className="ep-home-identity__copy">
          <div className="ep-home-identity__name">{businessName || "Loading…"}</div>
          <div className="ep-home-identity__meta">
            {role ? <span className="ep-home-identity__role">{role}</span> : null}
            {!kybLoading ? (
              <span
                className={`ep-home-identity__kyb${kybApproved ? " ep-home-identity__kyb--ok" : ""}`}
              >
                {kybApproved ? "KYB Verified" : kybLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="ep-home-identity__mark" aria-hidden>
        <span className="ep-home-identity__mark-cube" />
        ElementPay
      </div>
    </div>
  );
}
