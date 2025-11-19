"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type Mode2D = "sketch" | "realistic";
type View2D = "front" | "back" | "left" | "right" | "top" | "bottom";
type DownloadFormat = "png" | "jpg" | "webp";

const VIEW_OPTIONS: { value: View2D; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

const DOWNLOAD_FORMAT_OPTIONS: { value: DownloadFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

interface Generate2DResponseData {
  ok: true;
  userPrompt: string;
  mode: Mode2D;
  views: View2D[];
  downloadFormat: DownloadFormat;
  prototypes: {
    id: number;
    imageUrl: string;
    finalPrompt: string;
    source: "initial" | "edit";
  }[];
}

export default function Rendu2DPage() {
  const router = useRouter();

  const [idea, setIdea] = useState("");
  const [mode, setMode] = useState<Mode2D>("sketch");
  const [views, setViews] = useState<View2D[]>(["front"]);
  const [numImages, setNumImages] = useState(3);
  const [downloadFormat, setDownloadFormat] =
    useState<DownloadFormat>("png");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleView(view: View2D) {
    setViews((current) =>
      current.includes(view)
        ? current.filter((v) => v !== view)
        : [...current, view],
    );
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          resolve(result);
        } else {
          reject(new Error("Failed to read file as base64 string"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedIdea = idea.trim();
    if (!trimmedIdea) {
      setErrorMessage("Please describe your idea before generating.");
      return;
    }

    if (!views.length) {
      setErrorMessage("Please select at least one view.");
      return;
    }

    if (numImages <= 0) {
      setErrorMessage("Number of prototypes must be at least 1.");
      return;
    }

    setIsSubmitting(true);

    try {
      let imageBase64: string | null = null;
      if (imageFile) {
        imageBase64 = await fileToBase64(imageFile);
      }

      const body = {
        idea: trimmedIdea,
        mode,
        views,
        numImages,
        image: imageBase64,
        downloadFormat,
      };

      const res = await fetch("/api/genai/replicate/generate-2d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const message =
          (errJson && errJson.error) ||
          "Server error while generating 2D prototypes.";
        setErrorMessage(message);
        setIsSubmitting(false);
        return;
      }

      const data = (await res.json()) as Generate2DResponseData;

      if (!data.ok) {
        setErrorMessage("Generation failed (ok=false in response).");
        setIsSubmitting(false);
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("rendu2dResult", JSON.stringify(data));
      }

      router.push("/genAI/studio/rendu-2d/result");
    } catch (err) {
      console.error("Error in rendu-2d handleSubmit:", err);
      setErrorMessage("Unexpected error while generating 2D prototypes.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4 py-10">
      <div className="mx-auto max-w-5xl bg-slate-950/70 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-[0_0_60px_rgba(15,23,42,0.8)]">
        <header className="mb-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Studio – 2D Rendering
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
            Generate 2D prototypes from your idea
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Describe the object you want to design, choose the rendering mode,
            views and number of variants. The studio will generate N different
            prototypes (Prototype I, II, III…).
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {/* Idea */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Design idea
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Describe the product or system you want to visualize. You can
              mention functional constraints, style, materials, context, etc.
            </p>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/60 min-h-[120px]"
              placeholder="e.g. Compact electric delivery drone with four rotors, foldable arms, protected cargo bay..."
            />
          </div>

          {/* Mode + Views */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Mode */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-200">
                Rendering mode
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMode("sketch")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium ${
                    mode === "sketch"
                      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-emerald-500/40"
                  }`}
                >
                  Technical sketch
                  <span className="block text-xs font-normal text-slate-400 mt-1">
                    Clean CAD-like line drawing
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("realistic")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium ${
                    mode === "realistic"
                      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-emerald-500/40"
                  }`}
                >
                  Realistic render
                  <span className="block text-xs font-normal text-slate-400 mt-1">
                    Photorealistic product visualization
                  </span>
                </button>
              </div>
            </div>

            {/* Views */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-200">
                Views
              </label>
              <p className="text-xs text-slate-500 mb-1">
                Select the views you want the generator to focus on.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {VIEW_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer ${
                      views.includes(opt.value)
                        ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                        : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-emerald-500/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={views.includes(opt.value)}
                      onChange={() => toggleView(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Num images + Download format */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Num images */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Number of prototypes (N)
              </label>
              <p className="text-xs text-slate-500 mb-1">
                You will get prototypes I, II, III… up to N. (Max 6)
              </p>
              <input
                type="number"
                min={1}
                max={6}
                value={numImages}
                onChange={(e) =>
                  setNumImages(
                    Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                  )
                }
                className="w-24 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/60"
              />
            </div>

            {/* Download format */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Download format
              </label>
              <p className="text-xs text-slate-500 mb-1">
                Preferred format when you download a prototype image.
              </p>
              <div className="flex gap-2">
                {DOWNLOAD_FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDownloadFormat(opt.value)}
                    className={`flex-1 rounded-2xl border px-3 py-2 text-xs font-medium ${
                      downloadFormat === opt.value
                        ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                        : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-emerald-500/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Reference image (optional)
            </label>
            <p className="text-xs text-slate-500 mb-1">
              If you already have a sketch or reference picture, upload it here.
              It will guide the generator.
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-200 cursor-pointer hover:border-emerald-500/60">
                <span>Choose file</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setImageFile(file);
                  }}
                />
              </label>
              <span className="text-xs text-slate-500 truncate">
                {imageFile ? imageFile.name : "No file selected"}
              </span>
            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-xs text-red-200">
              {errorMessage}
            </div>
          )}

          {/* Submit */}
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
              className="rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-wait"
            >
              {isSubmitting ? "Generating..." : "Generate 2D prototypes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
