// apps/web/app/api/genai/gemini/adapt-2d-to-3d/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const geminiApiKey = process.env.GEMINI_API_KEY;

interface Adapt2Dto3DBody {
  userPrompt: string;
  prototypePrompt: string;
}

interface Adapt2Dto3DResponse {
  ok: true;
  prompt3D: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!geminiApiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as Adapt2Dto3DBody;

    const userPrompt = body.userPrompt?.trim();
    const prototypePrompt = body.prototypePrompt?.trim();

    if (!userPrompt || !prototypePrompt) {
      return NextResponse.json(
        { ok: false, error: "Missing userPrompt or prototypePrompt" },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const instructions = `
You are an expert in industrial 3D design.

Goal:
From an initial user idea and the final 2D image prompt for a prototype,
generate ONE high-quality English prompt to create a 3D model of the SAME object.

- Keep the same product concept and main characteristics.
- Adapt the prompt to 3D (mention overall volume, key dimensions, thicknesses,
  main features, materials if relevant, functional constraints).
- If camera viewpoint is mentioned, adapt it to a neutral 3D modelling perspective.
- Do NOT mention "2D", "render", "photo", "image"; focus on the 3D object itself.

Output:
ONLY the final 3D prompt text, no explanation, no markdown.
`.trim();

    const context = `
User prompt (initial idea):
${userPrompt}

2D prototype final prompt:
${prototypePrompt}
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

    const prompt3D = (rawText ?? "").trim();
    if (!prompt3D.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Empty 3D prompt returned by Gemini",
        },
        { status: 500 },
      );
    }

    const response: Adapt2Dto3DResponse = {
      ok: true,
      prompt3D,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("adapt-2d-to-3d route error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error in adapt-2d-to-3d route" },
      { status: 500 },
    );
  }
}
