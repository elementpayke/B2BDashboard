import { Suspense } from "react";
import LoginForm, { LoginFormFallback } from "./LoginForm";

/**
 * Server page owns the Suspense boundary so prerender HTML includes the auth
 * chrome fallback. The client LoginForm (useSearchParams) hydrates into it —
 * avoiding the empty fallback={null} mismatch that triggered the overlay on /login.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
