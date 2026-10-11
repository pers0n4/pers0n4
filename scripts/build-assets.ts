import { rm } from "node:fs/promises";
import { join } from "node:path";
import { buildBadges } from "./build-badges.ts";
import { buildGallery } from "./build-gallery.ts";

export async function prepareAssets(directory = "assets"): Promise<void> {
  await rm(directory, { recursive: true, force: true });
  await buildBadges(directory);
  await Bun.write(join(directory, ".nojekyll"), "");
}

if (import.meta.main) {
  await prepareAssets();
  if (!process.argv.includes("--prepare")) {
    await buildGallery();
  }
}
