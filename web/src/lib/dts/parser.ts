import type { DtsItem, DtsNode, PropValue } from './ast';

const DIRECTIVES = /^#\s*(include|define|undef|if|ifdef|ifndef|else|elif|endif|pragma|error|warning)\b/;

type Tok =
	| { t: 'word'; v: string; line: number; blank: boolean }
	| { t: 'punct'; v: '{' | '}' | ';' | '=' | ',' | ':'; line: number; blank: boolean }
	| { t: 'string'; v: string; line: number; blank: boolean }
	| { t: 'cells'; v: string[]; line: number; blank: boolean }
	| { t: 'bytes'; v: string; line: number; blank: boolean }
	| { t: 'comment'; v: string; line: number; blank: boolean; trailing: boolean }
	| { t: 'directive'; v: string; line: number; blank: boolean };

export class DtsParseError extends Error {
	constructor(
		msg: string,
		public line: number
	) {
		super(`${msg} (baris ${line})`);
	}
}

/** Split the inside of `< ... >` into cells, respecting parentheses and dropping comments. */
export function splitCells(src: string): string[] {
	const out: string[] = [];
	let cur = '';
	let depth = 0;
	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (ch === '/' && src[i + 1] === '/') {
			const nl = src.indexOf('\n', i);
			i = nl < 0 ? src.length : nl;
			if (depth === 0 && cur) (out.push(cur), (cur = ''));
			continue;
		}
		if (ch === '/' && src[i + 1] === '*') {
			const end = src.indexOf('*/', i + 2);
			i = end < 0 ? src.length : end + 1;
			if (depth === 0 && cur) (out.push(cur), (cur = ''));
			continue;
		}
		if (ch === '(') depth++;
		if (ch === ')') depth--;
		if (/\s/.test(ch) && depth === 0) {
			if (cur) out.push(cur);
			cur = '';
			continue;
		}
		if (/\s/.test(ch)) {
			if (!cur.endsWith(' ')) cur += ' ';
			continue;
		}
		cur += ch;
	}
	if (cur) out.push(cur);
	return out;
}

