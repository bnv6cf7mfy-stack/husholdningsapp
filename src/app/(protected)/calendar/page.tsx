import { FeaturePlaceholderPage } from "@/features/navigation/components/feature-placeholder-page";

export default function CalendarPage() {
  return (
    <FeaturePlaceholderPage
      title="Kalender"
      description="Her kommer kalenderen for familiens avtaler og aktiviteter."
      nextSteps={[
        "Opprette avtaler med start/slutt og type.",
        "Knytte hendelser til ett eller flere barn.",
        "Vise neste avtale på dashboard."
      ]}
    />
  );
}
