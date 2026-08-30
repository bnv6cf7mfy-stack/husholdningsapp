"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Plus, Ruler, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import {
  attachMeasurementPhotoAction,
  createInspectionMeasurementAction,
  createMeasurementPhotoUploadAction,
  deleteInspectionMeasurementAction,
  updateInspectionMeasurementAction
} from "@/features/inspections/measurement-actions";
import type { InspectionMeasurement, MeasurementData } from "@/features/inspections/measurement-queries";

const promptByRoom: Record<string, string[]> = {
  KJ: ["Kjøkkenøy", "Benkeplate", "Åpning for hvitevarer"],
  TRAPP: ["Trapp", "Total bredde", "Maks/min høyde", "Dybde"],
  BOD: ["Ekstern bod", "Alle vegglengder", "Dørbredde", "Takhøyde"],
  BOD2: ["Bod 2. etasje", "Dørbredde", "Hylleplass"],
  STUE: ["TV-vegg", "Gardinstang ved terrassedor"],
  SOV1: ["Vindu - innvendige mål for plisse-gardiner", "Garderobeskap", "Rommet"],
  SOV2: ["Vindu - innvendige mål for plisse-gardiner", "Garderobeskap", "Gardinstang ved fransk balkong", "Rommet"],
  SOV3: ["Vindu - innvendige mål for plisse-gardiner", "Garderobeskap", "Rommet"],
  SOV4: ["Vindu - innvendige mål for plisse-gardiner", "Garderobeskap", "Rommet"]
};

const groups = [
  { area: "ground_floor", label: "1. etasje" },
  { area: "upper_floor", label: "2. etasje" },
  { area: "outdoor_storage", label: "Uteareal / bod" }
] as const;

const emptyForm = { name: "", length: "", width: "", height: "", depth: "", note: "" };
const toNumber = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;
const asInput = (value: number | null) => value === null ? "" : String(value);

