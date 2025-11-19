// apps/web/app/api/genai/gemini/generate-2d-questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const geminiApiKey = process.env.GEMINI_API_KEY;

type EditField =
  | {
      name: string;
      label: string;
      type: "text" | "textarea";
      placeholder?: string;
    }
  | {
      name: string;
      label: string;
      type: "select";
      options: string[];
    };

interface GeneratedEditForm {
  helperText?: string;
  fields: EditField[];
}

interface Generate2DEditFormBody {
  prototypePrompt: string;
  userPrompt?: string;
}

/**
 * Fallback simple au cas où Gemini échoue
 */
function buildFallbackEditForm(): GeneratedEditForm {
  return {
    helperText:
      "You can modify the appearance and layout of this prototype. Leave fields empty if you don't want to change them.",
    fields: [
      {
        name: "main_color",
        label: "Main color of the object",
        type: "text",
        placeholder: "e.g. deep red, matte black, brushed aluminium",
      },
      {
        name: "background",
        label: "Background / environment changes",
        type: "textarea",
        placeholder:
          "e.g. neutral studio background, industrial workshop, outdoor scene...",
      },
      {
        name: "geometry_changes",
        label: "Geometry changes (shape, proportions, details)",
        type: "textarea",
        placeholder:
          "e.g. make the chassis lower, wheels larger, add a handle on the side...",
      },
      {
        name: "move_or_remove_objects",
        label: "Move / remove / add objects in the image",
        type: "textarea",
        placeholder:
          "e.g. remove the second chair, move the table closer to the window...",
      },
    ],
  };
}

/**
 * POST /api/genai/gemini/generate-2d-questions
 * Génère le formulaire d’édition dynamique pour AI Edit 2D
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Generate2DEditFormBody;

    const prototypePrompt = body.prototypePrompt?.trim();
    const userPrompt = body.userPrompt?.trim() || "";

    if (!prototypePrompt) {
      return NextResponse.json(
        { ok: false, error: "Missing prototypePrompt" },
        { status: 400 },
      );
    }

    if (!geminiApiKey) {
      // Pas de clé : on renvoie juste un formulaire fallback
      const fallback = buildFallbackEditForm();
      return NextResponse.json({
        ok: true,
        form: fallback,
        usedFallback: true,
      });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const instructions = `
You are an expert industrial designer and UX designer.

Goal:
Create a dynamic edit form for modifying ONE specific 2D prototype image of a product.

Input:
- userPrompt: what the user initially asked for.
- prototypePrompt: the final English prompt that was sent to the image generator for the current prototype.

You must output ONLY JSON, no explanation, with this shape:

{
  "helperText": "short text to explain how to use the form",
  "fields": [
    {
      "name": "unique_machine_friendly_name",
      "label": "Human readable label in English or French",
      "type": "text" | "textarea" | "select",
      "placeholder": "optional placeholder (for text / textarea)",
      "options": ["only for select type, list of choices"]
    },
    ...
  ]
}

Requirements:
- Think about what can be changed on THIS object type only (e.g. car / chair / drone / fridge).
- Typical editable dimensions:
  * colors / materials,
  * global size or scale (not real units, just relative),
  * shape and geometry details,
  * environment / background,
  * presence or absence of sub-parts (handles, wheels, supports, cables, etc.),
  * camera angle and distance,
  * lighting mood.
- At least 4 and at most 10 fields.
- Names must be machine friendly: lowercase, use underscore, no spaces (e.g. "main_color", "chassis_shape").
- Labels must be short and clear.
- For fields where a few classic choices make sense, use "select" with "options".
- Form fields are OPTIONAL for the user: leaving a field empty means "no change".
`.trim();

    const contents = `
${instructions}

userPrompt:
${userPrompt}

prototypePrompt:
${prototypePrompt}
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
      console.error(
        "Gemini returned empty text for 2D edit form, fallback used.",
      );
      const fallback = buildFallbackEditForm();
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
      console.error("Gemini JSON parse error (2D edit form), fallback:", err);
      const fallback = buildFallbackEditForm();
      return NextResponse.json({
        ok: true,
        form: fallback,
        usedFallback: true,
      });
    }

    const form = parsed as GeneratedEditForm;

    if (!form || !Array.isArray(form.fields) || form.fields.length === 0) {
      console.error(
        "Gemini JSON missing fields for 2D edit form, fallback.",
      );
      const fallback = buildFallbackEditForm();
      return NextResponse.json({
        ok: true,
        form: fallback,
        usedFallback: true,
      });
    }

    // Nettoyage léger
    form.fields = form.fields.map((f) => {
      if (f.type === "select" && (!f.options || !f.options.length)) {
        return {
          ...f,
          type: "text",
        } as EditField;
      }
      return f;
    });

    return NextResponse.json({
      ok: true,
      form,
      usedFallback: false,
    });
  } catch (err) {
    console.error("generate-2d-questions route error:", err);
    const fallback = buildFallbackEditForm();
    return NextResponse.json(
      { ok: true, form: fallback, usedFallback: true },
      { status: 200 },
    );
  }
}
