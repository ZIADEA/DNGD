"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface CdfResultPayload {
  idea: string;
  source: "studio" | "rendu-2d" | "3d";
  prototypePrompt?: string;
  fsdText: string;
  summaryPrompt2D?: string;
  summaryPrompt3D?: string;
}

function parseData(param: string | null): CdfResultPayload | null {
  if (!param) return null;
  try {
    return JSON.parse(decodeURIComponent(param)) as CdfResultPayload;
  } catch {
    return null;
  }
}

export default function CdfResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawData = useMemo(
    () => parseData(searchParams.get("data")),
    [searchParams],
  );

  const [editableText, setEditableText] = useState<string | null>(null);

  if (!rawData) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-50">
          Functional specification
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          No specification payload found. Please restart from the
          questionnaire.
        </p>
      </div>
    );
  }

  // Non-null à partir d'ici
  const data: CdfResultPayload = rawData;

  const fsdText = editableText ?? data.fsdText;

  function downloadAsTxt() {
    const blob = new Blob([fsdText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "functional_specification.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function goTo2D() {
    if (!data.summaryPrompt2D) return;
    const encoded = encodeURIComponent(data.summaryPrompt2D);
    router.push(`/genAI/studio/rendu-2d?prefillIdea=${encoded}`);
  }

  function goTo3D() {
    if (!data.summaryPrompt3D) return;
    const encoded = encodeURIComponent(data.summaryPrompt3D);
    router.push(
      `/genAI/studio/rendu-3d?prefillPrompt3D=${encoded}`,
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">
          Functional specification (NF EN 16271)
        </h1>
        <p className="text-sm text-slate-400">
          Generated from your answers and context. You can read, edit it,
          and export it.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-2">
          Initial context (fixed)
        </h2>
        <p className="text-xs text-slate-100 whitespace-pre-wrap">
          {data.idea}
        </p>
        {data.prototypePrompt && (
          <p className="mt-2 text-[11px] text-slate-400">
            Based on prototype / 3D concept: {data.prototypePrompt}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">
            Functional specification text
          </h2>
          <button
            onClick={() =>
              setEditableText((prev) =>
                prev === null ? data.fsdText : null,
              )
            }
            className="rounded-md border border-slate-700 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
          >
            {editableText === null ? "Edit in place" : "Reset to AI text"}
          </button>
        </div>

        {editableText === null ? (
          <div className="max-h-[480px] overflow-auto rounded-md bg-slate-900/80 p-3 text-xs text-slate-100 whitespace-pre-wrap">
            {data.fsdText}
          </div>
        ) : (
          <textarea
            rows={18}
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            className="w-full max-h-[480px] rounded-md border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-100 font-mono"
          />
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={downloadAsTxt}
            className="rounded-xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-white"
          >
            Download as .txt
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={goTo2D}
            disabled={!data.summaryPrompt2D}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            Get 2D prototypes from this CDF
          </button>
          <button
            onClick={goTo3D}
            disabled={!data.summaryPrompt3D}
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
          >
            Get 3D prototype from this CDF
          </button>
        </div>
      </section>
    </div>
  );
}
