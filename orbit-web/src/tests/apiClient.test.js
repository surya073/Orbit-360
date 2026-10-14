import { api, ApiClientError, toQuery } from '../services/apiClient';

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

afterEach(() => {
	delete global.fetch;
});

test('toQuery drops empty values', () => {
	expect(toQuery({ a: 1, b: '', c: undefined, d: 'x y' })).toBe('?a=1&d=x+y');
});

test('success unwraps data/meta and sends credentials', async () => {
	global.fetch = jest.fn(() => json(200, { ok: true, data: [1], meta: { total: 1 } }));
	const out = await api.get('/data/employees', { params: { page: 2 } });
	expect(out).toEqual({ data: [1], meta: { total: 1 } });
	const [url, init] = global.fetch.mock.calls[0];
	expect(url).toBe('/server/orbit_funtion/api/v1/data/employees?page=2');
	expect(init.credentials).toBe('include');
	expect(init.headers.Authorization).toBeUndefined();
});

test('identical in-flight GETs share one request', async () => {
	global.fetch = jest.fn(() => json(200, { ok: true, data: [] }));
	await Promise.all([api.get('/me'), api.get('/me')]);
	expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('error contract maps to ApiClientError with field errors', async () => {
	global.fetch = jest.fn(() => json(422, { ok: false, requestId: 'r1', error: { code: 'VALIDATION_FAILED', message: 'bad', details: [{ field: 'work_date', message: 'Required' }] } }));
	const err = await api.post('/data/time_entries', {}).catch((e) => e);
	expect(err).toBeInstanceOf(ApiClientError);
	expect(err.status).toBe(422);
	expect(err.fieldErrors).toEqual({ work_date: 'Required' });
	expect(err.requestId).toBe('r1');
});

test('network and non-JSON failures become explicit errors', async () => {
	global.fetch = jest.fn(() => Promise.reject(new TypeError('failed')));
	await expect(api.post('/x', {})).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
	global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('html')) }));
	await expect(api.post('/x', {})).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
});
