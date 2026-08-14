import { FeaturePlaceholderPage } from "@/features/navigation/components/feature-placeholder-page";

export default function ChildcarePage() {
  return (
    <FeaturePlaceholderPage
      title="Barnehage"
      description="Her kommer barnehage/levering-henting-modulen."
      nextSteps={[
        "Planlegge hvem som leverer og henter per dag.",
        "Knytte planer til barn.",
        "Vise dagens ansvar tydelig på dashboard."
      ]}
    />
  );
}
