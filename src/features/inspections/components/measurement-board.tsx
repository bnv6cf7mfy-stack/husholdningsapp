"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Plus, Ruler, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { attachMeasurementPhotoAction, createInspectionMeasurementAction, createMeasurementPhotoUploadAction, deleteInspectionMeasurementAction, updateInspectionMeasurementAction } from "@/features/inspections/measurement-actions";
import type { InspectionMeasurement, MeasurementData, MeasurementRoom } from "@/features/inspections/measurement-queries";

const groups = [{ area: "ground_floor", label: "1. etasje" }, { area: "upper_floor", label: "2. etasje" }, { area: "outdoor_storage", label: "Uteareal / bod" }] as const;
const blank = { name: "Ny måling", length: "", width: "", height: "", depth: "", note: "" };
const input = (value: number | null) => value === null ? "" : String(value);
const numberOrNull = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;

function MeasurementRow({ measurement, room, isNew, onSaved, onDelete }: { measurement?: InspectionMeasurement; room: MeasurementRoom; isNew?: boolean; onSaved: () => void; onDelete?: (measurement: InspectionMeasurement) => void }) {
  const router = useRouter();
  const [values, setValues] = useState(measurement ? { name: measurement.name, length: input(measurement.lengthCm), width: input(measurement.widthCm), height: input(measurement.heightCm), depth: input(measurement.depthCm), note: measurement.note ?? "" } : blank);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const save = async () => {
    if (!values.name.trim()) { setStatus("error"); return; }
    setStatus("saving");
    const payload = { roomId: room.id, name: values.name, lengthCm: numberOrNull(values.length), widthCm: numberOrNull(values.width), heightCm: numberOrNull(values.height), depthCm: numberOrNull(values.depth), note: values.note };
    const result = measurement ? await updateInspectionMeasurementAction({ ...payload, measurementId: measurement.id }) : await createInspectionMeasurementAction(payload);
    if (!result.ok) { setStatus("error"); return; }
    setStatus("idle"); onSaved(); startTransition(() => router.refresh());
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (!measurement || !files?.length) return;
    setStatus("saving");
    const supabase = createBrowserSupabaseClient();
    for (const file of Array.from(files)) {
      const upload = await createMeasurementPhotoUploadAction({ measurementId: measurement.id, contentType: file.type, fileSizeBytes: file.size });
      if (!upload.ok) { setStatus("error"); return; }
      const { error } = await supabase.storage.from("inspection-media").uploadToSignedUrl(upload.storagePath, upload.token, file, { contentType: file.type });
      if (error || !(await attachMeasurementPhotoAction({ measurementId: measurement.id, storagePath: upload.storagePath, contentType: file.type, fileSizeBytes: file.size })).ok) { setStatus("error"); return; }
    }
    if (fileInput.current) fileInput.current.value = "";
    setStatus("idle"); startTransition(() => router.refresh());
  };

  return <article className={`border-b border-slate-100 py-3 last:border-0 ${isNew ? "bg-emerald-50/50 px-2" : ""}`}><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(4,78px)]"><input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} aria-label="Navn på mål" className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-primary" />{([['length', 'L'], ['width', 'B'], ['height', 'H'], ['depth', 'D']] as const).map(([key, label]) => <label key={key} className="relative"><span className="sr-only">{label} i centimeter</span><input value={values[key]} inputMode="decimal" onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder={label} className="h-9 w-full rounded-lg border border-slate-300 px-2 pr-7 text-sm outline-none focus:border-primary" /><span className="pointer-events-none absolute right-2 top-2 text-xs text-slate-500">cm</span></label>)}</div><div className="mt-2 flex flex-wrap items-center gap-2"><input value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} placeholder="Notat" className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary" /><button type="button" onClick={() => void save()} disabled={status === "saving" || pending} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-60"><Save className="h-3.5 w-3.5" />{status === "saving" ? "Lagrer..." : "Lagre"}</button>{measurement ? <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"><Camera className="h-3.5 w-3.5" />Bilder<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" onChange={(event) => { void uploadPhotos(event.target.files); }} /></label> : null}{measurement && onDelete ? <button type="button" onClick={() => onDelete(measurement)} aria-label={`Slett ${measurement.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button> : null}</div>{status === "error" ? <p className="mt-2 text-xs font-medium text-red-700">Kunne ikke lagre. Kontroller feltene og prøv igjen.</p> : null}{measurement?.photos.length ? <div className="mt-2 flex flex-wrap gap-2">{measurement.photos.map((photo) => <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="h-12 w-12 overflow-hidden rounded-md border border-slate-200"><img src={photo.url} alt={`Bilde av ${measurement.name}`} className="h-full w-full object-cover" /></a>)}</div> : null}</article>;
}

export function MeasurementBoard({ data }: { data: MeasurementData | null }) {
  const router = useRouter();
  const [activeRoomId, setActiveRoomId] = useState(data?.rooms[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<InspectionMeasurement | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const room = data?.rooms.find((item) => item.id === activeRoomId) ?? data?.rooms[0];

  const deleteMeasurement = () => {
    if (!toDelete || confirmation !== "SLETT") return;
    startTransition(async () => {
      if (!(await deleteInspectionMeasurementAction(toDelete.id)).ok) return;
      setToDelete(null); setConfirmation(""); router.refresh();
    });
  };

  if (!data || !room) return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><section className="border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold">Oppmåling</h1><p className="mt-2 text-sm text-slate-600">Opprett ferdigbefaringen først for å måle rommene.</p></section></main>;

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><header className="border-b border-slate-200 pb-5"><p className="text-sm font-semibold text-primary">Ballerud Hageby, rekkehus 111</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Oppmåling</h1><p className="mt-2 text-sm text-slate-600">Registrer praktiske mål i centimeter. Vinduer måles innvendig for bestilling av plisse-gardiner.</p></header><div className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]"><nav className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Rom">{groups.map((group) => { const rooms = data.rooms.filter((item) => item.area === group.area); return rooms.length ? <section key={group.area} className="min-w-max"><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{group.label}</h2><div className="flex gap-2 lg:flex-col">{rooms.map((item) => <button key={item.id} type="button" onClick={() => { setActiveRoomId(item.id); setAdding(false); }} className={`min-w-max rounded-lg border px-3 py-2 text-left text-sm font-semibold ${item.id === room.id ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>{item.name}<span className="ml-2 text-xs opacity-80">{item.measurements.length}</span></button>)}</div></section> : null; })}</nav><section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">{room.name}</h2><p className="text-xs text-slate-500">Trykk direkte i en rad for å endre mål eller notat.</p></div><Ruler className="h-5 w-5 text-primary" /></div><button type="button" onClick={() => setAdding(true)} className="mt-4 inline-flex h-9 items-center gap-1 rounded-lg border border-primary px-3 text-xs font-semibold text-primary"><Plus className="h-3.5 w-3.5" />Legg til ny måling</button><div className="mt-3 divide-y divide-slate-100">{adding ? <MeasurementRow room={room} isNew onSaved={() => setAdding(false)} /> : null}{room.measurements.map((measurement) => <MeasurementRow key={measurement.id} measurement={measurement} room={room} onSaved={() => {}} onDelete={(selected) => { setToDelete(selected); setConfirmation(""); }} />)}</div></section></div>{toDelete ? <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center"><section role="dialog" aria-modal="true" aria-labelledby="delete-measurement-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 id="delete-measurement-title" className="text-lg font-bold text-slate-900">Slette mål permanent?</h2><p className="mt-2 text-sm leading-6 text-slate-600"><strong>{toDelete.name}</strong> og alle tilknyttede bilder blir slettet permanent. Dette kan ikke angres.</p></div><button type="button" onClick={() => setToDelete(null)} aria-label="Avbryt sletting" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300"><X className="h-4 w-4" /></button></div><label className="mt-5 block"><span className="text-sm font-semibold text-slate-800">Skriv SLETT for å bekrefte</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-red-600" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setToDelete(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Behold mål</button><button type="button" onClick={deleteMeasurement} disabled={confirmation !== "SLETT" || pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Slett mål</button></div></section></div> : null}</main>;
}