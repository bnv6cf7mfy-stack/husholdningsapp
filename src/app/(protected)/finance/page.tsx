import { FeaturePlaceholderPage } from "@/features/navigation/components/feature-placeholder-page";

export default function FinancePage() {
  return (
    <FeaturePlaceholderPage
      title="Økonomi"
      description="Denne modulen er reservert for senere økonomi-funksjoner i appen."
      nextSteps={[
        "Definere budsjettkategorier for husholdning.",
        "Registrere faste og variable utgifter.",
        "Koble innkjøp til budsjett over tid."
      ]}
    />
  );
}
