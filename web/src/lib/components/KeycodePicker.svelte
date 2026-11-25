<script lang="ts">
	import { CATEGORY_LABELS, KEYCODES, MOD_FUNCS, buildKeyExpr, keyDesc, keyLabel, parseKeyExpr, searchKeycodes, type KeyCategory } from '#lib/zmk/keycodes';
	import { codeToZmk } from '#lib/zmk/capture';

	let { value, onchange, allowMods = true }: { value: string; onchange: (v: string) => void; allowMods?: boolean } = $props();

	let query = $state('');
	let cat = $state<KeyCategory | 'all'>('all');
	let capturing = $state(false);

	const parsed = $derived(parseKeyExpr(value ?? ''));
	const results = $derived.by(() => {
		const list = query ? searchKeycodes(query) : KEYCODES;
		return cat === 'all' || query ? list : list.filter((k) => k.category === cat);
	});

	function pick(base: string) {
		onchange(buildKeyExpr(parsed.mods, base));
	}

	function toggleMod(m: string) {
		const mods = parsed.mods.includes(m) ? parsed.mods.filter((x) => x !== m) : [...parsed.mods, m];
		onchange(buildKeyExpr(mods, parsed.base || 'A'));
	}

	function capture(e: KeyboardEvent) {
		if (!capturing) return;
		e.preventDefault();
		e.stopPropagation();
		const base = codeToZmk(e.code);
		if (!base) return;
		const isModKey = /^(Shift|Control|Alt|Meta)/.test(e.code);
		const mods: string[] = [];
		if (!isModKey && allowMods) {
			if (e.ctrlKey) mods.push('LC');
			if (e.shiftKey) mods.push('LS');
			if (e.altKey) mods.push('LA');
			if (e.metaKey) mods.push('LG');
		}
		onchange(buildKeyExpr(mods, base));
		capturing = false;
	}

	const cats = Object.keys(CATEGORY_LABELS) as KeyCategory[];
</script>

<svelte:window onkeydown={capture} />

<div class="picker">
	<div class="current">
		<span class="cap-preview">{keyLabel(value || '?')}</span>
		<div class="grow">
			<input class="mono expr" value={value} onchange={(e) => onchange(e.currentTarget.value.trim())} aria-label="Keycode expression" />
			<div class="muted small">{value ? keyDesc(value) : '—'}{parsed.keycode ? '' : value ? ' · tidak dikenal' : ''}</div>
		</div>
		<button class:active={capturing} onclick={() => (capturing = !capturing)} title="Tekan tombol di keyboard Anda untuk memilih keycode">
			{capturing ? 'Tekan tombol…' : '⌨ Tangkap'}
		</button>
	</div>

	{#if allowMods}
		<div class="mods">
			{#each Object.entries(MOD_FUNCS) as [m, info] (m)}
				<button class="mod" class:active={parsed.mods.includes(m)} onclick={() => toggleMod(m)} title="{info.desc} — {m}(…)">{info.label}<small>{m}</small></button>
			{/each}
		</div>
	{/if}

	<input type="search" placeholder="Cari keycode: nama, alias, simbol, deskripsi…" bind:value={query} />
	{#if !query}
		<div class="cats">
			<button class="chip-btn" class:active={cat === 'all'} onclick={() => (cat = 'all')}>Semua</button>
			{#each cats as c (c)}
				<button class="chip-btn" class:active={cat === c} onclick={() => (cat = c)}>{CATEGORY_LABELS[c]}</button>
			{/each}
		</div>
	{/if}
	<div class="grid">
		{#each results as k (k.names[0])}
			<button class="kc" class:active={k.names.includes(parsed.base)} onclick={() => pick(k.names[0])} title="{k.desc}  ·  {k.names.join(', ')}">
				<span class="lbl">{k.label}</span>
				<span class="nm">{k.names[0].length > 10 ? k.names[k.names.length - 1] : k.names[0]}</span>
			</button>
		{/each}
		{#if !results.length}
			<div class="muted small">Tidak ditemukan. Ketik nama keycode langsung di kolom atas.</div>
		{/if}
	</div>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.current {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.cap-preview {
		min-width: 44px;
		height: 44px;
		padding: 0 6px;
		display: grid;
		place-items: center;
		background: var(--key-top);
		border: 1px solid var(--border-2);
		border-bottom-width: 4px;
		border-radius: 8px;
		font-weight: 700;
		font-size: 16px;
	}
	.expr {
		width: 100%;
	}
	.mods {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 4px;
	}
	.mod {
		padding: 3px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
	}
	.mod small {
		font-size: 9px;
		color: var(--text-3);
		font-family: var(--mono);
	}
	.cats {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.chip-btn {
		padding: 1px 8px;
		font-size: 11px;
		border-radius: 99px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
		gap: 4px;
		max-height: 260px;
		overflow: auto;
		padding-right: 2px;
	}
	.kc {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 4px 2px;
		gap: 1px;
		min-height: 44px;
	}
	.kc .lbl {
		font-weight: 600;
		font-size: 14px;
	}
	.kc .nm {
		font-size: 9px;
		color: var(--text-3);
		font-family: var(--mono);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
