import type { DtsItem, DtsNode, DtsProperty, PropValue } from './ast';

export interface PrintOptions {
	indent?: string;
	/** Custom formatter for a property; return null to use the default. */
	formatProp?: (prop: DtsProperty, node: DtsNode | null, indent: string) => string | null;
}

export function formatValue(v: PropValue): string {
	switch (v.type) {
		case 'cells':
			return `<${v.cells.join(' ')}>`;
		case 'string':
			return `"${v.value}"`;
		case 'bytes':
			return `[${v.raw}]`;
		case 'ref':
			return v.value;
	}
}

export function formatPropDefault(p: DtsProperty, indent: string): string {
	const labels = p.labels.map((l) => `${l}: `).join('');
	if (p.values === null) return `${indent}${labels}${p.name};`;
	const parts = p.values.map(formatValue);
	const oneLine = `${indent}${labels}${p.name} = ${parts.join(', ')};`;
	if (oneLine.length <= 110 || parts.length === 1) return oneLine;
	// one value per line
	const pad = indent + '    ';
	return `${indent}${labels}${p.name}\n${pad}= ${parts.join(`\n${pad}, `)}\n${pad};`;
}

export function printDts(items: DtsItem[], opts: PrintOptions = {}): string {
	const unit = opts.indent ?? '    ';
	const lines: string[] = [];

	function emit(list: DtsItem[], depth: number, parent: DtsNode | null) {
		const ind = unit.repeat(depth);
		list.forEach((it, idx) => {
			if (it.blankBefore && idx > 0 && lines.length && lines[lines.length - 1] !== '') lines.push('');
			switch (it.kind) {
				case 'comment': {
					if (it.trailing && lines.length) {
						lines[lines.length - 1] += ` ${it.text}`;
					} else {
						const ls = it.text.split('\n');
						lines.push(ind + ls[0]);
						for (const l of ls.slice(1)) lines.push(l);
					}
					break;
				}
				case 'directive':
					lines.push(it.text);
					break;
				case 'raw':
					lines.push(ind + it.text);
					break;
				case 'delete':
					lines.push(`${ind}/delete-${it.what}/ ${it.name};`);
					break;
				case 'prop': {
					const custom = opts.formatProp?.(it, parent, ind);
					lines.push(custom ?? formatPropDefault(it, ind));
					break;
				}
				case 'node': {
					const labels = it.labels.map((l) => `${l}: `).join('');
					if (it.children.length === 0) {
						lines.push(`${ind}${labels}${it.name} {`, `${ind}};`);
						break;
					}
					const only = it.children.length === 1 ? it.children[0] : null;
					if (only && (only.kind === 'prop' || only.kind === 'delete')) {
						const inner =
							only.kind === 'delete'
								? `/delete-${only.what}/ ${only.name};`
								: (opts.formatProp?.(only, it, '') ?? formatPropDefault(only, ''));
						const one = `${ind}${labels}${it.name} { ${inner} };`;
						if (!inner.includes('\n') && one.length <= 100) {
							lines.push(one);
							break;
						}
					}
					lines.push(`${ind}${labels}${it.name} {`);
					emit(it.children, depth + 1, it);
					lines.push(`${ind}};`);
					break;
				}
			}
		});
	}

	emit(items, 0, null);
	return lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
