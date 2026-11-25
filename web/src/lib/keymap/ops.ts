import { cells, cellsToNumber, getProp, propCells, setProp } from '../dts/ast';
import { LAYOUTS, type LayoutSize, mapPosition } from '../zmk/layouts';
import { type Binding, type Keymap, cellsToBindings, definedBehaviorRefs } from './model';

const LAYER_BEHAVIORS = new Set(['&mo', '&to', '&tog', '&sl', '&lt']);

/** Indexes of params of `b` that are layer numbers. */
export function layerParamIndexes(b: Binding, km: Keymap): number[] {
	if (LAYER_BEHAVIORS.has(b.behavior)) return [0];
	const d = definedBehaviorRefs(km).get(b.behavior);
	if (d && 'compatible' in d && d.compatible === 'zmk,behavior-hold-tap') {
		const inner = cellsToBindings(propCells(getProp(d.node, 'bindings')));
		const out: number[] = [];
		inner.forEach((ib, i) => {
			if (['&mo', '&to', '&tog', '&sl'].includes(ib.behavior)) out.push(i);
		});
		return out;
	}
	return [];
}

/** Every binding in the keymap, with a setter-friendly reference. */
export function* allBindings(km: Keymap): Generator<{ b: Binding; where: string; replace: (nb: Binding) => void }> {
	for (const [li, l] of km.layers.entries())
		for (const [pi, b] of l.bindings.entries()) yield { b, where: `layer ${li} pos ${pi}`, replace: (nb) => (l.bindings[pi] = nb) };
	for (const c of km.combos) yield { b: c.binding, where: `combo ${c.nodeName}`, replace: (nb) => (c.binding = nb) };
	for (const m of km.macros)
		for (const [i, b] of m.bindings.entries()) yield { b, where: `macro ${m.nodeName}`, replace: (nb) => (m.bindings[i] = nb) };
}

/** Rewrite all layer indexes using `map` (return undefined = layer removed). */
export function remapLayers(km: Keymap, map: (old: number) => number | undefined) {
	for (const { b, replace } of allBindings(km)) {
		const idx = layerParamIndexes(b, km);
		if (!idx.length) continue;
		const params = [...b.params];
		let removed = false;
		for (const i of idx) {
			const n = cellsToNumber(params[i]);
			if (n === undefined) continue;
			const m = map(n);
			if (m === undefined) removed = true;
			else params[i] = String(m);
		}
		if (removed) {
			// &lt L K -> &kp K, other layer behaviors -> &none
			if (b.behavior === '&lt' && params[1]) replace({ behavior: '&kp', params: [params[1]] });
			else replace({ behavior: '&none', params: [] });
		} else replace({ ...b, params });
	}
	for (const c of km.combos) if (c.layers) c.layers = c.layers.map(map).filter((n): n is number => n !== undefined);
	km.conditionalLayers = km.conditionalLayers.filter((c) => {
		const t = map(c.thenLayer);
		if (t === undefined) return false;
		c.thenLayer = t;
		c.ifLayers = c.ifLayers.map(map).filter((n): n is number => n !== undefined);
		return c.ifLayers.length > 0;
	});
}

export function moveLayer(km: Keymap, from: number, to: number) {
	if (from === to) return;
	const order = km.layers.map((_, i) => i);
	const [l] = km.layers.splice(from, 1);
	km.layers.splice(to, 0, l);
	const [o] = order.splice(from, 1);
	order.splice(to, 0, o);
	const inv = new Map(order.map((old, neu) => [old, neu]));
	remapLayers(km, (old) => inv.get(old));
}

export function deleteLayer(km: Keymap, index: number) {
	km.layers.splice(index, 1);
	remapLayers(km, (old) => (old === index ? undefined : old > index ? old - 1 : old));
}

/** Count references to a layer (bindings, combos, conditional layers). */
export function layerUsages(km: Keymap, index: number): string[] {
	const out: string[] = [];
	for (const { b, where } of allBindings(km)) {
		for (const i of layerParamIndexes(b, km)) if (cellsToNumber(b.params[i]) === index) out.push(`${where}: ${b.behavior} ${b.params.join(' ')}`);
	}
	for (const c of km.combos) if (c.layers?.includes(index)) out.push(`combo ${c.nodeName} (aktif di layer)`);
	for (const c of km.conditionalLayers) if (c.thenLayer === index || c.ifLayers.includes(index)) out.push(`conditional ${c.nodeName}`);
	return out;
}

export function keymapSize(km: Keymap): LayoutSize {
	if (km.physicalLayout?.includes('5col')) return 36;
	const n = km.layers[0]?.bindings.length ?? 42;
	return n === 36 ? 36 : 42;
}

export interface ConvertReport {
	droppedBindings: string[];
	droppedCombos: string[];
	changedBehaviors: string[];
}

/** Convert keymap positions between the 42-key and 36-key layouts. */
export function convertKeymap(km: Keymap, to: LayoutSize): ConvertReport {
	const from = keymapSize(km);
	const report: ConvertReport = { droppedBindings: [], droppedCombos: [], changedBehaviors: [] };
	if (from === to) return report;
	const target = LAYOUTS[to].keys.length;

	for (const [li, l] of km.layers.entries()) {
		const next: Binding[] = Array.from({ length: target }, () => ({ behavior: '&trans', params: [] }));
		l.bindings.forEach((b, p) => {
			const np = mapPosition(p, from, to);
			if (np === undefined) {
				if (b.behavior !== '&trans' && b.behavior !== '&none') report.droppedBindings.push(`${l.displayName ?? l.nodeName} pos ${p}: ${b.behavior} ${b.params.join(' ')}`);
				return;
			}
			next[np] = b;
		});
		km.layers[li].bindings = next;
	}

	km.combos = km.combos.filter((c) => {
		const mapped = c.keyPositions.map((p) => mapPosition(p, from, to));
		if (mapped.some((p) => p === undefined)) {
			report.droppedCombos.push(`${c.nodeName} (posisi ${c.keyPositions.join(' ')})`);
			return false;
		}
		c.keyPositions = mapped as number[];
		return true;
	});

	for (const b of km.behaviors) {
		const p = getProp(b.node, 'hold-trigger-key-positions');
		if (!p) continue;
		const mapped = propCells(p)
			.map((c) => cellsToNumber(c))
			.map((n) => (n === undefined ? undefined : mapPosition(n, from, to)))
			.filter((n): n is number => n !== undefined);
		setProp(b.node, 'hold-trigger-key-positions', [cells(...mapped)]);
		report.changedBehaviors.push(b.nodeName);
	}

	km.physicalLayout = to === 36 ? LAYOUTS[36].zmkRef : undefined;
	return report;
}
