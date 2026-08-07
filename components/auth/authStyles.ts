import type { CSSProperties } from "react";

// Light-theme palette for auth pages (outside dashboard theme toggle).
// Touch-friendly sizing for mobile keyboards and 44px+ targets.
// Preserve indigo brand (#3B2ED3) across login / forgot / sibling auth flows.

export const AUTH_INDIGO = "#3B2ED3";
export const AUTH_INK = "#131126";
export const AUTH_MUTED = "#4C4A66";
export const AUTH_MUTED_SOFT = "#8B89A6";

export const authPageStyle: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#F6F4EF",
  fontFamily: "'DM Sans',sans-serif",
  padding: "16px",
  paddingBottom: "max(16px, env(safe-area-inset-bottom))",
};

export const authCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  background: "#FFFFFF",
  border: "1px solid rgba(19,17,38,0.08)",
  borderRadius: "24px",
  padding: "28px 24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  boxShadow: "0 12px 40px rgba(19,17,38,0.06)",
};

export const authLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  color: AUTH_MUTED_SOFT,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export const authInputStyle: CSSProperties = {
  width: "100%",
  marginTop: "6px",
  padding: "12px 14px",
  minHeight: "48px",
  borderRadius: "14px",
  border: "1.5px solid rgba(19,17,38,0.11)",
  background: "rgba(255,255,255,0.6)",
  outline: "none",
  fontSize: "16px",
  color: AUTH_INK,
  boxSizing: "border-box",
};

/** Error-border variant — pair with aria-invalid on the field. */
export const authInputErrorStyle: CSSProperties = {
  ...authInputStyle,
  borderColor: "rgba(229,72,77,0.55)",
  background: "#FFF8F8",
};

export const authButtonStyle: CSSProperties = {
  padding: "14px",
  minHeight: "48px",
  borderRadius: "14px",
  border: "none",
  background: AUTH_INDIGO,
  color: "#fff",
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

export function authButtonStateStyle(disabled: boolean): CSSProperties {
  return {
    ...authButtonStyle,
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? "wait" : "pointer",
  };
}

export const authErrorStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#FCEBEC",
  color: "#E5484D",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.45,
};

export const authSuccessStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#E8F7EE",
  color: "#1B7A3D",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.45,
};

export const authTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "22px",
  fontWeight: 800,
  color: AUTH_INK,
  letterSpacing: "-0.02em",
  lineHeight: 1.25,
};

export const authSubtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "13.5px",
  color: AUTH_MUTED,
  lineHeight: 1.5,
};

export const authFooterStyle: CSSProperties = {
  fontSize: "13px",
  color: AUTH_MUTED,
  textAlign: "center",
  lineHeight: 1.5,
};

export const authLinkStyle: CSSProperties = {
  color: AUTH_INDIGO,
  fontWeight: 700,
  textDecoration: "none",
};

/** Inline text-button / link with ≥44px touch target. */
export const authTextButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "8px 4px",
  margin: 0,
  border: "none",
  background: "none",
  color: AUTH_INDIGO,
  fontWeight: 700,
  fontSize: "13px",
  fontFamily: "inherit",
  cursor: "pointer",
  textDecoration: "none",
};

export const authHintStyle: CSSProperties = {
  margin: 0,
  fontSize: "12.5px",
  color: AUTH_MUTED_SOFT,
  textAlign: "center",
  lineHeight: 1.45,
};
