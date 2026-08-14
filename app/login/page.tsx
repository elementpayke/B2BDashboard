import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm, { LoginFormFallback } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Mboka",
  description: "Sign in to your Mboka business dashboard.",
};

/**
 * Server page owns the Suspense boundary so prerender HTML includes the auth
 * chrome fallback. The client LoginForm (useSearchParams) hydrates into it —
 * avoiding the empty fallback={null} mismatch that triggered the overlay on /login.
 *
 * Visual / a11y polish for the form lives in LoginForm + shared authStyles.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
