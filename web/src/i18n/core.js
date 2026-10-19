// SeedCraft web tool: the languages. This core declares them and what
// every language file fills in (SEEDCRAFT_TEXT[code], SEEDCRAFT_NAMES[code]:
// web/src/i18n/<code>.js, loaded after it), picks the first language, and
// builds the ready-made sets (their emoji, colours and symbols here, their
// names from each language's file).
"use strict";

// the languages offered, each named in itself; the menu lists those whose file is loaded
const SEEDCRAFT_LANGS = [["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["it", "Italiano"],
	["ja", "日本語"], ["ko", "한국어"], ["zh", "中文"], ["ru", "Русский"]];
// the interface's texts and the sets' names, one object per language
const SEEDCRAFT_TEXT = {};
const SEEDCRAFT_NAMES = {};

// The first visit's language: the first of the browser's languages (in its
// order) that is available, by its main part ("de-AT" is "de", "zh-TW" is
// "zh"); English if none is. Pure: navigatorLanguages is navigator.languages.
function pickLang(navigatorLanguages, available) {
	for (const tag of navigatorLanguages || []) {
		const code = String(tag || "").toLowerCase().split(/[-_]/)[0];
		if (available.includes(code)) return code;
	}
	return available.includes("en") ? "en" : available[0];
}

// a pad file's problem, after its line number if it has one (the languages' errPadFile)
const lineOr = (line, word, msg) => line ? `${word} ${line}: ${msg}` : msg[0].toUpperCase() + msg.slice(1);

// Symbols drawn on things that have a colour but no emoji, so that a sheet
// printed in black and white still tells them apart. Plain geometric glyphs
// (not emoji), the most distinct first, and none that looks like a charm of
// the ready-made sets (no stars, moons or notes: they would be confused with
// ⭐ 🌙 🎵 in black and white).
const SEEDCRAFT_SYMBOLS = ["●", "▲", "■", "◆", "▼", "✚", "✖", "✿", "◉", "⬢", "❖", "⧗", "◐", "⊕", "▣", "✱",
	"◈", "⊗", "◒", "◓", "◧", "◨", "▤", "▥", "◩", "◪", "⊞", "⬣", "◑", "⊡", "◫", "⊟"];

// the i-th name of one of the language files' lists, in every language
// ({ en: …, es: …, … }); English stands in only for a language whose file is missing
function seedcraftNamed(list, i) {
	return Object.fromEntries(SEEDCRAFT_LANGS.map(([code]) => [code, (SEEDCRAFT_NAMES[code] || SEEDCRAFT_NAMES.en)[list][i]]));
}

// Ready-made sets: each thing has an emoji and/or a colour (with a symbol),
// and a name per language (thing[code]; set[code] is the set's name). Up to
// 32 things per set (the first N are used). Built once, after the language files.
let seedcraftSetsMade = null;
function seedcraftSets() {
	if (seedcraftSetsMade) return seedcraftSetsMade;
	const named = (list) => (x, i) => ({ ...x, ...seedcraftNamed(list, i) });
	const colours = ["#d32f2f", "#f57c00", "#fbc02d", "#9ccc65", "#2e7d32", "#00897b", "#4fc3f7", "#1e4fd8",
		"#1a237e", "#7b1fa2", "#d81b60", "#f48fb1", "#6d4c41", "#1b1b1b", "#9e9e9e", "#fafafa",
		"#c9a227", "#b8c2cc", "#e8d5b0", "#827717", "#ff7f6e", "#c5a3e6", "#a5e8c8", "#7b1531",
		"#ffcc99", "#d4a017", "#155e63", "#9fa8da", "#fa8072", "#b5a36a", "#fff8e1", "#424242"];
	const beads = colours.map((colour, i) => ({ colour, symbol: SEEDCRAFT_SYMBOLS[i] })).map(named("beads"));
	const bricks = colours.map((colour, i) => ({ symbol: SEEDCRAFT_SYMBOLS[i], colour, brick: true })).map(named("bricks"));
	const emoji = (list, all) => [...all].map((e) => ({ emoji: e })).map(named(list));
	const animals = emoji("animals", ["🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧",
		"🦉", "🦆", "🐴", "🦄", "🐝", "🦋", "🐌", "🐞", "🐢", "🐙", "🐠", "🐬", "🐳", "🦀", "🐘", "🦒"]);
	const charms = emoji("charms", ["⭐", "❤️", "🌙", "☀️", "⚓", "🔑", "🔔", "🍀", "🌸", "🍄", "🌈", "⚡", "🍎", "🍓", "🍋", "🍒",
		"👑", "💎", "🎈", "🎵", "⚽", "🚀", "🏠", "🌵", "🐚", "🌲", "☂️", "✏️", "🎁", "🧸", "🪐", "❄️"]);
	// the address book's kinds (SPEC §11.3): street types, each language in
	// its own alphabetical order, the conventional dictionary (the i-th of
	// one language is not a translation of another's)
	const streets = Array.from({ length: 8 }, () => ({})).map(named("streets"));
	// a photo album's kinds: the one obvious subject of each photo
	const photos = emoji("photos", ["🧑", "🐾", "🚗", "🏛️", "🌸", "🍲", "🌊", "⛰️"]);
	const suits = emoji("suits", ["♣️", "♦️", "♥️", "♠️"]);
	const authors = Array.from({ length: 8 }, () => ({})).map(named("authors"));
	const gems = ["#8e5cc4", "#1f3f99", "#1e8a5a", "#1b1b1b", "#f2b8c6", "#b07a2a", "#eceae4", "#d65a1f",
		"#34b3a8", "#4f9d69", "#5b5f66", "#e8c547", "#9c2f2a", "#2f4f86", "#cfd8e3", "#5d7385"]
		.map((colour, i) => ({ colour, symbol: SEEDCRAFT_SYMBOLS[i] })).map(named("gems"));
	const mixed = [];
	for (let i = 0; i < 16; i++) mixed.push(beads[i], charms[i]);
	const set = (id, icon, things) => ({ id, icon, ...Object.fromEntries(SEEDCRAFT_LANGS.map(([code]) => [code, (SEEDCRAFT_NAMES[code] || SEEDCRAFT_NAMES.en).sets[id]])), things });
	return (seedcraftSetsMade = [
		set("beads", "🔴", beads), set("animals", "🐾", animals), set("charms", "⭐", charms), set("bricks", "🧱", bricks),
		set("mixed", "🎨", mixed), set("streets", "📒", streets), set("gems", "💎", gems), set("photos", "📷", photos),
		set("authors", "📚", authors), set("suits", "🃏", suits),
	]);
}
// the colours offered for a piece: the first 16 beads' colours, each with its name alone ({ colour, name: { en, es, … } })
function seedcraftColours() {
	return seedcraftSets()[0].things.slice(0, 16).map((b, i) => ({ colour: b.colour, name: seedcraftNamed("colours", i) }));
}
