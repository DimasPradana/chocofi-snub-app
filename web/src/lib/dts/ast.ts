/** Minimal devicetree AST — enough to round-trip ZMK .keymap / .dtsi / .overlay files. */

export interface DtsNode {
	kind: 'node';
	name: string; // "/", "keymap", "&mt", "ssd1306@3c"
	labels: string[];
	children: DtsItem[];
	blankBefore?: boolean;
}

export type PropValue =
	| { type: 'cells'; cells: string[] }
	| { type: 'string'; value: string }
	| { type: 'bytes'; raw: string }
	| { type: 'ref'; value: string };

export interface DtsProperty {
	kind: 'prop';
	name: string;
	labels: string[];
	values: PropValue[] | null; // null = boolean property (`foo;`)
	blankBefore?: boolean;
}

export interface DtsComment {
	kind: 'comment';
	text: string;
	trailing?: boolean; // on the same line as the previous statement
	blankBefore?: boolean;
}

export interface DtsDirective {
	kind: 'directive';
	text: string; // full preprocessor line(s), e.g. "#include <behaviors.dtsi>"
	blankBefore?: boolean;
}

export interface DtsDelete {
	kind: 'delete';
	what: 'property' | 'node';
	name: string;
	blankBefore?: boolean;
}

export interface DtsRaw {
	kind: 'raw'; // e.g. "/dts-v1/;"
	text: string;
	blankBefore?: boolean;
}

export type DtsItem = DtsNode | DtsProperty | DtsComment | DtsDirective | DtsDelete | DtsRaw;

/* ---------- helpers ---------- */

export function getProp(node: DtsNode, name: string): DtsProperty | undefined {
	return node.children.find((c): c is DtsProperty => c.kind === 'prop' && c.name === name);
}

export function propCells(p: DtsProperty | undefined): string[] {
	if (!p?.values) return [];
	const out: string[] = [];
	for (const v of p.values) {
		if (v.type === 'cells') out.push(...v.cells);
		else if (v.type === 'ref') out.push(v.value);
	}
	return out;
}

/** Cells grouped per `<...>` value (used by macro / hold-tap `bindings = <&kp>, <&kp>`). */
export function propCellGroups(p: DtsProperty | undefined): string[][] {
	if (!p?.values) return [];
	return p.values.filter((v) => v.type === 'cells').map((v) => (v as { cells: string[] }).cells);
}

export function propString(p: DtsProperty | undefined): string | undefined {
	const v = p?.values?.find((v) => v.type === 'string');
	return v ? (v as { value: string }).value : undefined;
}

export function propStrings(p: DtsProperty | undefined): string[] {
	return (p?.values ?? []).filter((v) => v.type === 'string').map((v) => (v as { value: string }).value);
}

export function cellsToNumber(cell: string | undefined): number | undefined {
	if (cell === undefined) return undefined;
	const c = cell.replace(/^\((.*)\)$/, '$1').trim();
	if (/^-?\d+$/.test(c)) return parseInt(c, 10);
	if (/^0x[0-9a-f]+$/i.test(c)) return parseInt(c, 16);
	return undefined;
}

export function childNodes(node: DtsNode): DtsNode[] {
	return node.children.filter((c): c is DtsNode => c.kind === 'node');
}

export function prop(name: string, values: PropValue[] | null): DtsProperty {
	return { kind: 'prop', name, labels: [], values };
}

export const cells = (...c: (string | number)[]): PropValue => ({ type: 'cells', cells: c.map(String) });
export const str = (value: string): PropValue => ({ type: 'string', value });

/** Replace (or insert, or remove if values === undefined) a property, keeping its position. */
export function setProp(node: DtsNode, name: string, values: PropValue[] | null | undefined) {
	const idx = node.children.findIndex((c) => c.kind === 'prop' && c.name === name);
	if (values === undefined) {
		if (idx >= 0) node.children.splice(idx, 1);
		return;
	}
	if (idx >= 0) (node.children[idx] as DtsProperty).values = values;
	else {
		// insert after the last property (before child nodes)
		let at = 0;
		node.children.forEach((c, i) => {
			if (c.kind === 'prop' || c.kind === 'delete') at = i + 1;
		});
		node.children.splice(at, 0, prop(name, values));
	}
}
