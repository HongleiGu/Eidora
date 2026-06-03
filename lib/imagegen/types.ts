export type ImageProviderName = "openai" | "replicate" | "fal";

export interface GenerateImageInput {
  prompt: string;
  /** e.g. "1024x1024". Provider maps/ignores as needed. */
  size?: string;
  /** Provider-specific model id; defaults per provider. */
  model?: string;
}

export interface GeneratedImage {
  /** Raw image bytes — the caller uploads these via the storage abstraction. */
  data: ArrayBuffer;
  contentType: string;
  model: string;
  provider: ImageProviderName;
}

export interface ImageProvider {
  readonly name: ImageProviderName;
  generate(input: GenerateImageInput): Promise<GeneratedImage>;
}
