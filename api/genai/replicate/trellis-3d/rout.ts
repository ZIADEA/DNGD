// apps/web/app/api/genai/replicate/trellis-3d/route.ts
import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export const runtime = "nodejs";

const replicateApiToken = process.env.REPLICATE_API_TOKEN;

// Même client Replicate que pour generate-2d
const replicate = new Replicate({
  auth: replicateApiToken,
});

/**
 * Corps attendu pour la génération 3D Trellis
 *
 * - imageUrl : obligatoire, URL de l'image 2D du prototype (ex: prototype I)
 * - prompt3D : optionnel, juste pour log / cohérence (pas utilisé par Trellis lui-même)
 * - textureSize, meshSimplify, generateModel, saveGaussianPly, ssSamplingSteps :
 *   options Trellis avec des valeurs par défaut raisonnables.
 */
interface GenerateTrellis3DBody {
  imageUrl: string;
  prompt3D?: string;

  textureSize?: number; // default 2048
  meshSimplify?: number; // default 0.9
  generateModel?: boolean; // default true
  saveGaussianPly?: boolean; // default true
  ssSamplingSteps?: number; // default 38
}

/**
 * Forme typique de la sortie Trellis sur Replicate.
 * (adapter si tu vois d'autres champs dans la réponse réelle)
 */
interface TrellisOutput {
  model_file?: string;
  texture_file?: string;
  gaussian_ply_file?: string;
  [key: string]: unknown;
}

interface GenerateTrellis3DResponse {
  ok: true;
  modelFile: string | null;
  textureFile: string | null;
  gaussianPlyFile: string | null;
  raw: TrellisOutput | null;
}

/**
 * POST /api/genai/replicate/trellis-3d
 *
 * Ex:
 *  {
 *    "imageUrl": "https://....png",
 *    "prompt3D": "3D concept of ...",
 *    "textureSize": 2048,
 *    "meshSimplify": 0.9,
 *    "generateModel": true,
 *    "saveGaussianPly": true,
 *    "ssSamplingSteps": 38
 *  }
 */
export async function POST(req: NextRequest) {
  try {
    if (!replicateApiToken) {
      return NextResponse.json(
        { ok: false, error: "Missing REPLICATE_API_TOKEN in env" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as GenerateTrellis3DBody;

    const imageUrl = body.imageUrl?.trim();
    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing imageUrl" },
        { status: 400 },
      );
    }

    const textureSize = Number.isFinite(body.textureSize)
      ? body.textureSize!
      : 2048;
    const meshSimplify =
      typeof body.meshSimplify === "number" && body.meshSimplify >= 0 &&
      body.meshSimplify <= 1
        ? body.meshSimplify
        : 0.9;
    const generateModel =
      typeof body.generateModel === "boolean" ? body.generateModel : true;
    const saveGaussianPly =
      typeof body.saveGaussianPly === "boolean" ? body.saveGaussianPly : true;
    const ssSamplingSteps =
      typeof body.ssSamplingSteps === "number" && body.ssSamplingSteps > 0
        ? body.ssSamplingSteps
        : 38;

    // Préparation de l'input pour Trellis (exactement dans l'esprit de ton exemple)
    const input: Record<string, unknown> = {
      images: [imageUrl],
      texture_size: textureSize,
      mesh_simplify: meshSimplify,
      generate_model: generateModel,
      save_gaussian_ply: saveGaussianPly,
      ss_sampling_steps: ssSamplingSteps,
    };

    // ID du modèle Trellis (comme dans ton exemple)
    const modelId =
      "firtoz/trellis:e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c";

    const rawOutput = (await replicate.run(modelId, {
      input,
    })) as unknown;

    // On essaye de caster en objet pour extraire les champs utiles
    let trellisOutput: TrellisOutput | null = null;
    if (rawOutput && typeof rawOutput === "object") {
      trellisOutput = rawOutput as TrellisOutput;
    }

    const modelFile =
      trellisOutput && typeof trellisOutput.model_file === "string"
        ? trellisOutput.model_file
        : null;

    const textureFile =
      trellisOutput && typeof trellisOutput.texture_file === "string"
        ? trellisOutput.texture_file
        : null;

    const gaussianPlyFile =
      trellisOutput && typeof trellisOutput.gaussian_ply_file === "string"
        ? trellisOutput.gaussian_ply_file
        : null;

    const response: GenerateTrellis3DResponse = {
      ok: true,
      modelFile,
      textureFile,
      gaussianPlyFile,
      raw: trellisOutput,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("trellis-3d route error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error in trellis-3d route" },
      { status: 500 },
    );
  }
}
