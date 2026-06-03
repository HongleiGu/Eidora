import type { GenerateImageInput, GeneratedImage, ImageProvider } from "../types";

const DEFAULT_MODEL = "fal-ai/flux/schnell";

/** fal.ai synchronous run endpoint. */
export const falImages: ImageProvider = {
  name: "fal",

  async generate({ prompt, model }: GenerateImageInput): Promise<GeneratedImage> {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error("FAL_KEY is not set");
    const m = model ?? DEFAULT_MODEL;

    const res = await fetch(`https://fal.run/${m}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`fal ${res.status}: ${await res.text()}`);

    const json = await res.json() as { images?: { url: string; content_type?: string }[] };
    const first = json.images?.[0];
    if (!first?.url) throw new Error("fal: no output image");

    const img = await fetch(first.url);
    return { data: await img.arrayBuffer(), contentType: first.content_type ?? img.headers.get("content-type") ?? "image/jpeg", model: m, provider: "fal" };
  },
};
