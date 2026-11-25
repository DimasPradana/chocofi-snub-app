/**
 * ZMK build service.
 *
 * Reads <ZMK_CONFIG_DIR>/build.yaml (same format as the GitHub Actions matrix),
 * runs `west build` for the requested targets and writes UF2 files to FIRMWARE_DIR.
 * Logs are streamed to clients via Server-Sent Events.
 */
import { spawn, type Subprocess } from 'bun';
import { mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG_DIR = process.env.ZMK_CONFIG_DIR ?? '/zmk-config';
const FIRMWARE_DIR = process.env.FIRMWARE_DIR ?? '/firmware';
const CACHE_DIR = process.env.BUILD_CACHE_DIR ?? '/build-cache';
const WORKSPACE = process.env.WEST_WORKSPACE ?? '/workspace';
const PORT = Number(process.env.PORT ?? 8080);

interface Target {
	board: string;
	shield?: string;
	snippet?: string;
	'cmake-args'?: string;
	'artifact-name'?: string;
	artifact: string;
}

interface TargetResult {
	artifact: string;
	status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
	durationMs?: number;
	file?: string;
	size?: number;
	error?: string;
}

interface Job {
	id: string;
	startedAt: number;
	finishedAt?: number;
	status: 'running' | 'success' | 'failed' | 'cancelled';
	pristine: boolean;
	targets: TargetResult[];
}

type LogEvent = { type: 'log'; line: string; artifact?: string; stream: 'out' | 'err' | 'sys' };

const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();
let currentJob: Job | null = null;
let currentProc: Subprocess | null = null;
let cancelRequested = false;
let logBuffer: LogEvent[] = [];

function broadcast(event: string, data: unknown) {
	const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
	for (const c of clients) {
		try {
			c.enqueue(payload);
		} catch {
			clients.delete(c);
		}
	}
}

function log(line: string, stream: LogEvent['stream'] = 'sys', artifact?: string) {
	const ev: LogEvent = { type: 'log', line, stream, artifact };
	logBuffer.push(ev);
	if (logBuffer.length > 20000) logBuffer = logBuffer.slice(-15000);
	broadcast('log', ev);
}

function artifactName(t: Omit<Target, 'artifact'>): string {
	if (t['artifact-name']) return t['artifact-name'];
	const shield = t.shield ? `${t.shield.replace(/ /g, '-')}-` : '';
	return `${shield}${t.board}-zmk`.replace(/[/@]/g, '_');
}

async function loadTargets(): Promise<Target[]> {
	const raw = await readFile(join(CONFIG_DIR, 'build.yaml'), 'utf8');
	const doc = (Bun.YAML.parse(raw) ?? {}) as Record<string, any>;
	const out: Omit<Target, 'artifact'>[] = [];
	const boards: string[] = doc.board ?? [];
	const shields: string[] = doc.shield ?? [];
	for (const b of boards) {
		if (shields.length) for (const s of shields) out.push({ board: b, shield: s });
		else out.push({ board: b });
	}
	for (const inc of doc.include ?? []) out.push({ ...inc });
	return out.map((t) => ({ ...t, artifact: artifactName(t) }));
}

async function westManifestStatus() {
	try {
		const [baked, current] = await Promise.all([
			readFile(join(WORKSPACE, '.baked-west.yml'), 'utf8'),
			readFile(join(CONFIG_DIR, 'config', 'west.yml'), 'utf8')
		]);
		return { inSync: baked.trim() === current.trim() };
	} catch (e) {
		return { inSync: false, error: String(e) };
	}
}

async function pipe(stream: ReadableStream<Uint8Array> | null, kind: 'out' | 'err', artifact: string) {
	if (!stream) return;
	const decoder = new TextDecoder();
	let buf = '';
	for await (const chunk of stream) {
		buf += decoder.decode(chunk, { stream: true });
		let idx;
		while ((idx = buf.indexOf('\n')) >= 0) {
			log(buf.slice(0, idx).replace(/\r$/, ''), kind, artifact);
			buf = buf.slice(idx + 1);
		}
	}
	if (buf) log(buf, kind, artifact);
}

async function buildTarget(t: Target, pristine: boolean, result: TargetResult) {
	const buildDir = join(CACHE_DIR, t.artifact);
	const args = ['build', '-s', 'zmk/app', '-d', buildDir, '-b', t.board];
	if (pristine) args.push('-p', 'always');
	if (t.snippet) args.push('-S', t.snippet);
	args.push('--', `-DZMK_CONFIG=${join(CONFIG_DIR, 'config')}`, `-DUSER_CACHE_DIR=${join(CACHE_DIR, '.zephyr-cache')}`);
	if (t.shield) args.push(`-DSHIELD=${t.shield}`);
	try {
		await stat(join(CONFIG_DIR, 'zephyr', 'module.yml'));
		args.push(`-DZMK_EXTRA_MODULES=${CONFIG_DIR}`);
	} catch {
		/* no local module */
	}
	if (t['cmake-args']) args.push(...t['cmake-args'].split(/\s+/).filter(Boolean));

	log(`$ west ${args.join(' ')}`, 'sys', t.artifact);
	const started = Date.now();
	result.status = 'running';
	broadcast('job', currentJob);

	const proc = spawn(['west', ...args], { cwd: WORKSPACE, stdout: 'pipe', stderr: 'pipe' });
	currentProc = proc;
	await Promise.all([pipe(proc.stdout, 'out', t.artifact), pipe(proc.stderr, 'err', t.artifact)]);
	const code = await proc.exited;
	currentProc = null;
	result.durationMs = Date.now() - started;

	if (cancelRequested) {
		result.status = 'cancelled';
		return;
	}
	if (code !== 0) {
		result.status = 'failed';
		result.error = `west exited with code ${code}`;
		log(`✗ ${t.artifact} gagal (exit ${code})`, 'sys', t.artifact);
		return;
	}
	const src = join(buildDir, 'zephyr', 'zmk.uf2');
	const dest = join(FIRMWARE_DIR, `${t.artifact}.uf2`);
	await copyFile(src, dest);
	const s = await stat(dest);
	result.status = 'success';
	result.file = `${t.artifact}.uf2`;
	result.size = s.size;
	log(`✓ ${t.artifact} → ${result.file} (${(s.size / 1024).toFixed(1)} KiB, ${(result.durationMs / 1000).toFixed(1)} s)`, 'sys', t.artifact);
}

async function appendHistory(job: Job) {
	const file = join(FIRMWARE_DIR, 'builds.json');
	let history: Job[] = [];
	try {
		history = JSON.parse(await readFile(file, 'utf8'));
	} catch {
		/* first build */
	}
	history.unshift(job);
	await writeFile(file, JSON.stringify(history.slice(0, 50), null, 2));
}

async function runJob(selected: Target[], pristine: boolean) {
	cancelRequested = false;
	logBuffer = [];
	currentJob = {
		id: crypto.randomUUID(),
		startedAt: Date.now(),
		status: 'running',
		pristine,
		targets: selected.map((t) => ({ artifact: t.artifact, status: 'pending' }))
	};
	broadcast('job', currentJob);
	await mkdir(FIRMWARE_DIR, { recursive: true });
	await mkdir(CACHE_DIR, { recursive: true });

	const manifest = await westManifestStatus();
	if (!manifest.inSync) {
		log('⚠ config/west.yml berbeda dari versi yang di-bake ke image. Modul baru tidak akan ada sampai image di-build ulang: docker compose build zmk', 'sys');
	}

	for (let i = 0; i < selected.length; i++) {
		const res = currentJob.targets[i];
		if (cancelRequested) {
			res.status = 'cancelled';
			continue;
		}
		try {
			await buildTarget(selected[i], pristine, res);
		} catch (e) {
			res.status = 'failed';
			res.error = String(e);
			log(`✗ ${selected[i].artifact}: ${e}`, 'sys', selected[i].artifact);
		}
		broadcast('job', currentJob);
	}
	const statuses = currentJob.targets.map((t) => t.status);
	currentJob.status = cancelRequested
		? 'cancelled'
		: statuses.every((s) => s === 'success')
			? 'success'
			: 'failed';
	currentJob.finishedAt = Date.now();
	log(`Build selesai: ${currentJob.status} dalam ${((currentJob.finishedAt - currentJob.startedAt) / 1000).toFixed(1)} s`, 'sys');
	broadcast('job', currentJob);
	await appendHistory(currentJob);
}

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

Bun.serve({
	port: PORT,
	idleTimeout: 0,
	async fetch(req) {
		const url = new URL(req.url);
		try {
			if (url.pathname === '/health') return json({ ok: true });

			if (url.pathname === '/targets') {
				return json({ targets: await loadTargets(), manifest: await westManifestStatus() });
			}

			if (url.pathname === '/status') {
				return json({ job: currentJob, running: currentJob?.status === 'running' });
			}

			if (url.pathname === '/build' && req.method === 'POST') {
				if (currentJob?.status === 'running') return json({ error: 'Build sedang berjalan' }, 409);
				const body = (await req.json().catch(() => ({}))) as { targets?: string[]; pristine?: boolean };
				const all = await loadTargets();
				const selected = body.targets?.length ? all.filter((t) => body.targets!.includes(t.artifact)) : all;
				if (!selected.length) return json({ error: 'Tidak ada target yang cocok' }, 400);
				runJob(selected, !!body.pristine);
				return json({ ok: true, targets: selected.map((t) => t.artifact) }, 202);
			}

			if (url.pathname === '/cancel' && req.method === 'POST') {
				if (currentJob?.status !== 'running') return json({ ok: false });
				cancelRequested = true;
				currentProc?.kill();
				log('Build dibatalkan oleh pengguna', 'sys');
				return json({ ok: true });
			}

			if (url.pathname === '/events') {
				let ctrl: ReadableStreamDefaultController<Uint8Array>;
				const stream = new ReadableStream<Uint8Array>({
					start(c) {
						ctrl = c;
						clients.add(c);
						c.enqueue(encoder.encode(`event: job\ndata: ${JSON.stringify(currentJob)}\n\n`));
						c.enqueue(encoder.encode(`event: backlog\ndata: ${JSON.stringify(logBuffer)}\n\n`));
					},
					cancel() {
						clients.delete(ctrl);
					}
				});
				return new Response(stream, {
					headers: {
						'content-type': 'text/event-stream',
						'cache-control': 'no-cache',
						connection: 'keep-alive'
					}
				});
			}
			return json({ error: 'not found' }, 404);
		} catch (e) {
			return json({ error: String(e) }, 500);
		}
	}
});

// keep SSE connections alive through proxies
setInterval(() => {
	const ping = encoder.encode(`: ping\n\n`);
	for (const c of clients) {
		try {
			c.enqueue(ping);
		} catch {
			clients.delete(c);
		}
	}
}, 15000);

console.log(`ZMK builder listening on :${PORT}`);
