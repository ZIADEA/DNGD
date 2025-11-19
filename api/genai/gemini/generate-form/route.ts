// apps/web/app/api/genai/gemini/generate-form/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const geminiApiKey = process.env.GEMINI_API_KEY;

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
  options?: QuestionOption[]; // pour select / multi_select
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

interface GenerateFormBody {
  mode: FormMode;
  source: FormSource;
  idea?: string;
  prototypePrompt?: string;
  extraContext?: string;
}

/**
 * Fallback simple si Gemini ne répond pas
 */
function buildFallbackForm(mode: FormMode): GeneratedForm {
  if (mode === "cdf") {
    return {
      mode,
      sections: [
        {
          id: "context",
          title: "Project context and objectives",
          questions: [
            {
              id: "project_goal",
              label: "What is the main goal of this product or system?",
              type: "long_text",
              required: true,
            },
            {
              id: "target_users",
              label: "Who are the target users or stakeholders?",
              type: "long_text",
            },
          ],
        },
        {
          id: "constraints",
          title: "Main constraints",
          questions: [
            {
              id: "functional_constraints",
              label: "List the main functional constraints",
              type: "long_text",
            },
            {
              id: "environment_constraints",
              label: "Describe the environment and operating conditions",
              type: "long_text",
            },
          ],
        },
      ],
    };
  }

  // mode === "3d"
  return {
    mode,
    sections: [
      {
        id: "geometry",
        title: "Geometry and spatial constraints",
        questions: [
          {
            id: "bounding_volume",
            label:
              "Maximum bounding box dimensions (overall size the part must fit into)",
            type: "long_text",
          },
          {
            id: "forbidden_zones",
            label:
              "Describe 3D forbidden zones where no material is allowed (passages, clearances, etc.)",
            type: "long_text",
          },
        ],
      },
      {
        id: "loads",
        title: "Loads and operating conditions",
        questions: [
          {
            id: "loads_and_forces",
            label:
              "Describe the main loads and forces (direction, magnitude, frequency)",
            type: "long_text",
          },
          {
            id: "fixation_points",
            label:
              "Describe fixation / anchoring points that must remain fixed in space",
            type: "long_text",
          },
        ],
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateFormBody;

    const mode = body.mode;
    const source = body.source;
    const idea = body.idea?.trim() || "";
    const prototypePrompt = body.prototypePrompt?.trim() || "";
    const extraContext = body.extraContext?.trim() || "";

    if (!mode || (mode !== "cdf" && mode !== "3d")) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing mode (cdf | 3d)" },
        { status: 400 },
      );
    }

    if (!geminiApiKey) {
      const fallback = buildFallbackForm(mode);
      return NextResponse.json({
        ok: true,
        form: fallback,
        usedFallback: true,
      });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const baseInstructions =
      mode === "cdf"
        ? `
You are an expert in functional specification and systems engineering.
Your goal: generate a questionnaire to build a functional specification document
compliant with the NF EN 16271 standard.
`
        : `
You are an expert in mechanical design, FEA and design-for-manufacturing.
Your goal: generate a questionnaire to collect all the information required
to generate an accurate 3D prototype (geometry, loads, materials, manufacturing constraints).
`;

    const usageInstructions = `
Output ONLY JSON with this shape:

{
  "mode": "${mode}",
  "sections": [
    {
      "id": "section_id",
      "title": "Section title",
      "description": "optional short description",
      "questions": [
        {
          "id": "question_id",
          "label": "Human readable question (FR or EN)",
          "description": "optional help text",
          "type": "short_text" | "long_text" | "select" | "multi_select" | "number",
          "required": true | false,
          "options": [
            { "value": "value1", "label": "Label 1" }
          ] // only for select/multi_select
        }
      ]
    }
  ]
}

Requirements:
- IDs must be machine friendly (lowercase, underscore, no spaces).
- 3 to 6 sections.
- 3 to 8 questions per section.
- Questions must be SPECIFIC and directly useful to generate the final document or 3D.
- Avoid asking for information that is already obvious from the idea or prototype prompt.
`.trim();

    const contextText = `
Form mode: ${mode}
Source: ${source}

Idea (if any):
${idea || "(none)"}

Prototype prompt (if any):
${prototypePrompt || "(none)"}

Extra context:
${extraContext || "(none)"}
`.trim();

    const contents = `
${baseInstructions}

${usageInstructions}

CONTEXT:
${contextText}
`.trim();

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });

    interface GeminiTextCapable {
      text?: () => string | undefined;
    }

    const withText = result as GeminiTextCapable;
    const rawText =
      typeof withText.text === "function" ? withText.text() : undefined;

    const jsonText = (rawText ?? "").trim();
    if (!jsonText.length) {
      console.error("Gemini returned empty text for generate-form, fallback.");
      const fallback = buildFallbackForm(mode);
      return NextResponse.json({
        ok: true,
        form: fallback,
        usedFallback: true,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      console.error("Gemini JSON parse error (generate-form), fallback:", err);
      const fallback = buildFallbackForm(mode);
      return NextResponse.json({
        ok: true,
        form: fallback,
        usedFallback: true,
      });
    }

    const form = parsed as GeneratedForm;
    if (!form || !Array.isArray(form.sections) || !form.sections.length) {
      console.error(
        "Gemini JSON invalid for generate-form, using fallback.",
      );
      const fallback = buildFallbackForm(mode);
      return NextResponse.json({
        ok: true,
        form: fallback,
        usedFallback: true,
      });
    }

    return NextResponse.json({
      ok: true,
      form,
      usedFallback: false,
    });
  } catch (err) {
    console.error("generate-form route error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error in generate-form route" },
      { status: 500 },
    );
  }
}