function tokenize(src: string): Tok[] {
	const toks: Tok[] = [];
	let i = 0;
	let line = 1;
	let lastTokLine = 0;
	let newlinesSinceTok = 0;
	let atLineStart = true;

	const push = (tok: Omit<Tok, 'line' | 'blank'> & Record<string, unknown>) => {
		toks.push({ ...tok, line, blank: newlinesSinceTok >= 2 } as Tok);
		newlinesSinceTok = 0;
		lastTokLine = line;
		atLineStart = false;
	};

	while (i < src.length) {
		const ch = src[i];
		if (ch === '\n') {
			line++;
			newlinesSinceTok++;
			atLineStart = true;
			i++;
			continue;
		}
		if (/\s/.test(ch)) {
			i++;
			continue;
		}
		// comments
		if (ch === '/' && src[i + 1] === '/') {
			const end = src.indexOf('\n', i);
			const text = src.slice(i, end < 0 ? src.length : end).trimEnd();
			const trailing = lastTokLine === line && toks.length > 0;
			push({ t: 'comment', v: text, trailing });
			i = end < 0 ? src.length : end;
			continue;
		}
		if (ch === '/' && src[i + 1] === '*') {
			const end = src.indexOf('*/', i + 2);
			const stop = end < 0 ? src.length : end + 2;
			const text = src.slice(i, stop);
			const trailing = lastTokLine === line && toks.length > 0;
			const startLine = line;
			line += (text.match(/\n/g) ?? []).length;
			toks.push({ t: 'comment', v: text, trailing, line: startLine, blank: newlinesSinceTok >= 2 });
			newlinesSinceTok = 0;
			lastTokLine = line;
			atLineStart = false;
			i = stop;
			continue;
		}
		// preprocessor directive
		if (ch === '#' && atLineStart && DIRECTIVES.test(src.slice(i, i + 12))) {
			let j = i;
			let text = '';
			// honour line continuations
			for (;;) {
				const nl = src.indexOf('\n', j);
				const seg = src.slice(j, nl < 0 ? src.length : nl);
				text += seg;
				j = nl < 0 ? src.length : nl;
				if (seg.endsWith('\\') && nl >= 0) {
					text += '\n';
					j = nl + 1;
					line++;
					continue;
				}
				break;
			}
			push({ t: 'directive', v: text.trimEnd() });
			i = j;
			continue;
		}
		if (ch === '"') {
			let j = i + 1;
			let v = '';
			while (j < src.length && src[j] !== '"') {
				if (src[j] === '\\') {
					v += src[j] + src[j + 1];
					j += 2;
					continue;
				}
				v += src[j++];
			}
			push({ t: 'string', v });
			i = j + 1;
			continue;
		}
		if (ch === '<') {
			let j = i + 1;
			let depth = 0;
			while (j < src.length) {
				const c = src[j];
				if (c === '(') depth++;
				else if (c === ')') depth--;
				else if (c === '>' && depth <= 0) break;
				j++;
			}
			const inner = src.slice(i + 1, j);
			push({ t: 'cells', v: splitCells(inner) });
			line += (inner.match(/\n/g) ?? []).length;
			lastTokLine = line;
			i = j + 1;
			continue;
		}
		if (ch === '[') {
			const j = src.indexOf(']', i);
			push({ t: 'bytes', v: src.slice(i + 1, j).trim() });
			i = j + 1;
			continue;
		}
		if ('{};=,'.includes(ch)) {
			push({ t: 'punct', v: ch as '{' });
			i++;
			continue;
		}
		// words: names, labels (foo:), refs (&foo), /delete-property/, /
		let j = i;
		while (j < src.length && !/[\s{};=<>"[\]]/.test(src[j])) {
			if (src[j] === '/' && (src[j + 1] === '/' || src[j + 1] === '*') && j > i) break;
			j++;
		}
		if (j === i) {
			throw new DtsParseError(`Karakter tak terduga '${ch}'`, line);
		}
		let word = src.slice(i, j);
		// a trailing comma separates values (`&a, &b`), it is not part of the word
		while (word.endsWith(',') && word.length > 1) {
			word = word.slice(0, -1);
			j--;
		}
		// label "foo:" (label may be glued to the next token)
		const m = word.match(/^([A-Za-z_][\w]*):(.*)$/);
		if (m && !word.startsWith('&')) {
			push({ t: 'word', v: m[1] });
			push({ t: 'punct', v: ':' });
			word = m[2];
			if (!word) {
				i = j;
				continue;
			}
		}
		push({ t: 'word', v: word });
		i = j;
	}
	return toks;
}

export function parseDts(src: string): DtsItem[] {
	const toks = tokenize(src);
	let p = 0;

	const peek = (o = 0) => toks[p + o];
	const expect = (v: string) => {
		const t = toks[p];
		if (!t || t.v !== v) throw new DtsParseError(`Diharapkan '${v}', ditemukan '${t ? String(t.v) : 'EOF'}'`, t?.line ?? 0);
		p++;
	};

	function parseValues(): PropValue[] {
		const vals: PropValue[] = [];
		for (;;) {
			const t = toks[p];
			if (!t) throw new DtsParseError('EOF di dalam nilai properti', 0);
			if (t.t === 'cells') vals.push({ type: 'cells', cells: t.v });
			else if (t.t === 'string') vals.push({ type: 'string', value: t.v });
			else if (t.t === 'bytes') vals.push({ type: 'bytes', raw: t.v });
			else if (t.t === 'word' && t.v.startsWith('&')) vals.push({ type: 'ref', value: t.v });
			else if (t.t === 'word') vals.push({ type: 'cells', cells: [t.v] }); // macro expanding to value
			else if (t.t === 'comment') {
				p++;
				continue;
			} else throw new DtsParseError(`Nilai properti tidak valid '${String(t.v)}'`, t.line);
			p++;
			// skip comments between values
			while (toks[p]?.t === 'comment') p++;
			if (toks[p]?.v === ',') {
				p++;
				continue;
			}
			break;
		}
		return vals;
	}

	function parseItems(inNode: boolean): DtsItem[] {
		const items: DtsItem[] = [];
		while (p < toks.length) {
			const t = toks[p];
			if (t.t === 'punct' && t.v === '}') {
				if (!inNode) throw new DtsParseError("'}' tanpa pasangan", t.line);
				return items;
			}
			if (t.t === 'comment') {
				items.push({ kind: 'comment', text: t.v, trailing: t.trailing, blankBefore: t.blank });
				p++;
				continue;
			}
			if (t.t === 'directive') {
				items.push({ kind: 'directive', text: t.v, blankBefore: t.blank });
				p++;
				continue;
			}
			if (t.t === 'punct' && t.v === ';') {
				p++; // stray semicolon
				continue;
			}
			if (t.t !== 'word') throw new DtsParseError(`Token tak terduga '${String(t.v)}'`, t.line);
			const blank = t.blank;

			if (t.v === '/delete-property/' || t.v === '/delete-node/') {
				const name = toks[p + 1];
				p += 2;
				if (toks[p]?.v === ';') p++;
				items.push({
					kind: 'delete',
					what: t.v === '/delete-property/' ? 'property' : 'node',
					name: String(name?.v ?? ''),
					blankBefore: blank
				});
				continue;
			}
			if (t.v === '/dts-v1/' || t.v === '/plugin/') {
				p++;
				if (toks[p]?.v === ';') p++;
				items.push({ kind: 'raw', text: `${t.v};`, blankBefore: blank });
				continue;
			}

			const labels: string[] = [];
			while (peek()?.t === 'word' && peek(1)?.v === ':') {
				labels.push(String(peek()!.v));
				p += 2;
			}
			const nameTok = toks[p];
			if (!nameTok || nameTok.t !== 'word') throw new DtsParseError('Nama node/properti hilang', nameTok?.line ?? 0);
			const name = nameTok.v;
			p++;
			const next = toks[p];
			if (next?.v === '{') {
				p++;
				const children = parseItems(true);
				expect('}');
				if (toks[p]?.v === ';') p++;
				items.push({ kind: 'node', name, labels, children, blankBefore: blank || nameTok.blank });
			} else if (next?.v === '=') {
				p++;
				const values = parseValues();
				if (toks[p]?.v === ';') p++;
				else throw new DtsParseError(`';' hilang setelah properti '${name}'`, toks[p]?.line ?? nameTok.line);
				items.push({ kind: 'prop', name, labels, values, blankBefore: blank || nameTok.blank });
			} else if (next?.v === ';') {
				p++;
				items.push({ kind: 'prop', name, labels, values: null, blankBefore: blank || nameTok.blank });
			} else {
				throw new DtsParseError(`Diharapkan '{', '=' atau ';' setelah '${name}'`, next?.line ?? nameTok.line);
			}
		}
		if (inNode) throw new DtsParseError("'}' penutup hilang", toks[toks.length - 1]?.line ?? 0);
		return items;
	}

	return parseItems(false);
}

export function findNodes(items: DtsItem[], pred: (n: DtsNode, path: number[]) => boolean, base: number[] = []) {
	const out: { node: DtsNode; path: number[] }[] = [];
	items.forEach((it, i) => {
		if (it.kind !== 'node') return;
		const path = [...base, i];
		if (pred(it, path)) out.push({ node: it, path });
		out.push(...findNodes(it.children, pred, path));
	});
	return out;
}

export function nodeAt(items: DtsItem[], path: number[]): DtsNode | undefined {
	let cur: DtsItem | undefined;
	let list = items;
	for (const i of path) {
		cur = list[i];
		if (!cur || cur.kind !== 'node') return undefined;
		list = cur.children;
	}
	return cur as DtsNode;
}
