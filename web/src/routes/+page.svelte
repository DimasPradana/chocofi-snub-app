<script lang="ts">
	import { onMount } from 'svelte';
	import { editor, type SideTab } from '#lib/editor.svelte';
	import { describe } from '#lib/keymap/describe';
	import { convertKeymap } from '#lib/keymap/ops';
	import { newLayer, type Binding } from '#lib/keymap/model';
	import { CATEGORY_INFO, type BehaviorCategory } from '#lib/zmk/behaviors';
	import { LAYOUTS, type LayoutSize } from '#lib/zmk/layouts';
	import { layerColor } from '#lib/layerColors';
	import Keyboard from '#lib/components/Keyboard.svelte';
	import KeyPanel from '#lib/components/KeyPanel.svelte';
	import LayersPanel from '#lib/components/LayersPanel.svelte';
	import CombosPanel from '#lib/components/CombosPanel.svelte';
	import MacrosPanel from '#lib/components/MacrosPanel.svelte';
	import BehaviorsPanel from '#lib/components/BehaviorsPanel.svelte';
	import ConfPanel from '#lib/components/ConfPanel.svelte';
	import BuildPanel from '#lib/components/BuildPanel.svelte';
	import SourcePanel from '#lib/components/SourcePanel.svelte';
	import IssuesPanel from '#lib/components/IssuesPanel.svelte';

	onMount(() => {
		editor.init().catch((e) => editor.notify(String(e), 'err'));
		const before = (e: BeforeUnloadEvent) => {
			if (editor.dirty || editor.confDirty) e.preventDefault();
		};
		window.addEventListener('beforeunload', before);
		return () => window.removeEventListener('beforeunload', before);
	});

	$effect(() => {
		document.documentElement.dataset.theme = editor.theme;
	});

	const km = $derived(editor.km);
	const ctx = $derived(editor.ctx);
	const keymaps = $derived(editor.files.filter((f) => f.path.endsWith('.keymap')));
	const counts = $derived({
		error: editor.issues.filter((i) => i.severity === 'error').length,
		warning: editor.issues.filter((i) => i.severity === 'warning').length,
		info: editor.issues.filter((i) => i.severity === 'info').length
	});

	const searchHits = $derived.by(() => {
		const q = editor.search.trim().toLowerCase();
		if (!q || !km || !ctx) return [];
		const hits: { layer: number; pos: number }[] = [];
		km.layers.forEach((l, li) =>
			l.bindings.forEach((b, pos) => {
				const raw = [b.behavior, ...b.params].join(' ').toLowerCase();
				const f = describe(b, ctx);
				if (raw.includes(q) || f.tap.toLowerCase() === q || (f.hold ?? '').toLowerCase() === q) hits.push({ layer: li, pos });
			})
		);
		return hits;
	});
	const hitsByLayer = $derived(searchHits.reduce((m, h) => m.set(h.layer, (m.get(h.layer) ?? 0) + 1), new Map<number, number>()));

	const legend = $derived.by(() => {
		if (!km || !ctx) return [];
		const m = new Map<BehaviorCategory, number>();
		for (const b of km.layers[editor.layer]?.bindings ?? []) {
			const c = describe(b, ctx).category;
			m.set(c, (m.get(c) ?? 0) + 1);
		}
		return [...m.entries()].sort((a, b) => b[1] - a[1]);
	});

	const tabs: { id: SideTab; label: string }[] = [
		{ id: 'key', label: 'Tombol' },
		{ id: 'layers', label: 'Layer' },
		{ id: 'combos', label: 'Combo' },
		{ id: 'macros', label: 'Macro' },
		{ id: 'behaviors', label: 'Behavior' },
		{ id: 'conf', label: 'Config' },
		{ id: 'build', label: 'Build' },
		{ id: 'source', label: 'Source' },
		{ id: 'issues', label: 'Validasi' }
	];

	function setView(v: LayoutSize) {
		editor.view = v;
		editor.savePrefs();
	}

	function convert(to: LayoutSize) {
		if (!km) return;
		const preview = $state.snapshot(km);
		const report = convertKeymap(preview as typeof km, to);
		const lines = [
			`Konversi file keymap ke ${to} posisi?`,
			'',
			`• Semua layer diubah ke ${to} binding`,
			`• Posisi combo & hold-trigger-key-positions dipetakan ulang`,
			to === 36 ? '• Ditambahkan chosen { zmk,physical-layout = &foostan_corne_5col_layout; }' : '• chosen physical-layout 5 kolom dihapus (kembali ke default 6 kolom)'
		];
		if (report.droppedBindings.length) lines.push('', `⚠ ${report.droppedBindings.length} binding di kolom luar akan HILANG:`, ...report.droppedBindings.slice(0, 8));
		if (report.droppedCombos.length) lines.push('', `⚠ ${report.droppedCombos.length} combo memakai kolom luar dan akan DIHAPUS:`, ...report.droppedCombos.slice(0, 8));
		if (!confirm(lines.join('\n'))) return;
		editor.mutate((k) => convertKeymap(k, to));
		editor.view = to;
		editor.selected = null;
		editor.notify(`Keymap dikonversi ke ${to} posisi. Bisa di-undo (Ctrl+Z).`, 'ok');
	}

	function addLayer() {
		editor.mutate((k) => {
			const n = k.layers.length;
			k.layers.push(newLayer(`layer_${n}`, k.layers[0]?.bindings.length ?? editor.size, `L${n}`));
		});
		editor.layer = (km?.layers.length ?? 1) - 1;
		editor.tab = 'layers';
	}

	let clip: Binding | null = null;

	function moveSel(dx: number, dy: number) {
		if (editor.selected === null) return;
		const keys = LAYOUTS[editor.size].keys;
		const cur = keys[editor.selected];
		let best = -1,
			bestD = Infinity;
		keys.forEach((k, i) => {
			const vx = k.x - cur.x,
				vy = k.y - cur.y;
			if ((dx && Math.sign(vx) !== dx) || (dy && Math.sign(vy) !== dy)) return;
			if (dx && Math.abs(vx) < 50) return;
			if (dy && Math.abs(vy) < 50) return;
			const d = dx ? Math.abs(vx) + Math.abs(vy) * 3 : Math.abs(vy) + Math.abs(vx) * 3;
			if (d < bestD) (bestD = d), (best = i);
		});
		if (best >= 0 && editor.viewIndex(best) !== undefined) editor.selected = best;
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.key.toLowerCase() === 's') {
			e.preventDefault();
			editor.save();
			return;
		}
		if (typing) return;
		if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) (e.preventDefault(), editor.undo());
		else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) (e.preventDefault(), editor.redo());
		else if (e.altKey && /^[0-9]$/.test(e.key)) {
			const n = Number(e.key);
			if (km && n < km.layers.length) editor.layer = n;
		} else if (e.key === 'Escape') {
			editor.pick = null;
			editor.selected = null;
		} else if (editor.selected !== null && km) {
			const pos = editor.selected;
			if (e.key === 'Delete' || e.key === 'Backspace') editor.setBinding(editor.layer, pos, { behavior: '&trans', params: [] });
			else if (mod && e.key.toLowerCase() === 'c') clip = structuredClone($state.snapshot(km.layers[editor.layer].bindings[pos]));
			else if (mod && e.key.toLowerCase() === 'v' && clip) editor.setBinding(editor.layer, pos, structuredClone(clip));
			else if (e.key === 'ArrowLeft') (e.preventDefault(), moveSel(-1, 0));
			else if (e.key === 'ArrowRight') (e.preventDefault(), moveSel(1, 0));
			else if (e.key === 'ArrowUp') (e.preventDefault(), moveSel(0, -1));
			else if (e.key === 'ArrowDown') (e.preventDefault(), moveSel(0, 1));
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="app">
	<header>
		<div class="brand">
			<span class="logo">◧◨</span>
			<div>
				<div class="name">Snub Keymap</div>
				<div class="tag">Chocofi · ZMK v0.3 · offline</div>
			</div>
		</div>

		<select class="file" value={editor.keymapPath} onchange={(e) => {
			if ((editor.dirty || editor.confDirty) && !confirm('Ada perubahan belum disimpan. Tetap ganti file?')) return (e.currentTarget.value = editor.keymapPath);
			editor.loadKeymap(e.currentTarget.value);
		}} aria-label="File keymap">
			{#each keymaps as f (f.path)}<option value={f.path}>{f.path}</option>{/each}
		</select>

		<div class="seg" role="group" aria-label="Tampilan layout">
			{#each [42, 36] as v (v)}
				<button class:active={editor.view === v} onclick={() => setView(v as LayoutSize)} title={LAYOUTS[v as LayoutSize].name}>{v}</button>
			{/each}
		</div>

		<div class="row">
			<button class="ghost" disabled={!editor.canUndo} onclick={() => editor.undo()} title="Undo (Ctrl+Z)">↶</button>
			<button class="ghost" disabled={!editor.canRedo} onclick={() => editor.redo()} title="Redo (Ctrl+Y)">↷</button>
		</div>

		<div class="search">
			<input type="search" placeholder="Cari tombol: A, BSPC, &mt, BT…" bind:value={editor.search} aria-label="Cari keycode" />
			{#if editor.search}<span class="hits">{searchHits.length} hasil</span>{/if}
		</div>

		<div class="row toggles">
			<button class="ghost" class:active={editor.showCombos} onclick={() => ((editor.showCombos = !editor.showCombos), editor.savePrefs())} title="Overlay combo">⊕ Combo</button>
			<button class="ghost" class:active={editor.showPositions} onclick={() => (editor.showPositions = !editor.showPositions)} title="Nomor posisi tombol">#</button>
			<button class="ghost" onclick={() => ((editor.theme = editor.theme === 'dark' ? 'light' : 'dark'), editor.savePrefs())} title="Tema">{editor.theme === 'dark' ? '☾' : '☀'}</button>
		</div>

		<span class="grow"></span>
		<button class="issues-btn" onclick={() => (editor.tab = 'issues')} title="Validasi">
			{#if counts.error}<span class="badge err">{counts.error}</span>{/if}
			{#if counts.warning}<span class="badge warn">{counts.warning}</span>{/if}
			{#if counts.info}<span class="badge info">{counts.info}</span>{/if}
			{#if !counts.error && !counts.warning && !counts.info}<span class="okmark">✓</span>{/if}
		</button>
		<button onclick={() => editor.save()} disabled={!(editor.dirty || editor.confDirty) || editor.busy} title="Simpan (Ctrl+S)">
			{editor.dirty || editor.confDirty ? '● Simpan' : 'Tersimpan'}
		</button>
		<button class="primary" onclick={() => (editor.tab = 'build')}>
			{editor.buildStatus === 'running' ? '⏳ Building…' : '▶ Build'}
		</button>
	</header>

	{#if editor.parseError}
		<div class="fatal">
			<b>Gagal mem-parse {editor.keymapPath}:</b>
			{editor.parseError}
			<button onclick={() => editor.reload()}>Muat ulang</button>
		</div>
	{/if}

	{#if km && ctx}
		<main>
			<section class="canvas">
				<nav class="layer-tabs" aria-label="Layer">
					{#each km.layers as l, i (l.uid)}
						<button class="ltab" class:active={i === editor.layer} onclick={() => (editor.layer = i)} style:--lc={layerColor(i)} title="{l.nodeName} (Alt+{i})">
							<span class="lidx">{i}</span>
							<span>{ctx.layerNames[i]}</span>
							{#if hitsByLayer.get(i)}<span class="badge info">{hitsByLayer.get(i)}</span>{/if}
						</button>
					{/each}
					<button class="ghost add" onclick={addLayer} title="Tambah layer">+</button>
				</nav>

				{#if editor.view !== editor.size}
					<div class="banner">
						{#if editor.size === 42}
							Tampilan <b>36 tombol</b>. File keymap tetap <b>42 posisi</b>, kolom luar disembunyikan.
							<button onclick={() => convert(36)}>Konversi file ke 36</button>
						{:else}
							Tampilan <b>42 tombol</b>. File keymap <b>36 posisi</b>, kolom luar tidak dipakai.
							<button onclick={() => convert(42)}>Konversi file ke 42</button>
						{/if}
					</div>
				{/if}
				{#if editor.pick}
					<div class="banner pick">
						Mode pilih posisi ({editor.pick.kind === 'combo' ? 'combo' : 'hold-trigger'}): klik tombol untuk menambah/menghapus.
						<button onclick={() => (editor.pick = null)}>Selesai (Esc)</button>
					</div>
				{/if}

				<div class="board" style:--lc={layerColor(editor.layer)}>
					<div class="board-head">
						<span class="lidx big" style:background={layerColor(editor.layer)}>{editor.layer}</span>
						<div>
							<div class="lname">{ctx.layerNames[editor.layer]}</div>
							<div class="muted small mono">{km.layers[editor.layer]?.nodeName} · {LAYOUTS[editor.view].name} · keymap {editor.size} posisi</div>
						</div>
					</div>
					<Keyboard layerIndex={editor.layer} />
				</div>

				<div class="legend">
					{#each legend as [c, n] (c)}
						<span class="lg"><span class="swatch" style:background={CATEGORY_INFO[c].color}></span>{CATEGORY_INFO[c].label} <b>{n}</b></span>
					{/each}
					<span class="lg muted">▽ = transparan (label pudar = binding efektif dari layer bawah) · garis bawah berwarna = layer tujuan · ● = bagian combo</span>
				</div>

				<div class="section-title">Semua layer</div>
				<div class="overview">
					{#each km.layers as l, i (l.uid)}
						<button class="mini" class:active={i === editor.layer} onclick={() => (editor.layer = i)} style:--lc={layerColor(i)}>
							<div class="mini-head"><span class="lidx">{i}</span> {ctx.layerNames[i]}</div>
							<Keyboard layerIndex={i} compact />
						</button>
					{/each}
				</div>
			</section>

			<aside>
				<nav class="side-tabs">
					{#each tabs as t (t.id)}
						<button class:active={editor.tab === t.id} onclick={() => (editor.tab = t.id)}>
							{t.label}
							{#if t.id === 'issues' && counts.error}<span class="badge err">{counts.error}</span>{/if}
							{#if t.id === 'combos'}<span class="cnt">{km.combos.length}</span>{/if}
							{#if t.id === 'macros' && km.macros.length}<span class="cnt">{km.macros.length}</span>{/if}
							{#if t.id === 'build' && editor.buildStatus === 'running'}<span class="spin">◌</span>{/if}
						</button>
					{/each}
				</nav>
				<div class="side-body">
					{#if editor.tab === 'key'}<KeyPanel />{/if}
					{#if editor.tab === 'layers'}<LayersPanel />{/if}
					{#if editor.tab === 'combos'}<CombosPanel />{/if}
					{#if editor.tab === 'macros'}<MacrosPanel />{/if}
					{#if editor.tab === 'behaviors'}<BehaviorsPanel />{/if}
					{#if editor.tab === 'conf'}<ConfPanel />{/if}
					<div class:hidden={editor.tab !== 'build'}><BuildPanel /></div>
					{#if editor.tab === 'source'}<SourcePanel />{/if}
					{#if editor.tab === 'issues'}<IssuesPanel />{/if}
				</div>
			</aside>
		</main>
	{:else if !editor.parseError}
		<div class="loading muted">Memuat zmk-config…</div>
	{/if}

	{#if editor.toast}
		<div class="toast {editor.toast.kind}" role="status">{editor.toast.msg}</div>
	{/if}
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}
	header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 14px;
		border-bottom: 1px solid var(--border);
		background: var(--panel);
		flex-wrap: wrap;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-right: 6px;
	}
	.logo {
		font-size: 20px;
		color: var(--accent);
		letter-spacing: -3px;
	}
	.name {
		font-weight: 700;
		letter-spacing: 0.01em;
	}
	.tag {
		font-size: 10px;
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.file {
		max-width: 220px;
		font-family: var(--mono);
		font-size: 12px;
	}
	.seg {
		display: flex;
		border: 1px solid var(--border-2);
		border-radius: 7px;
		overflow: hidden;
	}
	.seg button {
		border: 0;
		border-radius: 0;
		padding: 5px 12px;
		font-weight: 600;
		background: transparent;
	}
	.seg button.active {
		background: var(--accent);
		color: #1b1405;
	}
	.search {
		position: relative;
	}
	.search input {
		width: 230px;
	}
	.hits {
		position: absolute;
		right: 28px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 11px;
		color: var(--accent);
	}
	.toggles button {
		padding: 5px 8px;
	}
	.issues-btn {
		display: flex;
		gap: 3px;
		align-items: center;
	}
	.okmark {
		color: var(--ok);
		font-weight: 700;
	}
	.fatal {
		background: color-mix(in srgb, var(--danger) 18%, transparent);
		border-bottom: 1px solid var(--danger);
		padding: 10px 14px;
		display: flex;
		gap: 10px;
		align-items: center;
	}
	main {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 440px;
		min-height: 0;
	}
	.canvas {
		overflow: auto;
		padding: 14px 18px 40px;
	}
	aside {
		border-left: 1px solid var(--border);
		background: var(--panel);
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.layer-tabs {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}
	.ltab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 4px;
		border-radius: 8px;
		background: var(--panel);
		border-color: var(--border);
	}
	.ltab.active {
		border-color: var(--lc);
		background: color-mix(in srgb, var(--lc) 16%, var(--panel));
	}
	.lidx {
		display: inline-grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		border-radius: 5px;
		font-size: 11px;
		font-weight: 800;
		color: #111;
		background: var(--lc, var(--text-3));
		padding: 0 4px;
	}
	.lidx.big {
		min-width: 34px;
		height: 34px;
		font-size: 17px;
		border-radius: 8px;
	}
	.add {
		font-size: 16px;
		padding: 2px 10px;
	}
	.banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		margin-bottom: 10px;
		border: 1px solid var(--info);
		border-radius: 8px;
		background: color-mix(in srgb, var(--info) 10%, transparent);
		font-size: 13px;
	}
	.banner.pick {
		border-color: var(--c-macro);
		background: color-mix(in srgb, var(--c-macro) 10%, transparent);
	}
	.banner button {
		margin-left: auto;
	}
	.board {
		background: var(--panel);
		border: 1px solid var(--border);
		border-top: 3px solid var(--lc);
		border-radius: 12px;
		padding: 14px 18px 18px;
		box-shadow: var(--shadow);
	}
	.board-head {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-bottom: 8px;
	}
	.lname {
		font-size: 18px;
		font-weight: 700;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		margin-top: 10px;
		font-size: 12px;
		color: var(--text-2);
	}
	.lg {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.overview {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 10px;
	}
	.mini {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 8px;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.mini.active {
		border-color: var(--lc);
		box-shadow: 0 0 0 1px var(--lc);
	}
	.mini-head {
		display: flex;
		gap: 6px;
		align-items: center;
		font-size: 12px;
		font-weight: 600;
	}
	.side-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 8px 8px 0;
		border-bottom: 1px solid var(--border);
	}
	.side-tabs button {
		border: 0;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		background: transparent;
		padding: 6px 8px;
		font-size: 13px;
		color: var(--text-2);
		display: inline-flex;
		gap: 4px;
		align-items: center;
	}
	.side-tabs button.active {
		color: var(--text);
		border-bottom-color: var(--accent);
	}
	.cnt {
		font-size: 10px;
		color: var(--text-3);
	}
	.spin {
		display: inline-block;
		animation: spin 1s linear infinite;
		color: var(--info);
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.side-body {
		padding: 12px 14px 40px;
		overflow: auto;
		flex: 1;
	}
	.hidden {
		display: none;
	}
	.loading {
		padding: 40px;
		text-align: center;
	}
	.toast {
		position: fixed;
		bottom: 18px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--panel);
		border: 1px solid var(--border-2);
		border-left: 4px solid var(--info);
		padding: 10px 16px;
		border-radius: 8px;
		box-shadow: var(--shadow);
		z-index: 100;
		max-width: 80vw;
	}
	.toast.ok {
		border-left-color: var(--ok);
	}
	.toast.err {
		border-left-color: var(--danger);
	}
	@media (max-width: 1100px) {
		main {
			grid-template-columns: 1fr;
		}
		aside {
			border-left: 0;
			border-top: 1px solid var(--border);
		}
	}
</style>
