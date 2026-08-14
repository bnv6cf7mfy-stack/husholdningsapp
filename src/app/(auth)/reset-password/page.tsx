import Link from "next/link";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Glemt passord</h1>
        <p className="mt-2 text-sm text-slate-600">Vi sender deg en lenke for å sette nytt passord.</p>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
        <p className="mt-5 text-sm text-slate-600">
          <Link href="/login" className="underline">
            Tilbake til login
          </Link>
        </p>
      </section>
    </main>
  );
}
