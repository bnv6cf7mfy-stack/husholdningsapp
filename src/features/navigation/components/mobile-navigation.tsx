"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Menu, X } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";

type NavigationItem = {
  href: string;
  label: string;
  enabled?: boolean;
  badge?: string;
};

export function MobileNavigation({ items }: { items: NavigationItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="md:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label="Åpne meny" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700">
        <Menu className="h-5 w-5" />
      </button>
      {open ? <div className="fixed inset-0 z-50 bg-slate-950/30" role="presentation" onMouseDown={() => setOpen(false)}>
        <aside role="dialog" aria-modal="true" aria-label="Hovedmeny" className="ml-auto flex h-full w-[min(85vw,340px)] flex-col bg-white p-5 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between"><p className="text-lg font-bold text-slate-900">Meny</p><button type="button" onClick={() => setOpen(false)} aria-label="Lukk meny" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700"><X className="h-5 w-5" /></button></div>
          <nav className="mt-6 space-y-1" aria-label="Hovedmeny">{items.map((item) => item.enabled === false ? <span key={item.href} className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-slate-400"><span>{item.label}</span>{item.badge ? <span className="text-xs">{item.badge}</span> : null}</span> : <Link key={item.href} href={item.href as Route} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-semibold text-slate-800 hover:bg-slate-100">{item.label}</Link>)}</nav>
          <form action={signOutAction} className="mt-auto"><button className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700">Logg ut</button></form>
        </aside>
      </div> : null}
    </div>
  );
}