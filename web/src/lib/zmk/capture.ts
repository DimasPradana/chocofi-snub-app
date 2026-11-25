/** Map KeyboardEvent.code to a ZMK keycode name. */
const MAP: Record<string, string> = {
	Enter: 'RET',
	Escape: 'ESC',
	Backspace: 'BSPC',
	Tab: 'TAB',
	Space: 'SPACE',
	Minus: 'MINUS',
	Equal: 'EQUAL',
	BracketLeft: 'LBKT',
	BracketRight: 'RBKT',
	Backslash: 'BSLH',
	Semicolon: 'SEMI',
	Quote: 'SQT',
	Backquote: 'GRAVE',
	Comma: 'COMMA',
	Period: 'DOT',
	Slash: 'FSLH',
	IntlBackslash: 'NUBS',
	CapsLock: 'CAPS',
	PrintScreen: 'PSCRN',
	ScrollLock: 'SLCK',
	Pause: 'PAUSE_BREAK',
	Insert: 'INS',
	Home: 'HOME',
	PageUp: 'PG_UP',
	Delete: 'DEL',
	End: 'END',
	PageDown: 'PG_DN',
	ArrowRight: 'RIGHT',
	ArrowLeft: 'LEFT',
	ArrowDown: 'DOWN',
	ArrowUp: 'UP',
	NumLock: 'KP_NUM',
	NumpadDivide: 'KP_DIVIDE',
	NumpadMultiply: 'KP_MULTIPLY',
	NumpadSubtract: 'KP_MINUS',
	NumpadAdd: 'KP_PLUS',
	NumpadEnter: 'KP_ENTER',
	NumpadDecimal: 'KP_DOT',
	NumpadEqual: 'KP_EQUAL',
	ContextMenu: 'K_APP',
	ShiftLeft: 'LSHFT',
	ShiftRight: 'RSHFT',
	ControlLeft: 'LCTRL',
	ControlRight: 'RCTRL',
	AltLeft: 'LALT',
	AltRight: 'RALT',
	MetaLeft: 'LGUI',
	MetaRight: 'RGUI',
	AudioVolumeUp: 'C_VOL_UP',
	AudioVolumeDown: 'C_VOL_DN',
	AudioVolumeMute: 'C_MUTE',
	MediaPlayPause: 'C_PP',
	MediaTrackNext: 'C_NEXT',
	MediaTrackPrevious: 'C_PREV'
};

export function codeToZmk(code: string): string | undefined {
	if (MAP[code]) return MAP[code];
	let m = code.match(/^Key([A-Z])$/);
	if (m) return m[1];
	m = code.match(/^Digit(\d)$/);
	if (m) return `N${m[1]}`;
	m = code.match(/^Numpad(\d)$/);
	if (m) return `KP_N${m[1]}`;
	m = code.match(/^F(\d{1,2})$/);
	if (m) return `F${m[1]}`;
	return undefined;
}
