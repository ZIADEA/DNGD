// apps/web/app/api/genai/meshy/text-to-3d/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const meshyApiKey = process.env.MESHY_API_KEY;
const MESHY_BASE_URL = "https://api.meshy.ai/openapi/v2/text-to-3d";

/* -------------------------------------------------------------------------- */
/*  Types d'entrée                                                             */
/* -------------------------------------------------------------------------- */

//type MeshyAction = "start" | "status";

type MeshyMode = "preview" | "refine";
type MeshyArtStyle = "realistic" | "sculpture";
type MeshyTopology = "quad" | "triangle";

interface StartTextTo3DBody {
  action: "start";

  // mode Meshy : preview (geometry) ou refine (texturé)
  meshyMode?: MeshyMode; // default "preview"

  // prompt de base pour le modèle 3D (issu de summaryPrompt3D ou autre)
  prompt3D: string;

  // si meshyMode = "refine", il faut un preview_task_id
  previewTaskId?: string;

  // options Meshy
  artStyle?: MeshyArtStyle; // default "realistic"
  aiModel?: "meshy-4" | "meshy-5" | "latest"; // default "latest"
  topology?: MeshyTopology; // default "triangle"
  targetPolycount?: number; // default 30000
  shouldRemesh?: boolean; // default true
  symmetryMode?: "off" | "auto" | "on"; // default "auto"
  isTPose?: boolean; // default false
  moderation?: boolean; // default false

  // pour refine
  enablePbr?: boolean; // default false
  texturePrompt?: string;
  textureImageUrl?: string;
}

interface StatusTextTo3DBody {
  action: "status";
  taskId: string;
}

type TextTo3DRequestBody = StartTextTo3DBody | StatusTextTo3DBody;

/* -------------------------------------------------------------------------- */
/*  Types de sortie Meshy                                                      */
/* -------------------------------------------------------------------------- */

interface MeshyModelUrls {
  glb?: string;
  fbx?: string;
  obj?: string;
  mtl?: string;
  usdz?: string;
  [key: string]: unknown;
}

interface MeshyTextureUrl {
  base_color?: string;
  [key: string]: unknown;
}

interface MeshyTextTo3DTask {
  id?: string;
  model_urls?: MeshyModelUrls;
  texture_urls?: MeshyTextureUrl[];
  thumbnail_url?: string;
  prompt?: string;
  art_style?: string;
  progress?: number;
  status?: string;
  task_error?: {
    message?: string;
  };
  [key: string]: unknown;
}

interface StartResponsePayload {
  ok: true;
  taskId: string;
  mode: MeshyMode;
}

interface StatusResponsePayload {
  ok: true;
  status: string;
  progress: number;
  modelUrls: MeshyModelUrls;
  thumbnailUrl: string | null;
  textureUrls: MeshyTextureUrl[];
  raw: MeshyTextTo3DTask;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function callMeshy(
  path: string,
  init: RequestInit,
): Promise<unknown> {
  if (!meshyApiKey) {
    throw new Error("Missing MESHY_API_KEY in env");
  }

  const headers: HeadersInit = {
    "Authorization": `Bearer ${meshyApiKey}`,
    ...(init.headers || {}),
  };

  const res = await fetch(`${MESHY_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Meshy API error (${res.status} ${res.statusText}): ${text}`,
    );
  }

  const json = (await res.json().catch(() => null)) as unknown;
  return json;
}

