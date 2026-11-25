import { error, json, text } from '@sveltejs/kit';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { safePath } from '#lib/server/config';

export async function GET({ url }) {
	let p: string;
	try {
		p = safePath(url.searchParams.get('path'));
	} catch (e) {
		error(400, String((e as Error).message));
	}
	try {
		const [content, s] = await Promise.all([readFile(p, 'utf8'), stat(p)]);
		return json({ content, mtime: s.mtimeMs });
	} catch {
		error(404, 'file tidak ditemukan');
	}
}

export async function PUT({ url, request }) {
	let p: string;
	try {
		p = safePath(url.searchParams.get('path'));
	} catch (e) {
		error(400, String((e as Error).message));
	}
	const body = (await request.json()) as { content: string; expectedMtime?: number };
	if (typeof body.content !== 'string') error(400, 'content wajib string');
	// optimistic concurrency: refuse if the file changed on disk since it was loaded
	if (body.expectedMtime) {
		try {
			const s = await stat(p);
			if (Math.abs(s.mtimeMs - body.expectedMtime) > 1) error(409, 'File berubah di disk sejak dimuat. Muat ulang dulu.');
		} catch (e) {
			if ((e as { status?: number }).status === 409) throw e;
		}
	}
	await writeFile(p, body.content, 'utf8');
	const s = await stat(p);
	return json({ ok: true, mtime: s.mtimeMs });
}

export const fallback = () => text('method not allowed', { status: 405 });
