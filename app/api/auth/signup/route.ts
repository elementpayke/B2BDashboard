/** Public signup is closed for launch — see app/signup/page.tsx. */
export async function POST(): Promise<Response> {
  return Response.json(
    { error: "Signup is closed. Join the waitlist at https://tally.so/r/e5Ze9e." },
    { status: 403 },
  );
}
