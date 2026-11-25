<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { describe } from '#lib/keymap/describe';
	import { bindingToString, type Binding } from '#lib/keymap/model';
	import { CATEGORY_INFO } from '#lib/zmk/behaviors';
	import { LAYOUTS, fingerLabel } from '#lib/zmk/layouts';
	import { layerColor } from '#lib/layerColors';
	import BindingEditor from './BindingEditor.svelte';

	const pos = $derived(editor.selected);
	const km = $derived(editor.km);
	const ctx = $derived(editor.ctx);
	const binding = $derived(pos !== null && km ? km.layers[editor.layer]?.bindings[pos] : undefined);
	const phys = $derived(pos !== null ? LAYOUTS[editor.size].keys[pos] : undefined);
	const combos = $derived(pos !== null && km ? km.combos.filter((c) => c.keyPositions.includes(pos)) : []);

	let clipboard = $state<Binding | null>(null);

	function set(b: Binding) {
		if (pos === null) return;
		editor.setBinding(editor.layer, pos, b);
	}
</script>

{#if pos === null || !binding || !km || !ctx}
	<div class="empty">
		<p><b>Klik tombol</b> di keyboard untuk mengedit binding-nya.</p>
		<ul class="muted small">
			<li>Drag tombol ke tombol lain untuk <b>menukar</b> binding (tahan Alt untuk menyalin).</li>
			<li>Ctrl+klik tombol layer (&amp;mo, &amp;lt…) untuk membuka layer tujuannya.</li>
			<li>Shortcut: <code>Del</code> = &amp;trans, <code>Ctrl+C/V</code> salin/tempel binding, <code>Ctrl+Z/Y</code> undo/redo, <code>Ctrl+S</code> simpan, <code>Alt+0..9</code> pindah layer, panah = pindah tombol.</li>
		</ul>
	</div>
{:else}
	<div class="head">
		<div>
			<div class="title">Posisi {pos} <span class="muted">· layer {editor.layer} {ctx.layerNames[editor.layer]}</span></div>
			{#if phys}
				<div class="muted small">Sisi {phys.side === 'L' ? 'kiri' : 'kanan'} · baris {phys.row + 1} · kolom {phys.col + 1} · jari {fingerLabel(phys.finger)}</div>
			{/if}
		</div>
		<div class="row">
			<button title="Salin binding (Ctrl+C)" onclick={() => (clipboard = structuredClone($state.snapshot(binding)))}>Salin</button>
			<button title="Tempel binding (Ctrl+V)" disabled={!clipboard} onclick={() => clipboard && set(structuredClone(clipboard))}>Tempel</button>
		</div>
	</div>

	<BindingEditor {binding} onchange={set} />

	<div class="section-title">Posisi ini di semua layer</div>
	<div class="list">
		{#each km.layers as l, li (l.uid)}
			{@const b = l.bindings[pos]}
			{@const f = b ? describe(b, ctx) : null}
			<button class="list-item" class:selected={li === editor.layer} onclick={() => (editor.layer = li)}>
				<span class="swatch" style:background={layerColor(li)}></span>
				<span class="lname">{li} · {ctx.layerNames[li]}</span>
				{#if f}
					<span class="swatch" style:background={CATEGORY_INFO[f.category].color}></span>
					<b>{f.tap || '∅'}</b>{#if f.hold}<span class="muted">/ {f.hold}</span>{/if}
					<code class="muted grow r">{b ? bindingToString(b) : ''}</code>
				{/if}
			</button>
		{/each}
	</div>

	{#if combos.length}
		<div class="section-title">Combo yang memakai tombol ini</div>
		<div class="list">
			{#each combos as c (c.uid)}
				<button class="list-item" onmouseenter={() => (editor.hoverCombo = c.uid)} onmouseleave={() => (editor.hoverCombo = null)} onclick={() => ((editor.tab = 'combos'), (editor.selectedCombo = c.uid))}>
					<b>{c.nodeName}</b>
					<span class="muted">{c.keyPositions.join(' + ')}</span>
					<code class="grow r">{bindingToString(c.binding)}</code>
				</button>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.empty p {
		margin-top: 0;
	}
	.empty ul {
		padding-left: 18px;
		line-height: 1.6;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 10px;
		gap: 8px;
	}
	.title {
		font-weight: 600;
		font-size: 15px;
	}
	.lname {
		min-width: 90px;
		font-size: 12px;
	}
	.r {
		text-align: right;
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
