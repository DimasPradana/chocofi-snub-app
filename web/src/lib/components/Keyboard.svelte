<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { describe, resolveTrans, type KeyFace } from '#lib/keymap/describe';
	import { bindingToString } from '#lib/keymap/model';
	import { CATEGORY_INFO } from '#lib/zmk/behaviors';
	import { fingerLabel, keyCenter, layoutBounds, type PhysKey } from '#lib/zmk/layouts';
	import { layerColor } from '#lib/layerColors';

	let { layerIndex, compact = false }: { layerIndex: number; compact?: boolean } = $props();

	const PAD = 12;
	const layout = $derived(editor.layout);
	const bounds = $derived(layoutBounds(layout.keys));
	const viewBox = $derived(`${bounds.minX - PAD} ${bounds.minY - PAD} ${bounds.width + PAD * 2} ${bounds.height + PAD * 2}`);

	interface KeyView {
		i: number;
		k: PhysKey;
		pos?: number;
		face?: KeyFace;
		trans?: { layer: number; face: KeyFace };
		raw: string;
		match: boolean;
	}

	const q = $derived(editor.search.trim().toLowerCase());

	const keys = $derived.by<KeyView[]>(() => {
		const km = editor.km;
		const ctx = editor.ctx;
		if (!km || !ctx) return [];
		const layer = km.layers[layerIndex];
		return layout.keys.map((k, i) => {
			const pos = editor.kmPos(i);
			const b = pos !== undefined ? layer?.bindings[pos] : undefined;
			if (!b || pos === undefined) return { i, k, pos, raw: '', match: false };
			const face = describe(b, ctx);
			let trans: KeyView['trans'];
			if (b.behavior === '&trans') {
				const r = resolveTrans(km, layerIndex, pos);
				if (r) trans = { layer: r.layer, face: describe(r.binding, ctx) };
			}
			const raw = bindingToString(b);
			const match = !!q && (raw.toLowerCase().includes(q) || face.tap.toLowerCase() === q || (face.hold ?? '').toLowerCase() === q);
			return { i, k, pos, face, trans, raw, match };
		});
	});

	/* ---------- combos ---------- */
	const combos = $derived.by(() => {
		const km = editor.km;
		const ctx = editor.ctx;
		if (!km || !ctx || compact || !editor.showCombos) return [];
		return km.combos
			.filter((c) => !c.layers?.length || c.layers.includes(layerIndex))
			.map((c) => {
				const vis = c.keyPositions.map((p) => editor.viewIndex(p));
				if (vis.some((v) => v === undefined)) return null;
				const pts = vis.map((v) => keyCenter(layout.keys[v!]));
				const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
				let cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
				// if the centroid sits on top of a key (e.g. 3 keys in a row), move the label to the gap above it
				const covered = layout.keys.some((k) => !k.r && cx > k.x + 8 && cx < k.x + k.w - 8 && cy > k.y + 8 && cy < k.y + k.h - 8);
				if (covered) cy -= 47;
				const face = describe(c.binding, ctx);
				return { uid: c.uid, name: c.nodeName, pts, cx, cy, face, positions: c.keyPositions };
			})
			.filter((c) => c !== null);
	});

	const comboPositions = $derived.by(() => {
		const s = new Map<number, string[]>();
		for (const c of editor.km?.combos ?? []) for (const p of c.keyPositions) s.set(p, [...(s.get(p) ?? []), c.nodeName]);
		return s;
	});

	const pickSet = $derived.by(() => {
		const p = editor.pick;
		if (!p || !editor.km) return new Set<number>();
		if (p.kind === 'combo') return new Set(editor.km.combos.find((c) => c.uid === p.uid)?.keyPositions ?? []);
		return new Set(editor.pickPositions);
	});

	const hoverComboSet = $derived.by(() => {
		const c = editor.km?.combos.find((x) => x.uid === editor.hoverCombo);
		return new Set(c?.keyPositions ?? []);
	});

	/* ---------- interaction ---------- */
	let hovered = $state<KeyView | null>(null);
	let tip = $state({ x: 0, y: 0 });
	let wrap: HTMLDivElement | undefined = $state();
	let dragFrom = $state<number | null>(null);
	let dragOver = $state<number | null>(null);

	function onMove(e: PointerEvent, kv: KeyView) {
		if (compact || !wrap) return;
		const r = wrap.getBoundingClientRect();
		tip = { x: e.clientX - r.left, y: e.clientY - r.top };
		hovered = kv;
		if (dragFrom !== null && kv.pos !== undefined) dragOver = kv.pos;
	}

	function onDown(e: PointerEvent, kv: KeyView) {
		if (compact || kv.pos === undefined || editor.pick) return;
		dragFrom = kv.pos;
	}

	function onUp(e: PointerEvent, kv: KeyView) {
		if (compact) return;
		const from = dragFrom;
		dragFrom = null;
		dragOver = null;
		if (kv.pos === undefined) return;
		if (from !== null && from !== kv.pos) {
			const to = kv.pos;
			editor.mutate((km) => {
				const l = km.layers[layerIndex].bindings;
				if (e.altKey) l[to] = structuredClone($state.snapshot(l[from]));
				else [l[from], l[to]] = [l[to], l[from]];
			});
			editor.notify(e.altKey ? `Binding pos ${from} disalin ke ${to}` : `Pos ${from} ⇄ ${to} ditukar`, 'info');
			editor.selected = to;
			return;
		}
		click(e, kv);
	}

	function click(e: PointerEvent | MouseEvent, kv: KeyView) {
		if (kv.pos === undefined) return;
		if (editor.pick) {
			editor.togglePick(kv.pos);
			return;
		}
		if ((e.ctrlKey || e.metaKey) && kv.face?.layerRef !== undefined) {
			editor.layer = kv.face.layerRef;
			return;
		}
		editor.selected = kv.pos;
		editor.tab = 'key';
	}

	function fontSize(s: string, w: number) {
		const len = [...s].length;
		const base = len <= 1 ? 34 : len <= 2 ? 30 : len <= 3 ? 25 : len <= 4 ? 21 : len <= 5 ? 18 : len <= 7 ? 15 : 12;
		return base * Math.min(1, w / 100);
	}

	function clip(s: string, n = 9) {
		const a = [...s];
		return a.length > n ? a.slice(0, n - 1).join('') + '…' : s;
	}

	const otherLayers = $derived.by(() => {
		const km = editor.km;
		const ctx = editor.ctx;
		if (!hovered || hovered.pos === undefined || !km || !ctx) return [];
		return km.layers
			.map((l, li) => ({ li, name: ctx.layerNames[li], b: l.bindings[hovered!.pos!] }))
			.filter((x) => x.li !== layerIndex && x.b && x.b.behavior !== '&trans')
			.map((x) => ({ ...x, face: describe(x.b, ctx) }));
	});
