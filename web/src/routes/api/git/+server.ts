import { error, json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { CONFIG_DIR } from '#lib/server/config';

function git(args: string[]): Promise<{ code: number; out: string; err: string }> {
	return new Promise((res) => {
		const p = spawn('git', args, { cwd: CONFIG_DIR });
		let out = '',
			err = '';
		p.stdout.on('data', (d) => (out += d));
		p.stderr.on('data', (d) => (err += d));
		p.on('close', (code) => res({ code: code ?? 1, out, err }));
		p.on('error', (e) => res({ code: 1, out, err: String(e) }));
	});
}

export async function GET({ url }) {
	const file = url.searchParams.get('diff');
	if (file) {
		const d = await git(['diff', '--', file]);
		return json({ diff: d.out });
	}
	const [status, log, branch] = await Promise.all([
		git(['status', '--porcelain']),
		git(['log', '--pretty=format:%h%x09%ad%x09%s', '--date=short', '-n', '10']),
		git(['rev-parse', '--abbrev-ref', 'HEAD'])
	]);
	if (status.code !== 0) return json({ available: false, error: status.err });
	return json({
		available: true,
		branch: branch.out.trim(),
		changes: status.out
			.split('\n')
			.filter(Boolean)
			.map((l) => ({ status: l.slice(0, 2).trim(), path: l.slice(3) })),
		log: log.out
			.split('\n')
			.filter(Boolean)
			.map((l) => {
				const [hash, date, subject] = l.split('\t');
				return { hash, date, subject };
			})
	});
}

export async function POST({ request }) {
	const { message, files } = (await request.json()) as { message?: string; files?: string[] };
	if (!message?.trim()) error(400, 'pesan commit wajib diisi');
	const add = await git(['add', '--', ...(files?.length ? files : ['.'])]);
	if (add.code !== 0) error(500, add.err);
	const c = await git(['commit', '-m', message.trim()]);
	if (c.code !== 0) error(500, c.err || c.out);
	return json({ ok: true, output: c.out });
}
