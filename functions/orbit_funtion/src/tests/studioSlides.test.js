'use strict';

// Free-form studio slides: sanitised on the way in, compressed to fit the Data Store column, round-tripped intact.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorld } = require('./helpers/world');
const { cleanCustomSlide } = require('../validators/slideSchema');

const text = (i, extra = {}) => ({ id: `t${i}`, kind: 'text', x: 100, y: 80 + i * 60, w: 900, h: 50, text: `Line ${i}: ${'Quarterly delivery review, '.repeat(3)}`, st: { fs: 36, fw: 600, color: 'theme:text', al: 'left' }, anim: { in: 'rise', delay: i * 80, dur: 600, step: 0 }, hover: 'lift', ...extra });

test('a studio slide keeps its objects, and anything outside the whitelist is dropped', () => {
	const s = cleanCustomSlide({
		type: 'custom',
		id: 's1',
		bg: { kind: 'gradient', color: '#102030', color2: '#304050', angle: 120 },
		notes: 'say hello',
		objects: [
			text(1, { link: 'https://example.com/report' }),
			{ id: 'sh', kind: 'shape', shape: 'ellipse', x: 10, y: 10, w: 100, h: 100, st: { fill: 'theme:accent', op: 5, bw: 999 } },
			{ id: 'im', kind: 'image', x: 0, y: 0, w: 300, h: 200, src: 'https://cdn.example.com/a.png', alt: 'logo', fit: 'contain' },
			{ id: 'w', kind: 'widget', x: 0, y: 0, w: 500, h: 300, widget: { type: 'bars', metric: 'workload', top: 99, compare: 1 } },
			{ id: 'evil', kind: 'script', x: 0, y: 0, w: 1, h: 1 },
		],
	}, 0);
	assert.equal(s.objects.length, 4); // the unknown kind is gone
	assert.equal(s.bg.kind, 'gradient');
	assert.equal(s.objects[0].link, 'https://example.com/report');
	assert.equal(s.objects[0].anim.in, 'rise');
	assert.equal(s.objects[0].hover, 'lift');
	assert.equal(s.objects[1].st.op, 1); // clamped
	assert.equal(s.objects[1].st.bw, 40);
	assert.equal(s.objects[3].widget.top, 10);
	assert.equal(s.objects[3].widget.compare, true);
});

