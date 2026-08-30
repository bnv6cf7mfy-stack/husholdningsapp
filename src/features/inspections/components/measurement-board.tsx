"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Plus, Ruler } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { attachMeasurementPhotoAction, createInspectionMeasurementAction, createMeasurementPhotoUploadAction } from "@/features/inspections/measurement-actions";
import type { MeasurementData } from "@/features/inspections/measurement-queries";

const promptsByRoom: Record<string, string[]> = {
  KJ: ["Kjøkkenøy: L/B/H", "Benkeplate", "Åpning for hvitevarer", "Vinduer"],
  TRAPP: ["Total bredde", "Maks/min høyde", "Dybde", "Veggplassering"],
  BOD: ["Alle vegglengder", "Innvendig bredde", "Dørbredde", "Takhøyde"],
  BOD2: ["Rom: L/B/H", "Dørbredde", "Hylleplass"],
  BAD: ["Rom: L/B/H", "Dusjsone", "Servantbredde"],
  BAD2: ["Rom: L/B/H", "Dusjsone", "Servantbredde"],
  TERR: ["Terrasse: L/B", "Rekkverkshøyde", "Døråpning"],
  BALKONG: ["Balkong: L/B", "Rekkverkshøyde", "Døråpning"],
  SOV1: ["Rom: L/B/H", "Garderobenisje: B/H/D", "Vinduer"],
  SOV2: ["Rom: L/B/H", "Garderobenisje: B/H/D", "Vinduer"],
  SOV3: ["Rom: L/B/H", "Garderobenisje: B/H/D", "Vinduer"],
  SOV4: ["Rom: L/B/H", "Garderobenisje: B/H/D", "Vinduer"]
};

const toNumberOrNull = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;

export function MeasurementBoard({ data }: { data: MeasurementData | null }) {
  const router = useRouter();
  const [activeRoomId, setActiveRoomId] = useState(data?.rooms[0]?.id ?? "");
  const [form, setForm] = useState({ name: "", length: "", width: "", height: "", depth: "", note: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const room = data?.rooms.find((item) => item.id === activeRoomId) ?? data?.rooms[0];
  const groups = [{ area: "ground_floor", label: "1. etasje" }, { area: "upper_floor", label: "2. etasje" }, { area: "outdoor_storage", label: "Uteareal / bod" }] as const;

  if (!data || !room) return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><section className="border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold">Oppmåling</h1><p className="mt-2 text-sm text-slate-600">Opprett ferdigbefaringen først for å måle rommene.</p></section></main>;

  const saveMeasurement = async () => {
    setError("");
    if (!form.name.trim()) { setError("Gi målingen et navn."); return; }
    setStatus("saving");
    const result = await createInspectionMeasurementAction({ roomId: room.id, name: form.name, lengthCm: toNumberOrNull(form.length), widthCm: toNumberOrNull(form.width), heightCm: toNumberOrNull(form.height), depthCm: toNumberOrNull(form.depth), note: form.note });
    if (!result.ok) { setStatus("error"); setError("Målingen kunne ikke lagres. Kontroller at verdiene er større enn null."); return; }
    if (photo) {
      const upload = await createMeasurementPhotoUploadAction({ measurementId: result.measurementId, contentType: photo.type, fileSizeBytes: photo.size });
      if (!upload.ok) { setStatus("error"); setError("Målingen er lagret, men bildet kunne ikke klargjøres."); return; }
      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage.from("inspection-media").uploadToSignedUrl(upload.storagePath, upload.token, photo, { contentType: photo.type });
      if (uploadError || !(await attachMeasurementPhotoAction({ measurementId: result.measurementId, storagePath: upload.storagePath, contentType: photo.type, fileSizeBytes: photo.size })).ok) { setStatus("error"); setError("Målingen er lagret, men bildet kunne ikke lagres."); return; }
    }
    setForm({ name: "", length: "", width: "", height: "", depth: "", note: "" }); setPhoto(null); if (fileInputRef.current) fileInputRef.current.value = ""; setStatus("idle"); startTransition(() => router.refresh());
  };

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><header className="border-b border-slate-200 pb-5"><p className="text-sm font-semibold text-primary">Ballerud Hageby, rekkehus 111</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Oppmåling</h1><p className="mt-2 text-sm text-slate-600">Registrer praktiske mål i centimeter. Areal er kun veiledende.</p></header><div className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]"><nav className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Rom">{groups.map((group) => { const rooms = data.rooms.filter((item) => item.area === group.area); return rooms.length ? <section key={group.area} className="min-w-max"><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{group.label}</h2><div className="flex gap-2 lg:flex-col">{rooms.map((item) => <button key={item.id} type="button" onClick={() => setActiveRoomId(item.id)} className={`min-w-max rounded-lg border px-3 py-2 text-left text-sm font-semibold ${item.id === room.id ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>{item.name}<span className="ml-2 text-xs opacity-80">{item.measurements.length}</span></button>)}</div></section> : null; })}</nav><section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">{room.name}</h2><Ruler className="h-5 w-5 text-primary" /></div><div className="mt-3 flex flex-wrap gap-2">{(promptsByRoom[room.code] ?? ["Rom: L/B/H", "Vinduer", "Dører", "Garderobenisje"]).map((prompt) => <button key={prompt} type="button" onClick={() => setForm((previous) => ({ ...previous, name: previous.name || prompt }))} className="rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary">{prompt}</button>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(4,82px)]"><input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Hva måles?" className="h-9 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary" />{([['length', 'L'], ['width', 'B'], ['height', 'H'], ['depth', 'D']] as const).map(([key, label]) => <label key={key} className="relative"><span className="sr-only">{label} i cm</span><input inputMode="decimal" value={form[key]} onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))} placeholder={label} className="h-9 w-full rounded-lg border border-slate-300 px-2 pr-7 text-sm outline-none focus:border-primary" /><span className="pointer-events-none absolute right-2 top-2 text-xs text-slate-500">cm</span></label>)}</div><div className="mt-2 flex flex-wrap items-center gap-2"><input value={form.note} onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Notat" className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary" /><label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"><Camera className="h-3.5 w-3.5" />{photo ? "Bilde valgt" : "Bilde"}<input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label><button type="button" onClick={() => void saveMeasurement()} disabled={status === "saving" || pending} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />{status === "saving" ? "Lagrer..." : "Legg til mål"}</button></div>{error ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}<div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">{room.measurements.length ? room.measurements.map((measurement) => <article key={measurement.id} className="flex items-start gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{measurement.name}</p><p className="mt-1 text-xs text-slate-600">{[['L', measurement.lengthCm], ['B', measurement.widthCm], ['H', measurement.heightCm], ['D', measurement.depthCm]].filter(([, value]) => value !== null).map(([label, value]) => `${label}: ${value} cm`).join(' · ') || 'Ingen tall registrert'}</p>{measurement.note ? <p className="mt-1 text-xs text-slate-600">{measurement.note}</p> : null}</div>{measurement.photoUrl ? <a href={measurement.photoUrl} target="_blank" rel="noreferrer" className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200"><img src={measurement.photoUrl} alt={`Bilde av ${measurement.name}`} className="h-full w-full object-cover" /></a> : null}</article>) : <p className="py-6 text-sm text-slate-500">Ingen mål er registrert i dette rommet ennå.</p>}</div></section></div></main>;
}