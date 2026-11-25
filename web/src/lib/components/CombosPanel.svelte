<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { describe } from '#lib/keymap/describe';
	import { newCombo, type Combo } from '#lib/keymap/model';
	import { CATEGORY_INFO } from '#lib/zmk/behaviors';
	import BindingEditor from './BindingEditor.svelte';

	const km = $derived(editor.km!);
	const ctx = $derived(editor.ctx!);
	let filter = $state('');
	let onlySelectedKey = $state(false);

	const list = $derived(
		km.combos
			.map((c, i) => ({ c, i, face: describe(c.binding, ctx) }))
			.filter(({ c, face }) => {
				if (onlySelectedKey && editor.selected !== null && !c.keyPositions.includes(editor.selected)) return false;
				const q = filter.toLowerCase();
				return !q || c.nodeName.toLowerCase().includes(q) || face.tap.toLowerCase().includes(q) || c.binding.params.join(' ').toLowerCase().includes(q);
			})
	);
	const current = $derived(km.combos.find((c) => c.uid === editor.selectedCombo));
	const ci = $derived(km.combos.findIndex((c) => c.uid === editor.selectedCombo));

	function upd(fn: (c: Combo) => void) {
		editor.mutate((k) => {
			const c = k.combos.find((x) => x.uid === editor.selectedCombo);
			if (c) fn(c);
		});
	}

	function add() {
		const c = newCombo(`combo_${km.combos.length + 1}`);
		if (editor.selected !== null) c.keyPositions = [editor.selected];
		editor.mutate((k) => k.combos.push(c));
		editor.selectedCombo = c.uid;
		editor.pick = { kind: 'combo', uid: c.uid };
		editor.notify('Klik tombol-tombol di keyboard untuk menambah/menghapus posisi combo', 'info');
	}

	function remove() {
		if (!current || !confirm(`Hapus combo ${current.nodeName}?`)) return;
		const uid = current.uid;
		editor.mutate((k) => (k.combos = k.combos.filter((c) => c.uid !== uid)));
		editor.selectedCombo = null;
		editor.pick = null;
	}

	$effect(() => {
		// leave pick mode when the combo panel is closed or another combo is selected
		if (editor.pick?.kind === 'combo' && (editor.tab !== 'combos' || editor.pick.uid !== editor.selectedCombo)) editor.pick = null;
	});
</script>

<div class="row">
	<input type="search" class="grow" placeholder="Cari combo…" bind:value={filter} />
	<button class="primary" onclick={add}>+ Combo</button>
</div>
<label class="inline small muted top">
	<input type="checkbox" bind:checked={onlySelectedKey} disabled={editor.selected === null} /> Hanya combo pada tombol terpilih {editor.selected !== null ? `(pos ${editor.selected})` : ''}
</label>
<label class="inline small muted"><input type="checkbox" bind:checked={editor.showCombos} onchange={() => editor.savePrefs()} /> Tampilkan overlay combo di keyboard</label>

<div class="list combos">
	{#each list as { c, face } (c.uid)}
		<button
			class="list-item"
			class:selected={c.uid === editor.selectedCombo}
			onclick={() => (editor.selectedCombo = c.uid === editor.selectedCombo ? null : c.uid)}
			onmouseenter={() => (editor.hoverCombo = c.uid)}
			onmouseleave={() => (editor.hoverCombo = null)}
		>
			<span class="swatch" style:background={CATEGORY_INFO[face.category].color}></span>
			<b class="tap">{face.tap || '∅'}</b>
			<span class="grow nm">{c.nodeName}</span>
			<span class="muted mono small">{c.keyPositions.join('+')}</span>
			{#if c.layers?.length}<span class="chip">L{c.layers.join(',')}</span>{/if}
		</button>
	{/each}
	{#if !list.length}<div class="muted small">Belum ada combo.</div>{/if}
</div>

{#if current && ci >= 0}
	<div class="card editor">
		<div class="row">
			<label class="field grow"><span>Nama node</span><input class="mono" value={current.nodeName} onchange={(e) => upd((c) => (c.nodeName = e.currentTarget.value.replace(/[^\w-]/g, '_')))} /></label>
			<button class="danger" onclick={remove}>Hapus</button>
		</div>

		<div class="field">
			<span class="lbl">Posisi tombol ({current.keyPositions.length})</span>
			<div class="row">
				<code class="grow">{current.keyPositions.join(' ') || '—'}</code>
				<button class:active={editor.pick?.uid === current.uid} onclick={() => (editor.pick = editor.pick?.uid === current.uid ? null : { kind: 'combo', uid: current.uid })}>
					{editor.pick?.uid === current.uid ? '✓ Selesai pilih' : '🖱 Pilih di keyboard'}
				</button>
			</div>
			{#if editor.pick?.uid === current.uid}<div class="small hint">Mode pilih aktif: klik tombol untuk menambah/menghapus posisi.</div>{/if}
		</div>

		<div class="section-title">Aksi</div>
		<BindingEditor binding={current.binding} compact onchange={(b) => upd((c) => (c.binding = b))} />

		<div class="section-title">Timing</div>
		<div class="grid2">
			<label class="field"><span>timeout-ms</span><input type="number" min="0" placeholder="50 (default)" value={current.timeoutMs ?? ''} oninput={(e) => upd((c) => (c.timeoutMs = e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value)))} /></label>
			<label class="field"><span>require-prior-idle-ms</span><input type="number" min="0" placeholder="—" value={current.requirePriorIdleMs ?? ''} oninput={(e) => upd((c) => (c.requirePriorIdleMs = e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value)))} /></label>
		</div>
		<label class="inline small"><input type="checkbox" checked={current.slowRelease} onchange={(e) => upd((c) => (c.slowRelease = e.currentTarget.checked))} /> slow-release (lepas saat semua tombol dilepas)</label>

		<div class="section-title">Aktif di layer</div>
		<div class="row wrap">
			<label class="inline small"><input type="checkbox" checked={!current.layers?.length} onchange={(e) => e.currentTarget.checked && upd((c) => (c.layers = undefined))} /> Semua</label>
			{#each km.layers as l, li (l.uid)}
				<label class="inline small"
					><input
						type="checkbox"
						checked={!!current.layers?.includes(li)}
						onchange={(e) =>
							upd((c) => {
								const cur = c.layers ?? [];
								c.layers = e.currentTarget.checked ? [...cur, li].sort((a, b) => a - b) : cur.filter((x) => x !== li);
								if (!c.layers.length) c.layers = undefined;
							})}
					/>{li}·{ctx.layerNames[li]}</label
				>
			{/each}
		</div>
	</div>
{/if}

<style>
	.top {
		margin-top: 8px;
	}
	.combos {
		margin-top: 8px;
		max-height: 300px;
		overflow: auto;
	}
	.tap {
		min-width: 28px;
	}
	.nm {
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.editor {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		color: var(--text-2);
	}
	.lbl {
		font-weight: 500;
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.wrap {
		flex-wrap: wrap;
	}
	.hint {
		color: var(--c-macro);
	}
</style>
