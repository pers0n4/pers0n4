import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { endpointBase } from "./build-badges.ts";

const publicBase = new URL("../", endpointBase).href;

export async function buildGallery(directory = "assets"): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const badgeFiles = (
    await readdir(join(directory, "badges"), { withFileTypes: true })
  )
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  const badges = await Promise.all(
    badgeFiles.map(async (filename) => {
      if (!/^[a-z0-9.]+\.json$/.test(filename)) {
        throw new Error(`Invalid badge filename: ${filename}`);
      }
      const badge = await Bun.file(join(directory, "badges", filename)).json();
      if (typeof badge?.message !== "string" || !badge.message.trim()) {
        throw new Error(`Missing badge title: ${filename}`);
      }
      const endpoint = new URL(filename, endpointBase).href;
      const shields = new URL("https://img.shields.io/endpoint");
      shields.searchParams.set("style", "for-the-badge");
      shields.searchParams.set("url", endpoint);
      return {
        filename,
        title: badge.message,
        endpoint: `badges/${filename}`,
        shields: shields.href,
        preview: shields.href,
      };
    }),
  );
  const snakeFiles = entries.some(
    (entry) => entry.isDirectory() && entry.name === "snake",
  )
    ? (await readdir(join(directory, "snake"), { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
        .map((entry) => entry.name)
        .sort()
    : [];
  const snakes = snakeFiles.map((filename) => {
    if (!/^[a-z0-9][a-z0-9.-]*\.svg$/.test(filename)) {
      throw new Error(`Invalid Snake filename: ${filename}`);
    }
    return {
      filename,
      url: `snake/${filename}`,
      publicUrl: new URL(`snake/${filename}`, publicBase).href,
      variant: filename.includes("-dark") ? "dark" : "light",
    };
  });
  const template = await Bun.file(
    new URL("./gallery.html", import.meta.url),
  ).text();
  const token = '"__ASSET_CATALOG__"';
  if (template.split(token).length !== 2) {
    throw new Error("Gallery template must contain exactly one catalog token");
  }
  const catalog = JSON.stringify({ badges, snakes }).replaceAll("<", "\\u003c");
  await Bun.write(
    join(directory, "index.html"),
    template.replace(token, () => catalog),
  );
  console.log(
    `Generated gallery with ${badges.length} badges and ${snakes.length} Snake images`,
  );
}

if (import.meta.main) {
  await buildGallery();
}
