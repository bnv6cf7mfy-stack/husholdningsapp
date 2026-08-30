import Link from "next/link";
import type { Route } from "next";

export default function BallerudLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white" aria-label="Ballerud">
        <div className="mx-auto flex w-full max-w-6xl gap-5 px-4 sm:px-6">
          <Link href={"/ballerud" as Route} className="border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary">Plan og aktiviteter</Link>
          <Link href={"/ballerud/ferdigbefaring" as Route} className="border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary">Ferdigbefaring</Link>
        </div>
      </nav>
      {children}
    </>
  );
}