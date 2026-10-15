import React from 'react';
import { RiOpenaiFill } from 'react-icons/ri';
import { SiAnthropic, SiClaude, SiCursor, SiFigma, SiGithub, SiGithubcopilot, SiGooglegemini, SiPerplexity } from 'react-icons/si';
import Icon from './Icon';

// Brand glyphs for the tools that appear in AI usage records, matched on the tool name as recorded.
// Unknown tools fall back to the generic sparkles icon (AI) or the category icon.
const BRANDS = [
	{ test: /chat\s*gpt|openai|\bgpt\b/i, glyph: RiOpenaiFill },
	{ test: /claude/i, glyph: SiClaude },
	{ test: /anthropic/i, glyph: SiAnthropic },
	{ test: /figma/i, glyph: SiFigma },
	{ test: /cursor/i, glyph: SiCursor },
	{ test: /copilot/i, glyph: SiGithubcopilot },
	{ test: /gemini/i, glyph: SiGooglegemini },
	{ test: /perplexity/i, glyph: SiPerplexity },
	{ test: /github/i, glyph: SiGithub },
];

export const toolGlyph = (name) => {
	const hit = BRANDS.find((b) => b.test.test(String(name || '')));
	return hit ? hit.glyph : null;
};

/** Small rounded tile with the tool's brand mark, drawn in the theme's text colour (no hardcoded brand colours). */
export default function ToolLogo({ name, size = 28 }) {
	const Glyph = toolGlyph(name);
	return (
		<span className="toollogo" style={{ width: size, height: size }} aria-hidden="true">
			{Glyph ? <Glyph size={Math.round(size * 0.58)} /> : <Icon name="sparkles" size={Math.round(size * 0.58)} />}
		</span>
	);
}
