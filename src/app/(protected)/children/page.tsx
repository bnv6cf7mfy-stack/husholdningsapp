import { FeaturePlaceholderPage } from "@/features/navigation/components/feature-placeholder-page";

export default function ChildrenPage() {
  return (
    <FeaturePlaceholderPage
      title="Barn"
      description="Her kommer barnemodulen med profiler, mål, notater, milepæler og sitater."
      nextSteps={[
        "Opprette første barn med navn og fødselsdato.",
        "Lagre målinger som høyde og vekt med historikk.",
        "Skrive notater, milepæler og sitater per barn."
      ]}
    />
  );
}
