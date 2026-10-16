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
	// what Tab may reach inside a panel or a popup, in order
	function focusables(box) {
		const out = [];
		const walk = (n) => (n.children ? [...n.children] : []).forEach((c) => {
			if (!c.tagName) return;
			const tab = c.getAttribute && c.getAttribute("tabindex");
			const can = (/^(BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/i.test(c.tagName) && !c.disabled) || (/^A$/i.test(c.tagName) && c.getAttribute("href") !== null)
				|| (tab !== null && tab !== undefined && tab !== "-1");
			if (can) out.push(c);
			walk(c);
		});
		walk(box);
		return out;
	}
	const inside = (box, n) => { for (; n; n = n.parentNode) if (n === box) return true; return false; };
	// Tab and Shift+Tab go round inside the open panel or popup, never behind it
	function trap(e, box) {
		const f = focusables(box);
		if (!f.length) { e.preventDefault(); return; }
		const at = document.activeElement, i = f.indexOf(at);
		if (!inside(box, at) || i < 0) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
		else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
		else if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); }
	}

	function onKey(e) {
		if (!slide || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === "Escape" || e.key === "Esc") {
			if (popup) { closePopup(); e.preventDefault(); }
			else if (panelOpen) { panel(false); e.preventDefault(); }
			return;
		}
		if (e.key === "Tab") {
			if (popup) trap(e, popup.box);
			else if (panelOpen && el.aside) trap(e, el.aside);
			return;
		}
		if (panelOpen || popup || e.defaultPrevented || typing(e.target)) return;
		// a phone held upright shows only «Turn your phone»: no slide to move
		if (el.lectern && el.lectern.classList.contains("upright")) return;
		const space = e.key === " " || e.key === "Spacebar";
		// the space bar on a focused button presses that button, whatever the slide
		if (space && pressable(e.target)) return;
		// a slide that still uses its own keys (an old step view) has them first
		if (slide.onKey && slide.onKey(e)) return;
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
	// page is hidden, so it is asked for again when the page shows. Requests
	// go one after another (never two at once, so no lock is left behind),
	// each doing what `awake` says by then. Any failure, silently: the screen
	// then turns off as it always does.
	let queue = Promise.resolve();
	function wakeLock(on) {
		awake = !!on;
		queue = queue.then(applyWake).catch(() => { lock = null; });
		return queue;
	}
	async function applyWake() {
		if (!awake) { const l = lock; lock = null; if (l) await l.release(); return; }
		if (lock || typeof navigator === "undefined" || !navigator.wakeLock) return;
		if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
		const got = await navigator.wakeLock.request("screen");
		if (!got) return;
		if (!awake || lock) { await got.release(); return; }
		lock = got;
		if (got.addEventListener) got.addEventListener("release", () => { if (lock === got) lock = null; });
	}

	// ---- mounting --------------------------------------------------------
	function mount(at, opts = {}) {
		root = at; onLang = opts.onLang || null; lang = opts.lang || lang;
		el.frame = h("div", { class: "slide-frame" });
		// the lasting nodes: what is read aloud when it changes is changed, not made anew
		el.turnText = h("b");
		el.turn = h("div", { class: "slide-turn", role: "alert" }, h("span", { class: "slide-turn-icon", "aria-hidden": "true", text: "📱↻" }), el.turnText);
		el.captionText = h("p"); el.captionStep = h("small");
		el.caption = h("div", { class: "slide-caption", "aria-live": "polite" }, el.captionText, el.captionStep);
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

	// Draws the whole slide: the body made anew from body(step). Opening or
	// closing the panel or a popup never comes through here.
	function draw() {
		const s = slide, steps = Math.max(1, s.steps || 1);
		const focusedNext = document.activeElement && document.activeElement.id === "slide-next";
		el.turnText.textContent = say("slidesTurn", "Turn your phone");

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
				"aria-haspopup": "dialog", "aria-expanded": String(panelOpen), on: { click: () => panel(!panelOpen) } }, "⋯"));
		const question = s.question ? h("h1", { class: "slide-question", text: s.question }) : null;

		el.body = h("div", { class: "slide-body" + (s.legacy ? " slide-legacy" : "") });
		const content = s.body ? s.body(Math.min(step, steps - 1)) : null;
		if (content) el.body.append(content);

		// the foot: Back, the caption, Next; always in the same places
		const lastStep = step >= steps - 1, firstStep = step <= 0;
		const back = firstStep ? s.prev : { label: say("slidesPrev", "◀ Back") };
		const on = lastStep ? s.next : { label: say("slidesNext", "Next ▶") };
		const caption = s.caption ? s.caption(step) : null;
		el.captionText.textContent = caption || "";
		el.captionText.hidden = !caption;
		el.captionStep.textContent = steps > 1 ? say("slidesStepOf", `step ${step + 1} of ${steps}`, step + 1, steps) : "";
		el.captionStep.hidden = steps <= 1;
		const foot = h("div", { class: "slide-foot" },
			back ? h("button", { class: "btn ghost slide-prev", id: "slide-prev", on: { click: () => move("prev") } }, back.label || say("slidesPrev", "◀ Back")) : h("span", { class: "slide-prev" }),
			el.caption,
			on ? h("button", { class: "btn slide-next", id: "slide-next", disabled: lastStep && on.ready === false, on: { click: () => move("next") } },
				on.label || say("slidesNext", "Next ▶")) : h("span", { class: "slide-next" }));

		if (panelOpen) buildPanel();
		el.frame.replaceChildren(h("div", { class: "slide-top" }, guide, tools), ...(question ? [question] : []), el.body, foot,
			...(panelOpen ? [el.scrim, el.aside] : []), ...(popup ? [popup.layer] : []));
		if (focusedNext && document.getElementById("slide-next")) document.getElementById("slide-next").focus();
	}

	// ---- the «⋯» panel: this slide's shortcuts, the language, the screen awake ----
	function buildPanel() {
		const s = slide, t = T();
		const close = h("button", { class: "slide-tool slide-close", id: "slide-close", "aria-label": say("slidesClose", "Close"), title: say("slidesClose", "Close"), on: { click: () => panel(false) } }, "✕");
		const awakeBox = h("input", { type: "checkbox", id: "slide-awake", checked: awake, on: { change: (e) => wakeLock(e.target.checked) } });
		el.scrim = h("div", { class: "slide-scrim", on: { click: () => panel(false) } });
		el.aside = h("aside", { class: "slide-panel", role: "dialog", "aria-modal": "true", "aria-label": say("slidesMore", "More") },
			h("div", { class: "slide-panel-top" }, close),
			h("ul", { class: "slide-shortcuts" }, (s.shortcuts || []).map((x) => h("li", {},
				h("button", { on: { click: () => { panel(false); x.go(); } } }, h("span", { class: "slide-icon", "aria-hidden": "true", text: x.icon || "" }), h("span", { text: x.label }))))),
			h("div", { class: "slide-panel-foot" },
				t.langSwitch ? h("button", { class: "btn ghost small", id: "slide-lang", on: { click: () => switchLang(t.langSwitch) } }, t.langName) : null,
				h("label", { class: "slide-awake" }, awakeBox, h("span", { text: say("slidesAwake", "Keep the screen on") }))));
	}
	// opens or closes the panel over the slide as it is: the body is not redrawn
	function panel(open) {
		if (!slide || !el.frame || !!open === panelOpen) return;
		panelOpen = !!open;
		if (panelOpen) {
			buildPanel();
			el.frame.append(el.scrim, el.aside);   // under a popup, if any: the popup's layer is above (z-index)
		} else {
			if (el.scrim) el.scrim.remove();
			if (el.aside) el.aside.remove();
			el.scrim = el.aside = null;
		}
		if (el.more) el.more.setAttribute("aria-expanded", String(panelOpen));
		const f = panelOpen ? document.getElementById("slide-close") : el.more;
		if (f) f.focus();
	}
	// another language: the same slide, redrawn by whoever owns its texts;
	// the panel stays open, the focus on its language button
	function switchLang(l) {
		lang = l;
		if (onLang) onLang(l); else draw();
		const f = document.getElementById("slide-lang") || document.getElementById("slide-close");
		if (panelOpen && f) f.focus();
	}

	// ---- a popup over the slide (a dictionary opened to choose a piece) ----
	// Closed by Esc, a tap outside it, or the function it returns; onClose
	// is told, so nothing chosen leaves things as they were. The focus goes
	// into it, and back to where it was when it closes.
	function openPopup(content, opts = {}) {
		closePopup(true);
		const opener = typeof document !== "undefined" ? document.activeElement : null;
		const box = h("div", { class: "slide-popup", role: "dialog", "aria-modal": "true", tabindex: "-1" }, content);
		if (opts.label) box.setAttribute("aria-label", opts.label);
		const layer = h("div", { class: "slide-popup-layer" }, h("div", { class: "slide-scrim", on: { click: () => closePopup() } }), box);
		popup = { layer, box, opener, onClose: opts.onClose || null };
		if (root && slide) {
			el.frame.append(layer);
			const f = focusables(box);
			(f[0] || box).focus();
		}
		return () => closePopup();
	}
	function closePopup(quiet) {
		if (!popup) return;
		const p = popup; popup = null;
		if (p.layer.parentNode) p.layer.remove();
		if (!quiet && p.opener && p.opener.focus) p.opener.focus();
		if (!quiet && p.onClose) p.onClose();
	}

	return { nextOf, mount, show, setLang, setReady, wakeLock, popup: openPopup, closePopup,
		get step() { return step; }, get panelOpen() { return panelOpen; } };
})();
