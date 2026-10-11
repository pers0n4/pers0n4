import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGallery } from "./build-gallery.ts";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "profile-gallery-test-"));
  directories.push(directory);
  await mkdir(join(directory, "badges"));
  return directory;
}

async function readCatalog(directory: string) {
  const html = await Bun.file(join(directory, "index.html")).text();
  const match = html.match(
    /<script id="asset-catalog" type="application\/json">([\s\S]*?)<\/script>/,
  );
  expect(match).not.toBeNull();
  return { html, catalog: JSON.parse(match![1]) };
}

test("discover actual files in deterministic order with valid links", async () => {
  const directory = await fixture();
  await Bun.write(
    join(directory, "badges", "python.json"),
    JSON.stringify({ message: "Python" }),
  );
  await Bun.write(
    join(directory, "badges", "astro.json"),
    JSON.stringify({ message: "Astro" }),
  );
  await Bun.write(join(directory, "badges", "note.txt"), "Not a badge");
  await mkdir(join(directory, "badges", "nested.json"));
  await mkdir(join(directory, "snake"));
  await Bun.write(
    join(directory, "snake", "github-snake-dark.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  await buildGallery(directory);
  const { catalog, html } = await readCatalog(directory);
  expect(
    catalog.badges.map((badge: { filename: string }) => badge.filename),
  ).toEqual(["astro.json", "python.json"]);
  expect(catalog.badges[0].endpoint).toBe("badges/astro.json");
  expect(new URL(catalog.badges[0].shields).searchParams.get("url")).toBe(
    "https://pers0n4.github.io/pers0n4/badges/astro.json",
  );
  expect(catalog.snakes).toEqual([
    {
      filename: "github-snake-dark.svg",
      url: "snake/github-snake-dark.svg",
      publicUrl:
        "https://pers0n4.github.io/pers0n4/snake/github-snake-dark.svg",
      variant: "dark",
    },
  ]);
  expect(html).not.toContain("__ASSET_CATALOG__");
  expect(html).not.toContain("catalog.js");
  const first = html;
  await buildGallery(directory);
  expect((await readCatalog(directory)).html).toBe(first);
});

test("optional Snake generation and removed assets do not leave stale entries", async () => {
  const directory = await fixture();
  await Bun.write(
    join(directory, "badges", "python.json"),
    JSON.stringify({ message: "Python" }),
  );
  await buildGallery(directory);
  expect((await readCatalog(directory)).catalog.snakes).toEqual([]);
  await rm(join(directory, "badges", "python.json"));
  await buildGallery(directory);
  expect((await readCatalog(directory)).catalog.badges).toEqual([]);
});

test("escape embedded catalog data without changing titles", async () => {
  const directory = await fixture();
  const title = '</script><script>alert("unexpected")</script> $&';
  await Bun.write(
    join(directory, "badges", "python.json"),
    JSON.stringify({ message: title }),
  );
  await buildGallery(directory);
  const { html, catalog } = await readCatalog(directory);
  expect(catalog.badges[0].title).toBe(title);
  expect(html).not.toContain(title);
  expect(html).toContain("\\u003c/script>");
});

test("reject invalid names and payloads before replacing the gallery", async () => {
  for (const [filename, payload] of [
    ["bad name.json", '{"message":"Bad"}'],
    ["python.json", "{}"],
    ["python.json", '{"message":" "}'],
    ["python.json", "invalid JSON"],
  ]) {
    const directory = await fixture();
    await Bun.write(join(directory, "index.html"), "Existing gallery");
    await Bun.write(join(directory, "badges", filename), payload);
    await expect(buildGallery(directory)).rejects.toThrow();
    expect(await Bun.file(join(directory, "index.html")).text()).toBe(
      "Existing gallery",
    );
  }
});
