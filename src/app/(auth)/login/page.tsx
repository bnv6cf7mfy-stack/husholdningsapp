import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export default async function LoginPage() {
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
        <h1 className="text-2xl font-bold">Logg inn</h1>
        <p className="mt-2 text-sm text-slate-600">Velkommen tilbake til husholdningsappen.</p>
        <div className="mt-6">
          <SignInForm />
        </div>
        <p className="mt-5 text-sm text-slate-600">
          Ingen konto?{" "}
          <Link href="/register" className="underline">
            Registrer deg
          </Link>
        </p>
      </section>
    </main>
  );
}
