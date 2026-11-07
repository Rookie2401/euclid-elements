import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, copyFile, rm, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = path.resolve(process.env.GOLEARN_SOURCE || path.join(root, "..", "go-v0"));
const sourceReal = await import("node:fs/promises").then(({ realpath }) => realpath(source));
const outputReal = await import("node:fs/promises").then(({ realpath }) => realpath(root));
if (/\\OneDrive(?:\\|$)/i.test(sourceReal) || /\\OneDrive(?:\\|$)/i.test(outputReal)) {
  throw new Error("GoLearn builds and outputs must be outside OneDrive.");
}

const sourceEntry = path.join(here, "golearn-entry.ts");
const generatedEntry = path.join(here, ".golearn-entry.generated.ts");
const original = await readFile(sourceEntry, "utf8");
let relativeSource = path.relative(here, source).replaceAll("\\", "/");
if (!relativeSource.startsWith(".")) relativeSource = `./${relativeSource}`;
const generated = original.replaceAll("../../go-v0/", `${relativeSource}/`);
if (generated === original && !source.endsWith("go-v0")) {
  throw new Error("Could not retarget the GoLearn source imports.");
}
const sourceRequire = createRequire(path.join(source, "package.json"));
const esbuildPackage = sourceRequire("esbuild/package.json");
if (esbuildPackage.version !== "0.28.2") throw new Error(`Expected GoLearn's esbuild 0.28.2; found ${esbuildPackage.version}.`);
const { build } = sourceRequire("esbuild");
const commit = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const asset = path.join(source, "public", "lexicon", "el", "koine-index.json");
const lexiconOut = path.join(root, "public", "lexicon", "el", "koine-index.json");
const sourceNotice = path.join(source, "docs", "greek", "KOINE-INDEX.md");

await mkdir(path.dirname(generatedEntry), { recursive: true });
await mkdir(path.dirname(lexiconOut), { recursive: true });
await writeFile(generatedEntry, generated);
try {
  await build({
    entryPoints: [generatedEntry],
    outfile: path.join(root, "public", "golearn.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    sourcemap: false,
    legalComments: "none",
    treeShaking: true,
    minify: true,
    logLevel: "info",
    loader: { ".md": "text" },
  });
  // GoLearn's generated Koine index is gitignored. When building in CI,
  // retain the already-vendored index in this site's public directory.
  try {
    await copyFile(asset, lexiconOut);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await access(lexiconOut);
    console.log("Using the existing bundled Koine index (upstream generated asset is not tracked).");
  }
  await access(sourceNotice);
  await mkdir(path.join(root, "public", "vendor"), { recursive: true });
  await writeFile(path.join(root, "public", "vendor", "golearn-build.json"), JSON.stringify({ source: "GoLearn", commit, esbuild: esbuildPackage.version, serviceUrl: "https://go-v0.onrender.com" }, null, 2) + "\n");
} finally {
  await rm(generatedEntry, { force: true });
}
console.log(`Built GoLearn bridge from ${commit}; copied the GoLearn Koine index.`);
