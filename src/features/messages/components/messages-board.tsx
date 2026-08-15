"use client";

import { useActionState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { sendMessageAction, type MessageFormState } from "@/features/messages/actions";
import type { MessagesData } from "@/features/messages/queries";

const initialState: MessageFormState = {};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function MessagesBoard({ data }: { data: MessagesData }) {
  const [state, formAction, isPending] = useActionState(sendMessageAction, initialState);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.messages]);

  // Reverse so oldest is at top
  const sorted = [...data.messages].reverse();

  return (
    <div className="flex flex-1 flex-col gap-0 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">
            Ingen meldinger ennå. Send den første!
          </p>
        ) : (
          sorted.map((msg) => {
            const isOwn = msg.authorId === data.currentProfileId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
              >
                {!isOwn && (
                  <span className="text-[11px] font-semibold text-slate-500 px-1">
                    {msg.authorName}
                  </span>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    isOwn
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-900 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <span className="text-[10px] text-slate-400 px-1">{formatTime(msg.createdAt)}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3">
        {state.error && (
          <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p>
        )}
        <form
          action={formAction}
          onSubmit={(e) => {
            const form = e.currentTarget;
            setTimeout(() => {
              form.reset();
              inputRef.current?.focus();
            }, 0);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            name="content"
            required
            rows={1}
            placeholder="Skriv en melding…"
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={isPending}
            aria-label="Send melding"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-1.5 text-[10px] text-slate-400 text-right">
          Enter sender · Shift+Enter linjeskift
        </p>
      </div>
    </div>
  );
}
