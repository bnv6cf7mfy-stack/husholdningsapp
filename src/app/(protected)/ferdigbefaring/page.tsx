import { redirect } from "next/navigation";
import type { Route } from "next";

export default function InspectionPage() {
  redirect("/ballerud/ferdigbefaring" as Route);
}