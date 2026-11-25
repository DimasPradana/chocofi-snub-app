import { error } from '@sveltejs/kit';
import { BUILDER_URL } from '#lib/server/config';

const ALLOWED = new Set(['targets', 'status', 'build', 'cancel', 'events', 'health']);

async function proxy(action: string, init?: RequestInit) {
	if (!ALLOWED.has(action)) error(404, 'unknown action');
	try {
		const res = await fetch(`${BUILDER_URL}/${action}`, init);
		return new Response(res.body, {
			status: res.status,
			headers: {
				'content-type': res.headers.get('content-type') ?? 'application/json',
				'cache-control': 'no-cache'
			}
		});
	} catch {
		return new Response(JSON.stringify({ error: `Builder tidak bisa dihubungi di ${BUILDER_URL}. Jalankan: docker compose up zmk` }), {
			status: 503,
			headers: { 'content-type': 'application/json' }
		});
	}
}

export const GET = ({ params, request }) => proxy(params.action, { signal: request.signal });
export const POST = async ({ params, request }) =>
	proxy(params.action, { method: 'POST', body: await request.text(), headers: { 'content-type': 'application/json' } });
