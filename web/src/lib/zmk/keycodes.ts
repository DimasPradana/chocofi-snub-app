/**
 * ZMK keycodes (subset of dt-bindings/zmk/keys.h used in practice).
 * names[0] is the canonical name used when inserting; the rest are aliases.
 */

export type KeyCategory =
	| 'letter'
	| 'number'
	| 'symbol'
	| 'edit'
	| 'nav'
	| 'mod'
	| 'fn'
	| 'media'
	| 'keypad'
	| 'app'
	| 'intl'
	| 'lock';

export interface Keycode {
	names: string[];
	label: string; // short label rendered on the key
	desc: string;
	category: KeyCategory;
	shifted?: boolean; // implicitly includes shift (e.g. EXCL = LS(N1))
}

export const CATEGORY_LABELS: Record<KeyCategory, string> = {
	letter: 'Huruf',
	number: 'Angka',
	symbol: 'Simbol',
	edit: 'Edit',
	nav: 'Navigasi',
	mod: 'Modifier',
	fn: 'Fungsi',
	media: 'Media',
	keypad: 'Keypad',
	app: 'Aplikasi',
	intl: 'Internasional',
	lock: 'Lock'
};

const K = (names: string[], label: string, category: KeyCategory, desc = '', shifted = false): Keycode => ({
	names,
	label,
	category,
	desc: desc || names[0],
	shifted
});

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => K([c], c, 'letter', `Huruf ${c}`));
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => K([`N${n}`, `NUMBER_${n}`], String(n), 'number', `Angka ${n}`));
const fkeys = Array.from({ length: 24 }, (_, i) => K([`F${i + 1}`], `F${i + 1}`, 'fn', `Fungsi F${i + 1}`));
const keypadNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) =>
	K([`KP_N${n}`, `KP_NUMBER_${n}`], `KP${n}`, 'keypad', `Keypad ${n}`)
);

