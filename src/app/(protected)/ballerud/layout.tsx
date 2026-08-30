import Link from "next/link";
import type { Route } from "next";

export default function BallerudLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="sticky top-[52px] z-10 overflow-x-auto border-b border-slate-200 bg-white/95 backdrop-blur" aria-label="Ballerud">
        <div className="mx-auto flex min-w-max gap-5 px-4 sm:max-w-6xl sm:px-6">
          <Link href={"/ballerud" as Route} className="shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary">Plan og aktiviteter</Link>
          <Link href={"/ballerud/ferdigbefaring" as Route} className="shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary">Ferdigbefaring</Link>
          <Link href={"/ballerud/dokumenter" as Route} className="shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary">Dokumenter</Link>
        </div>
      </nav>
      {children}
    </>
  );
}