import { redirect } from "next/navigation";
import { InspectionBoard } from "@/features/inspections/components/inspection-board";
import { getLatestInspection } from "@/features/inspections/queries";
import { getCurrentMembership } from "@/features/household/queries";

export default async function BallerudInspectionPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  return <InspectionBoard inspection={await getLatestInspection()} />;
}