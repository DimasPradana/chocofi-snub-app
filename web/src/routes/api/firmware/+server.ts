import { json } from '@sveltejs/kit';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { FIRMWARE_DIR } from '#lib/server/config';

export async function GET() {
	let files: { name: string; size: number; mtime: number }[] = [];
	let history: unknown[] = [];
	try {
		const names = (await readdir(FIRMWARE_DIR)).filter((n) => n.endsWith('.uf2'));
		files = await Promise.all(
			names.map(async (name) => {
				const s = await stat(join(FIRMWARE_DIR, name));
				return { name, size: s.size, mtime: s.mtimeMs };
			})
		);
		files.sort((a, b) => b.mtime - a.mtime);
	} catch {
		/* no firmware yet */
	}
	try {
		history = JSON.parse(await readFile(join(FIRMWARE_DIR, 'builds.json'), 'utf8'));
	} catch {
		/* none */
	}
	return json({ files, history });
}
