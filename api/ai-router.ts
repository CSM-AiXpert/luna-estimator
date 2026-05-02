import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { env } from "./lib/env";

const roomSuggestionSchema = z.object({
  name: z.string(),
  length: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  wallSqFt: z.number().nullable().optional(),
  ceilingSqFt: z.number().nullable().optional(),
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable().optional(),
});

const analyzeProjectUploadInput = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  fileText: z.string().optional(),
  imageDataUrl: z.string().optional(),
});

const generateRoomVisualizationInput = z.object({
  sourceImage: z.string(),
  paintBrand: z.string().optional(),
  paintColorName: z.string(),
  paintColorCode: z.string().optional(),
  trimColorName: z.string().optional(),
  trimColorCode: z.string().optional(),
  colorHex: z.string().optional(),
  trimColorHex: z.string().optional(),
  roomContext: z.string().optional(),
  variationStyle: z.string().optional(),
});

type AnalyzeProjectUploadResult = {
  rooms: Array<z.infer<typeof roomSuggestionSchema>>;
  summary?: string;
  warnings?: string[];
};

type GenerateRoomVisualizationResult = {
  images: Array<{ url: string; label: string }>;
  provider: "openai" | "mock";
  promptSummary?: string;
};

function clampMetric(value: number | null | undefined, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Number(value.toFixed(2));
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function normalizeRoomName(name: string | null | undefined) {
  const cleaned = (name || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  if (lower === "primary br") return "Primary Bedroom";
  if (lower === "master bedroom") return "Primary Bedroom";
  if (lower === "family room") return "Living Room";
  if (lower === "half bath") return "Powder Room";

  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sanitizeRoomSuggestions(rooms: Array<z.infer<typeof roomSuggestionSchema>>) {
  const seenNames = new Map<string, number>();

  return rooms
    .map((room) => {
      const nameBase = normalizeRoomName(room.name) || "Room";
      const count = (seenNames.get(nameBase) || 0) + 1;
      seenNames.set(nameBase, count);
      const name = count === 1 ? nameBase : `${nameBase} ${count}`;

      const length = clampMetric(room.length ?? null, 3, 80);
      const width = clampMetric(room.width ?? null, 3, 80);
      const height = clampMetric(room.height ?? null, 7, 20);
      const computedCeiling = length && width ? Number((length * width).toFixed(2)) : null;
      const computedWall = length && width && height ? Number((2 * (length + width) * height).toFixed(2)) : null;
      const ceilingSqFt = clampMetric(room.ceilingSqFt ?? computedCeiling, 16, 12000);
      const wallSqFt = clampMetric(room.wallSqFt ?? computedWall, 32, 24000);
      const confidence = Math.min(0.99, Math.max(0.2, Number((room.confidence ?? 0.45).toFixed(2))));

      const noteParts = [room.notes?.trim()].filter(Boolean);
      if (!length || !width) noteParts.push("Dimensions should be verified on site before pricing.");
      if (!wallSqFt && !ceilingSqFt) noteParts.push("Limited measurement evidence was available in the upload.");

      return {
        name,
        length,
        width,
        height,
        wallSqFt,
        ceilingSqFt,
        confidence,
        notes: noteParts.join(" "),
      };
    })
    .filter((room) => room.name && (room.wallSqFt || room.ceilingSqFt || room.length || room.width))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

const mockRoomTemplates = [
  { name: "Living Room", length: 18, width: 14, height: 9, wallSqFt: 576, ceilingSqFt: 252, notes: "Main gathering area with full wall repaint scope." },
  { name: "Kitchen", length: 12, width: 10, height: 9, wallSqFt: 396, ceilingSqFt: 120, notes: "Compact room with cabinetry and trim to work around." },
  { name: "Primary Bedroom", length: 16, width: 14, height: 9, wallSqFt: 540, ceilingSqFt: 224, notes: "Suitable for a premium repaint preview." },
  { name: "Bathroom", length: 8, width: 6, height: 9, wallSqFt: 252, ceilingSqFt: 48, notes: "Smaller room; moisture-resistant paint recommended." },
  { name: "Hallway", length: 14, width: 5, height: 9, wallSqFt: 342, ceilingSqFt: 70, notes: "Long transitions and cut-ins likely required." },
];

function buildMockAnalyzeProjectUploadResult(input: z.infer<typeof analyzeProjectUploadInput>): AnalyzeProjectUploadResult {
  const haystack = `${input.fileName}\n${input.fileText || ""}`.toLowerCase();
  const matched = mockRoomTemplates.filter((room) =>
    haystack.includes(room.name.toLowerCase()) ||
    (room.name === "Primary Bedroom" && haystack.includes("bedroom")) ||
    (room.name === "Living Room" && (haystack.includes("living") || haystack.includes("family room"))) ||
    (room.name === "Bathroom" && haystack.includes("bath")) ||
    (room.name === "Hallway" && haystack.includes("hall"))
  );
  const chosen = (matched.length > 0 ? matched : mockRoomTemplates.slice(0, 3)).slice(0, 5);

  return {
    rooms: chosen.map((room, index) => ({
      ...room,
      confidence: Math.max(0.58, 0.84 - index * 0.07),
    })),
    summary: `Luna Vision AI generated ${chosen.length} editable room suggestions from ${input.fileName}.`,
    warnings: [
      "Running in Luna Vision AI local mock mode. Add a valid OPENAI_API_KEY to enable live OpenAI analysis.",
    ],
  };
}

function buildMockVisualizationResult(
  input: z.infer<typeof generateRoomVisualizationInput>
): GenerateRoomVisualizationResult {
  return {
    images: [
      { url: input.sourceImage, label: "Luna Vision AI Mock · Variation 1" },
      { url: input.sourceImage, label: "Luna Vision AI Mock · Variation 2" },
      { url: input.sourceImage, label: "Luna Vision AI Mock · Variation 3" },
    ],
    provider: "mock",
    promptSummary: `Mock preview for ${input.paintColorName}${input.paintColorCode ? ` (${input.paintColorCode})` : ""}${input.trimColorName ? ` · Trim: ${input.trimColorName}` : ""}`,
  };
}

function requireOpenAI() {
  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to your local .env.");
  }
}

async function openAiJson<T>({
  model,
  input,
  schema,
}: {
  model: string;
  input: Array<Record<string, unknown>>;
  schema: Record<string, unknown>;
}): Promise<T> {
  requireOpenAI();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "analysis_result",
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error("OPENAI_API_KEY is invalid. Update it in .env and restart the dev server.");
    }
    throw new Error(`OpenAI analysis failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
        json?: unknown;
      }>;
    }>;
  };

  const directOutput = data.output_text;
  const structuredContent = data.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text" || item.type === "text" || item.type === "json_schema");

  const parsedText =
    directOutput ||
    (typeof structuredContent?.text === "string" ? structuredContent.text : undefined) ||
    (structuredContent?.json ? JSON.stringify(structuredContent.json) : undefined);

  if (!parsedText) {
    throw new Error("OpenAI analysis returned no structured output.");
  }

  return JSON.parse(parsedText) as T;
}

function dataUrlToFile(dataUrl: string, name: string) {
  const [meta, base64Data] = dataUrl.split(",");
  if (!meta || !base64Data) {
    throw new Error("Invalid image payload.");
  }
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || "image/png";
  const buffer = Buffer.from(base64Data, "base64");
  return new File([buffer], name, { type: mime });
}

async function generateOpenAiImageEdit({
  sourceImage,
  prompt,
  label,
}: {
  sourceImage: string;
  prompt: string;
  label: string;
}) {
  requireOpenAI();

  const file = dataUrlToFile(sourceImage, `${label.replace(/\s+/g, "-").toLowerCase()}.png`);
  const formData = new FormData();
  formData.append("model", "gpt-image-1");
  formData.append("prompt", prompt);
  formData.append("size", "1536x1024");
  formData.append("quality", "medium");
  formData.append("image", file);

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error("OPENAI_API_KEY is invalid. Update it in .env and restart the dev server.");
    }
    throw new Error(`OpenAI image generation failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const first = payload.data?.[0];
  if (!first) {
    throw new Error("OpenAI image generation returned no images.");
  }

  return {
    url: first.url || `data:image/png;base64,${first.b64_json}`,
    label,
  };
}

export const aiRouter = createRouter({
  analyzeProjectUpload: authedQuery
    .input(analyzeProjectUploadInput)
    .mutation(async ({ input }): Promise<AnalyzeProjectUploadResult> => {
      const warnings: string[] = [];

      if (!input.fileText && !input.imageDataUrl) {
        return {
          rooms: [],
          warnings: [
            "This file did not include readable text or image content for Luna Vision AI analysis.",
          ],
        };
      }

      if (env.useMockAi) {
        return buildMockAnalyzeProjectUploadResult(input);
      }

      const result = await openAiJson<AnalyzeProjectUploadResult>({
        model: "gpt-4.1",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are Luna Vision AI, a measurement assistant for Luna Drywall & Paint. Review uploaded floor plans, scan exports, inspection notes, or room photos and extract room-by-room estimating suggestions. Prefer measured evidence from the upload. Use feet for dimensions and square feet for areas. Do not hallucinate exact numbers. If a value is not supported by the source, return null and explain the uncertainty in notes. Normalize common room names, keep outputs editable, and focus on rooms that matter for paint or drywall estimating.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `File name: ${input.fileName}\nMime type: ${input.mimeType}\n\nExtract likely room-by-room suggestions with dimensions, wall area, ceiling area, and a short evidence note when supported. If the upload looks like a whole-home floor plan, include the main interior rooms only. If the upload looks like a single room scan, prioritize that room and any clearly adjacent spaces.`,
              },
              ...(input.fileText
                ? [
                    {
                      type: "input_text" as const,
                      text: `Readable file content:\n${input.fileText.slice(0, 18000)}`,
                    },
                  ]
                : []),
              ...(input.imageDataUrl
                ? [
                    {
                      type: "input_image" as const,
                      image_url: input.imageDataUrl,
                    },
                  ]
                : []),
            ],
          },
        ],
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            rooms: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  length: { type: ["number", "null"] },
                  width: { type: ["number", "null"] },
                  height: { type: ["number", "null"] },
                  wallSqFt: { type: ["number", "null"] },
                  ceilingSqFt: { type: ["number", "null"] },
                  confidence: { type: "number" },
                  notes: { type: ["string", "null"] },
                },
                required: ["name", "length", "width", "height", "wallSqFt", "ceilingSqFt", "confidence", "notes"],
              },
            },
            summary: { type: ["string", "null"] },
            warnings: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["rooms", "summary", "warnings"],
        },
      });

      const parsedRooms = sanitizeRoomSuggestions(z.array(roomSuggestionSchema).parse(result.rooms || []));
      const derivedWarnings = [...warnings, ...(result.warnings || [])];
      if (parsedRooms.length === 0) {
        derivedWarnings.push("Luna Vision AI could not confidently identify measured rooms from this upload.");
      } else if (parsedRooms.some((room) => !room.length || !room.width)) {
        derivedWarnings.push("Some suggested rooms are area-based only and should be verified before final pricing.");
      }

      return {
        rooms: parsedRooms,
        summary: result.summary || undefined,
        warnings: derivedWarnings,
      };
    }),

  generateRoomVisualization: authedQuery
    .input(generateRoomVisualizationInput)
    .mutation(async ({ input }): Promise<GenerateRoomVisualizationResult> => {
      if (env.useMockAi) {
        return buildMockVisualizationResult(input);
      }

      const baseContext = [
        `Room context: ${input.roomContext || "General interior room repaint preview"}`,
        `Paint brand: ${input.paintBrand || "Unspecified"}`,
        `Wall paint color: ${input.paintColorName}${input.paintColorCode ? ` (${input.paintColorCode})` : ""}`,
        `Wall color hex: ${input.colorHex || "Not provided"}`,
        `Trim paint color: ${input.trimColorName || "Keep existing trim color"}${input.trimColorCode ? ` (${input.trimColorCode})` : ""}`,
        `Trim color hex: ${input.trimColorHex || "Not provided"}`,
        "Preserve the exact room geometry, camera angle, lens perspective, furniture placement, artwork, fixtures, windows, doors, flooring, and lighting direction.",
        "Change paint only. Keep material textures realistic and keep trim lines crisp at ceilings, casings, baseboards, and corners.",
        "Apply the requested wall color to visible painted wall surfaces only, excluding ceilings unless they already match the wall treatment in the original image.",
        "Update trim, baseboards, and door casings only if a trim color is provided. Keep wood tones, tile, counters, and furnishings unchanged.",
        "Do not redesign the room. Do not restage furniture. Do not add decor. Keep the output photo-real and presentation-ready.",
      ].join("\n");

      const labels = [
        "Variation 1 · Daylight",
        "Variation 2 · Warm Evening",
        "Variation 3 · Presentation Ready",
      ];

      const prompts = [
        `${baseContext}\nRender a clean daylight version with balanced neutral lighting and true-to-life color accuracy.`,
        `${baseContext}\nRender a softly warmed residential version that keeps the same lighting sources and shadows while showing how the color reads in a lived-in setting.`,
        `${baseContext}\nRender a premium presentation version with crisp paint edges, believable sheen, and contractor-grade finish quality.`,
      ];

      const images = [];
      for (let i = 0; i < prompts.length; i += 1) {
        const image = await generateOpenAiImageEdit({
          sourceImage: input.sourceImage,
          prompt: prompts[i],
          label: labels[i],
        });
        images.push(image);
      }

      return {
        images,
        provider: "openai",
        promptSummary: `Walls: ${input.paintColorName}${input.paintColorCode ? ` (${input.paintColorCode})` : ""}${input.trimColorName ? ` · Trim: ${input.trimColorName}${input.trimColorCode ? ` (${input.trimColorCode})` : ""}` : ""}`,
      };
    }),
});
