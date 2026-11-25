<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { describe } from '#lib/keymap/describe';
	import { bindingToString, newMacro, type Binding, type Macro } from '#lib/keymap/model';
	import { MACRO_CONTROLS, MACRO_CONTROL_MAP } from '#lib/zmk/behaviors';
	import BindingEditor from './BindingEditor.svelte';

	const km = $derived(editor.km!);
	const ctx = $derived(editor.ctx!);
	const current = $derived(km.macros.find((m) => m.uid === editor.selectedMacro));
	let editStep = $state<number | null>(null);
	let dragIdx = $state<number | null>(null);
	let text = $state('');

	function upd(fn: (m: Macro) => void) {
		editor.mutate((k) => {
			const m = k.macros.find((x) => x.uid === editor.selectedMacro);
			if (m) fn(m);
		});
	}

	function add() {
		const used = new Set(km.macros.flatMap((m) => m.labels));
		let n = 1;
		while (used.has(`macro_${n}`)) n++;
		const m = newMacro(`macro_${n}`);
		editor.mutate((k) => k.macros.push(m));
		editor.selectedMacro = m.uid;
	}

	function rename(v: string) {
		const name = v.replace(/[^\w]/g, '_');
		if (!current) return;
		const uid = current.uid;
		const oldRefs = current.labels.map((l) => `&${l}`);
		editor.mutate((k) => {
			const m = k.macros.find((x) => x.uid === uid);
			if (!m) return;
			m.nodeName = name;
			m.labels = [name];
			// update usages
			for (const l of k.layers) for (const b of l.bindings) if (oldRefs.includes(b.behavior)) b.behavior = `&${name}`;
			for (const c of k.combos) if (oldRefs.includes(c.binding.behavior)) c.binding.behavior = `&${name}`;
		});
	}

	function remove() {
		if (!current || !confirm(`Hapus macro ${current.nodeName}? Pemakaiannya di keymap menjadi &none.`)) return;
		const refs = current.labels.map((l) => `&${l}`);
		const uid = current.uid;
		editor.mutate((k) => {
			k.macros = k.macros.filter((m) => m.uid !== uid);
			for (const l of k.layers) l.bindings = l.bindings.map((b) => (refs.includes(b.behavior) ? { behavior: '&none', params: [] } : b));
			k.combos = k.combos.filter((c) => !refs.includes(c.binding.behavior));
		});
		editor.selectedMacro = null;
	}

	function addStep(b: Binding) {
		upd((m) => m.bindings.push(b));
		editStep = (current?.bindings.length ?? 1) - 1;
	}

	/** Quick: type a word → tap each letter */
	function addText() {
		const map: Record<string, string> = { ' ': 'SPACE', '.': 'DOT', ',': 'COMMA', '-': 'MINUS', '/': 'FSLH', ';': 'SEMI', "'": 'SQT', '=': 'EQUAL', '\n': 'RET' };
		const steps: Binding[] = [{ behavior: '&macro_tap', params: [] }];
		for (const ch of text) {
			if (/[a-z]/.test(ch)) steps.push({ behavior: '&kp', params: [ch.toUpperCase()] });
			else if (/[A-Z]/.test(ch)) steps.push({ behavior: '&kp', params: [`LS(${ch})`] });
			else if (/[0-9]/.test(ch)) steps.push({ behavior: '&kp', params: [`N${ch}`] });
			else if (map[ch]) steps.push({ behavior: '&kp', params: [map[ch]] });
		}
		upd((m) => m.bindings.push(...steps));
		text = '';
	}

	function drop(i: number) {
		if (dragIdx === null || dragIdx === i) return;
		const from = dragIdx;
		upd((m) => {
			const [x] = m.bindings.splice(from, 1);
			m.bindings.splice(i, 0, x);
		});
		dragIdx = null;
	}

	function usage(m: Macro) {
		const refs = m.labels.map((l) => `&${l}`);
		let n = 0;
		for (const l of km.layers) for (const b of l.bindings) if (refs.includes(b.behavior)) n++;
		for (const c of km.combos) if (refs.includes(c.binding.behavior)) n++;
		return n;
	}
</script>

<div class="row">
	<span class="muted small grow">Macro menjalankan urutan binding. Kontrol (TAP/PRESS/RELEASE/WAIT) mengubah cara binding berikutnya dijalankan.</span>
	<button class="primary" onclick={add}>+ Macro</button>
</div>

