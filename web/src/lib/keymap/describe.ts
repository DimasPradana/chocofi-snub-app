/** Turn bindings into informative labels for the keyboard view. */
import { BUILTIN_MAP, CATEGORY_INFO, CUSTOM_KINDS, MACRO_CONTROL_MAP, MOUSE_BUTTONS, MOUSE_MOVES, MOUSE_SCROLLS, BT_OPTIONS, type BehaviorCategory, type BehaviorDef, type ParamDef, paramKindForInner } from '../zmk/behaviors';
import { findKeycode, keyDesc, keyLabel, parseKeyExpr } from '../zmk/keycodes';
import { cellsToNumber, getProp, propCellGroups, propCells, propString } from '../dts/ast';
import { type Binding, type CustomBehavior, type Keymap, type Macro, definedBehaviorRefs, cellsToBindings } from './model';

export interface KeyFace {
	tap: string; // main legend
	hold?: string; // secondary legend (hold action / modifier)
	sub?: string; // tiny legend (e.g. behavior kind)
	category: BehaviorCategory;
	title: string[]; // tooltip lines
	layerRef?: number; // layer this key activates/targets
	unknown?: boolean;
	shifted?: boolean;
}

export interface DescribeCtx {
	km: Keymap;
	layerNames: string[];
	defs: Map<string, CustomBehavior | Macro>;
}

export function makeCtx(km: Keymap): DescribeCtx {
	return {
		km,
		layerNames: km.layers.map((l, i) => l.displayName || l.nodeName.replace(/_layer$/, '') || `L${i}`),
		defs: definedBehaviorRefs(km)
	};
}

const MOUSE_LABEL: Record<string, string> = {
	LCLK: '🖱L',
	RCLK: '🖱R',
	MCLK: '🖱M',
	MB1: '🖱1',
	MB2: '🖱2',
	MB3: '🖱3',
	MB4: '🖱◀',
	MB5: '🖱▶',
	MOVE_UP: '🖱↑',
	MOVE_DOWN: '🖱↓',
	MOVE_LEFT: '🖱←',
	MOVE_RIGHT: '🖱→',
	SCRL_UP: '⇞',
	SCRL_DOWN: '⇟',
	SCRL_LEFT: '⇤',
	SCRL_RIGHT: '⇥'
};

const optLabel = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

function layerName(ctx: DescribeCtx, p: string | undefined) {
	const n = cellsToNumber(p);
	if (n === undefined) return { n, name: p ?? '?' };
	return { n, name: ctx.layerNames[n] ?? `L${n}?` };
}

/** Param defs for a custom behavior / macro defined in the keymap. */
export function customParams(def: CustomBehavior | Macro): ParamDef[] {
	if ('compatible' in def) {
		const node = def.node;
		const cellsN = cellsToNumber(propCells(getProp(node, '#binding-cells'))[0]) ?? 0;
		if (def.compatible === 'zmk,behavior-hold-tap') {
			const inner = propCells(getProp(node, 'bindings'));
			return [
				{ name: `Hold (${inner[0] ?? '?'})`, kind: paramKindForInner(inner[0] ?? '') === 'keycode' ? 'mod' : paramKindForInner(inner[0] ?? '') },
				{ name: `Tap (${inner[1] ?? '?'})`, kind: paramKindForInner(inner[1] ?? '') }
			];
		}
		return Array.from({ length: cellsN }, (_, i) => ({ name: `Param ${i + 1}`, kind: def.compatible.includes('sticky') ? 'keycode' : 'raw' }));
	}
	return Array.from({ length: def.cells }, (_, i) => ({ name: `Param ${i + 1}`, kind: 'keycode' }));
}

export function behaviorDef(ctx: DescribeCtx, ref: string): BehaviorDef | undefined {
	const b = BUILTIN_MAP.get(ref);
	if (b) return b;
	const d = ctx.defs.get(ref);
	if (!d) return undefined;
	if ('compatible' in d) {
		const kind = CUSTOM_KINDS[d.compatible as keyof typeof CUSTOM_KINDS];
		return {
			ref,
			name: propString(getProp(d.node, 'display-name')) ?? d.nodeName,
			desc: `${kind?.label ?? d.compatible} (didefinisikan di keymap)`,
			category: kind?.category ?? 'misc',
			params: customParams(d),
			builtin: false
		};
	}
	return {
		ref,
		name: d.displayName ?? d.nodeName,
		desc: `Macro (${d.bindings.length} langkah)`,
		category: 'macro',
		params: customParams(d),
		builtin: false
	};
}

function kpFace(expr: string | undefined): Pick<KeyFace, 'tap' | 'title' | 'unknown' | 'shifted'> {
	if (!expr) return { tap: '?', title: ['Parameter hilang'], unknown: true };
	const p = parseKeyExpr(expr);
	const known = !!p.keycode || /^\d+$/.test(p.base) || /^0x/i.test(p.base);
	return {
		tap: keyLabel(expr),
		title: [`${keyDesc(expr)}`],
		unknown: !known,
		shifted: p.keycode?.shifted || p.mods.some((m) => m.endsWith('S'))
	};
}

