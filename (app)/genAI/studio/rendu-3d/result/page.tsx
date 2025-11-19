"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Engine3D = "meshy" | "trellis";

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

interface MeshyStatusResponse {
  ok: boolean;
  status?: {
    state: "pending" | "running" | "completed" | "failed";
    progress?: number;
    meshUrl?: string;
  };
  error?: string;
}

export default function Rendu3DResultPage() {
  const router = useRouter();

  const [session, setSession] = useState<Rendu3DSession | null>(null);
  const [meshyStatus, setMeshyStatus] = useState<MeshyStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  //const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Charger session 3D depuis sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("rendu3dSession");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Rendu3DSession;
      setSession(parsed);

      if (parsed.engine === "meshy" && parsed.meshyTask) {
        startMeshyPolling(parsed.meshyTask.taskId);
      }
    } catch (err) {
      console.error("Error parsing rendu3dSession:", err);
    }
  }, []);

  // Polling Meshy
  function startMeshyPolling(taskId: string) {
    if (isPolling) return;
    setIsPolling(true);

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/genai/meshy/text-to-3d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "status",
            taskId,
          }),
        });

        const json = (await res.json()) as MeshyStatusResponse;
        setMeshyStatus(json);

        if (json.status?.state === "completed" || json.status?.state === "failed") {
          clearInterval(interval);
          setIsPolling(false);
        }
      } catch (err) {
        console.error("Meshy polling error:", err);
      }
    }, 5000);
  }

  // UI si session vide
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300">
        No 3D session found. Please generate a 3D prototype first.
      </div>
    );
  }

  const isMeshy = session.engine === "meshy";
  const isTrellis = session.engine === "trellis";

  // Status Meshy
  let meshyState: string | null = null;
  let meshyProgress = 0;
  let meshyModelUrl: string | null = null;

  if (meshyStatus?.status) {
    meshyState = meshyStatus.status.state;
    meshyProgress = meshyStatus.status.progress ?? 0;
    meshyModelUrl = meshyStatus.status.meshUrl ?? null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4 py-10">
      <div className="mx-auto max-w-5xl bg-slate-950/70 border border-slate-800 rounded-3xl p-8 shadow-[0_0_60px_rgba(15,23,42,0.8)]">

        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Studio – 3D Rendering
          </p>
          <h1 className="text-2xl md:text-3xl text-slate-50 font-semibold">
            Your 3D Prototype
          </h1>

          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Engine used: <strong className="text-violet-300">{session.engine.toUpperCase()}</strong>
          </p>
        </header>

        {/* Idea */}
        <div className="mb-8">
          <p className="text-xs text-slate-500 mb-1">Prompt used:</p>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-slate-300 text-sm">
            {session.ideaPrompt}
          </div>
        </div>

        {/* 2D preview if available */}
        {session.imageUrl && (
          <div className="mb-10">
            <p className="text-xs text-slate-500 mb-1">2D Prototype source:</p>
            <div className="relative w-full aspect-[4/3] rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <Image
                src={session.imageUrl}
                alt="2D prototype"
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}

        {/* ---------- MESHY ---------- */}
        {isMeshy && session.meshyTask && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-200">Meshy 3D Generation</h2>

            {!meshyStatus?.status && (
              <p className="text-slate-400 text-sm">
                Starting Meshy task… Please wait.
              </p>
            )}

            {meshyState === "pending" && (
              <p className="text-sm text-slate-400">Task pending…</p>
            )}

            {meshyState === "running" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">Generating 3D model…</p>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all"
                    style={{ width: `${meshyProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">{meshyProgress}%</p>
              </div>
            )}

            {meshyState === "failed" && (
              <p className="text-red-400 text-sm">
                Meshy failed to generate the model.
              </p>
            )}

            {meshyState === "completed" && meshyModelUrl && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  3D model ready!
                </p>

                <a
                  href={meshyModelUrl}
                  target="_blank"
                  className="block rounded-xl border border-violet-500/60 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/20"
                >
                  Download 3D Model (Meshy)
                </a>
              </div>
            )}
          </div>
        )}

        {/* ---------- TRELLIS ---------- */}
        {isTrellis && session.trellis && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-200">Trellis 3D Result</h2>

            <div className="flex flex-col gap-3">
              <a
                href={session.trellis.modelFile ?? undefined}
                target="_blank"
                className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
              >
                Download Model File (STL/OBJ GLB)
              </a>

              <a
                href={session.trellis.gaussianFile ?? undefined}
                target="_blank"
                className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
              >
                Download Gaussian Splatting File
              </a>
            </div>
          </div>
        )}

        {/* ---------- Actions ---------- */}
        <div className="flex justify-end gap-3 mt-10">
          <button
            onClick={() => router.push("/genAI/studio")}
            className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            Back to Studio
          </button>

          <button
            onClick={() => router.refresh()}
            className="rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
