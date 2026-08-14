import { FeaturePlaceholderPage } from "@/features/navigation/components/feature-placeholder-page";

export default function MealsPage() {
  return (
    <FeaturePlaceholderPage
      title="Middag"
      description="Her kommer måltidsplanlegging med ukevisning og forslag fra oppskrifter."
      nextSteps={[
        "Planlegge middag per dag.",
        "Knytte plan til intern eller ekstern oppskrift.",
        "Generere handleliste fra planen."
      ]}
    />
  );
}
