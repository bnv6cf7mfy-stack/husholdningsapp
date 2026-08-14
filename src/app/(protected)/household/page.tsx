import { FeaturePlaceholderPage } from "@/features/navigation/components/feature-placeholder-page";

export default function HouseholdPage() {
  return (
    <FeaturePlaceholderPage
      title="Household"
      description="Her kommer administrasjon av household-navn, medlemmer og roller."
      nextSteps={[
        "Invitere nye medlemmer.",
        "Endre roller (owner/adult/member).",
        "Vedlikeholde grunninnstillinger for household."
      ]}
    />
  );
}
