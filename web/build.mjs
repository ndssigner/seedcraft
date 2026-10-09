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
// The donation QR codes (the same images as NDS-Signer's README), inlined:
// data: URLs are the only images the page may show.
const png = (f) => "data:image/png;base64," + readFileSync(new URL("../docs/images/" + f, here)).toString("base64");
const donate = `// ---- donation images ----\nconst DONATE_IMAGES = { bitcoin: "${png("donate-bitcoin.png")}", lightning: "${png("donate-lightning.png")}" };\n`;

const PAGES = [
	{ out: "seedcraft-sequences.html", template: "src/seedcraft.html", styles: ["src/style.css"],
		scripts: ["third_party/qrcodegen.js", "src/bip39-english.js", "src/seedcraft-sequences.js", "src/i18n.js", "src/app.js"],
		version: "src/seedcraft-sequences.js" },
];

mkdirSync(new URL("../dist/", here), { recursive: true });
for (const page of PAGES) {
	const script = donate + page.scripts.map((f) => `// ---- ${f} ----\n${read(f)}`).join("\n");
	const style = page.styles.map(read).join("\n");
	const formatVersion = /const FORMAT_VERSION = (\d+);/.exec(read(page.version))[1];
	const html = read(page.template)
		.replace("{{SCRIPT_HASH}}", cspHash(script))
		.replace("{{STYLE_HASH}}", cspHash(style))
		.replace("{{FORMAT_VERSION}}", formatVersion)
		.replace("{{STYLE}}", () => style)
		.replace("{{SCRIPT}}", () => script);
	if (html.includes("{{")) throw new Error("unfilled placeholder in " + page.out);
	writeFileSync(new URL("../dist/" + page.out, here), html);
	console.log(createHash("sha256").update(html).digest("hex") + "  dist/" + page.out);
}
