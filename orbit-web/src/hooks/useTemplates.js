import { importsService } from '../services/importsService';
import useApiResource from './useApiResource';

let cached = null;

/** Field contracts (types, required, enums, immutable) for writable resources. Fetched once per session. */
export default function useTemplates() {
	const res = useApiResource(
		async () => {
			if (cached) return { data: cached };
			const out = await importsService.templates();
			cached = out.data;
			return out;
		},
		'templates'
	);
	const byModule = res.data ? Object.fromEntries(res.data.map((t) => [t.module, t])) : {};
	return { ...res, byModule };
}

export const __resetTemplateCache = () => {
	cached = null;
};
