import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareAssets } from "./build-assets.ts";
import { buildBadges, collectBadges } from "./build-badges.ts";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "profile-assets-test-"));
  directories.push(directory);
  await mkdir(join(directory, "badges"));
  await mkdir(join(directory, "snake"));
  await Bun.write(join(directory, "badges", "obsolete.json"), "{}");
  await Bun.write(join(directory, "snake", "existing.svg"), "Existing Snake");
  await Bun.write(join(directory, "index.html"), "Existing gallery");
  return directory;
}

test("badge-only generation removes obsolete endpoints without deleting other assets", async () => {
  const directory = await fixture();
  await Bun.write(
    join(directory, "badges", "notes.txt"),
    "Keep non-generated files",
  );
  const source = await Bun.file("README.md").text();
  await buildBadges(directory);
  expect(
    await Bun.file(join(directory, "badges", "obsolete.json")).exists(),
  ).toBe(false);
  expect(await Bun.file(join(directory, "badges", "notes.txt")).text()).toBe(
    "Keep non-generated files",
  );
  expect(await Bun.file(join(directory, "snake", "existing.svg")).text()).toBe(
    "Existing Snake",
  );
  expect(await Bun.file(join(directory, "index.html")).text()).toBe(
    "Existing gallery",
  );
  expect(await Bun.file("README.md").text()).toBe(source);
});

test("full preparation cleans output once and defers gallery until Snake generation", async () => {
  const directory = await fixture();
  const source = await Bun.file("README.md").text();
  await prepareAssets(directory);
  expect(await Bun.file(join(directory, "index.html")).exists()).toBe(false);
  expect(
    await Bun.file(join(directory, "snake", "existing.svg")).exists(),
  ).toBe(false);
  expect(await Bun.file(join(directory, ".nojekyll")).exists()).toBe(true);
  expect((await readdir(join(directory, "badges"))).sort()).toEqual(
    [...collectBadges(source).keys()].sort(),
  );
  expect(await Bun.file("README.md").text()).toBe(source);
});