export function MeasurementBoard({ data }: { data: MeasurementData | null }) {
  const router = useRouter();
  const [activeRoomId, setActiveRoomId] = useState(data?.rooms[0]?.id ?? "");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<InspectionMeasurement | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const room = data?.rooms.find((item) => item.id === activeRoomId) ?? data?.rooms[0];

  const loadMeasurement = (measurement: InspectionMeasurement) => {
    setEditingId(measurement.id);
    setForm({ name: measurement.name, length: asInput(measurement.lengthCm), width: asInput(measurement.widthCm), height: asInput(measurement.heightCm), depth: asInput(measurement.depthCm), note: measurement.note ?? "" });
    setPhoto(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  useEffect(() => {
    const next = room?.measurements.find((measurement) => measurement.lengthCm === null && measurement.widthCm === null && measurement.heightCm === null && measurement.depthCm === null);
    if (next) loadMeasurement(next);
  }, [room]);

  if (!data || !room) return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><section className="border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold">Oppmåling</h1><p className="mt-2 text-sm text-slate-600">Opprett ferdigbefaringen først for å måle rommene.</p></section></main>;

  const saveMeasurement = async () => {
    setError("");
    if (!form.name.trim()) { setError("Gi målingen et navn."); return; }
    setStatus("saving");
    const payload = { roomId: room.id, name: form.name, lengthCm: toNumber(form.length), widthCm: toNumber(form.width), heightCm: toNumber(form.height), depthCm: toNumber(form.depth), note: form.note };
    const isEditing = Boolean(editingId);
    const result = isEditing ? await updateInspectionMeasurementAction({ ...payload, measurementId: editingId }) : await createInspectionMeasurementAction(payload);
    if (!result.ok) { setStatus("error"); setError("Målingen kunne ikke lagres. Verdier må være større enn null."); return; }
    const measurementId = editingId ?? (!isEditing && "measurementId" in result ? result.measurementId : null);
    if (photo && measurementId) {
      const upload = await createMeasurementPhotoUploadAction({ measurementId, contentType: photo.type, fileSizeBytes: photo.size });
      if (!upload.ok) { setStatus("error"); setError("Målet er lagret, men bildet kunne ikke klargjøres."); return; }
      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage.from("inspection-media").uploadToSignedUrl(upload.storagePath, upload.token, photo, { contentType: photo.type });
      const attached = !uploadError && (await attachMeasurementPhotoAction({ measurementId, storagePath: upload.storagePath, contentType: photo.type, fileSizeBytes: photo.size })).ok;
      if (!attached) { setStatus("error"); setError("Målet er lagret, men bildet kunne ikke lagres."); return; }
    }
    setForm(emptyForm); setEditingId(null); setPhoto(null); setStatus("idle");
    if (fileInput.current) fileInput.current.value = "";
    startTransition(() => router.refresh());
  };

  const deleteMeasurement = () => {
    if (!toDelete || confirmation !== "SLETT") return;
    startTransition(async () => {
      const result = await deleteInspectionMeasurementAction(toDelete.id);
      if (!result.ok) { setError("Målet kunne ikke slettes. Prøv igjen."); return; }
      if (editingId === toDelete.id) { setEditingId(null); setForm(emptyForm); }
      setToDelete(null); setConfirmation(""); router.refresh();
    });
  };

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><header className="border-b border-slate-200 pb-5"><p className="text-sm font-semibold text-primary">Ballerud Hageby, rekkehus 111</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Oppmåling</h1><p className="mt-2 text-sm text-slate-600">Registrer praktiske mål i centimeter. Vinduer måles innvendig for bestilling av plisse-gardiner.</p></header><div className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]"><nav className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Rom">{groups.map((group) => { const rooms = data.rooms.filter((item) => item.area === group.area); return rooms.length ? <section key={group.area} className="min-w-max"><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{group.label}</h2><div className="flex gap-2 lg:flex-col">{rooms.map((item) => <button key={item.id} type="button" onClick={() => setActiveRoomId(item.id)} className={`min-w-max rounded-lg border px-3 py-2 text-left text-sm font-semibold ${item.id === room.id ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>{item.name}<span className="ml-2 text-xs opacity-80">{item.measurements.length}</span></button>)}</div></section> : null; })}</nav><section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">{room.name}</h2><Ruler className="h-5 w-5 text-primary" /></div><div className="mt-3 flex flex-wrap gap-2">{(promptByRoom[room.code] ?? ["Rommet", "Vindu", "Dør", "Garderobenisje"]).map((prompt) => <button key={prompt} type="button" onClick={() => { setEditingId(null); setForm((previous) => ({ ...previous, name: prompt })); }} className="rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary">{prompt}</button>)}<button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-full border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">Ny måling</button></div><div className="mt-4 rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Måling</p><p className="mt-0.5 text-sm font-bold text-slate-900">{form.name || "Velg eller skriv hva som måles"}</p></div><div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(4,82px)]"><input value={form.name} onChange={(event) => { setEditingId(null); setForm((previous) => ({ ...previous, name: event.target.value })); }} placeholder="Hva måles?" className="h-9 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary" />{([['length', 'L'], ['width', 'B'], ['height', 'H'], ['depth', 'D']] as const).map(([key, label]) => <label key={key} className="relative"><span className="sr-only">{label} i cm</span><input inputMode="decimal" value={form[key]} onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))} placeholder={label} className="h-9 w-full rounded-lg border border-slate-300 px-2 pr-7 text-sm outline-none focus:border-primary" /><span className="pointer-events-none absolute right-2 top-2 text-xs text-slate-500">cm</span></label>)}</div><div className="mt-2 flex flex-wrap items-center gap-2"><input value={form.note} onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Notat" className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary" /><label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"><Camera className="h-3.5 w-3.5" />{photo ? "Bilde valgt" : "Bilde"}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label><button type="button" onClick={() => void saveMeasurement()} disabled={status === "saving" || pending} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />{status === "saving" ? "Lagrer..." : editingId ? "Lagre mål" : "Legg til mål"}</button></div>{error ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}<div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">{room.measurements.length ? room.measurements.map((measurement) => <article key={measurement.id} className="flex items-start gap-3 py-3"><button type="button" onClick={() => loadMeasurement(measurement)} className="min-w-0 flex-1 text-left"><p className="text-sm font-bold text-slate-900">{measurement.name}</p><p className="mt-1 text-xs text-slate-600">{[['L', measurement.lengthCm], ['B', measurement.widthCm], ['H', measurement.heightCm], ['D', measurement.depthCm]].filter(([, value]) => value !== null).map(([label, value]) => `${label}: ${value} cm`).join(' · ') || 'Trykk for å fylle ut målene'}</p>{measurement.note ? <p className="mt-1 text-xs text-slate-600">{measurement.note}</p> : null}</button>{measurement.photoUrl ? <a href={measurement.photoUrl} target="_blank" rel="noreferrer" className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200"><img src={measurement.photoUrl} alt={`Bilde av ${measurement.name}`} className="h-full w-full object-cover" /></a> : null}<button type="button" onClick={() => { setToDelete(measurement); setConfirmation(""); }} aria-label={`Slett ${measurement.name}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></article>) : <p className="py-6 text-sm text-slate-500">Ingen mål er registrert i dette rommet ennå.</p>}</div></section></div>{toDelete ? <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><section role="dialog" aria-modal="true" aria-labelledby="delete-measurement-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 id="delete-measurement-title" className="text-lg font-bold text-slate-900">Slette mål permanent?</h2><p className="mt-2 text-sm leading-6 text-slate-600"><strong>{toDelete.name}</strong> og eventuelt bilde blir slettet permanent. Dette kan ikke angres.</p></div><button type="button" onClick={() => setToDelete(null)} aria-label="Avbryt sletting" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300"><X className="h-4 w-4" /></button></div><label className="mt-5 block"><span className="text-sm font-semibold text-slate-800">Skriv SLETT for å bekrefte</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-red-600" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setToDelete(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Behold mål</button><button type="button" onClick={deleteMeasurement} disabled={confirmation !== "SLETT" || pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Slett mål</button></div></section></div> : null}</main>;
}