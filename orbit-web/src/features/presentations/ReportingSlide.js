import React, { useMemo } from 'react';
import Button from '../../components/common/Button';
import { initialsOf } from '../reporting/treeModel';
import { REPORTING_BODY, REPORTING_NODE, layoutPart } from './reportingSlides';
import { SlideFrame } from './PresentationSlides';

// Animation timeline (ms): title (frame) -> roots -> connectors draw level by level -> avatars -> names -> metrics.
const ROOT_AT = 460;
const LEVEL_STEP = 560;
const STAGGER = 55;
const MAX_STAGGER = 520;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Screen-reader outline of the part (the visual tree is decorative to assistive technology). */
function Outline({ model, layout }) {
	const kids = new Map();
	for (const e of layout.edges) kids.set(e.from, [...(kids.get(e.from) || []), e.to]);
	const item = (id) => {
		const emp = model.byId.get(id);
		const node = model.tree[id];
		const role = (node && node.roleLabel) || (emp && emp.jobRole);
		return (
			<li key={id}>
				{emp ? emp.name : id}
				{role ? `, ${role}` : ''}
				{kids.get(id) ? <ul>{kids.get(id).map(item)}</ul> : null}
			</li>
		);
	};
	return <ul className="sr-only">{layout.roots.map(item)}</ul>;
}

/** One part of the saved reporting tree as a connected hierarchy of circular avatars. Static layout; CSS animations only. */
export function ReportingSlide({ slide, title }) {
	const { model, plan, part, parts } = slide;
	const { layout, k, offsetX, offsetY } = useMemo(() => layoutPart(model, plan), [model, plan]);
	const { stats, team } = model;
	const { nodeW, nodeH } = REPORTING_NODE;
	const first = plan.kind === 'all' || plan.kind === 'overview';
	const rootNames = layout.roots.map(model.nameOf).join(', ');

	const heading = plan.kind === 'branch' ? `${title}: ${rootNames}${layout.roots.length === 1 ? '’s team' : ''}` : parts > 1 ? `${title} (${part} of ${parts})` : title;
	const lead =
		plan.kind === 'branch'
			? `${team.name} · ${plural(layout.pos.size - 1, 'person', 'people')} reporting up to ${rootNames}`
			: `${team.name} · ${plural(stats.mapped, 'person', 'people')} across ${plural(stats.levels, 'reporting level', 'reporting levels')}`;

	const seen = new Map(); // depth -> how many placed so far, for the per-level stagger
	const nodes = [...layout.pos.entries()]
		.sort((a, b) => a[1].depth - b[1].depth || a[1].x - b[1].x)
		.map(([id, p]) => {
			const i = seen.get(p.depth) || 0;
			seen.set(p.depth, i + 1);
			return { id, p, delay: ROOT_AT + p.depth * LEVEL_STEP + Math.min(i * STAGGER, MAX_STAGGER) };
		});
	const lastDelay = Math.max(...nodes.map((n) => n.delay), ROOT_AT) + 700;

	return (
		<SlideFrame kicker="People" title={heading} lead={lead} className="pframe--reporting">
			<div className="rsl" role="group" aria-label={`${heading}. ${lead}`} style={{ width: REPORTING_BODY.w, height: REPORTING_BODY.h }}>
				<Outline model={model} layout={layout} />
				<div className="rsl__stage" aria-hidden="true" style={{ left: offsetX, top: offsetY, width: layout.width, height: layout.height, transform: `scale(${k})` }}>
					<svg className="rsl__edges" width={layout.width} height={layout.height}>
						{layout.edges.map(({ from, to }) => {
							const a = layout.pos.get(from);
							const b = layout.pos.get(to);
							const y1 = a.y + nodeH / 2 - 8;
							const y2 = b.y - nodeH / 2 + 2;
							const mid = (y1 + y2) / 2;
							return <path key={`${from}-${to}`} pathLength="1" className="rsl__edge" style={{ animationDelay: `${ROOT_AT + a.depth * LEVEL_STEP + 260}ms` }} d={`M ${a.x} ${y1} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y2}`} />;
						})}
					</svg>
					{nodes.map(({ id, p, delay }) => {
						const emp = model.byId.get(id);
						const node = model.tree[id];
						const role = (node && node.roleLabel) || (emp && emp.jobRole) || null;
						const hidden = layout.hidden.get(id);
						return (
							<div key={id} className={`rsl-node ${p.depth === 0 ? 'rsl-node--root' : ''}`.trim()} style={{ left: p.x - nodeW / 2, top: p.y - nodeH / 2, width: nodeW, height: nodeH, '--d': `${delay}ms` }}>
								<span className="rsl-avatar">{emp && emp.imageUrl ? <img src={emp.imageUrl} alt="" /> : initialsOf(emp ? emp.name : '')}</span>
								<span className="rsl-node__name" style={{ animationDelay: `${delay + 200}ms` }}>
									{emp ? emp.name : 'Unknown employee'}
								</span>
								{role ? (
									<span className="rsl-node__role" style={{ animationDelay: `${delay + 280}ms` }}>
										{role}
									</span>
								) : null}
								{hidden ? (
									<span className="rsl-node__more" style={{ animationDelay: `${delay + 340}ms` }}>
										+{plural(hidden, 'direct report', 'direct reports')} on a later slide
									</span>
								) : null}
							</div>
						);
					})}
				</div>
			</div>
			{first ? (
				<ul className="rsl-metrics" style={{ animationDelay: `${lastDelay}ms` }}>
					<li>
						<strong>{stats.mapped}</strong> {stats.mapped === 1 ? 'person' : 'people'} mapped
					</li>
					<li>
						<strong>{stats.levels}</strong> reporting {stats.levels === 1 ? 'level' : 'levels'}
					</li>
					{stats.roots > 1 ? (
						<li>
							<strong>{stats.roots}</strong> top-level leaders
						</li>
					) : null}
					{stats.unmapped > 0 ? (
						<li>
							<strong>{stats.unmapped}</strong> not yet mapped
						</li>
					) : null}
				</ul>
			) : null}
		</SlideFrame>
	);
}

/** Shown while the saved structure loads, or when it could not be read: never a made-up hierarchy. */
export function ReportingStateSlide({ slide, title, onRetry }) {
	return (
		<SlideFrame kicker="People" title={title}>
			{slide.state === 'loading' ? (
				<p className="pstate" role="status">
					Loading the reporting structure…
				</p>
			) : (
				<div className="pstate" role="alert">
					<p>The reporting structure could not be loaded{slide.error && slide.error.message ? `: ${slide.error.message}` : '.'}</p>
					{onRetry ? (
						<Button variant="primary" onClick={onRetry}>
							Retry
						</Button>
					) : null}
				</div>
			)}
		</SlideFrame>
	);
}
