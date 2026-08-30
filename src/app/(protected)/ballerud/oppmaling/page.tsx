import { redirect } from "next/navigation";
import { MeasurementBoard } from "@/features/inspections/components/measurement-board";
import { getInspectionMeasurementData } from "@/features/inspections/measurement-queries";

export default async function MeasurementPage() {
  const data = await getInspectionMeasurementData();
  if (!data) redirect("/ballerud/ferdigbefaring");
  return <MeasurementBoard data={data} />;
}