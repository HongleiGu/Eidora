import type { GenerateImageInput, GeneratedImage, ImageProvider } from "../types";

// Default to a fast, cheap text-to-image model. Override via IMAGE_MODEL.
const DEFAULT_MODEL = "black-forest-labs/flux-schnell";

/** Replicate. Uses the official-models endpoint with `Prefer: wait` to avoid polling. */
export const replicateImages: ImageProvider = {
  name: "replicate",

  async generate({ prompt, model }: GenerateImageInput): Promise<GeneratedImage> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN is not set");
    const m = model ?? DEFAULT_MODEL;

    const res = await fetch(`https://api.replicate.com/v1/models/${m}/predictions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait" },
      body: JSON.stringify({ input: { prompt } }),
    });
    if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);

    const pred = await res.json() as { status: string; output?: string | string[]; error?: string };
    if (pred.status !== "succeeded") throw new Error(`Replicate prediction ${pred.status}: ${pred.error ?? ""}`);

    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!url) throw new Error("Replicate: no output image");

    const img = await fetch(url);
    return { data: await img.arrayBuffer(), contentType: img.headers.get("content-type") ?? "image/webp", model: m, provider: "replicate" };
  },
};
