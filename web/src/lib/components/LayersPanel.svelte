<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { newConditional, newLayer, newUid } from '#lib/keymap/model';
	import { deleteLayer, layerUsages, moveLayer, remapLayers } from '#lib/keymap/ops';
	import { layerColor } from '#lib/layerColors';

	const km = $derived(editor.km!);
	let dragIdx = $state<number | null>(null);
	let overIdx = $state<number | null>(null);
	let copyFrom = $state<number>(-1);

	function add() {
		editor.mutate((k) => {
			const n = k.layers.length;
			const l = newLayer(`layer_${n}`, k.layers[0]?.bindings.length ?? editor.size, `L${n}`);
			if (copyFrom >= 0) l.bindings = structuredClone($state.snapshot(k.layers[copyFrom].bindings));
			k.layers.push(l);
		});
		editor.layer = km.layers.length - 1;
	}

	function duplicate(i: number) {
		editor.mutate((k) => {
			const src = $state.snapshot(k.layers[i]);
			const l = { ...structuredClone(src), uid: newUid(), nodeName: `${src.nodeName}_copy`, container: src.container };
			l.labels = [];
			k.layers.splice(i + 1, 0, l);
			// layers after i moved one index up: shift every reference (including the copy's)
			remapLayers(k, (old) => (old > i ? old + 1 : old));
		});
	}

	function remove(i: number) {
		const uses = layerUsages(km, i);
		const msg = `Hapus layer ${i} "${km.layers[i].displayName ?? km.layers[i].nodeName}"?` + (uses.length ? `\n\n${uses.length} referensi akan diubah (&mo/&to → &none, &lt → &kp):\n` + uses.slice(0, 12).join('\n') : '') + '\n\nIndex layer setelahnya otomatis digeser.';
		if (!confirm(msg)) return;
		editor.mutate((k) => deleteLayer(k, i));
		editor.clampLayer();
	}

	function drop(i: number) {
		if (dragIdx === null || dragIdx === i) return;
		const from = dragIdx;
		editor.mutate((k) => moveLayer(k, from, i));
		editor.layer = i;
		dragIdx = overIdx = null;
		editor.notify(`Layer dipindah ${from} → ${i}. Semua referensi index sudah diperbarui.`, 'ok');
	}

	function validName(s: string) {
		return s.trim().replace(/[^A-Za-z0-9_,.+-]/g, '_') || 'layer';
	}
</script>

<p class="muted small">Drag untuk mengurutkan. Semua <code>&amp;mo/&amp;lt/&amp;to/&amp;tog/&amp;sl</code>, combo dan conditional layer ikut diperbarui otomatis.</p>

