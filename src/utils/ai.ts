export type AnalyzeProjectUploadInput = {
  fileName: string;
  mimeType: string;
  fileText?: string;
  imageDataUrl?: string;
};

export type AnalyzeProjectUploadResult = {
  rooms: Array<{
    name: string;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    wallSqFt?: number | null;
    ceilingSqFt?: number | null;
    confidence: number;
    notes?: string | null;
  }>;
  summary?: string;
  warnings?: string[];
};

export type GenerateRoomVisualizationInput = {
  sourceImage: string;
  paintBrand?: string;
  paintColorName: string;
  paintColorCode?: string;
  trimColorName?: string;
  trimColorCode?: string;
  colorHex?: string;
  trimColorHex?: string;
  roomContext?: string;
  variationStyle?: string;
};

export type GenerateRoomVisualizationResult = {
  images: Array<{ url: string; label: string }>;
  provider: "openai" | "mock";
  promptSummary?: string;
};

export async function fileToText(file: File) {
  return file.text().catch(() => "");
}

export async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read blob"));
    reader.readAsDataURL(blob);
  });
}

export async function urlToDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch remote file (${response.status})`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function isTextLikeFile(file: File) {
  return (
    file.type.startsWith("text/") ||
    file.type.includes("json") ||
    file.type.includes("csv") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".json") ||
    file.name.endsWith(".csv")
  );
}
