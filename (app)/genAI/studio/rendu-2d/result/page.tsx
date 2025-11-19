"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode2D = "sketch" | "realistic";
type View2D = "front" | "back" | "left" | "right" | "top" | "bottom";
type DownloadFormat = "png" | "jpg" | "webp";

interface Prototype2D {
  id: number;
  imageUrl: string;
  finalPrompt: string;
  source: "initial" | "edit";
}

interface Rendu2DResult {
  ok: true;
  userPrompt: string;
  mode: Mode2D;
  views: View2D[];
  downloadFormat: DownloadFormat;
  prototypes: Prototype2D[];
}

export default function Rendu2DResultPage() {
  const router = useRouter();

  const [data, setData] = useState<Rendu2DResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Récupération du résultat depuis sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = sessionStorage.getItem("rendu2dResult");
    if (!raw) {
      setErrorMessage(
        "No generation result found. Please start from the 2D Studio page.",
      );
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Rendu2DResult;
      if (!parsed.ok || !Array.isArray(parsed.prototypes)) {
        setErrorMessage(
          "Invalid result payload. Please relaunch a 2D generation.",
        );
        return;
      }

      setData(parsed);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Error parsing rendu2dResult from sessionStorage:", err);
      setErrorMessage(
        "Unable to read previous result. Please relaunch a 2D generation.",
      );
    }
  }, []);

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-3xl border border-slate-800 bg-slate-950/80 p-6 space-y-4">
          <h1 className="text-xl font-semibold text-slate-50">
            2D rendering result
          </h1>
          <p className="text-sm text-red-300">{errorMessage}</p>
          <div className="flex justify-end">
            <button
              onClick={() => router.push("/genAI/studio/rendu-2d")}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Back to 2D Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.prototypes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-3xl border border-slate-800 bg-slate-950/80 p-6 space-y-4">
          <h1 className="text-xl font-semibold text-slate-50">
            2D rendering result
          </h1>
          <p className="text-sm text-slate-400">
            No prototypes available for this generation.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => router.push("/genAI/studio/rendu-2d")}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Back to 2D Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentProto: Prototype2D = data.prototypes[currentIndex];

  function goPrev() {
    setCurrentIndex((prev) =>
      prev > 0 ? prev - 1 : data.prototypes.length - 1,
    );
  }

  function goNext() {
    setCurrentIndex((prev) =>
      prev < data.prototypes.length - 1 ? prev + 1 : 0,
    );
  }

  function handleDownload() {
    if (!currentProto.imageUrl) return;

    // On respecte le format demandé, mais comme Replicate renvoie déjà une URL,
    // ici on se contente de télécharger tel quel.
    const link = document.createElement("a");
    link.href = currentProto.imageUrl;
    link.download = `prototype-${currentProto.id}.${data.downloadFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const isSketch = data.mode === "sketch";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4 py-10">
      <div className="mx-auto max-w-6xl bg-slate-950/70 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-[0_0_60px_rgba(15,23,42,0.8)] space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Studio – 2D Rendering Result
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
              Prototypes {currentProto.id} / {data.prototypes.length}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl">
              Navigate through the generated prototypes (Prototype I, II, III…)
              and download the one you prefer.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end text-[11px]">
            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-slate-200">
              Mode:{" "}
              <span className="ml-1 font-semibold text-emerald-300">
                {isSketch ? "Technical sketch" : "Realistic render"}
              </span>
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-slate-200">
              Views:{" "}
              <span className="ml-1 text-slate-300">
                {data.views.join(", ")}
              </span>
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-slate-200">
              Download format:{" "}
              <span className="ml-1 font-semibold text-sky-300">
                {data.downloadFormat.toUpperCase()}
              </span>
            </span>
          </div>
        </header>

        {/* Main layout */}
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1.2fr]">
          {/* Image + navigation */}
          <section className="space-y-4">
            <div className="relative rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex items-center justify-center min-h-[280px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentProto.imageUrl}
                alt={`Prototype ${currentProto.id}`}
                className="max-h-[420px] w-full object-contain rounded-xl bg-black/40"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/60"
                >
                  Previous prototype
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/60"
                >
                  Next prototype
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Download prototype {currentProto.id}
              </button>
            </div>
          </section>

          {/* Right panel: user prompt + final prompt */}
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">
                  User prompt (fixed)
                </h2>
              </div>
              <p className="text-xs text-slate-100 whitespace-pre-wrap">
                {data.userPrompt}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">
                  Final prompt sent to Replicate
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPrompt((prev) => !prev)}
                  className="text-[11px] text-slate-300 hover:text-slate-100"
                >
                  {showPrompt ? "Hide prompt" : "Show prompt"}
                </button>
              </div>

              {showPrompt && (
                <div className="max-h-64 overflow-auto rounded-xl bg-slate-950/80 p-3 text-[11px] text-slate-100 whitespace-pre-wrap font-mono">
                  {currentProto.finalPrompt}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.push("/genAI/studio/cdf")}
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-200 hover:border-sky-500/60"
              >
                Start functional specification 
              </button>
              {/* Plus tard : passer prototype I vers 3D, etc. */}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