export const KEYCODES: Keycode[] = [
	...letters,
	...numbers,
	// symbols
	K(['EXCLAMATION', 'EXCL'], '!', 'symbol', 'Tanda seru', true),
	K(['AT_SIGN', 'AT'], '@', 'symbol', 'At', true),
	K(['HASH', 'POUND'], '#', 'symbol', 'Pagar', true),
	K(['DOLLAR', 'DLLR'], '$', 'symbol', 'Dolar', true),
	K(['PERCENT', 'PRCNT'], '%', 'symbol', 'Persen', true),
	K(['CARET'], '^', 'symbol', 'Caret', true),
	K(['AMPERSAND', 'AMPS'], '&', 'symbol', 'Ampersand', true),
	K(['ASTERISK', 'ASTRK', 'STAR'], '*', 'symbol', 'Bintang', true),
	K(['LEFT_PARENTHESIS', 'LPAR'], '(', 'symbol', 'Kurung buka', true),
	K(['RIGHT_PARENTHESIS', 'RPAR'], ')', 'symbol', 'Kurung tutup', true),
	K(['MINUS'], '-', 'symbol', 'Minus'),
	K(['UNDERSCORE', 'UNDER'], '_', 'symbol', 'Garis bawah', true),
	K(['EQUAL'], '=', 'symbol', 'Sama dengan'),
	K(['PLUS'], '+', 'symbol', 'Plus', true),
	K(['LEFT_BRACKET', 'LBKT'], '[', 'symbol', 'Kurung siku buka'),
	K(['RIGHT_BRACKET', 'RBKT'], ']', 'symbol', 'Kurung siku tutup'),
	K(['LEFT_BRACE', 'LBRC'], '{', 'symbol', 'Kurung kurawal buka', true),
	K(['RIGHT_BRACE', 'RBRC'], '}', 'symbol', 'Kurung kurawal tutup', true),
	K(['BACKSLASH', 'BSLH'], '\\', 'symbol', 'Backslash'),
	K(['PIPE'], '|', 'symbol', 'Pipe', true),
	K(['NON_US_HASH', 'NUHS'], '#~', 'symbol', 'Non-US # (ISO)'),
	K(['SEMICOLON', 'SEMI'], ';', 'symbol', 'Titik koma'),
	K(['COLON'], ':', 'symbol', 'Titik dua', true),
	K(['SINGLE_QUOTE', 'SQT', 'APOSTROPHE', 'APOS', 'QUOTE'], "'", 'symbol', 'Petik tunggal'),
	K(['DOUBLE_QUOTES', 'DQT'], '"', 'symbol', 'Petik ganda', true),
	K(['GRAVE'], '`', 'symbol', 'Grave / backtick'),
	K(['TILDE'], '~', 'symbol', 'Tilde', true),
	K(['COMMA'], ',', 'symbol', 'Koma'),
	K(['LESS_THAN', 'LT'], '<', 'symbol', 'Lebih kecil', true),
	K(['PERIOD', 'DOT'], '.', 'symbol', 'Titik'),
	K(['GREATER_THAN', 'GT'], '>', 'symbol', 'Lebih besar', true),
	K(['SLASH', 'FSLH'], '/', 'symbol', 'Garis miring'),
	K(['QUESTION', 'QMARK'], '?', 'symbol', 'Tanda tanya', true),
	K(['NON_US_BACKSLASH', 'NUBS'], '\\|', 'symbol', 'Non-US \\ (ISO)'),
	K(['PIPE2'], '|', 'symbol', 'Pipe (ISO)', true),
	K(['TILDE2'], '~', 'symbol', 'Tilde (ISO)', true),
	// editing / whitespace
	K(['RETURN', 'ENTER', 'RET'], '⏎', 'edit', 'Enter'),
	K(['RETURN2', 'RET2'], '⏎₂', 'edit', 'Return 2'),
	K(['ESCAPE', 'ESC'], 'Esc', 'edit', 'Escape'),
	K(['BACKSPACE', 'BSPC', 'BKSP'], '⌫', 'edit', 'Backspace'),
	K(['TAB'], '⇥', 'edit', 'Tab'),
	K(['SPACE', 'SPC'], '␣', 'edit', 'Spasi'),
	K(['DELETE', 'DEL'], '⌦', 'edit', 'Delete'),
	K(['INSERT', 'INS'], 'Ins', 'edit', 'Insert'),
	K(['K_UNDO', 'UNDO'], 'Undo', 'edit', 'Undo (HID)'),
	K(['K_CUT', 'CUT'], 'Cut', 'edit', 'Cut (HID)'),
	K(['K_COPY', 'COPY'], 'Copy', 'edit', 'Copy (HID)'),
	K(['K_PASTE', 'PASTE'], 'Paste', 'edit', 'Paste (HID)'),
	K(['K_REDO', 'K_AGAIN', 'AGAIN'], 'Redo', 'edit', 'Redo / Again'),
	K(['K_FIND', 'FIND'], 'Find', 'edit', 'Find (HID)'),
	// navigation
	K(['HOME'], 'Home', 'nav', 'Home'),
	K(['END'], 'End', 'nav', 'End'),
	K(['PAGE_UP', 'PG_UP'], 'PgUp', 'nav', 'Page Up'),
	K(['PAGE_DOWN', 'PG_DN'], 'PgDn', 'nav', 'Page Down'),
	K(['LEFT_ARROW', 'LEFT'], '←', 'nav', 'Panah kiri'),
	K(['RIGHT_ARROW', 'RIGHT'], '→', 'nav', 'Panah kanan'),
	K(['UP_ARROW', 'UP'], '↑', 'nav', 'Panah atas'),
	K(['DOWN_ARROW', 'DOWN'], '↓', 'nav', 'Panah bawah'),
	K(['PRINTSCREEN', 'PSCRN'], 'PrtSc', 'nav', 'Print Screen'),
	K(['PAUSE_BREAK'], 'Pause', 'nav', 'Pause/Break'),
	K(['K_APPLICATION', 'K_APP', 'K_CONTEXT_MENU', 'K_CMENU'], '☰', 'nav', 'Menu konteks'),
	// locks
	K(['CAPSLOCK', 'CAPS', 'CLCK'], 'Caps', 'lock', 'Caps Lock'),
	K(['SCROLLLOCK', 'SLCK'], 'ScrLk', 'lock', 'Scroll Lock'),
	K(['KP_NUMLOCK', 'KP_NUM', 'KP_NLCK'], 'NumLk', 'lock', 'Num Lock'),
	// modifiers
	K(['LEFT_SHIFT', 'LSHIFT', 'LSHFT'], '⇧', 'mod', 'Shift kiri'),
	K(['RIGHT_SHIFT', 'RSHIFT', 'RSHFT'], 'R⇧', 'mod', 'Shift kanan'),
	K(['LEFT_CONTROL', 'LCTRL', 'LCTL'], '⌃', 'mod', 'Control kiri'),
	K(['RIGHT_CONTROL', 'RCTRL', 'RCTL'], 'R⌃', 'mod', 'Control kanan'),
	K(['LEFT_ALT', 'LALT'], '⌥', 'mod', 'Alt kiri'),
	K(['RIGHT_ALT', 'RALT'], 'R⌥', 'mod', 'Alt kanan / AltGr'),
	K(['LEFT_GUI', 'LGUI', 'LWIN', 'LCMD', 'LMETA'], '◆', 'mod', 'GUI kiri (Win/Cmd/Super)'),
	K(['RIGHT_GUI', 'RGUI', 'RWIN', 'RCMD', 'RMETA'], 'R◆', 'mod', 'GUI kanan'),
	// function
	...fkeys,
	// media / consumer
	K(['C_VOLUME_UP', 'C_VOL_UP'], '🔊', 'media', 'Volume naik'),
	K(['C_VOLUME_DOWN', 'C_VOL_DN'], '🔉', 'media', 'Volume turun'),
	K(['C_MUTE'], '🔇', 'media', 'Mute'),
	K(['C_PLAY_PAUSE', 'C_PP'], '⏯', 'media', 'Play/Pause'),
	K(['C_PLAY'], '▶', 'media', 'Play'),
	K(['C_PAUSE'], '⏸', 'media', 'Pause'),
	K(['C_NEXT'], '⏭', 'media', 'Lagu berikutnya'),
	K(['C_PREVIOUS', 'C_PREV'], '⏮', 'media', 'Lagu sebelumnya'),
	K(['C_STOP'], '⏹', 'media', 'Stop'),
	K(['C_FAST_FORWARD', 'C_FF'], '⏩', 'media', 'Fast forward'),
	K(['C_REWIND', 'C_RW'], '⏪', 'media', 'Rewind'),
	K(['C_EJECT'], '⏏', 'media', 'Eject'),
	K(['C_BRIGHTNESS_INC', 'C_BRI_UP', 'C_BRI_INC'], '🔆', 'media', 'Kecerahan naik'),
	K(['C_BRIGHTNESS_DEC', 'C_BRI_DN', 'C_BRI_DEC'], '🔅', 'media', 'Kecerahan turun'),
	K(['C_BRIGHTNESS_MAXIMUM', 'C_BRI_MAX'], '☀max', 'media', 'Kecerahan maksimum'),
	K(['C_BRIGHTNESS_MINIMUM', 'C_BRI_MIN'], '☀min', 'media', 'Kecerahan minimum'),
	K(['C_POWER', 'C_PWR'], '⏻', 'media', 'Power (consumer)'),
	K(['C_SLEEP'], '☾', 'media', 'Sleep (consumer)'),
	K(['C_AL_CALCULATOR', 'C_AL_CALC'], 'Calc', 'app', 'Kalkulator'),
	K(['C_AL_WWW'], 'WWW', 'app', 'Browser'),
	K(['C_AL_EMAIL', 'C_AL_MAIL'], 'Mail', 'app', 'Email'),
	K(['C_AL_FILE_BROWSER', 'C_AL_FILES'], 'Files', 'app', 'File browser'),
	K(['C_AL_LOCK', 'C_AL_SCREENSAVER', 'C_AL_SCR_SAVE'], '🔒', 'app', 'Kunci layar'),
	K(['C_AC_SEARCH'], '🔍', 'app', 'Cari'),
	K(['C_AC_HOME'], '⌂', 'app', 'Browser home'),
	K(['C_AC_BACK'], '⇦', 'app', 'Browser back'),
	K(['C_AC_FORWARD'], '⇨', 'app', 'Browser forward'),
	K(['C_AC_REFRESH'], '⟳', 'app', 'Refresh'),
	K(['C_AC_BOOKMARKS', 'C_AC_BOOKMARK'], '★', 'app', 'Bookmark'),
	K(['K_POWER', 'K_PWR'], '⏻', 'app', 'Power'),
	K(['K_SLEEP'], 'Sleep', 'app', 'Sleep'),
	K(['K_MUTE'], 'Mute', 'media', 'Mute (keyboard page)'),
	K(['K_VOLUME_UP', 'K_VOL_UP'], 'Vol+', 'media', 'Volume naik (keyboard page)'),
	K(['K_VOLUME_DOWN', 'K_VOL_DN'], 'Vol-', 'media', 'Volume turun (keyboard page)'),
	// keypad
	...keypadNums,
	K(['KP_DIVIDE', 'KP_SLASH'], 'KP/', 'keypad', 'Keypad /'),
	K(['KP_MULTIPLY', 'KP_ASTERISK'], 'KP*', 'keypad', 'Keypad *'),
	K(['KP_MINUS', 'KP_SUBTRACT'], 'KP-', 'keypad', 'Keypad -'),
	K(['KP_PLUS'], 'KP+', 'keypad', 'Keypad +'),
	K(['KP_ENTER'], 'KP⏎', 'keypad', 'Keypad Enter'),
	K(['KP_DOT'], 'KP.', 'keypad', 'Keypad .'),
	K(['KP_EQUAL'], 'KP=', 'keypad', 'Keypad ='),
	K(['KP_COMMA'], 'KP,', 'keypad', 'Keypad ,'),
	// international
	K(['INTERNATIONAL_1', 'INT1', 'INT_RO'], 'Ro', 'intl', 'International 1 (JIS Ro)'),
	K(['INTERNATIONAL_2', 'INT2', 'INT_KANA'], 'Kana', 'intl', 'International 2'),
	K(['INTERNATIONAL_3', 'INT3', 'INT_YEN'], '¥', 'intl', 'International 3 (Yen)'),
	K(['INTERNATIONAL_4', 'INT4', 'INT_HENKAN'], 'Henk', 'intl', 'International 4'),
	K(['INTERNATIONAL_5', 'INT5', 'INT_MUHENKAN'], 'Mhen', 'intl', 'International 5'),
	K(['LANGUAGE_1', 'LANG1', 'LANG_HANGEUL'], 'Lng1', 'intl', 'Language 1'),
	K(['LANGUAGE_2', 'LANG2', 'LANG_HANJA'], 'Lng2', 'intl', 'Language 2'),
	K(['MACRO_PLACEHOLDER'], '⟨P⟩', 'app', 'Placeholder parameter macro (diisi oleh &macro_param_*)')
];