<div class="list top">
	{#each km.macros as m (m.uid)}
		<button class="list-item" class:selected={m.uid === editor.selectedMacro} onclick={() => (editor.selectedMacro = m.uid === editor.selectedMacro ? null : m.uid)}>
			<b>&amp;{m.labels[0] ?? m.nodeName}</b>
			<span class="muted small grow">{m.bindings.filter((b) => !MACRO_CONTROL_MAP.has(b.behavior)).map((b) => describe(b, ctx).tap).join('')}</span>
			<span class="chip">{m.cells} param</span>
			<span class="chip">{usage(m)}× dipakai</span>
		</button>
	{/each}
	{#if !km.macros.length}<div class="muted small">Belum ada macro.</div>{/if}
</div>

{#if current}
	<div class="card ed">
		<div class="grid2">
			<label class="field"><span>Nama / label</span><input class="mono" value={current.labels[0] ?? current.nodeName} onchange={(e) => rename(e.currentTarget.value)} /></label>
			<label class="field"
				><span>Parameter</span>
				<select value={current.cells} onchange={(e) => upd((m) => (m.cells = Number(e.currentTarget.value) as 0 | 1 | 2))}>
					<option value={0}>0 — macro biasa</option>
					<option value={1}>1 — one-param</option>
					<option value={2}>2 — two-param</option>
				</select></label
			>
			<label class="field"><span>wait-ms</span><input type="number" min="0" value={current.waitMs ?? ''} placeholder="15" oninput={(e) => upd((m) => (m.waitMs = e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value)))} /></label>
			<label class="field"><span>tap-ms</span><input type="number" min="0" value={current.tapMs ?? ''} placeholder="30" oninput={(e) => upd((m) => (m.tapMs = e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value)))} /></label>
		</div>

		<div class="section-title">Langkah ({current.bindings.length}) — drag untuk mengurutkan</div>
		<div class="steps">
			{#each current.bindings as b, i (i)}
				{@const ctl = MACRO_CONTROL_MAP.get(b.behavior)}
				<div
					class="step"
					class:ctl={!!ctl}
					class:editing={editStep === i}
					draggable="true"
					ondragstart={() => (dragIdx = i)}
					ondragover={(e) => e.preventDefault()}
					ondrop={() => drop(i)}
					role="listitem"
				>
					<span class="handle">⠿</span>
					<span class="n">{i + 1}</span>
					{#if ctl}
						<span class="ctl-label">{ctl.label}{b.params[0] ? ` ${b.params[0]}ms` : ''}</span>
					{:else}
						<b>{describe(b, ctx).tap}</b>
					{/if}
					<code class="grow muted">{bindingToString(b)}</code>
					<button class="ghost" onclick={() => (editStep = editStep === i ? null : i)}>✎</button>
					<button class="ghost danger" onclick={() => upd((m) => m.bindings.splice(i, 1))}>✕</button>
				</div>
				{#if editStep === i}
					<div class="step-edit">
						<BindingEditor binding={b} compact allowMacroControls onchange={(nb) => upd((m) => (m.bindings[i] = nb))} />
					</div>
				{/if}
			{/each}
		</div>

		<div class="row wrap">
			{#each MACRO_CONTROLS.slice(0, 5) as c (c.ref)}
				<button class="small" title={c.desc} onclick={() => addStep({ behavior: c.ref, params: c.param ? ['50'] : [] })}>+ {c.label}</button>
			{/each}
			<button class="small" onclick={() => addStep({ behavior: '&kp', params: ['A'] })}>+ Key</button>
			{#if current.cells > 0}
				{#each MACRO_CONTROLS.slice(6) as c (c.ref)}
					<button class="small" title={c.desc} onclick={() => addStep({ behavior: c.ref, params: [] })}>+ {c.label}</button>
				{/each}
			{/if}
		</div>
		<div class="row">
			<input class="grow" placeholder="Ketik teks, mis. 'Halo dunia' → tap per huruf" bind:value={text} onkeydown={(e) => e.key === 'Enter' && addText()} />
			<button disabled={!text} onclick={addText}>+ Teks</button>
		</div>
		<button class="danger" onclick={remove}>Hapus macro</button>
	</div>
{/if}

<style>
	.top {
		margin-top: 8px;
	}
	.ed {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		color: var(--text-2);
	}
	.steps {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.step {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-2);
	}
	.step.ctl {
		border-left: 3px solid var(--c-macro);
	}
	.step.editing {
		border-color: var(--accent);
	}
	.step code {
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.step-edit {
		padding: 8px;
		border: 1px dashed var(--border-2);
		border-radius: 6px;
		margin: 0 0 4px 20px;
	}
	.handle {
		cursor: grab;
		color: var(--text-3);
	}
	.n {
		font-size: 10px;
		color: var(--text-3);
		width: 16px;
	}
	.ctl-label {
		font-size: 11px;
		font-weight: 700;
		color: var(--c-macro);
	}
	.wrap {
		flex-wrap: wrap;
	}
	.small {
		font-size: 11px;
		padding: 2px 7px;
	}
</style>
