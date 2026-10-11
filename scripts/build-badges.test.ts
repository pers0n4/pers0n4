import { test } from "bun:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { siDeno, siPython } from "simple-icons";
import { collectBadges, createBadge, endpointBase } from "./build-badges.ts";

function endpoint(filename: string): string {
  return `![badge](https://img.shields.io/endpoint?style=for-the-badge&url=${endpointBase}${filename})`;
}

test("brand-colored SVG and contrasting backgrounds", () => {
  const python = createBadge(siPython);
  assert(python.logoSvg.includes('fill="#3776AB"'), "Missing brand SVG fill");
  assert(
    !Object.hasOwn(python, "logoColor"),
    "Custom SVG endpoints must not include named-logo color options",
  );
  assert(python.message === "Python", "Missing icon title");
  assert(
    python.labelColor === "rgba(245, 245, 245, 0.87)",
    "Dark brand background",
  );
  assert(
    createBadge(siDeno).labelColor === "rgba(33, 33, 33, 0.87)",
    "Light brand background",
  );
});

test("deduplication and dotted technology names", () => {
  const badges = collectBadges(
    endpoint("node.js.json") + endpoint("node.js.json"),
  );
  assert(badges.size === 1, "Duplicate endpoint output");
  assert(
    badges.get("node.js.json")?.message === "Node.js",
    "Dotted slug lookup",
  );
});

test("mise official SVG and Astro endpoint generation", () => {
  const badges = collectBadges(endpoint("mise.json") + endpoint("astro.json"));
  const mise = badges.get("mise.json");
  assert(mise?.message === "mise", "Missing mise endpoint");
  assert(
    mise.logoSvg.includes('xmlns="http://www.w3.org/2000/svg"') &&
      mise.logoSvg.includes('viewBox="43 37 215 226"') &&
      mise.logoSvg.includes("<path"),
    "Invalid official mise logo",
  );
  assert(!Object.hasOwn(mise, "logoColor"), "Invalid mise logo color option");
  assert(
    badges.get("astro.json")?.message === "Astro",
    "Missing Astro endpoint",
  );
});

test("reject invalid or unsupported endpoints", () => {
  for (const readme of [
    "no badges",
    endpoint("unknown.json"),
    endpoint("../python.json"),
    endpoint("python.json").replace(endpointBase, "https://badges.deno.dev/"),
  ]) {
    let rejected = false;
    try {
      collectBadges(readme);
    } catch {
      rejected = true;
    }
    assert(rejected, `Accepted invalid input: ${readme}`);
  }
});

test("every README endpoint matches a generated JSON file", async () => {
  const readme = await Bun.file("README.md").text();
  assert(!readme.includes("badges.deno.dev"), "Obsolete server reference");
  const badges = collectBadges(readme);
  const files = await readdir("assets/badges");
  assert(files.length === badges.size, "Extra or missing generated endpoints");
  for (const [filename, expected] of badges) {
    const actual = JSON.parse(
      await Bun.file(`assets/badges/${filename}`).text(),
    );
    assert(
      JSON.stringify(actual) === JSON.stringify(expected),
      `Mismatch: ${filename}`,
    );
  }
});

test("card srcset URLs preserve theme and comma-separated filters", async () => {
  const readme = await Bun.file("README.md").text();
  for (const match of readme.matchAll(/srcset="([^"]+)"/g)) {
    assert(!match[1].includes(","), "Unescaped srcset candidate separator");
    const url = new URL(match[1]);
    if (url.pathname === "/api/top-langs") {
      assert(
        url.searchParams.get("theme") === "dark_github",
        "Lost dark theme",
      );
      assert(
        url.searchParams.get("hide") === "css,html,tex",
        "Truncated language filters",
      );
    }
  }
});
