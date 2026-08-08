import type { CSSProperties } from "react";

// Light-theme palette for auth pages (outside dashboard theme toggle).
// Touch-friendly sizing for mobile keyboards and 44px targets.
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
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

export const authLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#8B89A6",
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
  color: "#131126",
  boxSizing: "border-box",
};

export const authButtonStyle: CSSProperties = {
  padding: "14px",
  minHeight: "48px",
  borderRadius: "14px",
  border: "none",
  background: "#3B2ED3",
  color: "#fff",
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

export const authErrorStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "12px",
  background: "#FCEBEC",
  color: "#E5484D",
  fontSize: "13px",
  fontWeight: 600,
};

export const authSuccessStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "12px",
  background: "#E8F7EE",
  color: "#1B7A3D",
  fontSize: "13px",
  fontWeight: 600,
};
