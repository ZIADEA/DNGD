"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type FormMode = "cdf" | "3d";
type FormSource = "idea" | "from2DPrototype" | "from3DConcept";

type QuestionType =
  | "short_text"
  | "long_text"
  | "select"
  | "multi_select"
  | "number";

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  label: string;
  description?: string;
  type: QuestionType;
  required?: boolean;
  options?: QuestionOption[];
}

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

interface GeneratedForm {
  mode: FormMode;
  sections: Section[];
}

interface Answer {
  questionId: string;
  value: string | number | string[];
}

type IncomingData =
  | {
      from: "studio";
      idea: string;
    }
  | {
      from: "rendu-2d";
      userPrompt: string;
      prototype: {
        id: number;
        imageUrl: string;
        finalPrompt: string;
      };
    }
  | {
      from: "3d";
      prompt3D: string;
    };

function parseIncoming(param: string | null): IncomingData | null {
  if (!param) return null;
  try {
    return JSON.parse(decodeURIComponent(param)) as IncomingData;
  } catch {
    return null;
  }
}

export default function CdfQuestionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const incoming = useMemo(
    () => parseIncoming(searchParams.get("data")),
    [searchParams],
  );

  const [form, setForm] = useState<GeneratedForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingForm, setLoadingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Construire le contexte pour generate-form
  const ideaText =
    incoming?.from === "studio"
      ? incoming.idea
      : incoming?.from === "rendu-2d"
      ? incoming.userPrompt
      : incoming?.from === "3d"
      ? incoming.prompt3D
      : "";

  const prototypePrompt =
    incoming?.from === "rendu-2d"
      ? incoming.prototype.finalPrompt
      : "";

  const source: FormSource =
    incoming?.from === "rendu-2d"
      ? "from2DPrototype"
      : incoming?.from === "3d"
      ? "from3DConcept"
      : "idea";

  useEffect(() => {
    async function fetchForm() {
      if (!incoming) return;
      setLoadingForm(true);
      try {
        const res = await fetch("/api/genai/gemini/generate-form", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "cdf" as FormMode,
            source,
            idea: ideaText,
            prototypePrompt,
          }),
        });

        const json = await res.json();
        const formData = json.form as GeneratedForm;
        setForm(formData);

        const init: Record<string, string> = {};
        formData.sections.forEach((s) =>
          s.questions.forEach((q) => {
            init[q.id] = "";
          }),
        );
        setAnswers(init);
      } catch (err) {
        console.error("Error in generate-form (cdf):", err);
      } finally {
        setLoadingForm(false);
      }
    }

    if (incoming) void fetchForm();
  }, [incoming, ideaText, prototypePrompt, source]);

  function handleChange(q: Question, value: string) {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !incoming) return;

    setSubmitting(true);
    try {
      const answersArray: Answer[] = [];
      form.sections.forEach((s) =>
        s.questions.forEach((q) => {
          const raw = answers[q.id] ?? "";
          if (q.type === "multi_select") {
            const parts = raw
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);
            answersArray.push({
              questionId: q.id,
              value: parts,
            });
          } else if (q.type === "number") {
            answersArray.push({
              questionId: q.id,
              value: Number(raw),
            });
          } else {
            answersArray.push({
              questionId: q.id,
              value: raw,
            });
          }
        }),
      );

      const sourceFsd =
        incoming.from === "rendu-2d"
          ? "from2D" // on mappe ensuite
          : incoming.from === "3d"
          ? "from3D"
          : "fromIdea";

      const res = await fetch("/api/genai/gemini/generate-fsd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source:
            sourceFsd === "from2D"
              ? "from2D"
              : sourceFsd === "from3D"
              ? "from3D"
              : "fromIdea",
          idea: ideaText,
          prototypePrompt,
          answers: answersArray,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        console.error("generate-fsd error:", json);
        setSubmitting(false);
        return;
      }

      const payload = {
        idea: ideaText,
        source: incoming.from,
        prototypePrompt,
        fsdText: json.fsdText as string,
        summaryPrompt2D: json.summaryPrompt2D as string,
        summaryPrompt3D: json.summaryPrompt3D as string,
      };

      const encoded = encodeURIComponent(JSON.stringify(payload));
      router.push(`/genAI/studio/cdf/result?data=${encoded}`);
    } catch (err) {
      console.error("Error calling generate-fsd:", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!incoming) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-50">
          CDF questionnaire
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          No context was provided. Please start from the CDF entry page or from
          a 2D/3D result.
        </p>
      </div>
    );
  }

  if (loadingForm || !form) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-50">
          Building questionnaire...
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Gemini is generating the functional specification questionnaire.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-50">
          Functional specification – Questionnaire
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Answer these questions. Gemini will then synthesize everything into a
          complete functional specification (NF EN 16271).
        </p>
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <p className="text-xs font-medium text-slate-300">
            Context (fixed):
          </p>
          <p className="mt-1 text-xs text-slate-200 whitespace-pre-wrap">
            {ideaText}
          </p>
          {incoming.from === "rendu-2d" && (
            <p className="mt-2 text-[11px] text-slate-400">
              Based on prototype: {incoming.prototype.finalPrompt}
            </p>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {form.sections.map((section) => (
          <section
            key={section.id}
            className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                {section.title}
              </h2>
              {section.description && (
                <p className="mt-1 text-xs text-slate-400">
                  {section.description}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {section.questions.map((q) => (
                <div key={q.id} className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    {q.label}
                    {q.required && (
                      <span className="ml-1 text-red-400">*</span>
                    )}
                  </label>
                  {q.description && (
                    <p className="text-[11px] text-slate-500">
                      {q.description}
                    </p>
                  )}

                  {q.type === "select" || q.type === "multi_select" ? (
                    <select
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        handleChange(q, e.target.value)
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-50"
                    >
                      <option value="">—</option>
                      {(q.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : q.type === "short_text" || q.type === "number" ? (
                    <input
                      type={q.type === "number" ? "number" : "text"}
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        handleChange(q, e.target.value)
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-50"
                    />
                  ) : (
                    <textarea
                      rows={3}
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        handleChange(q, e.target.value)
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-50"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500 max-w-xs">
            When you submit, Gemini will generate the complete functional
            specification and summary prompts for 2D and 3D.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-60"
          >
            {submitting
              ? "Generating specification..."
              : "Generate functional specification"}
          </button>
        </div>
      </form>
    </div>
  );
}
