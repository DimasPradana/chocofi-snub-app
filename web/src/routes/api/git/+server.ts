import { error, json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { CONFIG_DIR, CONFIG_PATHS } from '#lib/server/config';

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
	// the repo also holds the app: scope status/commit to the config paths
	const [status, log, branch, prefix] = await Promise.all([
		git(['status', '--porcelain', '--', ...CONFIG_PATHS]),
		git(['log', '--pretty=format:%h%x09%ad%x09%s', '--date=short', '-n', '10']),
		git(['rev-parse', '--abbrev-ref', 'HEAD']),
		git(['rev-parse', '--show-prefix'])
	]);
	const pre = prefix.out.trim();
	if (status.code !== 0) return json({ available: false, error: status.err });
	return json({
		available: true,
		branch: branch.out.trim(),
		changes: status.out
			.split('\n')
			.filter(Boolean)
			.map((l) => {
				const path = l.slice(3);
				return { status: l.slice(0, 2).trim(), path: path.startsWith(pre) ? path.slice(pre.length) : path };
			}),
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
	const paths = files?.length ? files : CONFIG_PATHS;
	const add = await git(['add', '--', ...paths]);
	if (add.code !== 0) error(500, add.err);
	// pathspec keeps the commit limited to the config even if other files are staged
	const c = await git(['commit', '-m', message.trim(), '--', ...paths]);
	if (c.code !== 0) error(500, c.err || c.out);
	return json({ ok: true, output: c.out });
}
