// apps/web/app/api/genai/replicate/generate-2d/route.ts
import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export const runtime = "nodejs";

type Mode2D = "sketch" | "realistic";
type View2D = "front" | "back" | "left" | "right" | "top" | "bottom";
type DownloadFormat = "png" | "jpg" | "webp";

interface Generate2DRequestBody {
  idea: string;
  mode: Mode2D;
  views: View2D[];
  numImages: number;
  image?: string | null;
  downloadFormat?: DownloadFormat;
}

interface DesignPromptContext {
  mode: Mode2D;
  views: View2D[];
  hasImage: boolean;
  numImages: number;
}

/**
 * Structure d’un prototype 2D pour la page de résultats
 */
export interface Prototype2D {
  id: number; // 1, 2, 3, ...
  imageUrl: string;
  finalPrompt: string; // prompt final envoyé à Replicate pour CE prototype
  source: "initial" | "edit";
}

/**
 * Payload renvoyé à la page /rendu-2d/result
 */
export interface Generate2DResponseData {
  ok: true;
  userPrompt: string;
  mode: Mode2D;
  views: View2D[];
  downloadFormat: DownloadFormat;
  prototypes: Prototype2D[];
}

// ENV
const replicateApiToken = process.env.REPLICATE_API_TOKEN;

// Client Replicate (utilise REPLICATE_API_TOKEN)
const replicate = new Replicate({
  auth: replicateApiToken,
});

/* -------------------------------------------------------------------------- */
/*  1.  PROMPTS BASELINE (SANS LLM)                                           */
/* -------------------------------------------------------------------------- */

/**
 * Prompt "baseline" SANS LLM – sert de secours.
 * On génère un tableau de prompts (un par image) en ajoutant une petite
 * variation textuelle pour chaque prototype.
 */
function buildBaselineDesignPrompts(
  idea: string,
  context: DesignPromptContext,
): string[] {
  const viewsText =
    context.views.length > 0 ? context.views.join(", ") : "front";

  const renderStyle =
    context.mode === "sketch"
      ? "Technical CAD-style sketch, clean black lines, no background noise."
      : "Photorealistic industrial product render, realistic materials, soft studio lighting.";

  const imageHint = context.hasImage
    ? "The user also provided a reference image that should strongly guide the style and geometry."
    : "No reference image is provided. Infer a coherent design from the idea only.";

  const base = `
Industrial design prompt:

User design idea:
${idea}

Rendering requirements:
- Style: ${renderStyle}
- Views: ${viewsText}
- Suitable for CAD concept exploration.
- Emphasize geometry, proportions, functional features.
- Avoid text, UI, logos, watermarks.

Additional:
${imageHint}

Return ONE English prompt line suitable for an image model (ID-Sketch or Stable Diffusion 3.5).
`.trim();

  // On génère N variantes à partir du même noyau
  const prompts: string[] = [];
  for (let i = 0; i < context.numImages; i++) {
    const variant = i + 1;
    prompts.push(
      `${base}\n\nVariant focus: concept variation #${variant} with meaningful design changes from the others.`,
    );
  }

  return prompts;
}

/* -------------------------------------------------------------------------- */
/*  1bis.  OLLAMA (LLAMA 3.2) POUR LES PROMPTS                                */
/* -------------------------------------------------------------------------- */

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  message?: OllamaMessage;
}

/**
 * Nettoie la réponse texte d’Ollama pour en extraire le JSON strict.
 */
function extractJsonFromOllamaContent(content: string): string {
  let text = content.trim();

  // Si le modèle renvoie des ```json ... ```
  if (text.startsWith("```")) {
    const lines = text.split("\n");

    // Retirer la première ligne si elle commence par ```
    if (lines[0].startsWith("```")) {
      lines.shift();
    }

    // Retirer la dernière ligne si elle commence par ```
    const last = lines[lines.length - 1];
    if (typeof last === "string" && last.trim().startsWith("```")) {
      lines.pop();
    }

    text = lines.join("\n").trim();
  }

  // Sécuriser : garder seulement ce qui est entre le premier '{' et le dernier '}'
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text;
}

/**
 * Utilise Ollama (llama3.2:3b) pour générer N prompts différents (un par prototype).
 * Si ça échoue, on retombe sur buildBaselineDesignPrompts.
 */
