"use client";

import type { CardBrand } from "@/lib/services/cards";

export default function CardBrandMark({
  brand,
  className = "",
}: {
  brand: CardBrand;
  className?: string;
}) {
  if (brand === "unknown") return null;

  if (brand === "mastercard") {
    return (
      <span
        className={`ep-card-brand ep-card-brand--mastercard ${className}`.trim()}
        aria-label="Mastercard"
        role="img"
      >
        <svg viewBox="0 0 48 30" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <circle cx="18" cy="15" r="12" fill="#EB001B" />
          <circle cx="30" cy="15" r="12" fill="#F79E1B" />
          <path
            fill="#FF5F00"
            d="M24 5.05A11.95 11.95 0 0 0 16.9 15 11.95 11.95 0 0 0 24 24.95 11.95 11.95 0 0 0 31.1 15 11.95 11.95 0 0 0 24 5.05z"
          />
        </svg>
      </span>
    );
  }

  if (brand === "visa") {
    return (
      <span
        className={`ep-card-brand ep-card-brand--visa ${className}`.trim()}
        aria-label="Visa"
        role="img"
      >
        <svg viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <text
            x="0"
            y="13"
            fill="#fff"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="14"
            fontWeight="700"
            letterSpacing="0.5"
          >
            VISA
          </text>
        </svg>
      </span>
    );
  }

  if (brand === "amex") {
    return (
      <span
        className={`ep-card-brand ep-card-brand--amex ${className}`.trim()}
        aria-label="American Express"
        role="img"
      >
        <svg viewBox="0 0 56 16" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <text
            x="0"
            y="13"
            fill="#fff"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="11"
            fontWeight="700"
            letterSpacing="0.4"
          >
            AMEX
          </text>
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`ep-card-brand ep-card-brand--discover ${className}`.trim()}
      aria-label="Discover"
      role="img"
    >
      <svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <text
          x="0"
          y="13"
          fill="#fff"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="10"
          fontWeight="700"
          letterSpacing="0.3"
        >
          DISCOVER
        </text>
      </svg>
    </span>
  );
}
