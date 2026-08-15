import { redirect } from "next/navigation";
import { getChildrenData } from "@/features/children/queries";
import { ChildrenBoard } from "@/features/children/components/children-board";

export default async function ChildrenPage() {
  const data = await getChildrenData();

  if (!data) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Barn</p>
        <h1 className="mt-2 text-3xl font-bold">{data.householdName}</h1>
        <p className="mt-3 text-sm text-slate-600">
          MVP: registrer barna i husholdningen med navn, fødselsdato og kallenavn.
        </p>
      </section>

      <ChildrenBoard initialChildren={data.children} currentUserName={data.currentUserName} />
    </main>
  );
}
