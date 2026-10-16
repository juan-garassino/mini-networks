"use client";

// The owner's feedback inbox on every /lab page: a note + pasted/dropped
// pictures, stamped with the exact view (skin, URL, viewport), saved by the
// API under playground/.lab-shots/feedback/ where the orchestrating agent
// picks it up and relays it to the skin's builder. Status comes back here.
// Hidden under ?still=1 so it never appears in screenshots.
//
// Lab furniture, not part of any design: the closed tab never covers a
// design's drawer, sheet, plate, corner, chip or label. It docks to the first
// FREE spot on the viewport's edges (DOCKS, in order), re-checked every second
// and on resize; it stays put while its spot is free, and when no spot is free
// it shrinks to a small round button on the least-covered one.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { MessageSquare } from "lucide-react";
import { listFeedback, postFeedback } from "@/lib/api";
import type { FeedbackNote } from "@/lib/types";

const STATUS_COPY: Record<string, string> = {
  new: "Sent — waiting to be picked up",
  relayed: "Relayed to the builder",
  addressed: "Addressed",
};

type Edge = "left" | "right" | "top" | "bottom";
interface Dock { edge: Edge; at: number }
/** Where the tab may dock, in order of preference: the middle of each edge, then the thirds. */
const DOCKS: Dock[] = [
  { edge: "right", at: 0.5 }, { edge: "left", at: 0.5 }, { edge: "bottom", at: 0.5 }, { edge: "top", at: 0.5 },
  { edge: "right", at: 0.3 }, { edge: "left", at: 0.3 }, { edge: "right", at: 0.7 }, { edge: "left", at: 0.7 },
  { edge: "bottom", at: 0.3 }, { edge: "bottom", at: 0.7 }, { edge: "top", at: 0.3 }, { edge: "top", at: 0.7 },
];
/** The tab's footprint (px): long side along the edge, short side across it; the round button. */
const TAB = { long: 84, short: 26, round: 30 };
const PROBE_MS = 1000;
/** A panel bigger than this share of the viewport is the design's ground, not its chrome. */
const GROUND_SHARE = 0.7;
const INTERACTIVE = "button, a[href], input, select, textarea, summary, [role=button], [role=tab], [role=link], [tabindex]:not([tabindex='-1']), nav, header, footer, aside, dialog, [role=dialog]";
/** Chrome at any size: a drawer or sheet pulled to full screen is still not ground. */
const SHEET = "aside, dialog, [role=dialog]";

function boxOf(d: Dock, w: number, h: number, size: { long: number; short: number }) {
  const side = d.edge === "left" || d.edge === "right";
  const bw = side ? size.short : size.long;
  const bh = side ? size.long : size.short;
  const x = d.edge === "left" ? 0 : d.edge === "right" ? w - bw : d.at * w - bw / 2;
  const y = d.edge === "top" ? 0 : d.edge === "bottom" ? h - bh : d.at * h - bh / 2;
  return { x, y, w: bw, h: bh };
}

const opaqueColour = (c: string) => c !== "transparent" && !/rgba\([^)]*,\s*0(\.0+)?\)$/.test(c);
const hasOwnText = (e: Element) => [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());

/** A design's chrome or a mark worth not covering: anything interactive, any text, a drawer
 * or sheet at any size, or a filled/bordered panel smaller than the stage. Everything else
 * (the map, the data sheet, the sky) is ground the tab may sit on. */
function isChrome(hit: Element, vpArea: number): boolean {
  if (hasOwnText(hit) || hit instanceof SVGTextElement) return true;
  for (let e: Element | null = hit; e && e !== document.body; e = e.parentElement) {
    const r = e.getBoundingClientRect();
    // a stage-sized element is ground (a focusable map, the page) unless it is a sheet
    if (r.width * r.height >= GROUND_SHARE * vpArea) { if (e.matches(SHEET)) return true; continue; }
    if (e.matches(INTERACTIVE)) return true;
    const cs = getComputedStyle(e);
    if (opaqueColour(cs.backgroundColor) || cs.backgroundImage !== "none" || cs.boxShadow !== "none"
      || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0) return true;
  }
  return false;
}

