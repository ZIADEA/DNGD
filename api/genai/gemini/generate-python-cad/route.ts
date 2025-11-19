// apps/web/app/api/genai/gemini/generate-python-cad/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const geminiApiKey = process.env.GEMINI_API_KEY;

interface GeneratePythonCadBody {
  fsdText?: string; // cahier des charges complet
  concept3DPrompt?: string; // prompt 3D actuel
  targetLibrary?: "cadquery" | "freecad" | "generic";
}

interface GeneratePythonCadResponse {
  ok: true;
  pythonScript: string;
  notes: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!geminiApiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as GeneratePythonCadBody;

    const fsdText = body.fsdText?.trim() || "";
    const concept3DPrompt = body.concept3DPrompt?.trim() || "";
    const targetLibrary = body.targetLibrary ?? "generic";

    if (!fsdText && !concept3DPrompt) {
      return NextResponse.json(
        {
          ok: false,
          error: "Provide at least fsdText or concept3DPrompt",
        },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const instructions = `
You are an expert CAD engineer and Python developer.

Goal:
Generate a Python script skeleton that creates a parametric 3D model matching the functional specification.
Prefer simple primitives and clear structure; do NOT try to fully solve every detail.

Target CAD library:
- "cadquery": use CadQuery-style code.
- "freecad": use FreeCAD Python scripting.
- "generic": produce clear pseudo-code with comments that can be adapted.

Output ONLY JSON:

{
  "pythonScript": "full Python code as a string",
  "notes": "short explanation (in English or French)"
}

Requirements:
- Use clear variables for key dimensions (width, height, thickness, radius, etc.).
- Add comments that map code sections to functional requirements from the FSD.
- Highlight in comments which parts are approximations or need manual refinement.
`.trim();

    const context = `
Target library: ${targetLibrary}

FSD text (if provided):
${fsdText || "(none)"}

3D concept prompt (if provided):
${concept3DPrompt || "(none)"}
`.trim();

    const contents = `
${instructions}

CONTEXT:
${context}
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
      return NextResponse.json(
        { ok: false, error: "Empty response from Gemini" },
        { status: 500 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      console.error("Gemini JSON parse error (generate-python-cad):", err);
      return NextResponse.json(
        { ok: false, error: "Invalid JSON returned by Gemini" },
        { status: 500 },
      );
    }

    const pythonScript =
      (parsed as { pythonScript?: string }).pythonScript?.trim() || "";
    const notes = (parsed as { notes?: string }).notes?.trim() || "";

    if (!pythonScript) {
      return NextResponse.json(
        { ok: false, error: "pythonScript missing in Gemini response" },
        { status: 500 },
      );
    }

    const response: GeneratePythonCadResponse = {
      ok: true,
      pythonScript,
      notes,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("generate-python-cad route error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error in generate-python-cad route" },
      { status: 500 },
    );
  }
}