/* -------------------------------------------------------------------------- */
/*  Handler principal                                                          */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TextTo3DRequestBody;

    if (!meshyApiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing MESHY_API_KEY in env" },
        { status: 500 },
      );
    }

    if (!body || typeof body.action !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid action" },
        { status: 400 },
      );
    }

    if (body.action === "start") {
      return await handleStart(body as StartTextTo3DBody);
    }

    if (body.action === "status") {
      return await handleStatus(body as StatusTextTo3DBody);
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action (must be 'start' or 'status')" },
      { status: 400 },
    );
  } catch (err) {
    console.error("meshy/text-to-3d route error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error in meshy/text-to-3d route" },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Action: start                                                              */
/* -------------------------------------------------------------------------- */

async function handleStart(body: StartTextTo3DBody) {
  const prompt3D = body.prompt3D?.trim();
  if (!prompt3D) {
    return NextResponse.json(
      { ok: false, error: "Missing prompt3D" },
      { status: 400 },
    );
  }

  const meshyMode: MeshyMode = body.meshyMode ?? "preview";

  // Prépare le payload Meshy en fonction du mode
  const basePayload: Record<string, unknown> = {
    mode: meshyMode,
  };

  if (meshyMode === "preview") {
    // Preview task: on envoie le prompt
    basePayload.prompt = prompt3D;

    basePayload.art_style = body.artStyle ?? "realistic";
    basePayload.ai_model = body.aiModel ?? "latest";
    basePayload.topology = body.topology ?? "triangle";
    basePayload.target_polycount = Number.isFinite(body.targetPolycount)
      ? body.targetPolycount
      : 30000;
    basePayload.should_remesh =
      typeof body.shouldRemesh === "boolean" ? body.shouldRemesh : true;
    basePayload.symmetry_mode = body.symmetryMode ?? "auto";
    basePayload.is_a_t_pose =
      typeof body.isTPose === "boolean" ? body.isTPose : false;
    basePayload.moderation =
      typeof body.moderation === "boolean" ? body.moderation : false;
  } else {
    // refine
    if (!body.previewTaskId) {
      return NextResponse.json(
        {
          ok: false,
          error: "previewTaskId is required when meshyMode = 'refine'",
        },
        { status: 400 },
      );
    }

    basePayload.preview_task_id = body.previewTaskId;
    basePayload.enable_pbr =
      typeof body.enablePbr === "boolean" ? body.enablePbr : false;
    basePayload.ai_model = body.aiModel ?? "latest";
    basePayload.moderation =
      typeof body.moderation === "boolean" ? body.moderation : false;

    if (body.texturePrompt?.trim()) {
      basePayload.texture_prompt = body.texturePrompt.trim();
    }
    if (body.textureImageUrl?.trim()) {
      basePayload.texture_image_url = body.textureImageUrl.trim();
    }
  }

  // Appel Meshy: POST /openapi/v2/text-to-3d
  const json = (await callMeshy("", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(basePayload),
  })) as { result?: string };

  const taskId = (json?.result ?? "").toString().trim();
  if (!taskId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Meshy did not return a task id",
      },
      { status: 500 },
    );
  }

  const payload: StartResponsePayload = {
    ok: true,
    taskId,
    mode: meshyMode,
  };

  return NextResponse.json(payload);
}

/* -------------------------------------------------------------------------- */
/*  Action: status                                                             */
/* -------------------------------------------------------------------------- */

async function handleStatus(body: StatusTextTo3DBody) {
  const taskId = body.taskId?.trim();
  if (!taskId) {
    return NextResponse.json(
      { ok: false, error: "Missing taskId" },
      { status: 400 },
    );
  }

  // GET /openapi/v2/text-to-3d/:id
  const json = (await callMeshy(`/${taskId}`, {
    method: "GET",
  })) as MeshyTextTo3DTask;

  const status = json.status ?? "UNKNOWN";
  const progress =
    typeof json.progress === "number" ? json.progress : 0;

  const modelUrls: MeshyModelUrls = json.model_urls ?? {};
  const textureUrls: MeshyTextureUrl[] = Array.isArray(json.texture_urls)
    ? json.texture_urls
    : [];

  const thumbnailUrl =
    typeof json.thumbnail_url === "string" ? json.thumbnail_url : null;

  const payload: StatusResponsePayload = {
    ok: true,
    status,
    progress,
    modelUrls,
    thumbnailUrl,
    textureUrls,
    raw: json,
  };

  return NextResponse.json(payload);
}
