<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { editor } from '#lib/editor.svelte';

	interface Target {
		board: string;
		shield?: string;
		snippet?: string;
		'cmake-args'?: string;
		artifact: string;
	}
	interface TargetResult {
		artifact: string;
		status: string;
		durationMs?: number;
		file?: string;
		size?: number;
		error?: string;
	}
	interface Job {
		id: string;
		startedAt: number;
		finishedAt?: number;
		status: string;
		pristine: boolean;
		targets: TargetResult[];
	}
	type LogLine = { line: string; stream: string; artifact?: string };

	let targets = $state<Target[]>([]);
	let selected = $state<string[]>([]);
	let manifestInSync = $state(true);
	let builderError = $state<string | null>(null);
	let job = $state<Job | null>(null);
	let log = $state<LogLine[]>([]);
	let pristine = $state(false);
	let onlyErrors = $state(false);
	let autoscroll = $state(true);
	let firmware = $state<{ name: string; size: number; mtime: number }[]>([]);
	let history = $state<Job[]>([]);
	let git = $state<{ available: boolean; branch?: string; changes?: { status: string; path: string }[]; log?: { hash: string; date: string; subject: string }[] } | null>(null);
	let commitMsg = $state('');
	let logEl: HTMLDivElement | undefined = $state();
	let es: EventSource | null = null;

	const running = $derived(job?.status === 'running');
	const shown = $derived(onlyErrors ? log.filter((l) => /error|warning:|✗|⚠|FATAL/i.test(l.line)) : log);

	async function loadTargets() {
		try {
			const r = await fetch('/api/build/targets');
			const d = await r.json();
			if (!r.ok) throw new Error(d.error ?? r.statusText);
			targets = d.targets;
			manifestInSync = d.manifest?.inSync ?? true;
			if (!selected.length) selected = targets.map((t) => t.artifact);
			builderError = null;
		} catch (e) {
			builderError = (e as Error).message;
		}
	}

	async function loadFirmware() {
		const d = await (await fetch('/api/firmware')).json();
		firmware = d.files;
		history = d.history;
	}

	async function loadGit() {
		git = await (await fetch('/api/git')).json();
	}

	function connect() {
		es?.close();
		es = new EventSource('/api/build/events');
		es.addEventListener('job', (e) => {
			const prev = job?.status;
			job = JSON.parse((e as MessageEvent).data);
			if (prev === 'running' && job && job.status !== 'running') {
				loadFirmware();
				editor.notify(job.status === 'success' ? 'Build berhasil — firmware siap diunduh' : `Build ${job.status}`, job.status === 'success' ? 'ok' : 'err');
			}
			editor.buildStatus = job?.status ?? null;
		});
		es.addEventListener('backlog', (e) => {
			log = JSON.parse((e as MessageEvent).data);
			scroll();
		});
		es.addEventListener('log', (e) => {
			log.push(JSON.parse((e as MessageEvent).data));
			if (log.length > 8000) log.splice(0, log.length - 6000);
			scroll();
		});
		es.onerror = () => {
			builderError = 'Koneksi ke builder terputus — mencoba lagi…';
		};
		es.onopen = () => (builderError = null);
	}

	async function scroll() {
		if (!autoscroll) return;
		await tick();
		logEl?.scrollTo({ top: logEl.scrollHeight });
	}

	async function build(only?: string[]) {
		if (editor.dirty || editor.confDirty) {
			const ok = await editor.save();
			if (!ok) return;
		}
		const errs = editor.issues.filter((i) => i.severity === 'error');
		if (errs.length && !confirm(`Ada ${errs.length} error validasi:\n${errs.slice(0, 5).map((e) => '• ' + e.message).join('\n')}\n\nTetap build?`)) return;
		log = [];
		const r = await fetch('/api/build/build', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ targets: only ?? selected, pristine })
		});
		const d = await r.json();
		if (!r.ok) editor.notify(d.error ?? 'Gagal memulai build', 'err');
	}

	async function cancel() {
		await fetch('/api/build/cancel', { method: 'POST' });
	}

	async function commit() {
		const r = await fetch('/api/git', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: commitMsg }) });
		const d = await r.json();
		if (!r.ok) editor.notify(d.message ?? 'Commit gagal', 'err');
		else {
			editor.notify('Commit dibuat. Push dari host: git -C zmk-config push', 'ok');
			commitMsg = '';
		}
		loadGit();
	}

	const fmtSize = (n: number) => `${(n / 1024).toFixed(0)} KiB`;
	const fmtTime = (t: number) => new Date(t).toLocaleString('id');
	const side = (name: string) => (name.includes('left') ? 'kiri' : name.includes('right') ? 'kanan' : name.includes('reset') ? 'reset' : '');

	onMount(() => {
		loadTargets();
		loadFirmware();
		loadGit();
		connect();
	});
	onDestroy(() => es?.close());
