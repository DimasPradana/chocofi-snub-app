<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { cells, getProp, propCellGroups, propCells, setProp, str, type DtsNode } from '#lib/dts/ast';
	import { describe } from '#lib/keymap/describe';
	import { bindingsToCells, cellsToBindings, emptyNode, newUid, type Binding, type CustomBehavior } from '#lib/keymap/model';
	import { CUSTOM_KINDS } from '#lib/zmk/behaviors';
	import { OVERRIDABLE, SCHEMAS } from '#lib/zmk/props';
	import BindingEditor from './BindingEditor.svelte';
	import PropsEditor from './PropsEditor.svelte';

	const km = $derived(editor.km!);
	const ctx = $derived(editor.ctx!);
	const current = $derived(km.behaviors.find((b) => b.uid === editor.selectedBehavior));
	const currentOv = $derived(km.overrides.find((b) => b.uid === editor.selectedBehavior));

	function updB(fn: (n: DtsNode, b: CustomBehavior) => void) {
		const uid = editor.selectedBehavior;
		editor.mutate((k) => {
			const b = k.behaviors.find((x) => x.uid === uid) ?? (k.overrides.find((x) => x.uid === uid) as CustomBehavior | undefined);
			if (b) fn(b.node, b);
		});
	}

	type Template = { id: string; label: string; desc: string; make: () => CustomBehavior };

	function mk(name: string, compatible: string, cellsN: number, extra: (n: DtsNode) => void): CustomBehavior {
		const n = emptyNode(name);
		n.labels = [name];
		setProp(n, 'compatible', [str(compatible)]);
		setProp(n, '#binding-cells', [cells(cellsN)]);
		extra(n);
		return { uid: newUid(), nodeName: name, labels: [name], node: n, compatible };
	}

	function uniq(base: string) {
		const used = new Set([...km.behaviors.flatMap((b) => b.labels), ...km.macros.flatMap((m) => m.labels)]);
		let n = base;
		let i = 1;
		while (used.has(n)) n = `${base}${++i}`;
		return n;
	}

	const templates: Template[] = [
		{
			id: 'hrm',
			label: 'Home row mod (kiri)',
			desc: 'Hold-tap balanced + positional: hold hanya aktif jika tombol berikutnya di tangan kanan/thumb',
			make: () =>
				mk(uniq('hml'), 'zmk,behavior-hold-tap', 2, (n) => {
					setProp(n, 'flavor', [str('balanced')]);
					setProp(n, 'tapping-term-ms', [cells(280)]);
					setProp(n, 'quick-tap-ms', [cells(175)]);
					setProp(n, 'require-prior-idle-ms', [cells(150)]);
					setProp(n, 'bindings', [cells('&kp'), cells('&kp')]);
					setProp(n, 'hold-trigger-key-positions', [cells(...editor.sidePositions('R'))]);
					setProp(n, 'hold-trigger-on-release', null);
				})
		},
		{
			id: 'hrm-r',
			label: 'Home row mod (kanan)',
			desc: 'Pasangan HRM untuk tangan kanan (trigger di tangan kiri/thumb)',
			make: () =>
				mk(uniq('hmr'), 'zmk,behavior-hold-tap', 2, (n) => {
					setProp(n, 'flavor', [str('balanced')]);
					setProp(n, 'tapping-term-ms', [cells(280)]);
					setProp(n, 'quick-tap-ms', [cells(175)]);
					setProp(n, 'require-prior-idle-ms', [cells(150)]);
					setProp(n, 'bindings', [cells('&kp'), cells('&kp')]);
					setProp(n, 'hold-trigger-key-positions', [cells(...editor.sidePositions('L'))]);
					setProp(n, 'hold-trigger-on-release', null);
				})
		},
		{
			id: 'lt',
			label: 'Layer-tap custom',
			desc: 'Seperti &lt tapi dengan timing sendiri (tahan = &mo, tap = &kp)',
			make: () =>
				mk(uniq('lth'), 'zmk,behavior-hold-tap', 2, (n) => {
					setProp(n, 'flavor', [str('balanced')]);
					setProp(n, 'tapping-term-ms', [cells(200)]);
					setProp(n, 'quick-tap-ms', [cells(150)]);
					setProp(n, 'bindings', [cells('&mo'), cells('&kp')]);
				})
		},
		{
			id: 'td',
			label: 'Tap dance',
			desc: '1× tap, 2× tap, 3× tap → aksi berbeda',
			make: () =>
				mk(uniq('td'), 'zmk,behavior-tap-dance', 0, (n) => {
					setProp(n, 'tapping-term-ms', [cells(200)]);
					setProp(n, 'bindings', [cells('&kp', 'SEMI'), cells('&kp', 'COLON')]);
				})
		},
		{
			id: 'mm',
			label: 'Mod-morph',
			desc: 'Binding berbeda saat modifier ditahan (mis. Shift+, = ;)',
			make: () =>
				mk(uniq('mm'), 'zmk,behavior-mod-morph', 0, (n) => {
					setProp(n, 'bindings', [cells('&kp', 'COMMA'), cells('&kp', 'SEMI')]);
					setProp(n, 'mods', [cells('(MOD_LSFT|MOD_RSFT)')]);
				})
		},
		{
			id: 'sk',
			label: 'Sticky key custom',
			desc: 'One-shot modifier dengan timing sendiri',
			make: () =>
				mk(uniq('skq'), 'zmk,behavior-sticky-key', 1, (n) => {
					setProp(n, 'release-after-ms', [cells(1000)]);
					setProp(n, 'bindings', [cells('&kp')]);
					setProp(n, 'quick-release', null);
				})
		}
	];

	let tpl = $state('hrm');

	function add() {
		const t = templates.find((x) => x.id === tpl)!;
		const b = t.make();
		editor.mutate((k) => k.behaviors.push(b));
		editor.selectedBehavior = b.uid;
	}

	function addOverride(ref: string) {
		const existing = km.overrides.find((o) => o.nodeName === ref);
		if (existing) {
			editor.selectedBehavior = existing.uid;
			return;
		}
		const o = { uid: newUid(), nodeName: ref, labels: [], node: { ...emptyNode(ref), blankBefore: true }, container: '' };
		editor.mutate((k) => k.overrides.push(o));
		editor.selectedBehavior = o.uid;
	}

	function usages(labels: string[]) {
		const refs = labels.map((l) => `&${l}`);
		let n = 0;
		for (const l of km.layers) for (const b of l.bindings) if (refs.includes(b.behavior)) n++;
		for (const c of km.combos) if (refs.includes(c.binding.behavior)) n++;
		return n;
	}

	function removeCurrent() {
		const uid = editor.selectedBehavior;
		if (current) {
			if (!confirm(`Hapus behavior ${current.nodeName}? Pemakaiannya menjadi &none.`)) return;
			const refs = current.labels.map((l) => `&${l}`);
			editor.mutate((k) => {
				k.behaviors = k.behaviors.filter((b) => b.uid !== uid);
				for (const l of k.layers) l.bindings = l.bindings.map((b) => (refs.includes(b.behavior) ? { behavior: '&none', params: [] } : b));
			});
		} else if (currentOv) {
			editor.mutate((k) => (k.overrides = k.overrides.filter((b) => b.uid !== uid)));
		}
		editor.selectedBehavior = null;
	}

	function renameCurrent(v: string) {
		if (!current) return;
		const name = v.replace(/[^\w]/g, '_');
		const old = current.labels.map((l) => `&${l}`);
		const uid = current.uid;
		editor.mutate((k) => {
			const b = k.behaviors.find((x) => x.uid === uid);
			if (!b) return;
			b.nodeName = name;
			b.labels = [name];
			for (const l of k.layers) for (const x of l.bindings) if (old.includes(x.behavior)) x.behavior = `&${name}`;
			for (const c of k.combos) if (old.includes(c.binding.behavior)) c.binding.behavior = `&${name}`;
		});
	}

	// full bindings inside tap-dance / mod-morph (`<&kp A>, <&kp B>`)
	function groupBindings(n: DtsNode): Binding[] {
		return propCellGroups(getProp(n, 'bindings')).map((g) => cellsToBindings(g)[0] ?? { behavior: '&none', params: [] });
	}
	function setGroupBindings(bs: Binding[]) {
		updB((n) => setProp(n, 'bindings', bs.map((b) => cells(...bindingsToCells([b])))));
	}
	// hold-tap inner behavior refs (`<&kp>, <&kp>`)
	const innerRefs = ['&kp', '&mo', '&to', '&tog', '&sl', '&sk', '&kt'];
