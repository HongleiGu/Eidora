/**
 * Unified image-generation abstraction. Swap providers via IMAGE_PROVIDER
 * (openai | replicate | fal) — callers use getImageGen() and never touch a
 * vendor SDK. Mirrors lib/ai and lib/storage.
 *
 *   const gen = getImageGen();                 // or getImageGen("fal")
 *   const img = await gen.generate({ prompt }); // { data, contentType, ... }
 *   // then upload img.data via lib/storage
 */
export type { ImageProvider, GenerateImageInput, GeneratedImage, ImageProviderName } from "./types";

import { openaiImages } from "./providers/openai";
import { replicateImages } from "./providers/replicate";
import { falImages } from "./providers/fal";
import type { ImageProvider, ImageProviderName } from "./types";

export function getImageGen(name?: ImageProviderName): ImageProvider {
  const provider = name ?? (process.env.IMAGE_PROVIDER as ImageProviderName | undefined) ?? "openai";
  switch (provider) {
    case "openai":    return openaiImages;
    case "replicate": return replicateImages;
    case "fal":       return falImages;
    default:          throw new Error(`Unknown IMAGE_PROVIDER: ${provider}`);
  }
}
