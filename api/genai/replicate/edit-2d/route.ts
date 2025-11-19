// apps/web/app/api/genai/replicate/edit-2d/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import Replicate from "replicate";

export const runtime = "nodejs";

const geminiApiKey = process.env.GEMINI_API_KEY;
const replicateApiToken = process.env.REPLICATE_API_TOKEN;

// Même type Prototype2D que dans generate-2d
type Mode2D = "sketch" | "realistic";

interface Prototype2D {
  id: number;
  imageUrl: string;
  finalPrompt: string;
  source: "initial" | "edit";
}

interface Edit2DBody {
  userPrompt: string;            // prompt initial de l’utilisateur
  mode?: Mode2D;                 // pour savoir quel modèle Replicate utiliser
  basePrototype: Prototype2D;    // prototype I
  editValues: Record<string, string>; // valeurs du formulaire AI Edit
  image?: string | null;         // si tu veux prendre l’image comme input image2image (optionnel)
}

interface Edit2DResponse {
  ok: true;
  newPrototype: Prototype2D;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const replicate = new Replicate({
  auth: replicateApiToken,
});

async function buildEditedPromptWithGemini(
  userPrompt: string,
  basePrompt: string,
  editValues: Record<string, string>,
): Promise<string> {
  const fallback = `${basePrompt}\n\n# Edits:\n${JSON.stringify(
    editValues,
    null,
    2,
  )}`;

  if (!geminiApiKey) {
    return fallback;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const instructions = `
You are an expert industrial designer.

Goal:
From the original user idea, the base prompt used to generate a 2D prototype,
and a set of user edits (form values), generate ONE new English prompt
for an image model that describes a NEW variant of the same product (prototype I+1).

Output:
- ONLY the final prompt, no explanation, no markdown.

Requirements:
- Keep the same product family and main concept.
- Apply the edits explicitly (colors, geometry, environment, camera, etc.).
- Stay concise but detailed (3–6 lines).
- No comments, no JSON, just plain text.
`.trim();

    const context = `
User prompt (original idea):
${userPrompt}

Base prompt used for prototype I:
${basePrompt}

User edits (JSON):
${JSON.stringify(editValues, null, 2)}
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

    const finalText = (rawText ?? "").trim();
    if (!finalText.length) {
      console.error(
        "Gemini returned empty text for edit-2d, using fallback prompt.",
      );
      return fallback;
    }

    return finalText;
  } catch (err) {
    console.error("Gemini error in edit-2d (fallback to simple concat):", err);
    return fallback;
  }
}

interface ReplicateOutputWithUrl {
  url?: () => URL;
}
interface ReplicateOutputObject {
  output?: unknown;
  url?: () => URL;
}

function extractUrlsFromReplicateOutput(raw: unknown): string[] {
  if (!raw) return [];

  if (typeof raw === "string") {
    return [raw];
  }

  if (Array.isArray(raw)) {
    const urls: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        urls.push(item);
      } else if (
        item &&
        typeof item === "object" &&
        typeof (item as ReplicateOutputWithUrl).url === "function"
      ) {
        urls.push((item as ReplicateOutputWithUrl).url!().toString());
      }
    }
    return urls;
  }

  if (typeof raw === "object") {
    const obj = raw as ReplicateOutputObject;
    if (typeof obj.url === "function") {
      return [obj.url().toString()];
    }
    if (obj.output !== undefined) {
      return extractUrlsFromReplicateOutput(obj.output);
    }
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/*  Handler POST /api/genai/replicate/edit-2d                                 */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    if (!replicateApiToken) {
      return NextResponse.json(
        { ok: false, error: "Missing REPLICATE_API_TOKEN in env" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as Edit2DBody;

    const userPrompt = body.userPrompt?.trim();
    const basePrototype = body.basePrototype;
    const editValues = body.editValues || {};
    const mode: Mode2D = body.mode ?? "realistic"; // par défaut réaliste
    const hasImage = Boolean(body.image);

    if (!userPrompt) {
      return NextResponse.json(
        { ok: false, error: "Missing userPrompt" },
        { status: 400 },
      );
    }

    if (!basePrototype || !basePrototype.finalPrompt) {
      return NextResponse.json(
        { ok: false, error: "Missing basePrototype.finalPrompt" },
        { status: 400 },
      );
    }

    // 1) Nouveau prompt final via Gemini
    const newPrompt = await buildEditedPromptWithGemini(
      userPrompt,
      basePrototype.finalPrompt,
      editValues,
    );

    // 2) Appel Replicate pour générer l’image du prototype I+1
    const input: Record<string, unknown> = {
      prompt: newPrompt,
    };

    if (hasImage && body.image) {
      // si tu veux faire du image-to-image, tu peux ajouter l'image ici
      input.image = body.image;
    }

    let rawOutput: unknown;

    if (mode === "sketch") {
      const modelId = "orbifolia-coder/id-sketch";
      rawOutput = await replicate.run(modelId, { input });
    } else {
      const modelId = "stability-ai/stable-diffusion-3.5-large";
      rawOutput = await replicate.run(modelId, { input });
    }

    const urls = extractUrlsFromReplicateOutput(rawOutput);
    const imageUrl = urls[0] ?? "";

    if (!imageUrl) {
      console.warn(
        "Replicate returned no URL in edit-2d. Raw output:",
        rawOutput,
      );
    }

    const newPrototype: Prototype2D = {
      id: basePrototype.id + 1, // l’UI replacera l’id si besoin (position en liste)
      imageUrl,
      finalPrompt: newPrompt ?? "",
      source: "edit",
    };

    const response: Edit2DResponse = {
      ok: true,
      newPrototype,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("edit-2d route error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error in edit-2d route" },
      { status: 500 },
    );
  }
}
