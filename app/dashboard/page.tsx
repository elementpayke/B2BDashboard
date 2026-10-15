import type { Metadata } from "next";
import DashboardApp from "@/components/DashboardApp";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardApp />;
}
