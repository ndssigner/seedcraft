// Seedcraft Sequences, the web tool's slides: the lectern. One 16:9 slide at
// a time, scaled to fit the window whole (never a scroll), with its fixed
// places: the guide top left (where you are), «?» and «⋯» top right, the
// question big and centred under them, the body (layouts.js's canvas), and at
// the foot «Back» on the left, «Next» on the right and, between them, the
// step's caption with «step n of m». Next walks a slide's own steps before it
// leaves it. The keyboard: the space bar and → go on, ← goes back, except
// while typing (and the space bar on a button presses the button). Esc closes
// the «⋯» panel and any popup. A phone held upright sees only «Turn your
// phone». The screen is kept awake (Wake Lock), if the browser can.
// Nothing here writes a style attribute or an inline handler. Its pure part,
// nextOf, is tested in web/test.mjs without a DOM.
"use strict";

const SeedcraftSlides = (() => {
	// What Next (dir "next", the default) or Back (dir "prev") does on a slide
	// at a step: { step } within the slide's own steps, { go } to leave it
	// (the slide's next.go or prev.go), or null when there is nothing to do
	// (no slide that way, or Next waiting while the slide is not ready).
	function nextOf(state, slide) {
		const steps = Math.max(1, slide.steps || 1);
		const step = Math.min(steps - 1, Math.max(0, state.step || 0));
		if (state.dir === "prev") {
			if (step > 0) return { step: step - 1 };
			return slide.prev && slide.prev.go ? { go: slide.prev.go } : null;
		}
		if (step < steps - 1) return { step: step + 1 };
		return slide.next && slide.next.go && slide.next.ready !== false ? { go: slide.next.go } : null;
	}

	// ---- the DOM part --------------------------------------------------
	let root = null, onLang = null, lang = "en";
	let slide = null, step = 0, panelOpen = false, popup = null;
	let el = {};            // the lectern's fixed parts
	let awake = true, lock = null;
	const T = () => (typeof SEEDCRAFT_TEXT !== "undefined" && SEEDCRAFT_TEXT[lang]) || {};
	const say = (key, fallback, ...args) => { const v = T()[key]; return typeof v === "function" ? v(...args) : v || fallback; };

	function h(tag, props, ...children) {
		const e = document.createElement(tag);
		for (const [k, v] of Object.entries(props || {})) {
			if (v === undefined || v === null || v === false) continue;
			if (k === "class") e.className = v;
			else if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
			else if (k === "text") e.textContent = v;
			else e.setAttribute(k, v === true ? "" : v);
		}
		for (const c of children.flat()) if (c !== null && c !== undefined && c !== false)
			e.append(typeof c === "object" ? c : document.createTextNode(String(c)));
		return e;
	}

	// typing somewhere: the keys are the field's
	function typing(t) {
		for (let n = t; n && n.tagName; n = n.parentNode) {
			if (n.isContentEditable || (n.getAttribute && n.getAttribute("contenteditable") !== null && n.getAttribute("contenteditable") !== "false")) return true;
			if (n === t && /^(INPUT|TEXTAREA|SELECT)$/i.test(n.tagName)) return true;
		}
		return false;
	}
	// a focused button (or summary): the space bar presses it
	const pressable = (t) => !!t && !!t.tagName && (/^(BUTTON|SUMMARY|A)$/i.test(t.tagName) || (t.getAttribute && t.getAttribute("role") === "button"));

	function onKey(e) {
		if (!slide || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === "Escape" || e.key === "Esc") {
			if (popup) { closePopup(); e.preventDefault(); }
			else if (panelOpen) { panel(false); e.preventDefault(); }
			return;
		}
		if (panelOpen || popup || e.defaultPrevented || typing(e.target)) return;
		// a slide that still uses its own keys (an old step view) has them first
		if (slide.onKey && slide.onKey(e)) return;
		const space = e.key === " " || e.key === "Spacebar";
		if (space && pressable(e.target)) return;
		if (space || e.key === "ArrowRight") { e.preventDefault(); move("next"); }
		else if (e.key === "ArrowLeft") { e.preventDefault(); move("prev"); }
	}

	function move(dir) {
		if (!slide) return;
		const r = nextOf({ step, dir }, slide);
		if (!r) return;
		if ("step" in r) { step = r.step; draw(); }
		else r.go();
	}

	// ---- the screen kept awake ------------------------------------------
	// navigator.wakeLock, if there is one; the browser lets go of it when the
	// page is hidden, so it is asked for again when the page shows. Any
	// failure, silently: the screen then turns off as it always does.
	async function wakeLock(on) {
		awake = !!on;
		try {
			if (!awake) { const l = lock; lock = null; if (l) await l.release(); return; }
			if (lock || typeof navigator === "undefined" || !navigator.wakeLock) return;
			if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
			lock = await navigator.wakeLock.request("screen");
			if (lock && lock.addEventListener) lock.addEventListener("release", () => { lock = null; });
			if (!awake) { const l = lock; lock = null; if (l) await l.release(); }
		} catch (err) { lock = null; }
	}

	// ---- mounting --------------------------------------------------------
	function mount(at, opts = {}) {
		root = at; onLang = opts.onLang || null; lang = opts.lang || lang;
		el.frame = h("div", { class: "slide-frame" });
		el.turn = h("div", { class: "slide-turn", role: "alert" });
		el.lectern = h("div", { class: "lectern" }, el.frame, el.turn);
		root.replaceChildren(el.lectern);
		document.addEventListener("keydown", onKey);
		document.addEventListener("visibilitychange", () => { if (awake && document.visibilityState === "visible") wakeLock(true); });
		// a phone held upright: only «Turn your phone»
		const mq = typeof matchMedia === "function" ? matchMedia("(orientation: portrait) and (max-width: 700px)") : null;
		const upright = () => el.lectern.classList.toggle("upright", !!(mq && mq.matches));
		if (mq) { if (mq.addEventListener) mq.addEventListener("change", upright); else if (mq.addListener) mq.addListener(upright); }
		upright();
		wakeLock(awake);
		if (slide) draw();
	}
	// the language the lectern's own words are in; the next show draws in it
	function setLang(l) { if (l) lang = l; }
	// whether Next may leave the slide now (a field typed into without a redraw)
	function setReady(ok) {
		if (!slide || !slide.next) return;
		slide.next = { ...slide.next, ready: !!ok };
		const b = typeof document !== "undefined" && document.getElementById("slide-next");
		if (b && step >= Math.max(1, slide.steps || 1) - 1) b.disabled = !ok;
	}

	// Shows a slide. The same slide again (the same id: a redraw, another
	// language) keeps its step; another starts at its first step.
	function show(s) {
		const same = slide && s.id !== undefined && s.id === slide.id;
		const keep = same && slide.legacy && el.body ? el.body.scrollTop : 0;
		slide = s;
		step = same ? Math.min(step, Math.max(1, s.steps || 1) - 1) : 0;
		if (!same) closePopup(true);
		if (root) draw();
		if (keep && el.body) el.body.scrollTop = keep;
	}

	function draw() {
		const s = slide, steps = Math.max(1, s.steps || 1);
		const focusedNext = document.activeElement && document.activeElement.id === "slide-next";
		el.turn.replaceChildren(h("span", { class: "slide-turn-icon", "aria-hidden": "true", text: "📱↻" }), h("b", { text: say("slidesTurn", "Turn your phone") }));

		// where you are: the process's steps, the current one with its count
		const guide = h("nav", { class: "slide-guide", "aria-label": say("slidesWhere", "Where you are") },
			h("ol", {}, (s.guide || []).map((g) => {
				const label = [h("span", { text: g.name }), g.current && g.count !== undefined && g.count !== null ? h("small", { text: " " + g.count }) : null];
				return h("li", { class: g.current ? "on" : null, "aria-current": g.current ? "step" : null },
					g.go && !g.current ? h("button", { on: { click: g.go } }, label) : label);
			})));
		const tools = h("div", { class: "slide-tools" },
			s.help ? h("button", { class: "slide-tool", title: say("slidesHelp", "Explain"), "aria-label": say("slidesHelp", "Explain"), on: { click: () => s.help() } }, "?") : null,
			el.more = h("button", { class: "slide-tool", id: "slide-more", title: say("slidesMore", "More"), "aria-label": say("slidesMore", "More"),
				"aria-expanded": String(panelOpen), on: { click: () => panel(!panelOpen) } }, "⋯"));
		const question = s.question ? h("h1", { class: "slide-question", text: s.question }) : null;

		el.body = h("div", { class: "slide-body" + (s.legacy ? " slide-legacy" : "") });
		const content = s.body ? s.body(Math.min(step, steps - 1)) : null;
		if (content) el.body.append(content);

		// the foot: Back, the caption, Next; always in the same places
		const lastStep = step >= steps - 1, firstStep = step <= 0;
		const back = firstStep ? s.prev : { label: say("slidesPrev", "◀ Back") };
		const on = lastStep ? s.next : { label: say("slidesNext", "Next ▶") };
		const caption = s.caption ? s.caption(step) : null;
		const foot = h("div", { class: "slide-foot" },
			back ? h("button", { class: "btn ghost slide-prev", id: "slide-prev", on: { click: () => move("prev") } }, back.label || say("slidesPrev", "◀ Back")) : h("span", { class: "slide-prev" }),
			h("div", { class: "slide-caption", "aria-live": "polite" },
				caption ? h("p", { text: caption }) : null,
				steps > 1 ? h("small", { text: say("slidesStepOf", `step ${step + 1} of ${steps}`, step + 1, steps) }) : null),
			on ? h("button", { class: "btn slide-next", id: "slide-next", disabled: lastStep && on.ready === false, on: { click: () => move("next") } },
				on.label || say("slidesNext", "Next ▶")) : h("span", { class: "slide-next" }));

		el.frame.replaceChildren(h("div", { class: "slide-top" }, guide, tools), ...(question ? [question] : []), el.body, foot, ...drawPanel(), ...(popup ? [popup.layer] : []));
		el.frame.classList.toggle("dimmed", panelOpen);
		if (focusedNext && document.getElementById("slide-next")) document.getElementById("slide-next").focus();
	}

	// ---- the «⋯» panel: this slide's shortcuts, the language, the screen awake ----
	function drawPanel() {
		if (!panelOpen) return [];
		const s = slide, t = T();
		const close = h("button", { class: "slide-tool slide-close", id: "slide-close", "aria-label": say("slidesClose", "Close"), title: say("slidesClose", "Close"), on: { click: () => panel(false) } }, "✕");
		const awakeBox = h("input", { type: "checkbox", id: "slide-awake", checked: awake, on: { change: (e) => wakeLock(e.target.checked) } });
		return [
			h("div", { class: "slide-scrim", on: { click: () => panel(false) } }),
			h("aside", { class: "slide-panel", role: "dialog", "aria-modal": "true", "aria-label": say("slidesMore", "More") },
				h("div", { class: "slide-panel-top" }, close),
				h("ul", { class: "slide-shortcuts" }, (s.shortcuts || []).map((x) => h("li", {},
					h("button", { on: { click: () => { panel(false); x.go(); } } }, h("span", { class: "slide-icon", "aria-hidden": "true", text: x.icon || "" }), h("span", { text: x.label }))))),
				h("div", { class: "slide-panel-foot" },
					t.langSwitch ? h("button", { class: "btn ghost small", id: "slide-lang", on: { click: () => switchLang(t.langSwitch) } }, t.langName) : null,
					h("label", { class: "slide-awake" }, awakeBox, h("span", { text: say("slidesAwake", "Keep the screen on") })))),
		];
	}
	function panel(open) {
		if (!slide) return;
		panelOpen = !!open;
		draw();
		const f = document.getElementById(panelOpen ? "slide-close" : "slide-more");
		if (f) f.focus();
	}
	// another language: the same slide, redrawn by whoever owns its texts
	function switchLang(l) {
		lang = l;
		if (onLang) onLang(l); else draw();
	}

	// ---- a popup over the slide (a dictionary opened to choose a piece) ----
	// Closed by Esc, a tap outside it, or the function it returns; onClose
	// is told, so nothing chosen leaves things as they were.
	function openPopup(content, opts = {}) {
		closePopup(true);
		const box = h("div", { class: "slide-popup", role: "dialog", "aria-modal": "true" }, content);
		const layer = h("div", { class: "slide-popup-layer" }, h("div", { class: "slide-scrim", on: { click: () => closePopup() } }), box);
		popup = { layer, onClose: opts.onClose || null };
		if (root && slide) el.frame.append(layer);
		return () => closePopup();
	}
	function closePopup(quiet) {
		if (!popup) return;
		const p = popup; popup = null;
		if (p.layer.parentNode) p.layer.remove();
		if (!quiet && p.onClose) p.onClose();
	}

	return { nextOf, mount, show, setLang, setReady, wakeLock, popup: openPopup, closePopup,
		get step() { return step; }, get panelOpen() { return panelOpen; } };
})();
