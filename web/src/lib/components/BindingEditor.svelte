<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { behaviorDef, describe } from '#lib/keymap/describe';
	import { bindingToString, parseBindingString, type Binding } from '#lib/keymap/model';
	import { BUILTIN_BEHAVIORS, CATEGORY_INFO, DOCS_BASE, MACRO_CONTROLS, type ParamDef } from '#lib/zmk/behaviors';
	import { MODIFIER_NAMES, findKeycode } from '#lib/zmk/keycodes';
	import KeycodePicker from './KeycodePicker.svelte';
	import { layerColor } from '#lib/layerColors';

	let {
		binding,
		onchange,
		allowMacroControls = false,
		compact = false
	}: { binding: Binding; onchange: (b: Binding) => void; allowMacroControls?: boolean; compact?: boolean } = $props();

	const ctx = $derived(editor.ctx!);
	const def = $derived(behaviorDef(ctx, binding.behavior));
	const face = $derived(describe(binding, ctx));
	const macroCtl = $derived(MACRO_CONTROLS.find((c) => c.ref === binding.behavior));
	// svelte-ignore state_referenced_locally
	let openPicker = $state<number | null>(compact ? null : -1);
	let rawText = $state('');
	$effect(() => {
		rawText = bindingToString(binding);
	});

	const groups = $derived.by(() => {
		const g: { label: string; items: { ref: string; name: string }[] }[] = [];
		const cats = new Map<string, { ref: string; name: string }[]>();
		for (const b of BUILTIN_BEHAVIORS) {
			const label = CATEGORY_INFO[b.category].label;
			if (!cats.has(label)) cats.set(label, []);
			cats.get(label)!.push({ ref: b.ref, name: b.name });
		}
		for (const [label, items] of cats) g.push({ label, items });
		const customs = [...ctx.defs.entries()];
		const beh = customs.filter(([, d]) => 'compatible' in d).map(([ref, d]) => ({ ref, name: d.nodeName }));
		const mac = customs.filter(([, d]) => !('compatible' in d)).map(([ref, d]) => ({ ref, name: d.nodeName }));
		if (beh.length) g.push({ label: 'Behavior custom (keymap ini)', items: beh });
		if (mac.length) g.push({ label: 'Macro (keymap ini)', items: mac });
		if (allowMacroControls) g.unshift({ label: 'Kontrol macro', items: MACRO_CONTROLS.map((c) => ({ ref: c.ref, name: c.label })) });
		return g;
	});

	function defaultParam(p: ParamDef, prev: string[]): string {
		const prevKey = prev.find((x) => findKeycode(x.replace(/^[LR][SCAG]\(|\)+$/g, '')));
		switch (p.kind) {
			case 'keycode':
				return prevKey ?? 'A';
			case 'mod':
				return 'LEFT_SHIFT';
			case 'layer':
				return String(Math.min(1, ctx.layerNames.length - 1));
			case 'enum':
				return p.options?.[0]?.value ?? '';
			default:
				return '0';
		}
	}

	function changeBehavior(ref: string) {
		const ctl = MACRO_CONTROLS.find((c) => c.ref === ref);
		if (ctl) {
			onchange({ behavior: ref, params: ctl.param ? ['30'] : [] });
			return;
		}
		const d = behaviorDef(ctx, ref);
		const prev = binding.params;
		const params: string[] = [];
		const pdefs = d?.params ?? [];
		pdefs.forEach((p) => params.push(defaultParam(p, prev)));
		// keep the tap keycode when switching kp <-> mt/lt
		if (pdefs.length === 2 && pdefs[1].kind === 'keycode') params[1] = prev.find((x) => !/^\d+$/.test(x) && !MODIFIER_NAMES.includes(x)) ?? params[1];
		const opt = pdefs[0]?.options?.find((o) => o.value === params[0]);
		if (opt?.needsNumber) params.push(String(opt.needsNumber.min ?? 0));
		onchange({ behavior: ref, params });
	}

	function setParam(i: number, v: string) {
		const params = [...binding.params];
		params[i] = v;
		// enum with/without numeric argument
		const p = def?.params[i];
		if (p?.kind === 'enum') {
			const opt = p.options?.find((o) => o.value === v);
			if (opt?.needsNumber && params.length < i + 2) params[i + 1] = String(opt.needsNumber.min ?? 0);
			if (!opt?.needsNumber) params.length = i + 1;
		}
		onchange({ ...binding, params });
	}

	function applyRaw() {
		const b = parseBindingString(rawText);
		if (bindingToString(b) !== bindingToString(binding)) onchange(b);
	}

	const quick = ['&kp', '&mt', '&lt', '&mo', '&to', '&sk', '&trans', '&none'];
</script>