</script>

<p class="muted small">Behavior custom didefinisikan di keymap lalu dipakai seperti <code>&amp;nama param</code>. Override mengubah default behavior bawaan, mis. <code>&amp;mt</code>.</p>

<div class="row">
	<select class="grow" bind:value={tpl} aria-label="Template behavior">
		{#each templates as t (t.id)}<option value={t.id}>{t.label}</option>{/each}
	</select>
	<button class="primary" onclick={add}>+ Behavior</button>
</div>
<div class="muted small tdesc">{templates.find((t) => t.id === tpl)?.desc}</div>

<div class="section-title">Behavior custom</div>
<div class="list">
	{#each km.behaviors as b (b.uid)}
		{@const kind = CUSTOM_KINDS[b.compatible as keyof typeof CUSTOM_KINDS]}
		<button class="list-item" class:selected={b.uid === editor.selectedBehavior} onclick={() => (editor.selectedBehavior = b.uid === editor.selectedBehavior ? null : b.uid)}>
			<b>&amp;{b.labels[0] ?? b.nodeName}</b>
			<span class="chip">{kind?.label ?? b.compatible.replace('zmk,behavior-', '')}</span>
			<span class="grow"></span>
			<span class="chip">{usages(b.labels)}× dipakai</span>
		</button>
	{/each}
	{#if !km.behaviors.length}<div class="muted small">Belum ada. Contoh: home row mods, tap dance, mod-morph.</div>{/if}
</div>

<div class="section-title">Override behavior bawaan</div>
<div class="list">
	{#each km.overrides as o (o.uid)}
		<button class="list-item" class:selected={o.uid === editor.selectedBehavior} onclick={() => (editor.selectedBehavior = o.uid === editor.selectedBehavior ? null : o.uid)}>
			<b>{o.nodeName}</b>
			<span class="muted small grow">{o.node.children.filter((c) => c.kind === 'prop' || c.kind === 'delete').map((c) => ('name' in c ? c.name : '')).join(', ') || '(kosong)'}</span>
		</button>
	{/each}
</div>
<div class="row wrap ov-add">
	{#each OVERRIDABLE as r (r)}
		<button class="small" onclick={() => addOverride(r)}>{r}</button>
	{/each}
</div>

{#if current}
	{@const n = current.node}
	<div class="card ed">
		<div class="row">
			<label class="field grow"><span>Label (dipakai sebagai &amp;label)</span><input class="mono" value={current.labels[0] ?? current.nodeName} onchange={(e) => renameCurrent(e.currentTarget.value)} /></label>
			<button class="danger" onclick={removeCurrent}>Hapus</button>
		</div>
		<div class="muted small"><code>{current.compatible}</code> · #binding-cells = {propCells(getProp(n, '#binding-cells'))[0] ?? '?'}</div>

		{#if current.compatible === 'zmk,behavior-hold-tap'}
			{@const inner = propCells(getProp(n, 'bindings'))}
			<div class="grid2">
				{#each ['Hold', 'Tap'] as lbl, i (lbl)}
					<label class="field"
						><span>{lbl} behavior</span>
						<select
							value={inner[i] ?? '&kp'}
							onchange={(e) => {
								const v = e.currentTarget.value;
								updB((nn) => {
									const cur = propCells(getProp(nn, 'bindings'));
									cur[i] = v;
									setProp(nn, 'bindings', [cells(cur[0] ?? '&kp'), cells(cur[1] ?? '&kp')]);
								});
							}}
						>
							{#each innerRefs as r (r)}<option value={r}>{r}</option>{/each}
						</select></label
					>
				{/each}
			</div>
			<div class="muted small">Pemakaian: <code>&amp;{current.labels[0]} {inner[0] === '&mo' ? 'LAYER' : 'LSHFT'} A</code></div>
		{:else if current.compatible === 'zmk,behavior-tap-dance' || current.compatible === 'zmk,behavior-mod-morph'}
			{@const bs = groupBindings(n)}
			<div class="section-title">{current.compatible.includes('tap-dance') ? 'Aksi per jumlah tap' : 'Binding normal → dengan modifier'}</div>
			{#each bs as b, i (i)}
				<div class="card sub">
					<div class="row">
						<b class="small">{current.compatible.includes('tap-dance') ? `${i + 1}× tap` : i === 0 ? 'Normal' : 'Dengan mods'}</b>
						<span class="grow muted small">{describe(b, ctx).tap}</span>
						{#if current.compatible.includes('tap-dance') && bs.length > 1}
							<button class="ghost danger" onclick={() => setGroupBindings(bs.filter((_, j) => j !== i))}>✕</button>
						{/if}
					</div>
					<BindingEditor binding={b} compact onchange={(nb) => setGroupBindings(bs.map((x, j) => (j === i ? nb : x)))} />
				</div>
			{/each}
			{#if current.compatible.includes('tap-dance')}
				<button onclick={() => setGroupBindings([...bs, { behavior: '&kp', params: ['A'] }])}>+ Tambah tap</button>
			{/if}
		{/if}

		<div class="section-title">Properti</div>
		<PropsEditor node={n} schema={SCHEMAS[current.compatible] ?? []} hidden={['compatible', '#binding-cells', 'bindings', 'label']} update={(fn) => updB((nn) => fn(nn))} pickUid={current.uid} />
	</div>
{:else if currentOv}
	<div class="card ed">
		<div class="row">
			<b class="grow">{currentOv.nodeName} {'{ … }'}</b>
			<button class="danger" onclick={removeCurrent}>Hapus override</button>
		</div>
		{#if currentOv.node.children.some((c) => c.kind === 'delete')}
			<div class="muted small">
				Berisi: {#each currentOv.node.children.filter((c) => c.kind === 'delete') as d, i (i)}<code>/delete-{'what' in d ? d.what : ''}/ {'name' in d ? d.name : ''};</code>{' '}{/each}
			</div>
		{/if}
		<PropsEditor node={currentOv.node} schema={SCHEMAS[currentOv.nodeName] ?? []} update={(fn) => updB((nn) => fn(nn))} />
	</div>
{/if}

<style>
	.tdesc {
		margin-top: 4px;
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
	.sub {
		background: var(--bg-2);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.wrap {
		flex-wrap: wrap;
	}
	.ov-add {
		margin-top: 6px;
	}
	.small {
		font-size: 11px;
		padding: 2px 7px;
	}
</style>
