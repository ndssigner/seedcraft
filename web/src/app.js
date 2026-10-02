// Seedcraft Sequences test tool: user interface. Text from the user is only
// ever shown as text (textContent), never as HTML.
"use strict";

(() => {
	const S = SeedcraftSequences;
	const $ = (id) => document.getElementById(id);
	const el = (tag, text, cls) => {
		const e = document.createElement(tag);
		if (text !== undefined) e.textContent = text;
		if (cls) e.className = cls;
		return e;
	};

	// ---- warnings ----------------------------------------------------
	const online = () => $("online").classList.toggle("hidden", !navigator.onLine);
	window.addEventListener("online", online);
	window.addEventListener("offline", online);
	online();

	// ---- tabs --------------------------------------------------------
	for (const b of $("tabs").querySelectorAll("button")) {
		b.addEventListener("click", () => {
			for (const o of $("tabs").querySelectorAll("button")) o.classList.toggle("active", o === b);
			for (const p of ["encode", "decode", "about"]) $(p).classList.toggle("hidden", p !== b.dataset.tab);
		});
	}

	// ---- default objects ---------------------------------------------
	const COLOURS = [["Red", "#d32f2f"], ["Orange", "#f57c00"], ["Yellow", "#fbc02d"], ["Lime", "#9ccc65"],
		["Green", "#2e7d32"], ["Teal", "#00897b"], ["Cyan", "#4dd0e1"], ["Blue", "#1e88e5"],
		["Navy", "#1a237e"], ["Purple", "#7b1fa2"], ["Magenta", "#d81b60"], ["Pink", "#f8bbd0"],
		["Brown", "#6d4c41"], ["Black", "#212121"], ["Grey", "#9e9e9e"], ["White", "#fafafa"]];
	const CHARMS = ["Star charm", "Heart charm", "Moon charm", "Sun charm", "Anchor charm", "Key charm",
		"Bell charm", "Leaf charm", "Flower charm", "Fish charm", "Bird charm", "Cat charm", "Shell charm",
		"Crown charm", "Diamond charm", "Clover charm"];
	const DEFAULTS = COLOURS.map(([n]) => n).concat(CHARMS);
	const swatch = new Map(COLOURS.map(([n, c]) => [n.toLowerCase(), c]));
	let namesEdited = false;
	const fillNames = () => {
		const n = 1 << Number($("enc-n").value);
		$("enc-names").value = DEFAULTS.slice(0, n).join("\n");
		$("enc-names").rows = Math.min(n, 16);
	};
	$("enc-names").addEventListener("input", () => { namesEdited = true; });
	$("enc-n").addEventListener("change", () => {
		const n = 1 << Number($("enc-n").value);
		const current = names();
		if (!namesEdited || current.length < n) fillNames();
		else $("enc-names").value = current.slice(0, n).join("\n");
	});
	fillNames();
	const names = () => $("enc-names").value.split("\n").map((s) => s.trim()).filter((s) => s);

	// ---- helpers -----------------------------------------------------
	const showError = (id, err) => {
		$(id).textContent = err ? (err.message || String(err)) : "";
		$(id).classList.toggle("hidden", !err);
	};
	const chip = (name, index) => {
		const c = el("span", undefined, "chip");
		const dot = el("i");
		const colour = swatch.get(name.toLowerCase());
		if (colour) dot.style.background = colour;
		else dot.textContent = name.slice(0, 1).toUpperCase();
		c.append(dot, el("span", name));
		if (index !== undefined) c.append(el("em", String(index)));
		return c;
	};
	const stat = (value, label) => {
		const s = el("div", undefined, "stat");
		s.append(el("b", String(value)), el("span", label));
		return s;
	};
	const qrSvg = (qr) => {
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		const n = qr.size, b = 2;
		svg.setAttribute("viewBox", `0 0 ${n + 2 * b} ${n + 2 * b}`);
		svg.setAttribute("shape-rendering", "crispEdges");
		const path = document.createElementNS(ns, "path");
		let d = "";
		for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.getModule(x, y)) d += `M${x + b},${y + b}h1v1h-1z`;
		path.setAttribute("d", d);
		svg.append(path);
		return svg;
	};
	const randomSeed = (bytes) => {
		const e = new Uint8Array(bytes);
		crypto.getRandomValues(e);
		$("enc-seed").value = S.entropyToMnemonic(e);
	};
	$("rand12").addEventListener("click", () => randomSeed(16));
	$("rand24").addEventListener("click", () => randomSeed(32));

	// ---- seed -> objects ---------------------------------------------
	$("encode-btn").addEventListener("click", () => {
		const out = $("enc-result");
		out.replaceChildren();
		out.classList.add("hidden");
		try {
			showError("enc-error", null);
			const k = Number($("enc-n").value), n = 1 << k;
			const dictionary = names();
			if (dictionary.length !== n) throw new Error(`Write exactly ${n} objects, one per line (there are ${dictionary.length}).`);
			if (new Set(dictionary).size !== n) throw new Error("The objects must all be different.");
			const pin = $("enc-pin").value.trim();
			const entropy = S.mnemonicToEntropy($("enc-seed").value);
			const symbols = S.encode(entropy, k, pin || undefined);
			const sequence = S.physicalSequence(symbols, dictionary);
			const qr = S.compactSeedQR(pin ? S.pinXor(entropy, pin) : entropy);

			const summary = el("div", undefined, "summary");
			summary.append(stat(sequence.length, "objects in total"), stat(n, "dictionary (first)"),
				stat(symbols.length, "then the seed"), stat(`${qr.size}×${qr.size}`, `QR code, mask ${qr.mask}`));
			out.append(summary);

			out.append(el("h3", "How many of each"));
			const counts = new Map(dictionary.map((d) => [d, 1]));
			for (const s of symbols) counts.set(dictionary[s], counts.get(dictionary[s]) + 1);
			const cl = el("div", undefined, "chips");
			for (const d of dictionary) cl.append(chip(d, "×" + counts.get(d)));
			out.append(cl, el("p", `A shopping list with these exact numbers says a little about the seed: buy the same amount of each kind, ${symbols.length + 1} covers any seed.`, "note"));

			out.append(el("h3", "The sequence, from the start (clasp, knot or end)"));
			const ol = el("ol", undefined, "sequence");
			sequence.forEach((name, i) => {
				const li = el("li");
				li.append(chip(name));
				if (i === n) li.append(el("span", "  ← the seed starts", "note"));
				if (i % 10 === 0) li.className = "ten";
				ol.append(li);
			});
			out.append(ol);

			out.append(el("h3", "As text (to test the other tab)"));
			const ta = el("textarea");
			ta.readOnly = true;
			ta.rows = 4;
			ta.value = sequence.join("\n");
			const toDecode = el("button", "Read it back in “Objects → seed”", "secondary");
			toDecode.addEventListener("click", () => {
				$("dec-objects").value = ta.value;
				$("dec-pin").value = pin;
				document.querySelector('#tabs [data-tab="decode"]').click();
			});
			const bt = el("div", undefined, "buttons");
			bt.append(toDecode);
			out.append(ta, bt);

			out.append(el("h3", "The QR code it rebuilds"));
			const q = el("div", undefined, "qr");
			q.append(qrSvg(qr), el("p", pin
				? "With a PIN this QR code holds the obfuscated entropy: only a Seedcraft reader with the PIN gives the seed."
				: "The seed's CompactSeedQR: drawn or placed back from the sequence, any SeedSigner can scan it.", "note"));
			out.append(q);
			out.classList.remove("hidden");
		} catch (e) {
			showError("enc-error", e);
		}
	});

	// ---- objects -> seed ---------------------------------------------
	$("decode-btn").addEventListener("click", () => {
		const out = $("dec-result");
		out.replaceChildren();
		out.classList.add("hidden");
		try {
			showError("dec-error", null);
			const objects = $("dec-objects").value.split(/[\n,]/).map((s) => s.trim()).filter((s) => s);
			if (objects.length === 0) throw new Error("Write the sequence first.");
			const pin = $("dec-pin").value.trim();
			const r = S.decodeObjects(objects, pin || undefined);
			out.append(el("h3", "The seed"), el("div", S.entropyToMnemonic(r.entropy), "words"));
			const summary = el("div", undefined, "summary");
			summary.append(stat(1 << r.k, "kinds of objects"), stat(r.reversed ? "reversed" : "as written", "reading direction"),
				stat(r.fixed, "QR bytes repaired"), stat(r.header[1], "QR mask"));
			out.append(summary);
			if (r.fixed) out.append(el("p", "Some objects were misread and the QR code's error correction repaired them: check the sequence.", "note"));
			if (pin) out.append(el("p", "A wrong PIN does not fail: it gives a different, valid seed. Check that the seed is the expected one.", "note"));
			out.classList.remove("hidden");
		} catch (e) {
			showError("dec-error", e);
		}
	});
})();
