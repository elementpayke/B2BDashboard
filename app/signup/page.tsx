import { redirect } from "next/navigation";

/** Public signup is closed for launch — route straight to the waitlist. */
export default function SignupPage() {
  redirect("https://tally.so/r/e5Ze9e");
}
