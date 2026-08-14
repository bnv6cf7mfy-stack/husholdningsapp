import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export default async function RegisterPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Opprett konto</h1>
        <p className="mt-2 text-sm text-slate-600">Bruk e-post og passord for å komme i gang.</p>
        <div className="mt-6">
          <SignUpForm />
        </div>
        <p className="mt-5 text-sm text-slate-600">
          Har du konto?{" "}
          <Link href="/login" className="underline">
            Logg inn
          </Link>
        </p>
      </section>
    </main>
  );
}
