import React from 'react';
import { CANVAS_H, CANVAS_W, FONT_STACKS, colorCss } from './slideModel';

/**
 * Draws one free-form slide on the 1920x1080 canvas: the same component serves the player, the editor and the
 * thumbnails. Objects are positioned in canvas units (the host scales the whole canvas). Each object has three layers so
 * effects never fight: the box (position, rotation), the entrance animation, and the hover effect.
 *
 *   step      how many "on click" reveals have happened (objects with anim.step > step stay hidden); default: all shown
 *   animate   play entrance animations (off in thumbnails)
 *   editing   links are inert and empty pictures show a placeholder
 *   hiddenId  an object being edited in place (drawn by the editor instead)
 *   renderWidget(o)  draws live-data widgets; without it a widget shows a labelled box
 *   onJump(n)  an in-deck link (#slide-N) was followed
 */
function bgStyle(bg) {
	if (!bg || bg.kind === 'theme') return undefined;
	if (bg.kind === 'gradient') return { background: `linear-gradient(${bg.angle ?? 135}deg, ${colorCss(bg.color, '#111')}, ${colorCss(bg.color2, '#333')})` };
	return { background: colorCss(bg.color, '#111') };
}

const textStyle = (o) => {
	const s = o.st || {};
	return {
		fontSize: `${s.fs ?? 40}px`,
		fontWeight: s.fw ?? 500,
		fontStyle: s.it ? 'italic' : undefined,
		textDecoration: s.ul ? 'underline' : undefined,
		textAlign: s.al || 'left',
		color: colorCss(s.color, 'var(--text)'),
		fontFamily: FONT_STACKS[s.ff] || undefined,
		lineHeight: s.lh ?? 1.2,
		letterSpacing: s.ls ? `${s.ls}px` : undefined,
		justifyContent: s.va === 'middle' ? 'center' : s.va === 'bottom' ? 'flex-end' : 'flex-start',
		textShadow: s.sh ? '0 4px 24px rgb(0 0 0 / 0.45)' : undefined,
	};
};

function shapeStyle(o) {
	const s = o.st || {};
	const fill = s.fill2 ? `linear-gradient(135deg, ${colorCss(s.fill, 'transparent')}, ${colorCss(s.fill2, 'transparent')})` : colorCss(s.fill, 'transparent');
	return {
		background: o.shape === 'line' ? colorCss(s.fill, 'var(--text)') : fill,
		opacity: s.op ?? 1,
		borderRadius: o.shape === 'ellipse' ? '50%' : o.shape === 'pill' ? '999px' : `${s.r ?? 0}px`,
		border: s.bw ? `${s.bw}px solid ${colorCss(s.bc, 'transparent')}` : undefined,
		clipPath: o.shape === 'triangle' ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined,
	};
}

function Content({ o, editing, renderWidget }) {
	const s = o.st || {};
	switch (o.kind) {
		case 'text':
			return (
				<div className="sx__text" style={textStyle(o)}>
					<span>{o.text}</span>
				</div>
			);
		case 'shape':
			return <div className={`sx__shape sx__shape--${o.shape || 'rect'}`} style={shapeStyle(o)} />;
		case 'button':
			return (
				<div className="sx__button" style={{ ...textStyle(o), background: colorCss(s.fill, 'var(--accent)'), borderRadius: `${s.r ?? 999}px`, justifyContent: 'center' }}>
					<span>{o.text}</span>
				</div>
			);
		case 'image':
			return o.src ? (
				<img className="sx__image" src={o.src} alt={o.alt || ''} draggable="false" style={{ objectFit: o.fit || 'cover', borderRadius: `${s.r ?? 0}px` }} />
			) : editing ? (
				<div className="sx__image sx__image--empty" style={{ borderRadius: `${s.r ?? 0}px` }}>
					Add a picture link
				</div>
			) : null;
		case 'widget':
			return renderWidget ? renderWidget(o) : <div className="sx__widget-ph">{o.widget ? `${o.widget.type}: ${o.widget.metric}` : 'Data widget'}</div>;
		default:
			return null;
	}
}

function LinkWrap({ o, editing, onJump, children }) {
	if (!o.link || editing) return children;
	const m = /^#slide-(\d+)$/.exec(o.link);
	if (m) {
		return (
			<a className="sx__link" href={o.link} onClick={(e) => { e.preventDefault(); if (onJump) onJump(Number(m[1]) - 1); }}>
				{children}
			</a>
		);
	}
	return (
		<a className="sx__link" href={o.link} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	);
}

function SlideObject({ o, step, animate, editing, hiddenId, renderWidget, onJump }) {
	const anim = o.anim && o.anim.in && o.anim.in !== 'none' ? o.anim : null;
	const revealed = !anim || !anim.step || editing || step >= anim.step;
	const box = { left: o.x, top: o.y, width: o.w, height: o.h, transform: o.rot ? `rotate(${o.rot}deg)` : undefined, opacity: hiddenId === o.id ? 0 : undefined, visibility: revealed ? undefined : 'hidden' };
	const animStyle = anim && animate && !editing ? { animationDelay: `${anim.delay || 0}ms`, animationDuration: `${anim.dur || 600}ms` } : undefined;
	const animClass = anim && animate && !editing && revealed ? `sx-in sx-in--${anim.in}` : '';
	return (
		<div className={`sx__obj sx__obj--${o.kind}`} style={box} data-oid={o.id}>
			<div className={`sx__anim ${animClass}`.trim()} style={animStyle} key={revealed ? 'on' : 'off'}>
				<div className={`sx__fx ${o.hover && o.hover !== 'none' && !editing ? `sx-hv sx-hv--${o.hover}` : ''}`.trim()}>
					<LinkWrap o={o} editing={editing} onJump={onJump}>
						<Content o={o} editing={editing} renderWidget={renderWidget} />
					</LinkWrap>
				</div>
			</div>
		</div>
	);
}

export default function SlideCanvas({ slide, step = Infinity, animate = true, editing = false, hiddenId = null, renderWidget, onJump, className = '' }) {
	return (
		<div className={`sx ${className}`.trim()} style={{ width: CANVAS_W, height: CANVAS_H, ...bgStyle(slide.bg) }}>
			{(slide.objects || []).map((o) => (
				<SlideObject key={o.id} o={o} step={step} animate={animate} editing={editing} hiddenId={hiddenId} renderWidget={renderWidget} onJump={onJump} />
			))}
		</div>
	);
}