</script>

{#if builderError}
	<div class="alert">{builderError}</div>
{/if}
{#if !manifestInSync}
	<div class="alert warn">config/west.yml berbeda dari yang di-bake ke image. Modul baru belum tersedia: jalankan <code>docker compose build zmk</code> (butuh internet sekali).</div>
{/if}

<div class="section-title">Target (build.yaml)</div>
<div class="list">
	{#each targets as t (t.artifact)}
		{@const res = job?.targets.find((x) => x.artifact === t.artifact)}
		<div class="target card">
			<label class="inline">
				<input type="checkbox" checked={selected.includes(t.artifact)} onchange={(e) => (selected = e.currentTarget.checked ? [...selected, t.artifact] : selected.filter((x) => x !== t.artifact))} />
				<b>{t.shield ?? t.board}</b>
				{#if side(t.artifact)}<span class="chip">{side(t.artifact)}</span>{/if}
			</label>
			<div class="muted small mono">{t.board}{t.snippet ? ` · -S ${t.snippet}` : ''}{t['cmake-args'] ? ` · ${t['cmake-args']}` : ''}</div>
			<div class="row">
				{#if res}
					<span class="status {res.status}">{res.status}{res.durationMs ? ` · ${(res.durationMs / 1000).toFixed(0)}s` : ''}</span>
				{/if}
				<span class="grow"></span>
				<button class="small" disabled={running} onclick={() => build([t.artifact])}>Build ini</button>
			</div>
		</div>
	{/each}
</div>

<div class="row actions">
	<label class="inline small" title="Hapus cache build (lebih lama, untuk mengatasi error aneh)"><input type="checkbox" bind:checked={pristine} /> Pristine</label>
	<span class="grow"></span>
	{#if running}
		<button class="danger" onclick={cancel}>■ Batalkan</button>
	{/if}
	<button class="primary" disabled={running || !selected.length || !!builderError} onclick={() => build()}>
		{running ? 'Membangun…' : `▶ Simpan & Build (${selected.length})`}
	</button>
</div>

<div class="row loghead">
	<div class="section-title grow">Log build</div>
	<label class="inline small"><input type="checkbox" bind:checked={onlyErrors} /> Hanya error</label>
	<label class="inline small"><input type="checkbox" bind:checked={autoscroll} /> Auto-scroll</label>
</div>
<div class="log" bind:this={logEl}>
	{#each shown as l, i (i)}
		<div class="ll {l.stream}" class:err={/error|FATAL|✗/i.test(l.line)} class:wrn={/warning:|⚠/i.test(l.line)} class:ok={/^✓|Build selesai: success/.test(l.line)}>{l.line}</div>
	{/each}
	{#if !shown.length}<div class="muted">Belum ada log. Build berjalan offline di container zmk.</div>{/if}
</div>

<div class="section-title">Firmware (.uf2)</div>
<div class="list">
	{#each firmware as f (f.name)}
		<a class="list-item fw" href="/api/firmware/{encodeURIComponent(f.name)}" download>
			<span>⬇</span>
			<b class="grow">{f.name}</b>
			{#if side(f.name)}<span class="chip">{side(f.name)}</span>{/if}
			<span class="muted small">{fmtSize(f.size)} · {fmtTime(f.mtime)}</span>
		</a>
	{/each}
	{#if !firmware.length}<div class="muted small">Belum ada firmware.</div>{/if}
</div>

<details class="guide">
	<summary>Cara flashing (nice!nano v2)</summary>
	<ol>
		<li>Sambungkan sisi <b>kiri</b> via USB, lalu <b>tekan reset 2×</b> dengan cepat. Drive <code>NICENANO</code> akan muncul.</li>
		<li>Salin <code>…left…uf2</code> ke drive tersebut. Keyboard reboot otomatis.</li>
		<li>Ulangi untuk sisi <b>kanan</b> dengan <code>…right…uf2</code>.</li>
		<li>Kalau kedua sisi tidak tersambung: flash <code>settings_reset</code> ke kedua sisi, lalu flash ulang firmware dan reset keduanya hampir bersamaan.</li>
		<li>Setelah settings_reset, hapus/lupakan keyboard di perangkat host lalu pairing ulang.</li>
		<li>Saat charging, slider power harus <b>ON</b> dan indikator biru menyala tetap (tidak berkedip).</li>
	</ol>
</details>

{#if history.length}
	<details class="guide">
		<summary>Riwayat build ({history.length})</summary>
		{#each history.slice(0, 15) as h (h.id)}
			<div class="hist small">
				<span class="status {h.status}">{h.status}</span>
				{fmtTime(h.startedAt)} · {h.targets.map((t) => t.artifact).join(', ')}
				{#if h.finishedAt}· {((h.finishedAt - h.startedAt) / 1000).toFixed(0)}s{/if}
			</div>
		{/each}
	</details>
{/if}

<div class="section-title">Git (zmk-config)</div>
{#if git?.available}
	<div class="small muted">Branch <code>{git.branch}</code> · {git.changes?.length ?? 0} perubahan</div>
	{#each git.changes ?? [] as c (c.path)}
		<div class="small mono">{c.status} {c.path}</div>
	{/each}
	<div class="row commit">
		<input class="grow" placeholder="Pesan commit, mis. feat: tambah combo Esc" bind:value={commitMsg} />
		<button disabled={!commitMsg.trim() || !git.changes?.length} onclick={commit}>Commit</button>
	</div>
	<details class="guide">
		<summary>Commit terakhir</summary>
		{#each git.log ?? [] as l (l.hash)}
			<div class="small"><code>{l.hash}</code> <span class="muted">{l.date}</span> {l.subject}</div>
		{/each}
	</details>
	<div class="muted small">Push ke GitHub (butuh internet) dari host: <code>git -C zmk-config push</code></div>
{:else}
	<div class="muted small">Git tidak tersedia.</div>
{/if}

<style>
	.alert {
		background: color-mix(in srgb, var(--danger) 15%, transparent);
		border: 1px solid var(--danger);
		padding: 8px 10px;
		border-radius: 6px;
		font-size: 12px;
		margin-bottom: 8px;
	}
	.alert.warn {
		background: color-mix(in srgb, var(--warn) 15%, transparent);
		border-color: var(--warn);
	}
	.target {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
	}
	.actions {
		margin-top: 10px;
	}
	.status {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--panel);
	}
	.status.success {
		color: var(--ok);
	}
	.status.failed,
	.status.cancelled {
		color: var(--danger);
	}
	.status.running {
		color: var(--info);
	}
	.status.pending {
		color: var(--text-3);
	}
	.loghead {
		margin-top: 6px;
	}
	.log {
		background: #0b0c0e;
		color: #c9d1d9;
		border: 1px solid var(--border);
		border-radius: 6px;
		height: 280px;
		overflow: auto;
		padding: 6px 8px;
		font-family: var(--mono);
		font-size: 11px;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-all;
	}
	.ll.sys {
		color: #79c0ff;
	}
	.ll.err {
		color: #ff7b72;
	}
	.ll.wrn {
		color: #e3b341;
	}
	.ll.ok {
		color: #56d364;
		font-weight: 700;
	}
	.fw {
		text-decoration: none;
		color: inherit;
	}
	.guide {
		margin-top: 10px;
		font-size: 13px;
	}
	.guide summary {
		cursor: pointer;
		font-weight: 600;
	}
	.guide ol {
		padding-left: 20px;
		line-height: 1.6;
	}
	.hist {
		padding: 2px 0;
	}
	.commit {
		margin: 6px 0;
	}
	.small {
		font-size: 11px;
	}
	button.small {
		padding: 2px 8px;
	}
</style>
