import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";

export default function UpdatePasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Sett nytt passord</h1>
        <p className="mt-2 text-sm text-slate-600">Velg et nytt passord med minst 8 tegn.</p>
        <div className="mt-6">
          <UpdatePasswordForm />
        </div>
      </section>
    </main>
  );
}
