import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DashboardApp from "@/components/DashboardApp";
import { screenForSegments } from "@/lib/navigation/dashboardRoutes";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// One page serves every dashboard URL (/dashboard, /dashboard/transactions,
// …). The segment picks the initial screen, so a shared or refreshed URL
// opens the right screen on the first render (no flash of Home). After that
// DashboardApp keeps the URL in sync itself without remounting.
export default async function DashboardPage(props: { params: Promise<{ screen?: string[] }> }) {
  const { screen } = await props.params;
  const startScreen = screenForSegments(screen);
  if (!startScreen) notFound();
  return <DashboardApp startScreen={startScreen} />;
}
