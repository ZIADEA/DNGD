"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Engine3D = "meshy" | "trellis";

interface From2Dto3DSession {
  ideaPrompt: string;
  imageUrl: string;
}

interface MeshyStartResponse {
  ok: boolean;
  taskId?: string;
  mode?: "preview" | "refine";
  error?: string;
}

interface TrellisResponse {
  ok: boolean;
  modelFile?: string | null;
  gaussianFile?: string | null;
  error?: string;
}

interface MeshyTask {
  taskId: string;
  mode: "preview" | "refine";
}

interface TrellisResult {
  modelFile: string | null;
  gaussianFile: string | null;
}

interface Rendu3DSession {
  engine: Engine3D;
  ideaPrompt: string;
  imageUrl?: string | null;
  meshyTask?: MeshyTask;
  trellis?: TrellisResult;
}

export default function Rendu3DPage() {
  const router = useRouter();

  const [idea, setIdea] = useState("");
  const [engine, setEngine] = useState<Engine3D>("meshy");

  const [from2D, setFrom2D] = useState<From2Dto3DSession | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Charger les infos provenant du 2D (si on arrive depuis la page de résultats 2D)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("from2Dto3D");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as From2Dto3DSession;
      if (parsed.ideaPrompt) {
        setIdea(parsed.ideaPrompt);
      }
      if (parsed.imageUrl) {
        setFrom2D(parsed);
      }
    } catch {
      // on ignore les erreurs JSON
    }
  }, []);

  const has2DImage = Boolean(from2D?.imageUrl);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedIdea = idea.trim();
    if (!trimmedIdea) {
      setErrorMessage("Please describe your 3D concept before generating.");
      return;
    }

    if (engine === "trellis" && !has2DImage) {
      setErrorMessage(
        "Trellis 3D requires an existing 2D prototype image. Please generate a 2D prototype first."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (engine === "meshy") {
        // ---------------------- Meshy : Text → 3D ----------------------
        const res = await fetch("/api/genai/meshy/text-to-3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            meshyMode: "preview",
            prompt3D: trimmedIdea,
          }),
        });

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          const msg =
            errJson.error ||
            "Server error while starting Meshy 3D generation.";
          setErrorMessage(msg);
          setIsSubmitting(false);
          return;
        }

        const json = (await res.json()) as MeshyStartResponse;

        if (!json.ok || !json.taskId || !json.mode) {
          setErrorMessage(
            json.error || "Meshy 3D did not return a valid taskId."
          );
          setIsSubmitting(false);
          return;
        }

        const session: Rendu3DSession = {
          engine: "meshy",
          ideaPrompt: trimmedIdea,
          imageUrl: from2D?.imageUrl ?? null,
          meshyTask: {
            taskId: json.taskId,
            mode: json.mode,
          },
        };

        if (typeof window !== "undefined") {
          sessionStorage.setItem("rendu3dSession", JSON.stringify(session));
        }

        setIsSubmitting(false);
        router.push("/genAI/studio/rendu-3d/result");
        return;
      } else {
        // ---------------------- Trellis : Image → 3D ----------------------
        if (!from2D || !from2D.imageUrl) {
          setErrorMessage(
            "No 2D prototype image found for Trellis. Please go back to 2D results."
          );
          setIsSubmitting(false);
          return;
        }

        const res = await fetch("/api/genai/replicate/trellis-3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: from2D.imageUrl,
            ideaPrompt: trimmedIdea,
          }),
        });

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          const msg =
            errJson.error ||
            "Server error while generating 3D model with Trellis.";
          setErrorMessage(msg);
          setIsSubmitting(false);
          return;
        }

        const json = (await res.json()) as TrellisResponse;

        if (!json.ok) {
          setErrorMessage(
            json.error || "Trellis 3D generation failed (ok=false)."
          );
          setIsSubmitting(false);
          return;
        }

        const session: Rendu3DSession = {
          engine: "trellis",
          ideaPrompt: trimmedIdea,
          imageUrl: from2D.imageUrl,
          trellis: {
            modelFile: json.modelFile ?? null,
            gaussianFile: json.gaussianFile ?? null,
          },
        };

        if (typeof window !== "undefined") {
          sessionStorage.setItem("rendu3dSession", JSON.stringify(session));
        }

        setIsSubmitting(false);
        router.push("/genAI/studio/rendu-3d/result");
        return;
      }
    } catch (err) {
      console.error("Error in rendu-3d handleSubmit:", err);
      setErrorMessage("Unexpected error while preparing 3D generation.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4 py-10">
      <div className="mx-auto max-w-5xl bg-slate-950/70 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-[0_0_60px_rgba(15,23,42,0.8)]">
        <header className="mb-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Studio – 3D Rendering
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
            Generate a 3D prototype
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Start from your idea (and optionally from the 2D prototype you just
            generated) to create a 3D model using Meshy or Trellis.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Idea */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              3D concept idea
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Describe what the 3D object should be: geometry, main functions,
              constraints, scale, environment, etc. If you came from 2D, this
              field is already prefilled with the prototype prompt.
            </p>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70 focus:border-violet-500/60 min-h-[120px]"
              placeholder="e.g. Same compact delivery drone concept, but as a detailed 3D model with well-defined arms, propellers, landing gear, and cargo bay."
            />
          </div>

          {/* Engine selection + 2D preview */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Engine choice */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-200">
                3D generation engine
              </label>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setEngine("meshy")}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-left ${
                    engine === "meshy"
                      ? "border-violet-500/70 bg-violet-500/10 text-violet-200"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-violet-500/40"
                  }`}
                >
                  <span className="font-medium">Meshy – Text to 3D</span>
                  <span className="block text-xs text-slate-400 mt-1">
                    Generate a 3D model from the textual description (preview
                    mode). You can refine later.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEngine("trellis")}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm text-left ${
                    engine === "trellis"
                      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                      : has2DImage
                      ? "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-emerald-500/40"
                      : "border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed"
                  }`}
                  disabled={!has2DImage}
                >
                  <span className="font-medium">Trellis – Image to 3D</span>
                  <span className="block text-xs mt-1">
                    {has2DImage
                      ? "Convert your 2D prototype image into a 3D mesh (STL/GLB…)."
                      : "Requires an existing 2D prototype image (generate 2D first)."}
                  </span>
                </button>
              </div>
            </div>

            {/* 2D prototype preview if available */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-200">
                2D prototype (optional)
              </label>
              <p className="text-xs text-slate-500 mb-1">
                If you come from the 2D results page, the current 2D prototype
                is shown here and can be used as input for Trellis.
              </p>
              <div className="relative w-full aspect-[4/3] rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex items-center justify-center">
                {from2D?.imageUrl ? (
                  <Image
                    src={from2D.imageUrl}
                    alt="2D prototype used as reference"
                    fill
                    className="object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-500">
                    No 2D prototype detected.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-xs text-red-200">
              {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.push("/genAI/studio")}
              className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
            >
              Back to Studio
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-violet-500/40 hover:bg-violet-400 disabled:opacity-60 disabled:cursor-wait"
            >
              {isSubmitting
                ? engine === "meshy"
                  ? "Starting Meshy task..."
                  : "Generating 3D with Trellis..."
                : "Generate 3D prototype"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