async function buildDesignPromptsWithOllama(
  idea: string,
  context: DesignPromptContext,
): Promise<string[]> {
  const fallbackPrompts = buildBaselineDesignPrompts(idea, context);

  try {
    const systemInstructions = `
You are an expert industrial and mechanical designer.
Your job: from one user idea, generate several DIFFERENT high-quality English prompts
for an image generation model (one prompt per prototype).

Each prompt must describe a distinct design variant of the SAME object family,
suitable for industrial CAD exploration (geometry, proportions, functional features).

You MUST answer with STRICT JSON only, no extra text, no markdown, no commentary.
JSON shape:
{
  "prompts": [
    "prompt for prototype 1",
    "prompt for prototype 2",
    ...
  ]
}
Number of prompts MUST be exactly numImages = ${context.numImages}.
`.trim();

    const userContent = `
User idea:
${idea}

Context (JSON):
${JSON.stringify(context, null, 2)}

Constraints:
- Return STRICT JSON only, no explanation.
- JSON shape:
  {
    "prompts": [
      "prompt for prototype 1",
      "prompt for prototype 2",
      ...
    ]
  }
- Number of prompts MUST be exactly numImages = ${context.numImages}.
- Prompts must be concise but detailed (3–6 lines), in English, no markdown.
- Focus on:
  * geometry and proportions,
  * materials / finishes if relevant,
  * viewpoint and environment,
  * functional / mechanical aspects.
- Do NOT include comments, backticks or extra text.
`.trim();

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: userContent },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        `Ollama error ${response.status}: ${response.statusText} – ${text}`,
      );
      return fallbackPrompts;
    }

    const json = (await response.json()) as OllamaChatResponse;
    const rawContent =
      typeof json.message?.content === "string"
        ? json.message.content
        : "";

    const cleanedContent = extractJsonFromOllamaContent(rawContent);

    if (!cleanedContent.length) {
      console.error(
        "Ollama returned empty content for design prompts, fallback to baseline.",
      );
      return fallbackPrompts;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("Ollama JSON parse error, fallback to baseline:", e);
      return fallbackPrompts;
    }

    const promptsField = (parsed as { prompts?: unknown }).prompts;
    const prompts = Array.isArray(promptsField)
      ? (promptsField as unknown[])
          .map((p) => (typeof p === "string" ? p.trim() : ""))
          .filter((p) => p.length > 0)
      : [];

    if (!prompts.length) {
      console.error(
        "Ollama JSON had no valid prompts, fallback to baseline.",
      );
      return fallbackPrompts;
    }

    // On s’assure d’avoir exactement numImages prompts
    const target = context.numImages;
    if (prompts.length > target) {
      return prompts.slice(0, target);
    }
    if (prompts.length < target) {
      const extended = [...prompts];
      while (extended.length < target) {
        const base = prompts[extended.length % prompts.length];
        extended.push(`${base} (alternate variation)`);
      }
      return extended;
    }

    return prompts;
  } catch (err) {
    console.error("Ollama error (fallback to baseline):", err);
    return fallbackPrompts;
  }
}

/* -------------------------------------------------------------------------- */
/*  2.  OUTILS POUR LA SORTIE REPLICATE                                      */
/* -------------------------------------------------------------------------- */

interface ReplicateOutputWithUrl {
  url?: () => URL;
}

interface ReplicateOutputObject {
  output?: unknown;
  url?: () => URL;
}

/**
 * Extraction des URLs depuis la sortie Replicate (robuste, sans any)
 */
function extractUrlsFromReplicateOutput(raw: unknown): string[] {
  if (!raw) return [];

  // Cas string : URL directe
  if (typeof raw === "string") {
    return [raw];
  }

  // Cas tableau
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

  // Cas objet
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
/*  3.  HANDLER POST /api/genai/replicate/generate-2d                        */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    if (!replicateApiToken) {
      return NextResponse.json(
        { ok: false, error: "Missing REPLICATE_API_TOKEN in env" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as Generate2DRequestBody;

    const idea = body.idea?.trim();
    if (!idea) {
      return NextResponse.json(
        { ok: false, error: "Missing idea" },
        { status: 400 },
      );
    }

    const mode: Mode2D = body.mode ?? "sketch";
    const views: View2D[] =
      Array.isArray(body.views) && body.views.length ? body.views : ["front"];

    const numImagesRaw =
      typeof body.numImages === "number" && body.numImages > 0
        ? body.numImages
        : 1;

    // Limite raisonnable
    const numImages = Math.min(numImagesRaw, 6);

    const hasImage = Boolean(body.image);
    const downloadFormat: DownloadFormat = body.downloadFormat ?? "png";

    const context: DesignPromptContext = {
      mode,
      views,
      hasImage,
      numImages,
    };

    // 1) N prompts finaux via Ollama (ou baseline)
    const prompts = await buildDesignPromptsWithOllama(idea, context);

    // 2) Pour chaque prompt, on appelle Replicate pour générer UNE image
    const prototypes: Prototype2D[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const finalPrompt: string = prompts[i] ?? "";

      const input: Record<string, unknown> = {
        prompt: finalPrompt,
      };

      // Si plus tard tu veux faire de l'image-to-image :
      // if (hasImage && body.image) {
      //   input.image = body.image;
      // }

      let rawOutput: unknown;
      const isSketch = mode === "sketch";

      if (isSketch) {
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
          `Replicate returned no URL for prototype ${i + 1}. Raw output:`,
          rawOutput,
        );
      }

      prototypes.push({
        id: i + 1,
        imageUrl,
        finalPrompt,
        source: "initial",
      });
    }

    const response: Generate2DResponseData = {
      ok: true,
      userPrompt: idea,
      mode,
      views,
      downloadFormat,
      prototypes,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("generate-2d route error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Server error in generate-2d route",
      },
      { status: 500 },
    );
  }
}
