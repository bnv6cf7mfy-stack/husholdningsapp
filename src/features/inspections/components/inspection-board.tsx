"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Check, ClipboardCheck, ImagePlus, Save } from "lucide-react";
import { createBallerudInspectionAction, createInspectionPhotoUploadAction, registerInspectionPhotoAction, updateInspectionCheckpointAction } from "@/features/inspections/actions";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { InspectionData } from "@/features/inspections/queries";

export function InspectionBoard({ inspection }: { inspection: InspectionData | null }) {
  const router = useRouter();
  const [activeRoomId, setActiveRoomId] = useState(inspection?.rooms[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [uploadingCheckpointId, setUploadingCheckpointId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoCheckpointId, setPhotoCheckpointId] = useState<string | null>(null);
  const [checkedCheckpointIds, setCheckedCheckpointIds] = useState<Set<string>>(
    new Set(inspection?.rooms.flatMap((room) => room.checkpoints.filter((checkpoint) => checkpoint.checkedAt).map((checkpoint) => checkpoint.id)) ?? [])
  );
  const [noteStatus, setNoteStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(inspection?.rooms.flatMap((room) => room.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint.note ?? ""])) ?? [])
  );

  if (!inspection) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <ClipboardCheck className="h-7 w-7 text-primary" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Ferdigbefaring Ballerud</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Opprett den forberedte sjekklisten for rekkehus 111. Punktene bygger pa bestilte tilvalg og rommene i dokumentasjonen.</p>
        <button type="button" disabled={pending} onClick={() => startTransition(createBallerudInspectionAction)} className="mt-5 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">Opprett sjekkliste</button>
      </section>
    );
  }

  const total = inspection.rooms.reduce((sum, room) => sum + room.checkpoints.length, 0);
  const completed = checkedCheckpointIds.size;
  const room = inspection.rooms.find((item) => item.id === activeRoomId) ?? inspection.rooms[0];
  const roomCompleted = room.checkpoints.filter((checkpoint) => checkedCheckpointIds.has(checkpoint.id)).length;

  const saveCheckpoint = (id: string, checked: boolean) => {
    setCheckedCheckpointIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("checked", String(checked));
      formData.set("note", notes[id] ?? "");
      const result = await updateInspectionCheckpointAction(formData);
      if (!result.ok) {
        setCheckedCheckpointIds((previous) => {
          const next = new Set(previous);
          if (checked) next.delete(id);
          else next.add(id);
          return next;
        });
      }
    });
  };

  const saveNote = (id: string) => {
    setNoteStatus((previous) => ({ ...previous, [id]: "saving" }));
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("checked", String(checkedCheckpointIds.has(id)));
      formData.set("note", notes[id] ?? "");
      const result = await updateInspectionCheckpointAction(formData);
      setNoteStatus((previous) => ({ ...previous, [id]: result.ok ? "saved" : "error" }));
      if (result.ok) router.refresh();
    });
  };

  const selectPhoto = (checkpointId: string) => {
    setPhotoCheckpointId(checkpointId);
    photoInputRef.current?.click();
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file || !photoCheckpointId) return;
    setUploadError(null);
    setUploadingCheckpointId(photoCheckpointId);
    const upload = await createInspectionPhotoUploadAction({
      checkpointId: photoCheckpointId,
      fileName: file.name,
      contentType: file.type,
      fileSizeBytes: file.size
    });
    if (!upload.ok) {
      setUploadError("Bildet kunne ikke klargjøres. Bruk JPG, PNG, WebP eller HEIC pa maks 10 MB.");
      setUploadingCheckpointId(null);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from("inspection-media")
      .uploadToSignedUrl(upload.storagePath, upload.token, file, { contentType: file.type });
    if (uploadError) {
      setUploadError("Bildet kunne ikke lastes opp. Prøv igjen.");
      setUploadingCheckpointId(null);
      return;
    }
    const result = await registerInspectionPhotoAction({
      checkpointId: photoCheckpointId,
      storagePath: upload.storagePath,
      fileName: file.name,
      contentType: file.type,
      fileSizeBytes: file.size
    });
    if (!result.ok) setUploadError("Bildet ble lastet opp, men kunne ikke knyttes til punktet.");
    setUploadingCheckpointId(null);
    startTransition(() => router.refresh());
  };

  const uploadPhotos = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      await uploadPhoto(file);
    }
  };

  const roomGroups = [
    { area: "ground_floor", label: "1. etasje" },
    { area: "upper_floor", label: "2. etasje" },
    { area: "outdoor_storage", label: "Uteareal / bod" }
  ] as const;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-primary">{inspection.date} · {inspection.address}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{inspection.name}</h1>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${total ? (completed / total) * 100 : 0}%` }} /></div>
        <p className="mt-2 text-sm font-medium text-slate-600">{completed}/{total} kontrollert · {total - completed} gjenstar</p>
      </header>
      <div className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]">
        <nav className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Rom">
          {roomGroups.map((group) => {
            const groupedRooms = inspection.rooms.filter((item) => item.area === group.area);
            if (!groupedRooms.length) return null;
            return <section key={group.area} className="min-w-max"><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{group.label}</h2><div className="flex gap-2 lg:flex-col">{groupedRooms.map((item) => {
              const done = item.checkpoints.filter((checkpoint) => checkedCheckpointIds.has(checkpoint.id)).length;
              return <button key={item.id} type="button" onClick={() => setActiveRoomId(item.id)} className={`min-w-max rounded-lg border px-3 py-2 text-left text-sm font-semibold ${item.id === room.id ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700"}`}>{item.name}<span className="ml-2 text-xs opacity-80">{done}/{item.checkpoints.length}</span></button>;
            })}</div></section>;
          })}
        </nav>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-baseline justify-between gap-3"><h2 className="text-xl font-bold text-slate-900">{room.name}</h2><p className="text-sm text-slate-500">{roomCompleted}/{room.checkpoints.length}</p></div>
          <div className="mt-4 space-y-3">
            {room.checkpoints.map((checkpoint) => (
              <article key={checkpoint.id} className={`border-b border-slate-100 pb-4 last:border-0 ${checkedCheckpointIds.has(checkpoint.id) ? "opacity-70" : ""}`}>
                <div className="flex items-start gap-3">
                  <button type="button" aria-label={`Marker ${checkpoint.title} som kontrollert`} onClick={() => saveCheckpoint(checkpoint.id, !checkedCheckpointIds.has(checkpoint.id))} className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${checkedCheckpointIds.has(checkpoint.id) ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}><Check className="h-5 w-5" /></button>
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{checkpoint.category}</p><h3 className="mt-0.5 text-sm font-semibold leading-5 text-slate-900">{checkpoint.title}</h3>{checkpoint.guidance ? <p className="mt-2 text-xs leading-5 text-slate-600">{checkpoint.guidance}</p> : null}</div>
                </div>
                <div className="mt-3 pl-11"><label className="block"><span className="sr-only">Observasjon eller mangel</span><textarea value={notes[checkpoint.id] ?? ""} onChange={(event) => { setNotes((previous) => ({ ...previous, [checkpoint.id]: event.target.value })); setNoteStatus((previous) => ({ ...previous, [checkpoint.id]: "idle" })); }} placeholder="Observasjon / mangel..." rows={2} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => saveNote(checkpoint.id)} disabled={noteStatus[checkpoint.id] === "saving"} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 disabled:opacity-60"><Save className="h-3.5 w-3.5" />{noteStatus[checkpoint.id] === "saving" ? "Lagrer..." : "Lagre notat"}</button>{noteStatus[checkpoint.id] === "saved" ? <span className="text-xs font-medium text-emerald-700">Lagret</span> : null}{noteStatus[checkpoint.id] === "error" ? <span className="text-xs font-medium text-red-700">Kunne ikke lagre</span> : null}</div></div>
                <div className="mt-3 flex flex-wrap items-center gap-2 pl-11">
                  <button type="button" onClick={() => selectPhoto(checkpoint.id)} disabled={uploadingCheckpointId === checkpoint.id} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><Camera className="h-4 w-4" />{uploadingCheckpointId === checkpoint.id ? "Laster opp..." : "Ta bilde / velg bilde"}</button>
                  {checkpoint.photos.map((photo) => <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" title={photo.fileName} className="block h-12 w-12 overflow-hidden rounded-md border border-slate-200"><img src={photo.url} alt={photo.caption ?? photo.fileName} className="h-full w-full object-cover" /></a>)}
                </div>
              </article>
            ))}
          </div>
          {uploadError ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{uploadError}</p> : null}
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ImagePlus className="h-4 w-4" /> Bilder knyttes til dette punktet og lagres privat i befaringsdokumentasjonen.</p>
        </section>
      </div>
      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" multiple className="sr-only" onChange={(event) => { void uploadPhotos(event.target.files); event.target.value = ""; }} />
    </main>
  );
}