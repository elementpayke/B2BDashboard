"use client";

import React from "react";
import {
  resolveMobileMoneyBrand,
  type MobileMoneyBrand,
} from "@/lib/services/mobileMoneyBrands";

type Props = {
  /** Catalog provider name or code. */
  name?: string | null;
  brand?: MobileMoneyBrand | null;
  size?: number;
  className?: string;
};

/**
 * Square mark for a mobile-money operator. Uses the brand SVG when known;
 * otherwise a colored initial chip.
 */
export default function MobileMoneyMark({
  name,
  brand: brandProp,
  size = 28,
  className,
}: Props) {
  const brand = brandProp ?? resolveMobileMoneyBrand(name) ?? null;
  const label = brand?.label || name?.trim() || "Mobile money";
  const initial = label.replace(/^[^A-Za-z0-9]+/, "").charAt(0).toUpperCase() || "M";

  if (brand?.logoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small local brand marks
      <img
        src={brand.logoSrc}
        alt=""
        width={size}
        height={size}
        className={className || "ep-momo-mark"}
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }

  return (
    <span
      className={className || "ep-momo-mark ep-momo-mark--fallback"}
      style={{
        width: size,
        height: size,
        background: brand?.accent || "var(--indigo-tint)",
        color: brand?.key === "mtn" ? "#1a1a1a" : "#fff",
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
