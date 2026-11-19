import type { CSSProperties } from "react";
import { BRAND, FEEDBACK, SHADOW, THEME_LIGHT } from "@/lib/theme/tokens.generated";

// Light-theme palette for auth pages (outside dashboard theme toggle).
// Touch-friendly sizing for mobile keyboards and 44px+ targets.
// Brand aligned to the v2 design handoff (#3B2ED3).

export const AUTH_INDIGO = BRAND.indigo;
export const AUTH_INK = BRAND.ink;
export const AUTH_MUTED = THEME_LIGHT["--muted"];
/** Soft secondary text — darkened for ≥4.5:1 on the auth canvas `#F6F4EF`. */
export const AUTH_MUTED_SOFT = FEEDBACK.mutedSoft;

export const authPageStyle: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: BRAND.bone,
  fontFamily: "'DM Sans',sans-serif",
  padding: "16px",
  paddingBottom: "max(16px, env(safe-area-inset-bottom))",
};

export const authCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  background: THEME_LIGHT["--panel"],
  border: `1px solid ${THEME_LIGHT["--border"]}`,
  borderRadius: "24px",
  padding: "28px 24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  boxShadow: SHADOW.card,
};

/* The brand lockup lives in components/brand/AuthBrand.tsx — the old
   letter-in-a-square placeholder was replaced by the Chamfer mark. */

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

export const authLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  color: AUTH_MUTED_SOFT,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export const authFieldRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

export const authInputStyle: CSSProperties = {
  width: "100%",
  marginTop: "6px",
  padding: "12px 14px",
  minHeight: "48px",
  borderRadius: "14px",
  // Longhand only — never mix with `border` shorthand. Toggling
  // authInputErrorStyle's borderColor otherwise warns on rerender.
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: THEME_LIGHT["--input-border"],
  background: THEME_LIGHT["--input-bg"],
  outline: "none",
  fontSize: "16px",
  color: AUTH_INK,
  boxSizing: "border-box",
  WebkitAppearance: "none",
};

/** Error-border variant — pair with aria-invalid on the field. */
export const authInputErrorStyle: CSSProperties = {
  ...authInputStyle,
  borderColor: FEEDBACK.errorFieldBorder,
  background: FEEDBACK.errorFieldBg,
};

/** Alias used by login/forgot forms. */
export const authInputInvalidStyle = authInputErrorStyle;

export const authButtonStyle: CSSProperties = {
  padding: "14px",
  minHeight: "48px",
  borderRadius: "14px",
  border: "none",
  background: AUTH_INDIGO,
  color: THEME_LIGHT["--indigo-on"],
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
  WebkitTapHighlightColor: "transparent",
};

export const authButtonDisabledStyle: CSSProperties = {
  opacity: 0.65,
  cursor: "not-allowed",
};

export function authButtonStateStyle(disabled: boolean): CSSProperties {
  return {
    ...authButtonStyle,
    ...((disabled ? authButtonDisabledStyle : null) ?? {}),
    cursor: disabled ? "wait" : "pointer",
  };
}

export const authErrorStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "12px",
  background: THEME_LIGHT["--red-tint"],
  color: FEEDBACK.errorText,
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.45,
  border: `1px solid ${FEEDBACK.errorBannerBorder}`,
};

export const authSuccessStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "12px",
  background: FEEDBACK.successBg,
  color: FEEDBACK.successText,
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.45,
  border: `1px solid ${FEEDBACK.successBorder}`,
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
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  textDecorationThickness: "1.5px",
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
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};

/** Alias for padded auth link hit areas. */
export const authLinkHitStyle: CSSProperties = {
  ...authLinkStyle,
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  padding: "8px 2px",
  boxSizing: "border-box",
};

export const authHintStyle: CSSProperties = {
  margin: 0,
  fontSize: "12.5px",
  color: AUTH_MUTED_SOFT,
  textAlign: "center",
  lineHeight: 1.45,
};
