"use client";

import Link from "next/link";

export default function StudioHome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl bg-slate-950/70 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-[0_0_60px_rgba(15,23,42,0.8)]">
        {/* Header */}
        <header className="mb-10 text-center space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            AI Prototyping Studio
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold text-slate-50">
            Welcome to your prototyping studio
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto">
            From functional specifications (NF EN 16271) to 2D sketches and
            3D concepts (Meshy / Trellis), centralize all your design steps in one place.
          </p>
        </header>

        {/* Intro text */}
        <div className="text-center mb-8">
          <p className="text-sm md:text-base text-slate-300">
            What do you want to start with today?
          </p>
        </div>

        {/* 3 main cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* CDF – Functional Specification */}
          <Link href="/genAI/studio/cdf" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-6 flex flex-col justify-between transition duration-200 group-hover:-translate-y-1 group-hover:border-sky-500/70">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-300 border border-sky-500/20">
                  Step 1 · CDF
                </div>
                <h2 className="text-lg font-semibold text-slate-50">
                  Functional specification
                </h2>
                <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                  Generate a complete functional specification compliant with
                  the NF EN 16271 standard from your idea or from existing
                  prototypes (2D / 3D).
                </p>
              </div>
              <span className="mt-5 inline-flex items-center text-xs font-semibold text-sky-300 group-hover:text-sky-200">
                Access
                <span className="ml-1 text-sky-400 group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </span>
            </div>
          </Link>

          {/* 2D Rendering */}
          <Link href="/genAI/studio/rendu-2d" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-6 flex flex-col justify-between transition duration-200 group-hover:-translate-y-1 group-hover:border-emerald-500/60">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300 border border-emerald-500/20">
                  Visuals · 2D
                </div>
                <h2 className="text-lg font-semibold text-slate-50">
                  2D rendering
                </h2>
                <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                  Get N different 2D prototypes (technical sketch or realistic
                  render) from a text prompt, a CDF summary, or an existing
                  image.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
                Access
                <span className="ml-1 text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </span>
            </div>
          </Link>

          {/* 3D Rendering */}
          <Link href="/genAI/studio/rendu-3d" className="group">
            <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-6 flex flex-col justify-between transition duration-200 group-hover:-translate-y-1 group-hover:border-violet-500/60">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-300 border border-violet-500/20">
                  Volume · 3D
                </div>
                <h2 className="text-lg font-semibold text-slate-50">
                  3D rendering
                </h2>
                <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                  Generate 3D concepts from an idea, a 2D prototype or a CDF:
                  Meshy preview / refine, or Trellis (mesh + Gaussian splats).
                </p>
              </div>
              <span className="mt-5 inline-flex items-center text-xs font-semibold text-violet-300 group-hover:text-violet-200">
                Access
                <span className="ml-1 text-violet-400 group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </span>
            </div>
          </Link>
        </div>

        {/* Helper section (optionnel, mais utile) */}
        <div className="mt-10 grid gap-4 md:grid-cols-3 text-xs text-slate-400">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
            <p className="font-semibold text-slate-200 text-sm">Typical flow</p>
            <p>1. Start with CDF</p>
            <p>2. Generate 2D prototypes</p>
            <p>3. Upgrade one prototype to 3D</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
            <p className="font-semibold text-slate-200 text-sm">Skip steps</p>
            <p>· Direct 2D from idea</p>
            <p>· Direct 3D from idea or CDF</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
            <p className="font-semibold text-slate-200 text-sm">
              Interoperability
            </p>
            <p>· CDF → 2D (prefill idea)</p>
            <p>· CDF → 3D (prefill prompt)</p>
            <p>· 2D → 3D (from prototype I)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
