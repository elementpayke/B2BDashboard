"use client";
import React from "react";
import MbokaLogo from "@/components/brand/MbokaLogo";

/**
 * Brand lockup for the auth screens (login, signup, forgot/reset password,
 * verify email). Standalone placement, so it carries the kit's clear space.
 */
export default function AuthBrand() {
  return (
    <div style={{ marginBottom: 8, marginLeft: -8 }}>
      <MbokaLogo size={32} className="ep-logo--framed" />
    </div>
  );
}
