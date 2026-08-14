import { FeaturePlaceholderPage } from "@/features/navigation/components/feature-placeholder-page";

export default function RecipesPage() {
  return (
    <FeaturePlaceholderPage
      title="Oppskrifter"
      description="Her kommer oppskriftsmodulen med ingredienser, alias og kategorier."
      nextSteps={[
        "Lage og redigere oppskrifter.",
        "Knytte ingredienser og mengder per oppskrift.",
        "Bruke oppskrifter direkte i middagsplan."
      ]}
    />
  );
}
