import { redirect } from "next/navigation";
import { HouseholdSettings } from "@/features/household/components/household-settings";
import { getHouseholdPageData } from "@/features/household/queries";

export default async function HouseholdPage() {
  const data = await getHouseholdPageData();

  if (!data) {
    redirect("/onboarding");
  }

  return <HouseholdSettings data={data} />;
}
