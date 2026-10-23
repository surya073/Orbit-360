import { cloneSlide, uid } from './slideModel';

/**
 * "Your templates": decks the person saved as a starting point (from the editor, or automatically when they import a
 * PowerPoint file). They live on this device only (localStorage), so they cost no requests and need no setup; a template
 * is a copy, so using one never changes it.
 */
const KEY = 'company360.studioTemplates';
const MAX_TEMPLATES = 12;
const MAX_CHARS = 700 * 1024;

const read = () => {
	try {
		const v = JSON.parse(window.localStorage.getItem(KEY) || '[]');
		return Array.isArray(v) ? v.filter((t) => t && t.id && Array.isArray(t.slides) && t.slides.length) : [];
	} catch {
		return [];
	}
};

export const listUserTemplates = () => read();

/** Saves a copy of the slides; returns the template, or null when the device cannot store it (too large or storage blocked). */
export function saveUserTemplate(name, slides, extracted = {}) {
	const custom = slides.filter((s) => s.type === 'custom'); // live report slides are not designs
	if (!custom.length) return null;
	const tpl = { id: uid(), name: String(name || 'My template').slice(0, 80), savedAt: Date.now(), palette: Array.isArray(extracted.palette) ? extracted.palette.slice(0, 12) : [], fonts: extracted.fonts || null, animations: extracted.animations || 0, slides: custom.map((s) => cloneSlide(s)) };
	const next = [tpl, ...read()].slice(0, MAX_TEMPLATES);
	try {
		const json = JSON.stringify(next);
		if (json.length > MAX_CHARS) return null;
		window.localStorage.setItem(KEY, json);
		return tpl;
	} catch {
		return null;
	}
}

export function removeUserTemplate(id) {
	try {
		window.localStorage.setItem(KEY, JSON.stringify(read().filter((t) => t.id !== id)));
	} catch {
		/* nothing to remove */
	}
}

/** A fresh copy of a template's slides (new ids), or null if it no longer exists. */
export function slidesOfUserTemplate(id) {
	const t = read().find((x) => x.id === id);
	return t ? { title: t.name, palette: t.palette || [], slides: t.slides.map((s) => cloneSlide(s)) } : null;
}
