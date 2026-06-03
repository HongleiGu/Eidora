import type { GenerateImageInput, GeneratedImage, ImageProvider } from "../types";

const DEFAULT_MODEL = "gpt-image-1";

/** OpenAI Images API. Handles both b64_json (gpt-image-1) and url (dall-e-3) responses. */
export const openaiImages: ImageProvider = {
  name: "openai",

  async generate({ prompt, size, model }: GenerateImageInput): Promise<GeneratedImage> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const m = model ?? DEFAULT_MODEL;

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: m, prompt, size: size ?? "1024x1024", n: 1 }),
    });
    if (!res.ok) throw new Error(`OpenAI images ${res.status}: ${await res.text()}`);

    const json = await res.json() as { data: { b64_json?: string; url?: string }[] };
    const first = json.data?.[0];
    if (!first) throw new Error("OpenAI images: empty response");

    if (first.b64_json) {
      return { data: Buffer.from(first.b64_json, "base64").buffer as ArrayBuffer, contentType: "image/png", model: m, provider: "openai" };
    }
    if (first.url) {
      const img = await fetch(first.url);
      return { data: await img.arrayBuffer(), contentType: img.headers.get("content-type") ?? "image/png", model: m, provider: "openai" };
    }
    throw new Error("OpenAI images: no image data");
  },
};
