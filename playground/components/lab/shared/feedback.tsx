"use client";

// The owner's feedback inbox on every /lab page: a note + pasted/dropped
// pictures, stamped with the exact view (skin, URL, viewport), saved by the
// API under playground/.lab-shots/feedback/ where the orchestrating agent
// picks it up and relays it to the skin's builder. Status comes back here.
// Hidden under ?still=1 so it never appears in screenshots.
import { useCallback, useEffect, useRef, useState } from "react";
import { listFeedback, postFeedback } from "@/lib/api";
import type { FeedbackNote } from "@/lib/types";

const STATUS_COPY: Record<string, string> = {
  new: "Sent — waiting to be picked up",
  relayed: "Relayed to the builder",
  addressed: "Addressed",
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function FeedbackTab() {
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [skin, setSkin] = useState("lab");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHidden(new URLSearchParams(window.location.search).get("still") === "1");
    setSkin(window.location.pathname.split("/").filter(Boolean)[1] ?? "lab");
  }, []);

  const refresh = useCallback(() => {
    listFeedback().then((d) => setNotes(d.notes)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    area.current?.focus();
    const id = setInterval(refresh, 10000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearInterval(id); window.removeEventListener("keydown", onKey); };
  }, [open, refresh]);

  const addFiles = async (files: Iterable<File>) => {
    const pics = [...files].filter((f) => f.type.startsWith("image/"));
    const urls = await Promise.all(pics.map(readAsDataUrl));
    setImages((prev) => [...prev, ...urls].slice(0, 8));
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await postFeedback({
        skin, url: window.location.href, text,
        viewport: [window.innerWidth, window.innerHeight], images,
      });
      setText("");
      setImages([]);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  if (hidden) return null;
  const mine = notes.filter((n) => n.skin === skin).slice(0, 6);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 z-[100] -translate-y-1/2 rounded-l-lg bg-neutral-900 px-2 py-3 text-[14px] font-semibold text-white shadow-lg [writing-mode:vertical-rl] hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Feedback
        </button>
      )}
      {open && (
        <aside
          role="dialog"
          aria-label="Send feedback to the builders"
          className="fixed inset-y-3 right-3 z-[100] flex w-[min(380px,calc(100vw-24px))] flex-col gap-3 overflow-y-auto rounded-xl bg-white p-4 text-[15px] text-neutral-900 shadow-2xl ring-1 ring-black/10"
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); void addFiles(e.clipboardData.files); } }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files); }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Tell the builders</h2>
              <p className="text-[13px] text-neutral-600">
                About <b>{skin}</b>, this exact view. Paste or drop pictures anywhere in this panel.
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded px-2 py-1 text-[14px] underline">Close</button>
          </div>
          <textarea
            ref={area}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }}
            rows={5}
            placeholder="What should change? (⌘↵ to send)"
            className="w-full resize-y rounded-lg border border-neutral-300 p-2 text-[15px] outline-none focus:border-neutral-900"
          />
          {images.length > 0 && (
            <ul className="grid grid-cols-4 gap-2">
              {images.map((src, i) => (
                <li key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`attached picture ${i + 1}`} className="aspect-square w-full rounded object-cover ring-1 ring-black/10" />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-neutral-900 px-1.5 text-[12px] text-white"
                    aria-label={`remove picture ${i + 1}`}
                  >×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-[14px] hover:border-neutral-900">
              Add pictures
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
            </label>
            <button
              onClick={() => void send()}
              disabled={sending || (!text.trim() && images.length === 0)}
              className="ml-auto rounded-lg bg-neutral-900 px-4 py-1.5 text-[14px] font-semibold text-white disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          {error && <p className="text-[13px] text-red-700">Couldn’t send: {error}. Is the model server on :8000 running?</p>}
          {mine.length > 0 && (
            <section className="border-t border-neutral-200 pt-3">
              <h3 className="mb-2 text-[14px] font-semibold">Your notes on {skin}</h3>
              <ul className="flex flex-col gap-2">
                {mine.map((n) => (
                  <li key={n.id} className="rounded-lg bg-neutral-50 p-2 text-[13px]">
                    <p className="line-clamp-3">{n.text || "(pictures only)"}</p>
                    <p className="mt-1 text-neutral-600">
                      {STATUS_COPY[n.status] ?? n.status}{n.images.length ? `, ${n.images.length} picture${n.images.length > 1 ? "s" : ""}` : ""}
                    </p>
                    {n.reply && <p className="mt-1 text-neutral-800">{n.reply}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}
    </>
  );
}
