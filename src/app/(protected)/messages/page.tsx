import { redirect } from "next/navigation";
import { MessagesBoard } from "@/features/messages/components/messages-board";
import { getMessagesData } from "@/features/messages/queries";

export default async function MessagesPage() {
  const data = await getMessagesData();

  if (!data) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Meldinger</p>
        <h1 className="mt-2 text-3xl font-bold">{data.householdName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send beskjeder til husholdningen. Andre mottar varsel umiddelbart.
        </p>
      </section>

      <MessagesBoard data={data} />
    </main>
  );
}