export function describe(b: Binding, ctx: DescribeCtx, depth = 0): KeyFace {
	const raw = [b.behavior, ...b.params].join(' ');
	const [p1, p2] = b.params;
	const base = (category: BehaviorCategory, f: Partial<KeyFace>): KeyFace => ({
		tap: '',
		category,
		...f,
		title: [...(f.title ?? []), raw]
	});

	switch (b.behavior) {
		case '&kp': {
			const f = kpFace(p1);
			const isMod = parseKeyExpr(p1 ?? '').keycode?.category === 'mod';
			return base(isMod ? 'holdtap' : 'key', { ...f, sub: isMod ? 'mod' : undefined });
		}
		case '&kt':
			return base('key', { ...kpFace(p1), sub: 'toggle', title: ['Key toggle: ' + keyDesc(p1 ?? '')] });
		case '&mt': {
			const t = kpFace(p2);
			return base('holdtap', { tap: t.tap, hold: keyLabel(p1 ?? '?'), unknown: t.unknown, title: [`Tap: ${keyDesc(p2 ?? '')}`, `Tahan: ${keyDesc(p1 ?? '')}`] });
		}
		case '&lt': {
			const { n, name } = layerName(ctx, p1);
			const t = kpFace(p2);
			return base('holdtap', { tap: t.tap, hold: `▼${name}`, layerRef: n, unknown: t.unknown, title: [`Tap: ${keyDesc(p2 ?? '')}`, `Tahan: layer ${n} (${name})`] });
		}
		case '&mo': {
			const { n, name } = layerName(ctx, p1);
			return base('layer', { tap: name, sub: 'tahan', layerRef: n, title: [`Momentary: layer ${n} aktif selama ditahan`] });
		}
		case '&to': {
			const { n, name } = layerName(ctx, p1);
			return base('layer', { tap: `→${name}`, sub: 'ke', layerRef: n, title: [`Pindah ke layer ${n} (${name})`] });
		}
		case '&tog': {
			const { n, name } = layerName(ctx, p1);
			return base('layer', { tap: `⇄${name}`, sub: 'toggle', layerRef: n, title: [`Toggle layer ${n} (${name})`] });
		}
		case '&sl': {
			const { n, name } = layerName(ctx, p1);
			return base('sticky', { tap: name, sub: 'sticky', layerRef: n, title: [`Sticky layer ${n} (${name}) untuk 1 tombol`] });
		}
		case '&sk':
			return base('sticky', { tap: keyLabel(p1 ?? '?'), sub: 'sticky', title: [`Sticky key ${keyDesc(p1 ?? '')} (one-shot)`] });
		case '&trans':
			return base('trans', { tap: '▽', title: ['Transparan: meneruskan ke layer di bawah'] });
		case '&none':
			return base('none', { tap: '', title: ['Tidak ada aksi'] });
		case '&gresc':
			return base('misc', { tap: 'Esc', hold: '`', sub: 'gresc', title: ['Grave-escape: Esc, + Shift/GUI = `'] });
		case '&caps_word':
			return base('misc', { tap: 'CAPS', sub: 'word', title: ['Caps word'] });
		case '&key_repeat':
			return base('misc', { tap: '⟳', sub: 'repeat', title: ['Ulangi key terakhir'] });
		case '&bt': {
			const opt = BT_OPTIONS.find((o) => o.value === p1);
			if (p1 === 'BT_SEL' || p1 === 'BT_DISC') {
				const n = cellsToNumber(p2);
				return base('bluetooth', { tap: `BT${n !== undefined ? n + 1 : '?'}`, sub: p1 === 'BT_DISC' ? 'putus' : 'profil', title: [`${opt?.label} ${n !== undefined ? n + 1 : '?'} (index ${p2})`] });
			}
			const short: Record<string, string> = { BT_NXT: 'BT▶', BT_PRV: 'BT◀', BT_CLR: 'BT✕', BT_CLR_ALL: 'BT✕✕' };
			return base('bluetooth', { tap: short[p1 ?? ''] ?? p1 ?? '?', sub: 'bt', title: [opt?.label ?? p1 ?? ''] });
		}
		case '&out': {
			const m: Record<string, string> = { OUT_USB: 'USB', OUT_BLE: 'BLE', OUT_TOG: 'USB⇄BLE' };
			return base('output', { tap: m[p1 ?? ''] ?? p1 ?? '?', sub: 'output', title: ['Pilih output'] });
		}
		case '&ext_power':
			return base('output', { tap: (p1 ?? '').replace('EP_', 'Pwr '), sub: 'ext pwr', title: ['External power'] });
		case '&rgb_ug':
			return base('lighting', { tap: (p1 ?? '').replace('RGB_', ''), sub: 'rgb', title: ['RGB underglow'] });
		case '&bl':
			return base('lighting', { tap: (p1 ?? '').replace('BL_', ''), sub: 'backlight', title: ['Backlight'] });
		case '&mkp':
			return base('mouse', { tap: MOUSE_LABEL[p1 ?? ''] ?? p1 ?? '?', sub: 'klik', title: [optLabel(MOUSE_BUTTONS, p1 ?? '')] });
		case '&mmv':
			return base('mouse', { tap: MOUSE_LABEL[p1 ?? ''] ?? p1 ?? '?', sub: 'gerak', title: [optLabel(MOUSE_MOVES, p1 ?? '')] });
		case '&msc':
			return base('mouse', { tap: MOUSE_LABEL[p1 ?? ''] ?? p1 ?? '?', sub: 'scroll', title: [optLabel(MOUSE_SCROLLS, p1 ?? '')] });
		case '&bootloader':
			return base('system', { tap: 'BOOT', sub: 'flash', title: ['Masuk bootloader UF2'] });
		case '&sys_reset':
			return base('system', { tap: 'RESET', title: ['Restart keyboard'] });
		case '&soft_off':
			return base('system', { tap: '⏻ OFF', title: ['Soft off (matikan keyboard)'] });
		case '&studio_unlock':
			return base('system', { tap: '🔓', sub: 'studio', title: ['Buka kunci ZMK Studio'] });
	}

	const d = ctx.defs.get(b.behavior);
	if (d && depth < 3) {
		if ('compatible' in d) {
			const name = propString(getProp(d.node, 'display-name')) ?? d.nodeName;
			const inner = cellsToBindings(propCells(getProp(d.node, 'bindings')));
			if (d.compatible === 'zmk,behavior-hold-tap') {
				const hold = describe({ behavior: inner[0]?.behavior ?? '&none', params: p1 ? [p1] : [] }, ctx, depth + 1);
				const tap = describe({ behavior: inner[1]?.behavior ?? '&none', params: p2 ? [p2] : [] }, ctx, depth + 1);
				return base('holdtap', {
					tap: tap.tap,
					hold: hold.tap,
					sub: name,
					layerRef: hold.layerRef,
					title: [`Hold-tap "${name}"`, `Tap: ${tap.title[0]}`, `Tahan: ${hold.title[0]}`]
				});
			}
			if (d.compatible === 'zmk,behavior-tap-dance') {
				const faces = inner.map((ib) => describe(ib, ctx, depth + 1));
				return base('tapdance', {
					tap: faces[0]?.tap ?? name,
					hold: faces.slice(1).map((f) => f.tap).join(' '),
					sub: `TD ${name}`,
					title: [`Tap dance "${name}"`, ...faces.map((f, i) => `${i + 1}× tap: ${f.title[0]}`)]
				});
			}
			if (d.compatible === 'zmk,behavior-mod-morph') {
				const groups = propCellGroups(getProp(d.node, 'bindings')).map(cellsToBindings).flat();
				const faces = groups.map((ib) => describe(ib, ctx, depth + 1));
				const mods = propCells(getProp(d.node, 'mods')).join(' ');
				return base('modmorph', {
					tap: faces[0]?.tap ?? name,
					hold: faces[1]?.tap,
					sub: `morph`,
					title: [`Mod-morph "${name}"`, `Normal: ${faces[0]?.title[0] ?? ''}`, `Dengan ${mods}: ${faces[1]?.title[0] ?? ''}`]
				});
			}
			if (d.compatible === 'zmk,behavior-sticky-key') {
				return base('sticky', { tap: keyLabel(p1 ?? '?'), sub: name, title: [`Sticky key "${name}"`] });
			}
			const kind = CUSTOM_KINDS[d.compatible as keyof typeof CUSTOM_KINDS];
			return base(kind?.category ?? 'misc', { tap: name.slice(0, 8), sub: kind?.label, title: [`${kind?.label ?? d.compatible} "${name}"`] });
		}
		// macro
		const steps = d.bindings
			.filter((x) => !MACRO_CONTROL_MAP.has(x.behavior))
			.map((x) => describe(x, ctx, depth + 1).tap)
			.join('');
		return base('macro', {
			tap: d.displayName ?? d.nodeName,
			hold: steps.length <= 10 ? steps : steps.slice(0, 9) + '…',
			sub: 'macro',
			title: [`Macro "${d.nodeName}"`, `Urutan: ${d.bindings.map((x) => [x.behavior, ...x.params].join(' ')).join(', ')}`]
		});
	}

	return base('misc', { tap: b.behavior.replace('&', ''), sub: '?', unknown: true, title: ['Behavior tidak dikenal oleh editor'] });
}

export function categoryColor(c: BehaviorCategory) {
	return CATEGORY_INFO[c].color;
}

/** Resolve what a &trans key actually does by looking at lower layers. */
export function resolveTrans(km: Keymap, layer: number, pos: number): { layer: number; binding: Binding } | undefined {
	for (let l = layer - 1; l >= 0; l--) {
		const b = km.layers[l]?.bindings[pos];
		if (b && b.behavior !== '&trans') return { layer: l, binding: b };
	}
	return undefined;
}

export { findKeycode };