test('dangerous links, svg or script images and odd colours are removed', () => {
	const s = cleanCustomSlide({
		type: 'custom',
		bg: { kind: 'solid', color: 'url(javascript:alert(1))' },
		objects: [
			text(1, { link: 'javascript:alert(1)', st: { color: 'red; background:url(x)', fill: '#fff' } }),
			{ id: 'a', kind: 'image', x: 0, y: 0, w: 10, h: 10, src: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
			{ id: 'b', kind: 'image', x: 0, y: 0, w: 10, h: 10, src: 'http://insecure.example.com/a.png' },
			{ id: 'c', kind: 'image', x: 0, y: 0, w: 10, h: 10, src: 'data:image/png;base64,iVBORw0KGgo=' },
			text(2, { text: 'x'.repeat(5000) }),
		],
	}, 0);
	assert.equal(s.bg.color, '#111111'); // a bad colour falls back
	assert.equal(s.objects[0].link, undefined);
	assert.equal(s.objects[0].st.color, 'theme:text');
	assert.equal(s.objects[1].src, '');
	assert.equal(s.objects[2].src, '');
	assert.ok(s.objects[3].src.startsWith('data:image/png;base64,'));
	assert.equal(s.objects[4].text.length, 1500);
});

test('at most 40 objects per slide, and duplicate ids are made unique', () => {
	const many = Array.from({ length: 60 }, () => text(1));
	const s = cleanCustomSlide({ type: 'custom', objects: many }, 0);
	assert.equal(s.objects.length, 40);
	assert.equal(new Set(s.objects.map((o) => o.id)).size, 40);
});

test('a deck too long for the column is stored compressed and reads back identical', async () => {
	const w = buildWorld();
	const slides = Array.from({ length: 12 }, (_, n) => ({ type: 'custom', id: `s${n}`, name: `Slide ${n}`, objects: Array.from({ length: 12 }, (__, i) => text(i)) }));
	const created = await w.api(w.ids.admin, 'POST', '/presentations', { title: 'Big studio deck', slides });
	assert.equal(created.status, 201, JSON.stringify(created.body));
	const stored = w.store.rows('saved_presentations')[0].slides_config;
	assert.ok(stored.startsWith('z1:'), 'long decks are compressed');
	assert.ok(stored.length <= 9000);
	const got = (await w.api(w.ids.admin, 'GET', `/presentations/${created.body.data.ROWID}`)).body.data;
	assert.equal(got.slides.length, 12);
	assert.equal(got.slides[3].objects.length, 12);
	assert.equal(got.slides[3].objects[5].text, slides[3].objects[5].text);
});

test('a deck that cannot fit even compressed is refused with a clear message', async () => {
	const w = buildWorld();
	// high-entropy text does not compress, so this deck is genuinely too large
	const rnd = (n) => Array.from({ length: n }, () => Math.random().toString(36).slice(2, 4)).join('');
	const slides = Array.from({ length: 10 }, (_, n) => ({ type: 'custom', id: `s${n}`, objects: Array.from({ length: 8 }, (__, i) => text(i, { text: rnd(700) })) }));
	const r = await w.api(w.ids.admin, 'POST', '/presentations', { title: 'Too big', slides });
	assert.equal(r.status, 422);
	assert.match(JSON.stringify(r.body), /too large/i);
});

test('older section decks are stored exactly as before', async () => {
	const w = buildWorld();
	const r = await w.api(w.ids.admin, 'POST', '/presentations', { title: 'Plain', slides: [{ type: 'section', section: 'billable_hours' }] });
	assert.equal(r.status, 201);
	assert.ok(w.store.rows('saved_presentations')[0].slides_config.startsWith('{'));
});

test('the list gives each deck a small cover and slide count, never the saved config', async () => {
	const w = buildWorld();
	await w.api(w.ids.admin, 'POST', '/presentations', { title: 'Studio', slides: [{ type: 'custom', id: 'a', bg: { kind: 'solid', color: '#112233' }, objects: Array.from({ length: 14 }, (_, i) => text(i)) }, { type: 'custom', id: 'b', objects: [] }] });
	await w.api(w.ids.admin, 'POST', '/presentations', { title: 'Report', slides: [{ type: 'section', section: 'billable_hours' }] });
	const r = await w.api(w.ids.admin, 'GET', '/presentations');
	assert.equal(r.status, 200);
	const studio = r.body.data.find((p) => p.title === 'Studio');
	assert.equal(studio.slideCount, 2);
	assert.equal(studio.studio, true);
	assert.equal(studio.cover.objects.length, 10);
	assert.equal(studio.cover.bg.color, '#112233');
	const report = r.body.data.find((p) => p.title === 'Report');
	assert.deepEqual([report.studio, report.cover, report.slideCount], [false, null, 1]);
	assert.equal(JSON.stringify(r.body).includes('slides_config'), false);
});

test('a deck whose saved slides cannot be decoded says why instead of failing quietly', async () => {
	const w = buildWorld();
	const id = (await w.api(w.ids.admin, 'POST', '/presentations', { title: 'Broken', slides: [{ type: 'section', section: 'billable_hours' }] })).body.data.ROWID;
	w.store.rows('saved_presentations').find((r) => r.ROWID === id).slides_config = 'z1:not-really-compressed';
	const got = (await w.api(w.ids.admin, 'GET', `/presentations/${id}`)).body.data;
	assert.equal(got.slidesAvailable, false);
	assert.match(got.slidesProblem, /slides/i);
	const list = (await w.api(w.ids.admin, 'GET', '/presentations')).body.data.find((p) => p.title === 'Broken');
	assert.equal(list.unreadable, true);
});
