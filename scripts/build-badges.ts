import { mkdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import * as icons from "simple-icons";
import type { SimpleIcon } from "simple-icons";

export const endpointBase = "https://pers0n4.github.io/pers0n4/badges/";

// Official logo: https://github.com/jdx/mise/blob/main/docs/public/logo.svg
const miseIcon = {
  slug: "mise",
  title: "mise",
  hex: "000000",
  svg: readFileSync(
    new URL("./icons/mise.svg", import.meta.url),
    "utf8",
  ).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '),
};

export interface Badge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
  labelColor: string;
  logoSvg: string;
  style: "for-the-badge";
}

export function createBadge(
  icon: Pick<SimpleIcon, "title" | "hex" | "svg">,
): Badge {
  const rgb = [0, 2, 4].map((offset) =>
    parseInt(icon.hex.slice(offset, offset + 2), 16),
  );
  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 255000;
  const labelColor =
    brightness <= 0.69 ? "rgba(245, 245, 245, 0.87)" : "rgba(33, 33, 33, 0.87)";

  return {
    schemaVersion: 1,
    label: "",
    message: icon.title,
    color: icon.hex,
    labelColor,
    logoSvg: icon.svg.replace("<svg ", `<svg fill="#${icon.hex}" `),
    style: "for-the-badge",
  };
}

export function collectBadges(readme: string): Map<string, Badge> {
  const badges = new Map<string, Badge>();
  for (const match of readme.matchAll(
    /https:\/\/img\.shields\.io\/endpoint\?[^\s)]+/g,
  )) {
    const endpoint = new URL(match[0]).searchParams.get("url");
    if (!endpoint?.startsWith(endpointBase)) {
      throw new Error(`Unexpected badge endpoint: ${endpoint}`);
    }
    const filename = endpoint.slice(endpointBase.length);
    if (!/^[a-z0-9.]+\.json$/.test(filename)) {
      throw new Error(`Invalid badge filename: ${filename}`);
    }
    const slug = filename.slice(0, -5).replaceAll(".", "dot");
    const icon =
      slug === miseIcon.slug
        ? miseIcon
        : Object.values(icons).find(
            (icon): icon is SimpleIcon => "slug" in icon && icon.slug === slug,
          );
    if (!icon) throw new Error(`Unknown Simple Icons slug: ${slug}`);
    badges.set(filename, createBadge(icon));
  }
  if (badges.size === 0) throw new Error("README contains no endpoint badges");
  return badges;
}

if (import.meta.main) {
  const badges = collectBadges(await Bun.file("README.md").text());
  // Remove obsolete generated endpoints before creating the Pages artifact.
  await rm("assets", { recursive: true, force: true });
  await mkdir("assets/badges", { recursive: true });
  await Bun.write("assets/.nojekyll", "");
  for (const [filename, badge] of badges) {
    await Bun.write(
      `assets/badges/${filename}`,
      JSON.stringify(badge, null, 2) + "\n",
    );
  }
  console.log(`Generated ${badges.size} static badge endpoints`);
}