const byName = new Map<string, Keycode>();
for (const k of KEYCODES) for (const n of k.names) byName.set(n, k);

export function findKeycode(name: string): Keycode | undefined {
	return byName.get(name);
}

/* ---------- modifier functions: LS(A), LC(LS(TAB)) ---------- */

export const MOD_FUNCS: Record<string, { label: string; desc: string }> = {
	LS: { label: '⇧', desc: 'Shift kiri' },
	RS: { label: 'R⇧', desc: 'Shift kanan' },
	LC: { label: '⌃', desc: 'Control kiri' },
	RC: { label: 'R⌃', desc: 'Control kanan' },
	LA: { label: '⌥', desc: 'Alt kiri' },
	RA: { label: 'R⌥', desc: 'Alt kanan' },
	LG: { label: '◆', desc: 'GUI kiri' },
	RG: { label: 'R◆', desc: 'GUI kanan' }
};

export interface ParsedKey {
	mods: string[]; // e.g. ['LC','LS']
	base: string; // e.g. 'TAB'
	keycode?: Keycode;
}

/** Parse "LC(LS(TAB))" into mods + base. */
export function parseKeyExpr(expr: string): ParsedKey {
	const mods: string[] = [];
	let s = expr.trim();
	for (;;) {
		const m = s.match(/^([LR][SCAG])\((.*)\)$/);
		if (!m) break;
		mods.push(m[1]);
		s = m[2].trim();
	}
	return { mods, base: s, keycode: findKeycode(s) };
}