<div class="be" class:compact>
	{#if !compact}
		<div class="quick">
			{#each quick as q (q)}
				<button class:active={binding.behavior === q} onclick={() => changeBehavior(q)}>{q}</button>
			{/each}
		</div>
	{/if}

	<div class="row">
		<select class="grow" value={binding.behavior} onchange={(e) => changeBehavior(e.currentTarget.value)} aria-label="Behavior">
			{#if !def && !macroCtl}
				<option value={binding.behavior}>{binding.behavior} (tidak dikenal)</option>
			{/if}
			{#each groups as g (g.label)}
				<optgroup label={g.label}>
					{#each g.items as it (it.ref)}
						<option value={it.ref}>{it.ref} — {it.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		{#if def?.docs}
			<a class="doc" href="{DOCS_BASE}{def.docs}" target="_blank" rel="noreferrer" title="Dokumentasi ZMK (butuh internet)">docs ↗</a>
		{/if}
	</div>

	{#if def && !compact}
		<div class="desc">
			<span class="swatch" style:background={CATEGORY_INFO[def.category].color}></span>
			<span>{def.desc}</span>
			{#if def.requires}<span class="chip" title="Opsi Kconfig yang dibutuhkan">{def.requires}</span>{/if}
		</div>
	{:else if macroCtl && !compact}
		<div class="desc muted">{macroCtl.desc}</div>
	{/if}

	{#if macroCtl?.param}
		<label class="field"><span>{macroCtl.param}</span><input type="number" value={binding.params[0] ?? ''} oninput={(e) => setParam(0, e.currentTarget.value)} /></label>
	{/if}

	{#each def?.params ?? [] as p, i (i)}
		{@const v = binding.params[i] ?? ''}
		<div class="param">
			<div class="param-head">
				<span class="pname">{p.name}</span>
				{#if p.kind === 'keycode' && compact}
					<button class="ghost small" onclick={() => (openPicker = openPicker === i ? null : i)}>{openPicker === i ? 'tutup' : 'pilih…'}</button>
				{/if}
			</div>
			{#if p.kind === 'keycode'}
				{#if openPicker === i || openPicker === -1}
					<KeycodePicker value={v} onchange={(nv) => setParam(i, nv)} />
				{:else}
					<input class="mono" value={v} onchange={(e) => setParam(i, e.currentTarget.value)} />
				{/if}
			{:else if p.kind === 'mod'}
				<div class="modgrid">
					{#each MODIFIER_NAMES as m (m)}
						<button class:active={v === m} onclick={() => setParam(i, m)}>{findKeycode(m)?.label} <small>{m.replace('LEFT_', 'L').replace('RIGHT_', 'R')}</small></button>
					{/each}
				</div>
				<input class="mono" value={v} onchange={(e) => setParam(i, e.currentTarget.value)} title="Boleh kombinasi, mis. LC(LSHFT)" />
			{:else if p.kind === 'layer'}
				<div class="layers">
					{#each ctx.layerNames as name, li (li)}
						<button class:active={v === String(li)} onclick={() => setParam(i, String(li))}>
							<span class="swatch" style:background={layerColor(li)}></span>{li} · {name}
						</button>
					{/each}
				</div>
			{:else if p.kind === 'enum'}
				{@const opt = p.options?.find((o) => o.value === v)}
				<select value={v} onchange={(e) => setParam(i, e.currentTarget.value)}>
					{#if !opt}<option value={v}>{v}</option>{/if}
					{#each p.options ?? [] as o (o.value)}
						<option value={o.value}>{o.label} ({o.value})</option>
					{/each}
				</select>
				{#if opt?.desc}<div class="muted small">{opt.desc}</div>{/if}
				{#if opt?.needsNumber}
					{@const nn = opt.needsNumber}
					<label class="field">
						<span>{nn.label}{nn.base1Display ? ` (index ${binding.params[i + 1]} = profil ${Number(binding.params[i + 1]) + 1} di OLED)` : ''}</span>
						<input type="number" min={nn.min} max={nn.max} value={binding.params[i + 1] ?? '0'} oninput={(e) => {
							const params = [...binding.params];
							params[i + 1] = e.currentTarget.value;
							onchange({ ...binding, params });
						}} />
					</label>
				{/if}
			{:else}
				<input class="mono" value={v} onchange={(e) => setParam(i, e.currentTarget.value)} />
			{/if}
		</div>
	{/each}

	<label class="field raw">
		<span>Binding devicetree</span>
		<input class="mono" bind:value={rawText} onkeydown={(e) => e.key === 'Enter' && applyRaw()} onblur={applyRaw} />
	</label>
	{#if !compact}
		<div class="muted small">Hasil: <b>{face.tap}</b>{face.hold ? ` / ${face.hold}` : ''} — {face.title.slice(0, -1).join(' · ')}</div>
	{/if}
</div>

<style>
	.be {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.be.compact {
		gap: 6px;
	}
	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.quick button {
		font-family: var(--mono);
		font-size: 12px;
		padding: 3px 8px;
	}
	.desc {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-2);
		flex-wrap: wrap;
	}
	.doc {
		font-size: 12px;
		color: var(--info);
		white-space: nowrap;
	}
	.param {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.param-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.pname {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-2);
	}
	.modgrid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
	}
	.modgrid button {
		font-size: 13px;
		padding: 4px 2px;
	}
	.modgrid small {
		font-size: 10px;
		color: var(--text-3);
	}
	.layers {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.layers button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
	}
	.raw input {
		font-size: 12px;
	}
	.small {
		font-size: 11px;
	}
</style>