/** How many of the box's five sample points land on ground (5 = free). */
function freePoints(box: { x: number; y: number; w: number; h: number }, self: Element | null): number {
  const vpArea = window.innerWidth * window.innerHeight;
  const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]];
  let free = 0;
  for (const [fx, fy] of pts) {
    const hit = document.elementsFromPoint(box.x + fx * box.w, box.y + fy * box.h).find((el) => !self?.contains(el));
    if (!hit || !isChrome(hit, vpArea)) free++;
  }
  return free;
}

/** The dock to use: keep the current one while it is free, else the first free one, else
 * the least-covered one as a round button. */
function chooseDock(current: number | null, self: Element | null): { i: number; round: boolean } {
  const w = window.innerWidth, h = window.innerHeight;
  const score = (i: number) => freePoints(boxOf(DOCKS[i], w, h, TAB), self);
  if (current !== null && score(current) === 5) return { i: current, round: false };
  let best = 0, bestScore = -1;
  for (let i = 0; i < DOCKS.length; i++) {
    const sc = score(i);
    if (sc === 5) return { i, round: false };
    if (sc > bestScore) { best = i; bestScore = sc; }
  }
  return { i: best, round: true };
}

function dockStyle(d: Dock, round: boolean): CSSProperties {
  const size = round ? { long: TAB.round, short: TAB.round } : TAB;
  const side = d.edge === "left" || d.edge === "right";
  const s: CSSProperties = { width: side ? size.short : size.long, height: side ? size.long : size.short };
  if (side) Object.assign(s, { [d.edge]: 0, top: `calc(${d.at * 100}% - ${size.long / 2}px)` });
  else Object.assign(s, { [d.edge]: 0, left: `calc(${d.at * 100}% - ${size.long / 2}px)` });
  return s;
}

/** Round the corners that face into the page; the edge side stays flush. */
const RADIUS: Record<Edge, string> = {
  right: "rounded-l-md", left: "rounded-r-md", top: "rounded-b-md", bottom: "rounded-t-md",
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const noSubscribe = () => () => {};
const readHidden = () => new URLSearchParams(window.location.search).get("still") === "1";
const readSkin = () => window.location.pathname.split("/").filter(Boolean)[1] ?? "lab";

export function FeedbackTab() {
  // hidden on the server and under ?still=1; the skin is the /lab/<skin> segment
  const hidden = useSyncExternalStore(noSubscribe, readHidden, () => true);
  const skin = useSyncExternalStore(noSubscribe, readSkin, () => "lab");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  // null until the first probe: the tab never flashes on a spot it then leaves
  const [dock, setDock] = useState<{ i: number; round: boolean } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<{ i: number; round: boolean } | null>(null);

  useEffect(() => {
    if (hidden || open) return;
    const probe = () => {
      const d = dockRef.current;
      const next = chooseDock(d?.i ?? null, tabRef.current);
      if (d && d.i === next.i && d.round === next.round) return;
      dockRef.current = next;
      setDock(next);
    };
    probe();
    const id = setInterval(probe, PROBE_MS);
    window.addEventListener("resize", probe);
    return () => { clearInterval(id); window.removeEventListener("resize", probe); };
  }, [hidden, open]);

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
      {!open && dock && (() => {
        const d = DOCKS[dock.i];
        const side = d.edge === "left" || d.edge === "right";
        return (
          <button
            ref={tabRef}
            onClick={() => setOpen(true)}
            aria-label="Feedback"
            title="Send feedback to the builders"
            style={dockStyle(d, dock.round)}
            className={`fixed z-[100] flex items-center justify-center bg-neutral-900/85 text-[12px] font-semibold text-white shadow-md hover:bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 ${
              dock.round ? "m-1 rounded-full" : RADIUS[d.edge]} ${side && !dock.round ? "[writing-mode:vertical-rl]" : ""}`}
          >
            {dock.round ? <MessageSquare size={14} strokeWidth={2} aria-hidden /> : "Feedback"}
          </button>
        );
      })()}
      {open && (
        <aside
          role="dialog"
          aria-label="Send feedback to the builders"
          className={`fixed inset-y-3 ${dock && DOCKS[dock.i].edge === "left" ? "left-3" : "right-3"} z-[100] flex w-[min(380px,calc(100vw-24px))] flex-col gap-3 overflow-y-auto rounded-xl bg-white p-4 text-[15px] text-neutral-900 shadow-2xl ring-1 ring-black/10`}
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
