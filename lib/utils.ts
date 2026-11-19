import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know our custom scales, otherwise it can't tell that
 * `text-sm` (a font size) and `text-primary` (a colour) don't conflict, and
 * would silently drop one of them.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["overline-sm", "label", "caption", "dense", "body", "body-lg", "lead", "title", "headline", "page-sm", "stat", "amount", "page", "hero"],
      radius: ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "pill"],
      shadow: ["hairline", "float", "card", "modal", "selection", "focus", "nav-active", "auth"],
      font: ["display", "body", "mono"],
      leading: ["tight", "heading", "snug", "body", "relaxed"],
      tracking: ["display", "heading", "title", "normal", "label", "overline"],
      ease: ["standard", "spring", "move", "linear", "sheet"],
      breakpoint: ["desktop"],
    },
  },
});

/** Compose class names; later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
