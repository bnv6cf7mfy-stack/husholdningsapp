"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runFinanceForecastAction } from "@/features/finance/actions";
import type { FinanceOverview } from "@/features/finance/queries";
import { FinanceDashboardTab } from "./finance-dashboard-tab";
import { FinanceCashFlowTab } from "./finance-cashflow-tab";
import { FinanceAccountTab } from "./finance-account-tab";

type FinanceActionResult = { ok: boolean; error?: string };

const tabs = [
  { key: "dashboard", label: "Dashboard" },
  { key: "cashflow", label: "Inntekt/kostnad" },
  { key: "accounts", label: "Konto" }
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function FinanceDashboard({ overview }: { overview: FinanceOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  function runAction(action: () => Promise<FinanceActionResult>) {
    setError(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Noe gikk galt.");
        return;
      }
      setSuccessMessage("Lagret ✓");
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), 3000);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">{error}</p> : null}
      {successMessage ? (
        <p className="rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700 ring-1 ring-green-200">{successMessage}</p>
      ) : null}

      <nav className="flex flex-wrap gap-2 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-black/5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === tab.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "dashboard" ? (
        <FinanceDashboardTab overview={overview} pending={pending} onRunForecast={() => runAction(() => runFinanceForecastAction())} />
      ) : null}
      {activeTab === "cashflow" ? (
        <FinanceCashFlowTab overview={overview} pending={pending} runAction={runAction} setError={setError} />
      ) : null}
      {activeTab === "accounts" ? (
        <FinanceAccountTab overview={overview} pending={pending} runAction={runAction} setError={setError} />
      ) : null}
    </div>
  );
}