<div class="list">
	{#each km.layers as l, i (l.uid)}
		{@const uses = layerUsages(km, i).length}
		<div
			class="layer card"
			class:selected={i === editor.layer}
			class:over={overIdx === i && dragIdx !== i}
			draggable="true"
			ondragstart={() => (dragIdx = i)}
			ondragover={(e) => (e.preventDefault(), (overIdx = i))}
			ondragend={() => (dragIdx = overIdx = null)}
			ondrop={() => drop(i)}
			role="listitem"
		>
			<div class="row">
				<span class="handle" title="Drag untuk memindah">⠿</span>
				<span class="idx" style:background={layerColor(i)}>{i}</span>
				<button class="ghost grow name" onclick={() => (editor.layer = i)}>{l.displayName ?? l.nodeName}</button>
				<span class="chip" title="Referensi ke layer ini">{uses} ref</span>
				<button class="ghost" title="Duplikat" onclick={() => duplicate(i)}>⧉</button>
				<button class="ghost danger" title="Hapus" disabled={km.layers.length <= 1} onclick={() => remove(i)}>✕</button>
			</div>
			{#if i === editor.layer}
				<div class="fields">
					<label class="field"
						><span>Nama node</span>
						<input class="mono" value={l.nodeName} onchange={(e) => editor.mutate((k) => (k.layers[i].nodeName = validName(e.currentTarget.value)))} /></label
					>
					<label class="field"
						><span>display-name {editor.niceOled ? '(OLED, ≤4 huruf)' : ''}</span>
						<input value={l.displayName ?? ''} maxlength="16" onchange={(e) => editor.mutate((k) => (k.layers[i].displayName = e.currentTarget.value || undefined))} /></label
					>
				</div>
				<div class="row small muted">
					{l.bindings.filter((b) => b.behavior !== '&trans').length} binding aktif · {l.bindings.filter((b) => b.behavior === '&trans').length} transparan
					<span class="grow"></span>
					<button class="small" onclick={() => editor.mutate((k) => (k.layers[i].bindings = k.layers[i].bindings.map(() => ({ behavior: '&trans', params: [] }))))}>Kosongkan (&amp;trans)</button>
				</div>
			{/if}
		</div>
	{/each}
</div>

<div class="row add">
	<select bind:value={copyFrom} aria-label="Isi awal layer baru">
		<option value={-1}>Layer baru kosong (&amp;trans)</option>
		{#each km.layers as l, i (l.uid)}
			<option value={i}>Salin dari {i} · {l.displayName ?? l.nodeName}</option>
		{/each}
	</select>
	<button class="primary" onclick={add}>+ Layer</button>
</div>

<div class="section-title">Conditional layers (tri-layer)</div>
<p class="muted small">Layer <i>then</i> aktif otomatis saat semua layer <i>if</i> aktif bersamaan.</p>
<div class="list">
	{#each km.conditionalLayers as c, ci (c.uid)}
		<div class="card cond">
			<div class="row">
				<input class="mono grow" value={c.nodeName} onchange={(e) => editor.mutate((k) => (k.conditionalLayers[ci].nodeName = validName(e.currentTarget.value)))} />
				<button class="ghost danger" onclick={() => editor.mutate((k) => k.conditionalLayers.splice(ci, 1))}>✕</button>
			</div>
			<div class="row wrap">
				<span class="small muted">Jika aktif:</span>
				{#each km.layers as l, li (l.uid)}
					<label class="inline small"
						><input
							type="checkbox"
							checked={c.ifLayers.includes(li)}
							onchange={(e) =>
								editor.mutate((k) => {
									const x = k.conditionalLayers[ci];
									x.ifLayers = e.currentTarget.checked ? [...x.ifLayers, li].sort() : x.ifLayers.filter((n) => n !== li);
								})}
						/>{li}·{l.displayName ?? l.nodeName}</label
					>
				{/each}
			</div>
			<div class="row">
				<span class="small muted">Maka aktifkan:</span>
				<select value={c.thenLayer} onchange={(e) => editor.mutate((k) => (k.conditionalLayers[ci].thenLayer = Number(e.currentTarget.value)))}>
					{#each km.layers as l, li (l.uid)}
						<option value={li}>{li} · {l.displayName ?? l.nodeName}</option>
					{/each}
				</select>
			</div>
		</div>
	{/each}
</div>
<button
	class="add-cond"
	disabled={km.layers.length < 3}
	onclick={() => editor.mutate((k) => k.conditionalLayers.push(newConditional(`tri_layer_${k.conditionalLayers.length}`, [1, 2], Math.min(3, k.layers.length - 1))))}
	>+ Conditional layer</button
>

<style>
	.layer {
		padding: 6px 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.layer.selected {
		border-color: var(--accent);
	}
	.layer.over {
		border-color: var(--info);
		border-style: dashed;
	}
	.handle {
		cursor: grab;
		color: var(--text-3);
	}
	.idx {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 12px;
		color: #111;
	}
	.name {
		text-align: left;
		font-weight: 600;
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.add {
		margin-top: 10px;
	}
	.add select {
		flex: 1;
	}
	.cond {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.wrap {
		flex-wrap: wrap;
	}
	.add-cond {
		margin-top: 8px;
	}
	button.small {
		font-size: 11px;
		padding: 2px 6px;
	}
</style>
