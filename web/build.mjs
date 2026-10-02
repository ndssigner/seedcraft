// Builds the single-file web tool: dist/seedcraft-sequences.html.
//     node web/build.mjs
// Deterministic (no dates, no random): the same sources give the same file,
// so anyone can rebuild it and compare its SHA-256 with the published one.
// The Content-Security-Policy allows only this file's own script and style,
// by their SHA-256 hashes, and no network at all.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const cspHash = (text) => "sha256-" + createHash("sha256").update(text, "utf8").digest("base64");

// qrcodegen.js is compiled from third_party/qrcodegen.ts (Project Nayuki,
// commit 3c6d0b3) with TypeScript 5.6.3:
//   npx -p typescript@5.6.3 tsc --target es2017 --module none qrcodegen.ts
const script = ["third_party/qrcodegen.js", "src/bip39-english.js", "src/seedcraft-sequences.js", "src/app.js"]
	.map((f) => `// ---- ${f} ----\n${read(f)}`).join("\n");
const style = read("src/style.css");
const formatVersion = /const FORMAT_VERSION = (\d+);/.exec(read("src/seedcraft-sequences.js"))[1];

const html = read("src/seedcraft.html")
	.replace("{{SCRIPT_HASH}}", cspHash(script))
	.replace("{{STYLE_HASH}}", cspHash(style))
	.replace("{{FORMAT_VERSION}}", formatVersion)
	.replace("{{STYLE}}", () => style)
	.replace("{{SCRIPT}}", () => script);
if (html.includes("{{")) throw new Error("unfilled placeholder");

mkdirSync(new URL("../dist/", here), { recursive: true });
const out = new URL("../dist/seedcraft-sequences.html", here);
writeFileSync(out, html);
console.log(createHash("sha256").update(html).digest("hex") + "  dist/seedcraft-sequences.html");