export function buildKeyExpr(mods: string[], base: string): string {
	return mods.reduceRight((acc, m) => `${m}(${acc})`, base);
}

export function keyLabel(expr: string): string {
	const p = parseKeyExpr(expr);
	const base = p.keycode?.label ?? p.base;
	return p.mods.map((m) => MOD_FUNCS[m]?.label ?? m).join('') + base;
}

export function keyDesc(expr: string): string {
	const p = parseKeyExpr(expr);
	const base = p.keycode?.desc ?? p.base;
	return [...p.mods.map((m) => MOD_FUNCS[m]?.desc ?? m), base].join(' + ');
}

/** Modifiers usable as the hold part of &mt / &sk */
export const MODIFIER_NAMES = [
	'LEFT_SHIFT',
	'LEFT_CONTROL',
	'LEFT_ALT',
	'LEFT_GUI',
	'RIGHT_SHIFT',
	'RIGHT_CONTROL',
	'RIGHT_ALT',
	'RIGHT_GUI'
];

export function searchKeycodes(q: string, limit = 400): Keycode[] {
	const query = q.trim().toLowerCase();
	if (!query) return KEYCODES.slice(0, limit);
	const scored: [number, Keycode][] = [];
	for (const k of KEYCODES) {
		let score = 0;
		for (const n of k.names) {
			const ln = n.toLowerCase();
			if (ln === query) score = Math.max(score, 100);
			else if (ln.startsWith(query)) score = Math.max(score, 60);
			else if (ln.includes(query)) score = Math.max(score, 30);
		}
		if (k.label.toLowerCase() === query) score = Math.max(score, 90);
		if (k.desc.toLowerCase().includes(query)) score = Math.max(score, 20);
		if (score) scored.push([score, k]);
	}
	return scored
		.sort((a, b) => b[0] - a[0])
		.slice(0, limit)
		.map((s) => s[1]);
}
