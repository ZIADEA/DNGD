// apps/web/app/api/genai/gemini/generate-fsd/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type FsdSource = "fromIdea" | "from2D" | "from3D";

interface Answer {
  questionId: string;
  value: string | number | string[];
}

interface GenerateFsdBody {
  source: FsdSource;
  idea: string;
  prototypePrompt?: string;
  answers: Answer[];
}

interface GenerateFsdResponse {
  ok: true;
  fsdText: string;
  summaryPrompt2D: string;
  summaryPrompt3D: string;
}

function normalizeValue(value: string | number | string[]): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function buildFsdText(body: GenerateFsdBody): string {
  const { source, idea, prototypePrompt, answers } = body;

  const sourceLabel =
    source === "from2D"
      ? "Derived from a 2D prototype"
      : source === "from3D"
      ? "Derived from a 3D concept"
      : "Directly from the initial idea";

  const lines: string[] = [];

  lines.push("FUNCTIONAL SPECIFICATION – NF EN 16271");
  lines.push("--------------------------------------");
  lines.push("");
  lines.push("1. Context and need");
  lines.push("");
  lines.push(`Source: ${sourceLabel}`);
  lines.push("");
  lines.push("Initial idea / need:");
  lines.push(idea.trim());
  lines.push("");

  if (prototypePrompt && prototypePrompt.trim().length > 0) {
    lines.push("Prototype / concept used as reference:");
    lines.push(prototypePrompt.trim());
    lines.push("");
  }

  lines.push("2. Structured requirements (from questionnaire)");
  lines.push("");

  if (!answers.length) {
    lines.push(
      "- No additional answers were provided in the questionnaire.",
    );
  } else {
    for (const ans of answers) {
      const valueText = normalizeValue(ans.value).trim();
      if (!valueText.length) {
        continue;
      }
      lines.push(`- ${ans.questionId}: ${valueText}`);
    }
  }

  lines.push("");
  lines.push("3. Additional remarks");
  lines.push("");
  lines.push(
    "This functional specification is a first synthetic version built from the structured questionnaire.",
  );
  lines.push(
    "It should be reviewed and completed by the engineering team before validation.",
  );

  return lines.join("\n");
}

function buildSummaryPrompt2D(body: GenerateFsdBody): string {
  const { idea, answers } = body;

  const keyConstraints = answers
    .map((a) => normalizeValue(a.value))
    .filter((v) => v.trim().length > 0)
    .slice(0, 8) // on limite pour garder le prompt raisonnable
    .join("; ");

  const constraintsPart =
    keyConstraints.length > 0
      ? `Key constraints: ${keyConstraints}.`
      : "Use reasonable industrial constraints inferred from the context.";

  return [
    "Industrial 2D rendering from functional specification.",
    `Main idea / system: ${idea.trim()}.`,
    constraintsPart,
    "Generate several 2D concept images (technical sketches or realistic renders) that respect the functional needs and constraints.",
  ].join(" ");
}

function buildSummaryPrompt3D(body: GenerateFsdBody): string {
  const { idea, answers } = body;

  const keyConstraints = answers
    .map((a) => normalizeValue(a.value))
    .filter((v) => v.trim().length > 0)
    .slice(0, 8)
    .join("; ");

  const constraintsPart =
    keyConstraints.length > 0
      ? `Key constraints for 3D: ${keyConstraints}.`
      : "Use reasonable mechanical and geometric constraints inferred from the context.";

  return [
    "Industrial 3D prototype from functional specification.",
    `Main idea / system: ${idea.trim()}.`,
    constraintsPart,
    "Generate a coherent 3D concept (mesh) suitable for CAD and structural analysis, focusing on main volumes, interfaces and constraints.",
  ].join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateFsdBody;

    if (!body.idea || !Array.isArray(body.answers)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing idea or answers in request body",
        },
        { status: 400 },
      );
    }

    const fsdText = buildFsdText(body);
    const summaryPrompt2D = buildSummaryPrompt2D(body);
    const summaryPrompt3D = buildSummaryPrompt3D(body);

    const response: GenerateFsdResponse = {
      ok: true,
      fsdText,
      summaryPrompt2D,
      summaryPrompt3D,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("generate-fsd route error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Server error in generate-fsd route",
      },
      { status: 500 },
    );
  }
}
