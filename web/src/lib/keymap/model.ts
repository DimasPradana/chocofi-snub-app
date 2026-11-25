import {
	type DtsItem,
	type DtsNode,
	type DtsProperty,
	cells,
	cellsToNumber,
	getProp,
	propCellGroups,
	propCells,
	propString,
	setProp,
	str
} from '../dts/ast';
import { findNodes, nodeAt, parseDts } from '../dts/parser';
import { formatPropDefault, printDts } from '../dts/printer';
import { MACRO_COMPATIBLES, MACRO_CONTROL_MAP } from '../zmk/behaviors';

export interface Binding {
	behavior: string; // "&kp"
	params: string[];
}

interface Entity {
	uid: string;
	nodeName: string;
	labels: string[];
	/** original (or template) node: unmanaged props and comments are kept from here */
	node: DtsNode;
	/** path key of the container node in the source AST; undefined = new entity */
	container?: string;
}

export interface Layer extends Entity {
	displayName?: string;
	bindings: Binding[];
	sensorBindings?: Binding[];
}

export interface Combo extends Entity {
	binding: Binding;
	keyPositions: number[];
	timeoutMs?: number;
	requirePriorIdleMs?: number;
	layers?: number[];
	slowRelease: boolean;
}

export interface Macro extends Entity {
	cells: 0 | 1 | 2;
	displayName?: string;
	waitMs?: number;
	tapMs?: number;
	bindings: Binding[];
}

/** Custom behavior (hold-tap, tap-dance, mod-morph, sticky-key...). Props are edited directly on `node`. */
export interface CustomBehavior extends Entity {
	compatible: string;
}

/** Top-level `&ref { ... };` override node (e.g. `&mt { tapping-term-ms = <200>; };`). */
export interface Override extends Entity {}

export interface ConditionalLayer extends Entity {
	ifLayers: number[];
	thenLayer: number;
}

export type ContainerKind = 'keymap' | 'combos' | 'macros' | 'behaviors' | 'conditional';

export interface Keymap {
	ast: DtsItem[];
	layers: Layer[];
	combos: Combo[];
	macros: Macro[];
	behaviors: CustomBehavior[];
	overrides: Override[];
	conditionalLayers: ConditionalLayer[];
	/** ref chosen via `chosen { zmk,physical-layout = <ref>; }` inside the keymap, if any */
	physicalLayout?: string;
	containers: Partial<Record<ContainerKind, string>>;
	/** path keys of every entity node in `ast` (replaced wholesale on serialize) */
	entityPaths: string[];
	includes: string[];
}

