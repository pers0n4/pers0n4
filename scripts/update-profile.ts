const start = "<!--START_SECTION:waka-->";
const end = "<!--END_SECTION:waka-->";
const outputPrefix = "README stats current output:\n\n";

export function updateProfile(source: string, output: string): string {
  if (!output.startsWith(outputPrefix)) {
    throw new Error("Missing Waka README_CONTENT output");
  }
  const stats = output.slice(outputPrefix.length).trim();
  if (!stats || stats.includes(start) || stats.includes(end)) {
    throw new Error("Invalid Waka metrics content");
  }
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  if (
    from === -1 ||
    to < from ||
    source.indexOf(start, from + start.length) !== -1 ||
    source.indexOf(end, to + end.length) !== -1
  ) {
    throw new Error("README must contain exactly one ordered Waka section");
  }
  return (
    source.slice(0, from + start.length) +
    "\n" +
    stats +
    "\n" +
    source.slice(to)
  );
}

if (import.meta.main) {
  const source = await Bun.file("README.md").text();
  await Bun.write(
    "README.md",
    updateProfile(source, process.env.WAKA_OUTPUT ?? ""),
  );
}
