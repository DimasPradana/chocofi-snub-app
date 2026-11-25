import { json } from '@sveltejs/kit';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { CONFIG_DIR } from '#lib/server/config';

async function walk(dir: string, out: { path: string; size: number; mtime: number }[]) {
	for (const e of await readdir(dir, { withFileTypes: true })) {
		if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'docs') continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) await walk(p, out);
		else if (/\.(keymap|conf|ya?ml|json|dtsi|overlay)$/.test(e.name)) {
			const s = await stat(p);
			out.push({ path: relative(CONFIG_DIR, p), size: s.size, mtime: s.mtimeMs });
		}
	}
}

export async function GET() {
	const files: { path: string; size: number; mtime: number }[] = [];
	await walk(CONFIG_DIR, files);
	files.sort((a, b) => a.path.localeCompare(b.path));
	return json({ root: CONFIG_DIR, files });
}