let uidCounter = 0;
export const newUid = () => `e${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

const key = (path: number[]) => path.join('.');

/* ---------- bindings <-> cells ---------- */

export function cellsToBindings(cs: string[]): Binding[] {
	const out: Binding[] = [];
	for (const c of cs) {
		if (c.startsWith('&')) out.push({ behavior: c, params: [] });
		else if (out.length) out[out.length - 1].params.push(c);
		else out.push({ behavior: c, params: [] }); // malformed; keep it visible
	}
	return out;
}

export function bindingsToCells(bs: Binding[]): string[] {
	return bs.flatMap((b) => [b.behavior, ...b.params]);
}

export function bindingToString(b: Binding): string {
	return [b.behavior, ...b.params].join(' ');
}

export function parseBindingString(s: string): Binding {
	return cellsToBindings(s.trim().split(/\s+(?![^(]*\))/))[0] ?? { behavior: '&none', params: [] };
}

const nums = (p: DtsProperty | undefined) =>
	propCells(p)
		.map((c) => cellsToNumber(c))
		.filter((n): n is number => n !== undefined);

/* ---------- parse ---------- */

export function parseKeymap(text: string): Keymap {
	const ast = parseDts(text);
	const km: Keymap = {
		ast,
		layers: [],
		combos: [],
		macros: [],
		behaviors: [],
		overrides: [],
		conditionalLayers: [],
		containers: {},
		entityPaths: [],
		includes: ast.filter((i) => i.kind === 'directive').map((i) => (i as { text: string }).text)
	};

	const base = (node: DtsNode, container: string): Entity => ({
		uid: newUid(),
		nodeName: node.name,
		labels: [...node.labels],
		node: structuredClone(node),
		container
	});

	// top-level &ref overrides
	ast.forEach((it, i) => {
		if (it.kind === 'node' && it.name.startsWith('&')) {
			km.overrides.push(base(it, ''));
			km.entityPaths.push(key([i]));
		}
	});

	for (const { node, path } of findNodes(ast, () => true)) {
		const compatible = propString(getProp(node, 'compatible'));
		const parentKey = key(path.slice(0, -1));
		if (node.name === 'chosen') {
			const pl = getProp(node, 'zmk,physical-layout');
			const v = pl?.values?.[0];
			if (v?.type === 'ref') km.physicalLayout = v.value;
			else if (v?.type === 'cells') km.physicalLayout = v.cells[0];
		}
		if (!compatible) continue;
		if (compatible === 'zmk,keymap') {
			km.containers.keymap = key(path);
			node.children.forEach((c, i) => {
				if (c.kind !== 'node') return;
				const b = getProp(c, 'bindings');
				km.layers.push({
					...base(c, key(path)),
					displayName: propString(getProp(c, 'display-name')) ?? propString(getProp(c, 'label')),
					bindings: cellsToBindings(propCells(b)),
					sensorBindings: getProp(c, 'sensor-bindings') ? cellsToBindings(propCells(getProp(c, 'sensor-bindings'))) : undefined
				});
				km.entityPaths.push(key([...path, i]));
			});
		} else if (compatible === 'zmk,combos') {
			km.containers.combos = key(path);
			node.children.forEach((c, i) => {
				if (c.kind !== 'node') return;
				km.combos.push({
					...base(c, key(path)),
					binding: cellsToBindings(propCells(getProp(c, 'bindings')))[0] ?? { behavior: '&none', params: [] },
					keyPositions: nums(getProp(c, 'key-positions')),
					timeoutMs: cellsToNumber(propCells(getProp(c, 'timeout-ms'))[0]),
					requirePriorIdleMs: cellsToNumber(propCells(getProp(c, 'require-prior-idle-ms'))[0]),
					layers: getProp(c, 'layers') ? nums(getProp(c, 'layers')) : undefined,
					slowRelease: !!getProp(c, 'slow-release')
				});
				km.entityPaths.push(key([...path, i]));
			});
		} else if (compatible === 'zmk,conditional-layers') {
			km.containers.conditional = key(path);
			node.children.forEach((c, i) => {
				if (c.kind !== 'node') return;
				km.conditionalLayers.push({
					...base(c, key(path)),
					ifLayers: nums(getProp(c, 'if-layers')),
					thenLayer: nums(getProp(c, 'then-layer'))[0] ?? 0
				});
				km.entityPaths.push(key([...path, i]));
			});
		} else if (compatible.startsWith('zmk,behavior-macro')) {
			km.containers.macros ??= parentKey;
			const groups = propCellGroups(getProp(node, 'bindings'));
			km.macros.push({
				...base(node, parentKey),
				cells: (cellsToNumber(propCells(getProp(node, '#binding-cells'))[0]) ?? 0) as 0 | 1 | 2,
				displayName: propString(getProp(node, 'display-name')) ?? propString(getProp(node, 'label')),
				waitMs: cellsToNumber(propCells(getProp(node, 'wait-ms'))[0]),
				tapMs: cellsToNumber(propCells(getProp(node, 'tap-ms'))[0]),
				bindings: cellsToBindings(groups.flat())
			});
			km.entityPaths.push(key(path));
		} else if (compatible.startsWith('zmk,behavior-')) {
			km.containers.behaviors ??= parentKey;
			km.behaviors.push({ ...base(node, parentKey), compatible });
			km.entityPaths.push(key(path));
		}
	}
	return km;
}

/* ---------- serialize ---------- */

function applyLayer(l: Layer): DtsNode {
	const n = structuredClone(l.node);
	n.name = l.nodeName;
	n.labels = l.labels;
	setProp(n, 'label', undefined);
	setProp(n, 'display-name', l.displayName ? [str(l.displayName)] : undefined);
	// keep display-name before bindings
	setProp(n, 'bindings', [cells(...bindingsToCells(l.bindings))]);
	if (l.sensorBindings) setProp(n, 'sensor-bindings', [cells(...bindingsToCells(l.sensorBindings))]);
	else setProp(n, 'sensor-bindings', undefined);
	return n;
}

function applyCombo(c: Combo): DtsNode {
	const n = structuredClone(c.node);
	n.name = c.nodeName;
	n.labels = c.labels;
	setProp(n, 'compatible', undefined);
	setProp(n, 'timeout-ms', c.timeoutMs !== undefined ? [cells(c.timeoutMs)] : undefined);
	setProp(n, 'key-positions', [cells(...c.keyPositions)]);
	setProp(n, 'bindings', [cells(...bindingsToCells([c.binding]))]);
	setProp(n, 'layers', c.layers?.length ? [cells(...c.layers)] : undefined);
	setProp(n, 'require-prior-idle-ms', c.requirePriorIdleMs !== undefined ? [cells(c.requirePriorIdleMs)] : undefined);
	setProp(n, 'slow-release', c.slowRelease ? null : undefined);
	return n;
}

/** Group macro bindings so each control behavior starts a new `<...>` group. */
export function macroGroups(bs: Binding[]): Binding[][] {
	const groups: Binding[][] = [];
	let cur: Binding[] = [];
	for (const b of bs) {
		if (MACRO_CONTROL_MAP.has(b.behavior) && cur.length) {
			groups.push(cur);
			cur = [];
		}
		cur.push(b);
	}
	if (cur.length) groups.push(cur);
	return groups;
}

function applyMacro(m: Macro): DtsNode {
	const n = structuredClone(m.node);
	n.name = m.nodeName;
	n.labels = m.labels;
	setProp(n, 'compatible', [str(MACRO_COMPATIBLES[m.cells])]);
	setProp(n, '#binding-cells', [cells(m.cells)]);
	setProp(n, 'label', undefined);
	setProp(n, 'display-name', m.displayName ? [str(m.displayName)] : undefined);
	setProp(n, 'wait-ms', m.waitMs !== undefined ? [cells(m.waitMs)] : undefined);
	setProp(n, 'tap-ms', m.tapMs !== undefined ? [cells(m.tapMs)] : undefined);
	setProp(
		n,
		'bindings',
		macroGroups(m.bindings).map((g) => cells(...bindingsToCells(g)))
	);
	return n;
}

function applyCond(c: ConditionalLayer): DtsNode {
	const n = structuredClone(c.node);
	n.name = c.nodeName;
	n.labels = c.labels;
	setProp(n, 'if-layers', [cells(...c.ifLayers)]);
	setProp(n, 'then-layer', [cells(c.thenLayer)]);
	return n;
}

function applyGeneric(e: Entity): DtsNode {
	const n = structuredClone(e.node);
	n.name = e.nodeName;
	n.labels = e.labels;
	return n;
}

export const ROW_SIZES: Record<number, number[]> = {
	42: [12, 12, 12, 6],
	36: [10, 10, 10, 6]
};

function formatLayerBindings(p: DtsProperty, indent: string, total: number): string {
	const bs = cellsToBindings(propCells(p));
	const rows = ROW_SIZES[bs.length] ?? (total ? ROW_SIZES[total] : undefined);
	if (!rows || rows.reduce((a, b) => a + b, 0) !== bs.length) return formatPropDefault(p, indent);
	const strs = bs.map(bindingToString);
	const full = rows[0];
	const thumbOffset = (full - rows[rows.length - 1]) / 2;
	// rows -> matrix of [col, text]
	const grid: { col: number; text: string }[][] = [];
	let i = 0;
	for (const n of rows) {
		const off = n === full ? 0 : Math.floor((full - n) / 2) || thumbOffset;
		grid.push(strs.slice(i, i + n).map((text, j) => ({ col: off + j, text })));
		i += n;
	}
	const widths = Array(full).fill(0);
	for (const r of grid) for (const c of r) widths[c.col] = Math.max(widths[c.col], c.text.length);
	const lines = grid.map((r) => {
		let line = '';
		for (let col = 0; col < full; col++) {
			const cell = r.find((c) => c.col === col);
			const isLast = col === (r[r.length - 1]?.col ?? 0);
			const gap = col === full / 2 - 1 ? 4 : 2; // wider gap between the two halves
			if (cell) {
				line += isLast ? cell.text : cell.text.padEnd(widths[col] + gap);
				if (isLast) break;
			} else line += ''.padEnd(widths[col] + gap);
		}
		return line.trimEnd();
	});
	return `${indent}bindings = <\n${lines.join('\n')}\n${indent}>;`;
}

function formatMultiGroup(p: DtsProperty, indent: string): string {
	const pad = indent + '    ';
	const parts = (p.values ?? []).map((v) => (v.type === 'cells' ? `<${v.cells.join(' ')}>` : v.type === 'string' ? `"${v.value}"` : v.type === 'ref' ? v.value : `[${v.raw}]`));
	return `${indent}${p.name}\n${pad}= ${parts.join(`\n${pad}, `)}\n${pad};`;
}

function ensureRoot(ast: DtsItem[]): DtsNode {
	let root = ast.find((i): i is DtsNode => i.kind === 'node' && i.name === '/');
	if (!root) {
		root = { kind: 'node', name: '/', labels: [], children: [], blankBefore: true };
		ast.push(root);
	}
	return root;
}

const CONTAINER_TEMPLATES: Record<Exclude<ContainerKind, 'macros' | 'behaviors'>, { name: string; compatible: string }> = {
	keymap: { name: 'keymap', compatible: 'zmk,keymap' },
	combos: { name: 'combos', compatible: 'zmk,combos' },
	conditional: { name: 'conditional_layers', compatible: 'zmk,conditional-layers' }
};

function createContainer(ast: DtsItem[], kind: ContainerKind): DtsNode {
	const root = ensureRoot(ast);
	const n: DtsNode = { kind: 'node', name: kind === 'macros' ? 'macros' : kind === 'behaviors' ? 'behaviors' : CONTAINER_TEMPLATES[kind].name, labels: [], children: [], blankBefore: true };
	if (kind !== 'macros' && kind !== 'behaviors') setProp(n, 'compatible', [str(CONTAINER_TEMPLATES[kind].compatible)]);
	// put new containers before the keymap node so behaviors are defined before use
	const kmIdx = root.children.findIndex((c) => c.kind === 'node' && propString(getProp(c, 'compatible')) === 'zmk,keymap');
	if (kind !== 'keymap' && kmIdx >= 0) root.children.splice(kmIdx, 0, n);
	else root.children.push(n);
	return n;
}

export function serializeKeymap(km: Keymap): string {
	const ast: DtsItem[] = structuredClone(km.ast);
	const entitySet = new Set(km.entityPaths);

	// resolve container objects (before mutating anything)
	const containerObjs = new Map<string, DtsItem[]>();
	const resolve = (k: string): DtsItem[] | undefined => {
		if (containerObjs.has(k)) return containerObjs.get(k);
		const list = k === '' ? ast : nodeAt(ast, k.split('.').map(Number))?.children;
		if (list) containerObjs.set(k, list);
		return list;
	};
	for (const p of km.entityPaths) resolve(p.split('.').slice(0, -1).join('.'));
	for (const k of Object.values(km.containers)) if (k !== undefined) resolve(k);

	// generated nodes per container key
	const layerNodes = new WeakSet<DtsNode>();
	const multiGroupNodes = new WeakSet<DtsNode>();
	const pending = new Map<DtsItem[], DtsNode[]>();
	const add = (list: DtsItem[], n: DtsNode) => {
		if (!pending.has(list)) pending.set(list, []);
		pending.get(list)!.push(n);
	};
	const newContainers = new Map<ContainerKind, DtsNode>();
	const containerFor = (kind: ContainerKind, existing?: string): DtsItem[] => {
		const k = existing ?? km.containers[kind];
		const list = k !== undefined ? resolve(k) : undefined;
		if (list) return list;
		if (!newContainers.has(kind)) newContainers.set(kind, createContainer(ast, kind));
		return newContainers.get(kind)!.children;
	};

	for (const l of km.layers) {
		const n = applyLayer(l);
		layerNodes.add(n);
		add(containerFor('keymap', l.container), n);
	}
	for (const c of km.combos) add(containerFor('combos', c.container), applyCombo(c));
	for (const c of km.conditionalLayers) add(containerFor('conditional', c.container), applyCond(c));
	for (const m of km.macros) {
		const n = applyMacro(m);
		multiGroupNodes.add(n);
		add(containerFor('macros', m.container), n);
	}
	for (const b of km.behaviors) {
		const n = applyGeneric(b);
		multiGroupNodes.add(n);
		add(containerFor('behaviors', b.container), n);
	}
	for (const o of km.overrides) add(o.container !== undefined ? resolve(o.container) ?? ast : ast, applyGeneric(o));

	// rebuild each container's children: drop old entity nodes, insert generated ones at the first slot
	const pathOfList = new Map<DtsItem[], string>();
	for (const [k, list] of containerObjs) pathOfList.set(list, k);
	const lists = new Set<DtsItem[]>([...containerObjs.values(), ...pending.keys()]);
	for (const list of lists) {
		const k = pathOfList.get(list);
		const gen = pending.get(list) ?? [];
		const out: DtsItem[] = [];
		let inserted = false;
		const isOverrideList = list === ast;
		list.forEach((it, i) => {
			const isEntity = k !== undefined && entitySet.has(k === '' ? String(i) : `${k}.${i}`);
			if (isEntity) {
				if (!inserted) {
					out.push(...gen);
					inserted = true;
				}
				return;
			}
			// new top-level overrides go before the first root node
			if (isOverrideList && !inserted && it.kind === 'node' && it.name === '/') {
				out.push(...gen);
				inserted = true;
			}
			out.push(it);
		});
		if (!inserted) out.push(...gen);
		list.splice(0, list.length, ...out);
	}

	// physical layout selection (chosen node in root)
	const chosenNodes = findNodes(ast, (n) => n.name === 'chosen');
	if (km.physicalLayout) {
		let chosen = chosenNodes[0]?.node;
		if (!chosen) {
			chosen = { kind: 'node', name: 'chosen', labels: [], children: [] };
			ensureRoot(ast).children.unshift(chosen);
		}
		setProp(chosen, 'zmk,physical-layout', [{ type: 'ref', value: km.physicalLayout }]);
	} else {
		for (const { node } of chosenNodes) setProp(node, 'zmk,physical-layout', undefined);
		// drop now-empty chosen nodes
		const prune = (items: DtsItem[]) => {
			for (let i = items.length - 1; i >= 0; i--) {
				const it = items[i];
				if (it.kind === 'node') {
					if (it.name === 'chosen' && it.children.length === 0) items.splice(i, 1);
					else prune(it.children);
				}
			}
		};
		prune(ast);
	}

	const total = km.layers[0]?.bindings.length ?? 0;
	return printDts(ast, {
		formatProp(p, parent, indent) {
			if (parent && layerNodes.has(parent) && p.name === 'bindings') return formatLayerBindings(p, indent, total);
			if (parent && multiGroupNodes.has(parent) && (p.values?.length ?? 0) > 1) return formatMultiGroup(p, indent);
			return null;
		}
	});
}

/* ---------- factories ---------- */

export function emptyNode(name: string): DtsNode {
	return { kind: 'node', name, labels: [], children: [], blankBefore: true };
}

export function newLayer(name: string, size: number, displayName?: string): Layer {
	return {
		uid: newUid(),
		nodeName: name,
		labels: [],
		node: emptyNode(name),
		displayName,
		bindings: Array.from({ length: size }, () => ({ behavior: '&trans', params: [] }))
	};
}

export function newCombo(name: string): Combo {
	return {
		uid: newUid(),
		nodeName: name,
		labels: [],
		node: emptyNode(name),
		binding: { behavior: '&kp', params: ['ESC'] },
		keyPositions: [],
		timeoutMs: 50,
		slowRelease: false
	};
}

export function newMacro(name: string, cellsN: 0 | 1 | 2 = 0): Macro {
	return {
		uid: newUid(),
		nodeName: name,
		labels: [name],
		node: emptyNode(name),
		cells: cellsN,
		waitMs: 30,
		tapMs: 30,
		bindings: [
			{ behavior: '&macro_tap', params: [] },
			{ behavior: '&kp', params: ['H'] },
			{ behavior: '&kp', params: ['I'] }
		]
	};
}

export function newConditional(name: string, ifLayers: number[], thenLayer: number): ConditionalLayer {
	return { uid: newUid(), nodeName: name, labels: [], node: emptyNode(name), ifLayers, thenLayer };
}

/** Labels (phandles) that can be used as behaviors from this keymap. */
export function definedBehaviorRefs(km: Keymap): Map<string, CustomBehavior | Macro> {
	const out = new Map<string, CustomBehavior | Macro>();
	for (const b of km.behaviors) for (const l of b.labels) out.set(`&${l}`, b);
	for (const m of km.macros) for (const l of m.labels) out.set(`&${l}`, m);
	return out;
}