</script>

<div class="kb" class:compact bind:this={wrap} role="presentation" onpointerleave={() => ((hovered = null), (dragFrom = null), (dragOver = null))}>
	<svg {viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Keyboard layer {layerIndex}">
		<defs>
			<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
				<line x1="0" y1="0" x2="0" y2="8" stroke="var(--c-none)" stroke-width="3" />
			</pattern>
		</defs>

		{#each keys as kv (kv.i)}
			{@const k = kv.k}
			{@const f = kv.face}
			{@const color = f ? CATEGORY_INFO[f.category].color : 'var(--border)'}
			{@const sel = !compact && kv.pos !== undefined && editor.selected === kv.pos}
			{@const picked = kv.pos !== undefined && pickSet.has(kv.pos)}
			{@const hoverC = kv.pos !== undefined && hoverComboSet.has(kv.pos)}
			{@const inset = 4}
			<g
				class="key"
				class:sel
				class:picked
				class:match={kv.match}
				class:dimmed={!!q && !kv.match}
				class:ghost={!f}
				class:dragover={dragOver === kv.pos && dragFrom !== kv.pos}
				transform={k.r ? `rotate(${k.r} ${k.rx} ${k.ry})` : undefined}
				onpointermove={(e) => onMove(e, kv)}
				onpointerdown={(e) => onDown(e, kv)}
				onpointerup={(e) => onUp(e, kv)}
				role="button"
				tabindex={compact ? -1 : 0}
				aria-label={f ? `${kv.raw} posisi ${kv.pos}` : 'tidak ada di keymap'}
				onkeydown={(e) => e.key === 'Enter' && click(e as unknown as MouseEvent, kv)}
			>
				<rect class="cap-edge" x={k.x + inset} y={k.y + inset} width={k.w - inset * 2} height={k.h - inset * 2} rx="10" />
				<rect
					class="cap"
					x={k.x + inset}
					y={k.y + inset}
					width={k.w - inset * 2}
					height={k.h - inset * 2 - 5}
					rx="10"
					fill={f?.category === 'none' ? 'url(#hatch)' : undefined}
					style:--cat={color}
				/>
				{#if f && f.category !== 'trans' && f.category !== 'none'}
					<rect class="tint" x={k.x + inset} y={k.y + inset} width={k.w - inset * 2} height={k.h - inset * 2 - 5} rx="10" fill={color} />
					<rect x={k.x + inset + 10} y={k.y + inset} width={k.w - inset * 2 - 20} height="4" rx="2" fill={color} />
				{/if}
				{#if f?.layerRef !== undefined}
					<rect x={k.x + inset + 14} y={k.y + k.h - inset - 13} width={k.w - inset * 2 - 28} height="4" rx="2" fill={layerColor(f.layerRef)} />
				{/if}

				{#if f}
					{@const cx = k.x + k.w / 2}
					{#if f.category === 'trans' && kv.trans && !compact}
						<text class="trans-label" x={cx} y={k.y + k.h / 2 + 2} font-size={fontSize(kv.trans.face.tap, k.w) * 0.8}>{clip(kv.trans.face.tap)}</text>
						<text class="sub" x={k.x + 14} y={k.y + 22}>▽ L{kv.trans.layer}</text>
					{:else}
						{@const hasHold = !!f.hold}
						<text
							class="tap"
							class:unknown={f.unknown}
							x={cx}
							y={k.y + k.h / 2 + (hasHold ? -6 : 2) + (k.h > 100 ? -10 : 0)}
							font-size={fontSize(f.tap, k.w) * (compact ? 1.1 : 1)}>{clip(f.tap)}</text
						>
						{#if hasHold && !compact}
							<text class="hold" x={cx} y={k.y + k.h - inset - 22} font-size={[...(f.hold ?? '')].length > 6 ? 11 : 14}>{clip(f.hold ?? '', 10)}</text>
						{/if}
					{/if}
					{#if f.sub && !compact}
						<text class="sub" x={k.x + 14} y={k.y + 22}>{clip(f.sub, 8)}</text>
					{/if}
					{#if !compact && editor.showPositions}
						<text class="posnum" x={k.x + k.w - 12} y={k.y + 22}>{kv.pos}</text>
					{/if}
					{#if !compact && kv.pos !== undefined && comboPositions.has(kv.pos)}
						<circle class="combo-dot" class:hl={hoverC} cx={k.x + k.w - 15} cy={k.y + k.h - 22} r="4" />
					{/if}
				{:else}
					<text class="sub" x={k.x + k.w / 2} y={k.y + k.h / 2 + 4} text-anchor="middle">tidak ada</text>
				{/if}
			</g>
		{/each}

		{#each combos as c (c.uid)}
			{@const hl = editor.hoverCombo === c.uid || (editor.selected !== null && c.positions.includes(editor.selected))}
			{@const label = clip(c.face.tap, 6)}
			{@const w = Math.max(26, [...label].length * 8 + 12)}
			<g class="combo" class:hl role="presentation" onpointerenter={() => (editor.hoverCombo = c.uid)} onpointerleave={() => (editor.hoverCombo = null)}>
				{#each c.pts as p, idx (idx)}
					<line x1={c.cx} y1={c.cy} x2={p.x} y2={p.y} />
				{/each}
				<rect class="pill" x={c.cx - w / 2} y={c.cy - 9} width={w} height="18" rx="9" style:--cat={CATEGORY_INFO[c.face.category].color} />
				<text class="pill-text" x={c.cx} y={c.cy + 1}>{label}</text>
				<title>Combo {c.name}: {c.face.title.join(' · ')} — posisi {c.positions.join(' + ')}</title>
			</g>
		{/each}
	</svg>

	{#if hovered && hovered.face && !compact && dragFrom === null}
		{@const f = hovered.face}
		<div class="tooltip" style:left="{tip.x + 16}px" style:top="{tip.y + 16}px">
			<div class="tt-head">
				<span class="swatch" style:background={CATEGORY_INFO[f.category].color}></span>
				<strong>{CATEGORY_INFO[f.category].label}</strong>
				<span class="muted">pos {hovered.pos}</span>
			</div>
			<code class="tt-raw">{hovered.raw}</code>
			{#each f.title.slice(0, -1) as t, i (i)}
				<div>{t}</div>
			{/each}
			{#if hovered.trans}
				<div class="muted">Efektif dari layer {hovered.trans.layer}: <code>{hovered.trans.face.title.at(-1)}</code></div>
			{/if}
			<div class="tt-meta muted">
				Sisi {hovered.k.side === 'L' ? 'kiri' : 'kanan'} · baris {hovered.k.row + 1} · {fingerLabel(hovered.k.finger)}
			</div>
			{#if hovered.pos !== undefined && comboPositions.has(hovered.pos)}
				<div class="tt-meta">Combo: {comboPositions.get(hovered.pos)!.join(', ')}</div>
			{/if}
			{#if otherLayers.length}
				<div class="tt-layers">
					{#each otherLayers as o (o.li)}
						<div class="tt-l"><span class="swatch" style:background={layerColor(o.li)}></span><span class="muted">{o.name}</span> <b>{o.face.tap}</b>{#if o.face.hold}<span class="muted"> / {o.face.hold}</span>{/if}</div>
					{/each}
				</div>
			{/if}
			{#if f.layerRef !== undefined}
				<div class="muted small">Ctrl+klik untuk membuka layer {f.layerRef}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.kb {
		position: relative;
		width: 100%;
		user-select: none;
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}
	.key {
		cursor: pointer;
		outline: none;
	}
	.compact .key {
		cursor: inherit;
	}
	.cap-edge {
		fill: var(--key-edge);
	}
	.cap {
		fill: var(--key-top);
		stroke: var(--border-2);
		stroke-width: 1.5;
		transition: stroke 0.1s;
	}
	.tint {
		opacity: 0.13;
		pointer-events: none;
	}
	.key:hover .cap {
		stroke: var(--text-3);
	}
	.key:focus-visible .cap {
		stroke: var(--accent);
		stroke-width: 3;
	}
	.key.sel .cap {
		stroke: var(--accent);
		stroke-width: 4;
	}
	.key.picked .cap {
		stroke: var(--c-macro);
		stroke-width: 4;
		stroke-dasharray: 8 4;
	}
	.key.dragover .cap {
		stroke: var(--info);
		stroke-width: 4;
	}
	.key.match .cap {
		stroke: var(--accent);
		stroke-width: 4;
		filter: drop-shadow(0 0 6px var(--accent));
	}
	.key.dimmed {
		opacity: 0.35;
	}
	.key.ghost .cap {
		fill: transparent;
		stroke-dasharray: 6 5;
	}
	.key.ghost .cap-edge {
		fill: transparent;
	}
	text {
		pointer-events: none;
		text-anchor: middle;
		fill: var(--text);
		font-family: var(--font);
		dominant-baseline: middle;
	}
	.tap {
		font-weight: 600;
	}
	.tap.unknown {
		fill: var(--warn);
	}
	.hold {
		fill: var(--text-2);
		font-weight: 500;
	}
	.sub {
		text-anchor: start;
		font-size: 10.5px;
		fill: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.posnum {
		text-anchor: end;
		font-size: 11px;
		fill: var(--text-3);
		font-family: var(--mono);
	}
	.trans-label {
		fill: var(--text-3);
		opacity: 0.6;
		font-style: italic;
	}
	.combo-dot {
		fill: var(--c-macro);
		opacity: 0.8;
	}
	.combo-dot.hl {
		r: 6;
		opacity: 1;
	}
	.combo line {
		pointer-events: none;
		stroke: var(--c-macro);
		stroke-width: 2;
		opacity: 0.35;
		stroke-dasharray: 4 3;
	}
	.combo .pill {
		fill: var(--panel);
		stroke: var(--cat);
		stroke-width: 1.5;
	}
	.combo .pill-text {
		font-size: 10.5px;
		font-weight: 600;
	}
	.combo {
		opacity: 0.82;
		cursor: help;
	}
	.combo.hl {
		opacity: 1;
	}
	.combo.hl line {
		opacity: 1;
		stroke-dasharray: none;
		stroke-width: 3;
	}
	.combo.hl .pill {
		fill: var(--c-macro);
	}
	.combo.hl .pill-text {
		fill: #fff;
	}
	.tooltip {
		position: absolute;
		z-index: 20;
		pointer-events: none;
		background: var(--panel);
		border: 1px solid var(--border-2);
		border-radius: 8px;
		padding: 8px 10px;
		box-shadow: var(--shadow);
		font-size: 12px;
		min-width: 200px;
		max-width: 320px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.tt-head {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.tt-head .muted {
		margin-left: auto;
		font-family: var(--mono);
	}
	.tt-raw {
		color: var(--accent);
	}
	.tt-meta {
		font-size: 11px;
		margin-top: 2px;
	}
	.tt-layers {
		border-top: 1px solid var(--border);
		margin-top: 4px;
		padding-top: 4px;
		display: grid;
		gap: 2px;
	}
	.tt-l {
		display: flex;
		gap: 6px;
		align-items: center;
	}
</style>
