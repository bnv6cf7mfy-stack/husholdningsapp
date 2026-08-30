"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, FolderOpen, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { createBallerudDocumentUploadAction, registerBallerudDocumentAction } from "@/features/ballerud/document-actions";
import { documentCategories, type BallerudDocument, type DocumentCategory } from "@/features/ballerud/documents";

export function DocumentArchive({ documents }: { documents: BallerudDocument[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const uploadDocument = async () => {
    if (!file || !title.trim()) { setError("Velg fil og gi dokumentet en tittel."); return; }
    setStatus("uploading"); setError("");
    const upload = await createBallerudDocumentUploadAction({ title, category, fileName: file.name, contentType: file.type, fileSizeBytes: file.size });
    if (!upload.ok) { setStatus("error"); setError("Filen ma vaere PDF, JPG, PNG eller WebP og maks 25 MB."); return; }
    const supabase = createBrowserSupabaseClient();
    const { error: storageError } = await supabase.storage.from("ballerud-documents").uploadToSignedUrl(upload.storagePath, upload.token, file, { contentType: file.type });
    if (storageError) { setStatus("error"); setError("Dokumentet kunne ikke lastes opp. Prov igjen."); return; }
    const result = await registerBallerudDocumentAction({ title, category, fileName: file.name, contentType: file.type, fileSizeBytes: file.size, storagePath: upload.storagePath });
    if (!result.ok) { setStatus("error"); setError("Dokumentet ble lastet opp, men kunne ikke registreres."); return; }
    setTitle(""); setFile(null); setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => router.refresh());
  };

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><header className="border-b border-slate-200 pb-5"><p className="text-sm font-semibold text-primary">Ballerud Hageby, rekkehus 111</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Dokumentarkiv</h1><p className="mt-2 text-sm leading-6 text-slate-600">Private dokumenter for befaring, overtagelse og innflytting.</p></header><section className="mt-6 border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Last opp dokument</h2><div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tittel, for eksempel Elektroplan 1. etasje" className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary" /><select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">{Object.entries(documentCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Upload className="h-4 w-4" />Velg fil<input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label></div>{file ? <div className="mt-3 flex items-center justify-between gap-3 text-sm"><p className="truncate text-slate-600">{file.name}</p><button type="button" onClick={() => void uploadDocument()} disabled={status === "uploading" || pending} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{status === "uploading" ? "Laster opp..." : "Lagre dokument"}</button></div> : null}{error ? <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}</section><section className="mt-6"><div className="flex items-center gap-2"><FolderOpen className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold text-slate-900">Dokumenter ({documents.length})</h2></div><div className="mt-3 divide-y divide-slate-100 border border-slate-200 bg-white shadow-sm">{documents.length ? documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"><FileText className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{document.title}</p><p className="truncate text-xs text-slate-500">{documentCategories[document.category]} · {document.fileName}</p></div><span className="text-xs text-slate-500">{new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(document.createdAt))}</span></a>) : <p className="px-4 py-8 text-sm text-slate-500">Ingen dokumenter er lagt til ennå.</p>}</div></section></main>;
}