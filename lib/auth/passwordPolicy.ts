/**
 * Client-side password policy — mirrors Mboka's `validate_strong_password`:
 * min 12 chars, upper + lower + digit + symbol, no whitespace.
 */

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /[0-9]/;
const SYMBOL = /[^A-Za-z0-9]/;

export type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { id: "length", label: "At least 12 characters", met: password.length >= 12 },
    { id: "upper", label: "One uppercase letter", met: UPPER.test(password) },
    { id: "lower", label: "One lowercase letter", met: LOWER.test(password) },
    { id: "digit", label: "One number", met: DIGIT.test(password) },
    { id: "symbol", label: "One symbol (e.g. !@#)", met: SYMBOL.test(password) },
    { id: "space", label: "No spaces", met: password.length > 0 && !/\s/.test(password) },
  ];
}

/** Returns an error message if the password fails policy, otherwise null. */
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 12) return "Password must be at least 12 characters long.";
  if (/\s/.test(password)) return "Password must not contain whitespace.";
  if (!UPPER.test(password)) return "Password must include at least one uppercase letter.";
  if (!LOWER.test(password)) return "Password must include at least one lowercase letter.";
  if (!DIGIT.test(password)) return "Password must include at least one digit.";
  if (!SYMBOL.test(password)) return "Password must include at least one symbol.";
  return null;
}

export function passwordsMatch(password: string, confirm: string): string | null {
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
