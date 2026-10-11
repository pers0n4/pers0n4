import { expect, test } from "bun:test";
import { updateProfile } from "./update-profile.ts";

const start = "<!--START_SECTION:wakatime-->";
const end = "<!--END_SECTION:wakatime-->";
const output = "README stats current output:\n\nCurrent metrics\n";

test("replace only the generated section in the source snapshot", () => {
  const source = `Source header\n${start}\nOld metrics\n${end}\nSource footer`;
  expect(updateProfile(source, output)).toBe(
    `Source header\n${start}\nCurrent metrics\n${end}\nSource footer`,
  );
});

test("render an empty template and remain idempotent", () => {
  const source = `${start}\n${end}`;
  const rendered = updateProfile(source, output);
  expect(updateProfile(rendered, output)).toBe(rendered);
});

test("reject missing or malformed metrics", () => {
  for (const invalid of [
    "",
    "raw stats",
    "README stats current output:\n\n",
    output + start,
  ]) {
    expect(() => updateProfile(`${start}\n${end}`, invalid)).toThrow();
  }
});

test("reject missing, duplicated or reversed markers", () => {
  for (const invalid of [
    "no markers",
    start,
    end + start,
    start + start + end,
    start + end + end,
  ]) {
    expect(() => updateProfile(invalid, output)).toThrow();
  }
});
