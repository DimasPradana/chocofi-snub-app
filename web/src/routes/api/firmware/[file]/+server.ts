import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { FIRMWARE_DIR } from '#lib/server/config';

export async function GET({ params }) {
	const name = basename(params.file);
	if (!name.endsWith('.uf2')) error(400, 'hanya file .uf2');
	try {
		const data = await readFile(join(FIRMWARE_DIR, name));
		return new Response(data, {
			headers: {
				'content-type': 'application/octet-stream',
				'content-disposition': `attachment; filename="${name}"`
			}
		});
	} catch {
		error(404, 'firmware tidak ditemukan');
	}
}
