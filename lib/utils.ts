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
      text: ["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl"],
      radius: ["sm", "md", "lg", "xl", "2xl", "full"],
      shadow: ["card", "overlay"],
      font: ["display", "body", "mono"],
    },
  },
});

/** Compose class names; later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
