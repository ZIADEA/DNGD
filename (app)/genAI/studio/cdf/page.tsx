"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function CdfEntryPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!idea.trim()) return;

    const payload = {
      from: "studio" as const,
      idea: idea.trim(),
    };
    const encoded = encodeURIComponent(JSON.stringify(payload));
    router.push(`/genAI/studio/cdf/questions?data=${encoded}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-[0_0_50px_rgba(15,23,42,0.8)] space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Functional Specification
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">
            Start a functional specification (NF EN 16271)
          </h1>
          <p className="text-sm text-slate-400">
            Describe briefly your system or product. Gemini will generate
            a structured questionnaire to build a complete CDF.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">
              Your idea / need
            </label>
            <textarea
              rows={5}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Example: A modular robotic trolley to transport heavy loads between stations in a factory..."
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 max-w-xs">
              You will answer a series of questions. Then Gemini will synthesize
              everything into a functional specification document.
            </p>
            <button
              type="submit"
              disabled={!idea.trim()}
              className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
            >
              Start questionnaire
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
