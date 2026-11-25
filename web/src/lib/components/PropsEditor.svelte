<script lang="ts">
	import type { DtsNode, DtsProperty } from '#lib/dts/ast';
	import { setProp } from '#lib/dts/ast';
	import { formatValue } from '#lib/dts/printer';
	import { MOD_MASKS } from '#lib/zmk/behaviors';
	import { parseRawValue, readProp, writeProp, type PropSchema } from '#lib/zmk/props';
	import { editor } from '#lib/editor.svelte';

	let {
		node,
		schema,
		hidden = [],
		update,
		pickUid
	}: {
		node: DtsNode;
		schema: PropSchema[];
		hidden?: string[];
		update: (fn: (n: DtsNode) => void) => void;
		pickUid?: string;
	} = $props();

	const known = $derived(new Set([...schema.map((s) => s.name), ...hidden]));
	const extra = $derived(node.children.filter((c): c is DtsProperty => c.kind === 'prop' && !known.has(c.name)));
	let newName = $state('');
	let newValue = $state('');
	let err = $state('');

	function set(s: PropSchema, v: Parameters<typeof writeProp>[2]) {
		update((n) => writeProp(n, s, v));
	}

	function setRaw(name: string, text: string) {
		try {
			const vals = text.trim() === '' ? null : parseRawValue(text);
			update((n) => setProp(n, name, vals));
			err = '';
		} catch (e) {
			err = `${name}: ${(e as Error).message}`;
		}
	}
</script>

<div class="props">
	{#each schema as s (s.name)}
		{@const v = readProp(node, s)}
		<div class="prop" class:set={v !== undefined && v !== false && !(Array.isArray(v) && !v.length)}>
			{#if s.type === 'bool'}
				<label class="inline"><input type="checkbox" checked={!!v} onchange={(e) => set(s, e.currentTarget.checked)} /> <code>{s.name}</code></label>
			{:else}
				<div class="pname"><code>{s.name}</code></div>
				{#if s.type === 'ms' || s.type === 'int'}
					<div class="row">
						<input type="number" min="0" value={(v as string) ?? ''} placeholder={s.placeholder ?? 'default'} oninput={(e) => set(s, e.currentTarget.value)} />
						{#if s.type === 'ms'}<span class="muted small">ms</span>{/if}
					</div>
				{:else if s.type === 'enum'}
					<select value={(v as string) ?? ''} onchange={(e) => set(s, e.currentTarget.value || undefined)}>
						<option value="">(default)</option>
						{#each s.options ?? [] as o (o)}<option value={o}>{o}</option>{/each}
					</select>
				{:else if s.type === 'positions'}
					{@const arr = (v as number[]) ?? []}
					<div class="row">
						<code class="grow pos">{arr.join(' ') || '—'}</code>
						{#if pickUid}
							<button class:active={editor.pick?.uid === pickUid} onclick={() => (editor.pick = editor.pick?.uid === pickUid ? null : { kind: 'holdtrigger', uid: pickUid })}
								>{editor.pick?.uid === pickUid ? '✓ Selesai' : '🖱 Pilih'}</button
							>
							<button title="Isi dengan semua tombol sisi kanan + thumb" onclick={() => set(s, editor.sidePositions('R'))}>Kanan</button>
							<button title="Isi dengan semua tombol sisi kiri + thumb" onclick={() => set(s, editor.sidePositions('L'))}>Kiri</button>
						{/if}
					</div>
				{:else if s.type === 'mods'}
					{@const arr = (v as string[]) ?? []}
					<div class="mods">
						{#each MOD_MASKS as m (m.value)}
							<button class:active={arr.includes(m.value)} onclick={() => set(s, arr.includes(m.value) ? arr.filter((x) => x !== m.value) : [...arr, m.value])}>{m.label}</button>
						{/each}
					</div>
				{:else}
					<input class="mono" value={(v as string) ?? ''} placeholder={s.placeholder} onchange={(e) => setRaw(s.name, e.currentTarget.value)} />
				{/if}
			{/if}
			<div class="muted desc">{s.desc}</div>
		</div>
	{/each}

	{#each extra as p (p.name)}
		<div class="prop set">
			<div class="pname"><code>{p.name}</code> <span class="muted small">(properti lain)</span></div>
			<div class="row">
				<input class="mono grow" value={p.values ? p.values.map(formatValue).join(', ') : ''} placeholder="(boolean)" onchange={(e) => setRaw(p.name, e.currentTarget.value)} />
				<button class="ghost danger" onclick={() => update((n) => setProp(n, p.name, undefined))}>✕</button>
			</div>
		</div>
	{/each}

	<details>
		<summary class="small muted">+ Properti lain (raw devicetree)</summary>
		<div class="row add">
			<input class="mono" placeholder="nama" bind:value={newName} />
			<input class="mono grow" placeholder={'<100> atau "teks" (kosong = boolean)'} bind:value={newValue} />
			<button
				disabled={!newName}
				onclick={() => {
					setRaw(newName.trim(), newValue);
					newName = newValue = '';
				}}>Tambah</button
			>
		</div>
	</details>
	{#if err}<div class="err small">{err}</div>{/if}
</div>

<style>
	.props {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.prop {
		padding: 6px 8px;
		border-left: 2px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.prop.set {
		border-left-color: var(--accent);
	}
	.pname code {
		font-size: 12px;
	}
	.desc {
		font-size: 11px;
	}
	.pos {
		font-size: 11px;
		word-break: break-all;
	}
	.mods {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 3px;
	}
	.mods button {
		padding: 3px 0;
		font-size: 11px;
	}
	.add {
		margin-top: 6px;
	}
	.add input:first-child {
		width: 120px;
	}
	.err {
		color: var(--danger);
	}
	input[type='number'] {
		width: 110px;
	}
</style>
