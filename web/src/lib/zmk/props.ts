/** Known devicetree properties of ZMK behaviors, for typed editing. */
import { cells, cellsToNumber, getProp, propCells, propString, setProp, str, type DtsNode, type PropValue } from '../dts/ast';
import { parseDts } from '../dts/parser';
import { formatValue } from '../dts/printer';

export type PropType = 'ms' | 'int' | 'bool' | 'enum' | 'positions' | 'mods' | 'string' | 'raw';

export interface PropSchema {
	name: string;
	type: PropType;
	desc: string;
	options?: string[];
	placeholder?: string;
}

const HOLD_TAP: PropSchema[] = [
	{ name: 'flavor', type: 'enum', desc: 'Cara memutuskan hold vs tap', options: ['hold-preferred', 'balanced', 'tap-preferred', 'tap-unless-interrupted'] },
	{ name: 'tapping-term-ms', type: 'ms', desc: 'Lama tahan sebelum dianggap hold', placeholder: '200' },
	{ name: 'quick-tap-ms', type: 'ms', desc: 'Tap lalu tahan cepat = repeat tap (bukan hold)', placeholder: '0' },
	{ name: 'require-prior-idle-ms', type: 'ms', desc: 'Jika tombol lain ditekan < n ms sebelumnya, langsung tap (anti misfire saat mengetik cepat)' },
	{ name: 'hold-trigger-key-positions', type: 'positions', desc: 'Positional hold-tap: hold hanya terpicu jika tombol berikutnya ada di posisi ini (biasanya tangan seberang)' },
	{ name: 'hold-trigger-on-release', type: 'bool', desc: 'Evaluasi posisi hold-trigger saat tombol dilepas (cocok untuk HRM berlapis)' },
	{ name: 'retro-tap', type: 'bool', desc: 'Jika ditahan lalu dilepas tanpa tombol lain → tetap tap' },
	{ name: 'hold-while-undecided', type: 'bool', desc: 'Langsung tekan hold selama belum diputuskan' },
	{ name: 'hold-while-undecided-linger', type: 'bool', desc: 'Pertahankan hold sementara setelah diputuskan tap' }
];

const STICKY: PropSchema[] = [
	{ name: 'release-after-ms', type: 'ms', desc: 'Lepas otomatis setelah n ms', placeholder: '1000' },
	{ name: 'quick-release', type: 'bool', desc: 'Lepas segera saat tombol berikutnya ditekan' },
	{ name: 'lazy', type: 'bool', desc: 'Aktif hanya tepat sebelum tombol berikutnya' },
	{ name: 'ignore-modifiers', type: 'bool', desc: 'Modifier lain tidak mengonsumsi sticky key' }
];

export const SCHEMAS: Record<string, PropSchema[]> = {
	'zmk,behavior-hold-tap': HOLD_TAP,
	'zmk,behavior-tap-dance': [{ name: 'tapping-term-ms', type: 'ms', desc: 'Jeda maksimum antar tap', placeholder: '200' }],
	'zmk,behavior-mod-morph': [
		{ name: 'mods', type: 'mods', desc: 'Modifier yang memicu binding kedua' },
		{ name: 'keep-mods', type: 'mods', desc: 'Modifier yang tetap diteruskan ke binding kedua' }
	],
	'zmk,behavior-sticky-key': STICKY,
	'&mt': HOLD_TAP,
	'&lt': HOLD_TAP,
	'&sk': STICKY,
	'&sl': STICKY,
	'&caps_word': [
		{ name: 'continue-list', type: 'raw', desc: 'Keycode yang tidak mengakhiri caps word', placeholder: '<UNDERSCORE MINUS BSPC>' },
		{ name: 'mods', type: 'mods', desc: 'Modifier yang diterapkan (default Shift)' }
	],
	'&soft_off': [
		{ name: 'hold-time-ms', type: 'ms', desc: 'Lama tahan sebelum mati' },
		{ name: 'split-peripheral-off-on-press', type: 'bool', desc: 'Matikan sisi peripheral saat ditekan' }
	],
	'&mmv': [
		{ name: 'time-to-max-speed-ms', type: 'ms', desc: 'Waktu sampai kecepatan maksimum kursor', placeholder: '300' },
		{ name: 'acceleration-exponent', type: 'int', desc: 'Kurva akselerasi (0 = linear konstan, 1 = linear, 2 = kuadrat)', placeholder: '1' },
		{ name: 'delay-ms', type: 'ms', desc: 'Jeda sebelum mulai bergerak' }
	],
	'&msc': [
		{ name: 'time-to-max-speed-ms', type: 'ms', desc: 'Waktu sampai kecepatan scroll maksimum', placeholder: '300' },
		{ name: 'acceleration-exponent', type: 'int', desc: 'Kurva akselerasi scroll', placeholder: '0' },
		{ name: 'delay-ms', type: 'ms', desc: 'Jeda sebelum mulai scroll' }
	],
	'&key_repeat': [{ name: 'usage-pages', type: 'raw', desc: 'Usage page yang diulang', placeholder: '<HID_USAGE_KEY HID_USAGE_CONSUMER>' }],
	'&gresc': [{ name: 'mods', type: 'mods', desc: 'Modifier yang mengubah Esc menjadi `' }]
};

export const OVERRIDABLE = ['&mt', '&lt', '&sk', '&sl', '&caps_word', '&soft_off', '&mmv', '&msc', '&key_repeat', '&gresc'];

export function readProp(node: DtsNode, s: PropSchema): string | boolean | number[] | string[] | undefined {
	const p = getProp(node, s.name);
	if (!p) return s.type === 'bool' ? false : undefined;
	switch (s.type) {
		case 'bool':
			return true;
		case 'ms':
		case 'int':
			return propCells(p)[0];
		case 'enum':
		case 'string':
			return propString(p);
		case 'positions':
			return propCells(p)
				.map((c) => cellsToNumber(c))
				.filter((n): n is number => n !== undefined);
		case 'mods':
			return propCells(p)
				.join(' ')
				.replace(/[()\s]/g, '')
				.split('|')
				.filter(Boolean);
		default:
			return (p.values ?? []).map(formatValue).join(', ');
	}
}

export function writeProp(node: DtsNode, s: PropSchema, v: string | boolean | number[] | string[] | undefined) {
	if (v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length)) return setProp(node, s.name, undefined);
	switch (s.type) {
		case 'bool':
			return setProp(node, s.name, null);
		case 'ms':
		case 'int':
			return setProp(node, s.name, [cells(String(v))]);
		case 'enum':
		case 'string':
			return setProp(node, s.name, [str(String(v))]);
		case 'positions':
			return setProp(node, s.name, [cells(...(v as number[]))]);
		case 'mods':
			return setProp(node, s.name, [cells(`(${(v as string[]).join('|')})`)]);
		default:
			return setProp(node, s.name, parseRawValue(String(v)));
	}
}

/** Parse property value text like `<&kp A>, <&kp B>` or `"foo"`. */
export function parseRawValue(text: string): PropValue[] {
	const items = parseDts(`x = ${text.trim().replace(/;$/, '')};`);
	const p = items[0];
	if (p?.kind !== 'prop' || !p.values) throw new Error('nilai tidak valid');
	return p.values;
}
