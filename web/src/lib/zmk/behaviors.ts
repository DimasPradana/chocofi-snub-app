/** Built-in ZMK behaviors (v0.3) with parameter metadata for the binding editor. */

export type ParamKind = 'keycode' | 'mod' | 'layer' | 'number' | 'enum' | 'raw';

export interface EnumOption {
	value: string;
	label: string;
	desc?: string;
	/** when selected, a numeric argument follows (e.g. BT_SEL 0) */
	needsNumber?: { label: string; min?: number; max?: number; base1Display?: boolean };
}

export interface ParamDef {
	name: string;
	kind: ParamKind;
	options?: EnumOption[];
}

export type BehaviorCategory =
	| 'key'
	| 'holdtap'
	| 'layer'
	| 'sticky'
	| 'mouse'
	| 'bluetooth'
	| 'output'
	| 'lighting'
	| 'system'
	| 'macro'
	| 'tapdance'
	| 'modmorph'
	| 'misc'
	| 'trans'
	| 'none';

export interface BehaviorDef {
	ref: string; // "&kp"
	name: string;
	desc: string;
	category: BehaviorCategory;
	params: ParamDef[];
	builtin: boolean;
	/** Kconfig option that must be enabled for this behavior */
	requires?: string;
	docs?: string;
}

export const CATEGORY_INFO: Record<BehaviorCategory, { label: string; color: string }> = {
	key: { label: 'Key press', color: 'var(--c-key)' },
	holdtap: { label: 'Hold-tap / mod-tap', color: 'var(--c-holdtap)' },
	layer: { label: 'Layer', color: 'var(--c-layer)' },
	sticky: { label: 'Sticky', color: 'var(--c-sticky)' },
	mouse: { label: 'Mouse', color: 'var(--c-mouse)' },
	bluetooth: { label: 'Bluetooth', color: 'var(--c-bt)' },
	output: { label: 'Output', color: 'var(--c-bt)' },
	lighting: { label: 'Lampu', color: 'var(--c-light)' },
	system: { label: 'Sistem', color: 'var(--c-system)' },
	macro: { label: 'Macro', color: 'var(--c-macro)' },
	tapdance: { label: 'Tap dance', color: 'var(--c-tapdance)' },
	modmorph: { label: 'Mod-morph', color: 'var(--c-modmorph)' },
	misc: { label: 'Lainnya', color: 'var(--c-misc)' },
	trans: { label: 'Transparan', color: 'var(--c-trans)' },
	none: { label: 'Kosong', color: 'var(--c-none)' }
};

const P = (name: string, kind: ParamKind, options?: EnumOption[]): ParamDef => ({ name, kind, options });

export const BT_OPTIONS: EnumOption[] = [
	{ value: 'BT_SEL', label: 'Pilih profil', desc: 'Pindah ke profil Bluetooth tertentu', needsNumber: { label: 'Profil', min: 0, max: 4, base1Display: true } },
	{ value: 'BT_NXT', label: 'Profil berikutnya' },
	{ value: 'BT_PRV', label: 'Profil sebelumnya' },
	{ value: 'BT_CLR', label: 'Hapus profil aktif', desc: 'Hapus pairing profil yang sedang dipakai' },
	{ value: 'BT_CLR_ALL', label: 'Hapus semua profil' },
	{ value: 'BT_DISC', label: 'Putuskan profil', needsNumber: { label: 'Profil', min: 0, max: 4, base1Display: true } }
];

export const OUT_OPTIONS: EnumOption[] = [
	{ value: 'OUT_USB', label: 'USB' },
	{ value: 'OUT_BLE', label: 'Bluetooth' },
	{ value: 'OUT_TOG', label: 'Toggle USB/BLE' }
];

export const EP_OPTIONS: EnumOption[] = [
	{ value: 'EP_ON', label: 'External power ON' },
	{ value: 'EP_OFF', label: 'External power OFF' },
	{ value: 'EP_TOG', label: 'Toggle external power' }
];

export const RGB_OPTIONS: EnumOption[] = [
	['RGB_TOG', 'Toggle'],
	['RGB_ON', 'On'],
	['RGB_OFF', 'Off'],
	['RGB_HUI', 'Hue +'],
	['RGB_HUD', 'Hue -'],
	['RGB_SAI', 'Saturasi +'],
	['RGB_SAD', 'Saturasi -'],
	['RGB_BRI', 'Kecerahan +'],
	['RGB_BRD', 'Kecerahan -'],
	['RGB_SPI', 'Kecepatan +'],
	['RGB_SPD', 'Kecepatan -'],
	['RGB_EFF', 'Efek berikutnya'],
	['RGB_EFR', 'Efek sebelumnya']
].map(([value, label]) => ({ value, label }));

export const BL_OPTIONS: EnumOption[] = [
	{ value: 'BL_TOG', label: 'Toggle' },
	{ value: 'BL_ON', label: 'On' },
	{ value: 'BL_OFF', label: 'Off' },
	{ value: 'BL_INC', label: 'Naik' },
	{ value: 'BL_DEC', label: 'Turun' },
	{ value: 'BL_CYCLE', label: 'Cycle' },
	{ value: 'BL_SET', label: 'Set level', needsNumber: { label: 'Level %', min: 0, max: 100 } }
];

export const MOUSE_BUTTONS: EnumOption[] = [
	{ value: 'LCLK', label: 'Klik kiri' },
	{ value: 'RCLK', label: 'Klik kanan' },
	{ value: 'MCLK', label: 'Klik tengah' },
	{ value: 'MB4', label: 'Tombol 4 (Back)' },
	{ value: 'MB5', label: 'Tombol 5 (Forward)' }
];

export const MOUSE_MOVES: EnumOption[] = [
	{ value: 'MOVE_UP', label: 'Gerak atas' },
	{ value: 'MOVE_DOWN', label: 'Gerak bawah' },
	{ value: 'MOVE_LEFT', label: 'Gerak kiri' },
	{ value: 'MOVE_RIGHT', label: 'Gerak kanan' }
];

export const MOUSE_SCROLLS: EnumOption[] = [
	{ value: 'SCRL_UP', label: 'Scroll atas' },
	{ value: 'SCRL_DOWN', label: 'Scroll bawah' },
	{ value: 'SCRL_LEFT', label: 'Scroll kiri' },
	{ value: 'SCRL_RIGHT', label: 'Scroll kanan' }
];

const POINTING = 'CONFIG_ZMK_POINTING';

export const BUILTIN_BEHAVIORS: BehaviorDef[] = [
	{ ref: '&kp', name: 'Key press', desc: 'Kirim keycode (boleh dengan modifier, mis. LC(C))', category: 'key', params: [P('Key', 'keycode')], builtin: true, docs: 'key-press' },
	{ ref: '&mt', name: 'Mod-tap', desc: 'Tahan = modifier, tap = key', category: 'holdtap', params: [P('Hold (modifier)', 'mod'), P('Tap', 'keycode')], builtin: true, docs: 'mod-tap' },
	{ ref: '&lt', name: 'Layer-tap', desc: 'Tahan = aktifkan layer, tap = key', category: 'holdtap', params: [P('Hold (layer)', 'layer'), P('Tap', 'keycode')], builtin: true, docs: 'layers#layer-tap' },
	{ ref: '&mo', name: 'Momentary layer', desc: 'Layer aktif selama tombol ditahan', category: 'layer', params: [P('Layer', 'layer')], builtin: true, docs: 'layers#momentary-layer' },
	{ ref: '&to', name: 'To layer', desc: 'Pindah ke layer ini (mematikan layer lain kecuali default)', category: 'layer', params: [P('Layer', 'layer')], builtin: true, docs: 'layers#to-layer' },
	{ ref: '&tog', name: 'Toggle layer', desc: 'Nyalakan/matikan layer', category: 'layer', params: [P('Layer', 'layer')], builtin: true, docs: 'layers#toggle-layer' },
	{ ref: '&sl', name: 'Sticky layer', desc: 'Layer aktif untuk satu penekanan berikutnya', category: 'sticky', params: [P('Layer', 'layer')], builtin: true, docs: 'sticky-layer' },
	{ ref: '&sk', name: 'Sticky key', desc: 'Modifier/key "menempel" untuk penekanan berikutnya (one-shot)', category: 'sticky', params: [P('Key', 'keycode')], builtin: true, docs: 'sticky-key' },
	{ ref: '&kt', name: 'Key toggle', desc: 'Tekan sekali = tahan, tekan lagi = lepas', category: 'key', params: [P('Key', 'keycode')], builtin: true, docs: 'key-toggle' },
	{ ref: '&trans', name: 'Transparent', desc: 'Teruskan ke layer aktif di bawahnya', category: 'trans', params: [], builtin: true, docs: 'misc#transparent' },
	{ ref: '&none', name: 'None', desc: 'Tidak melakukan apa-apa (menahan fall-through)', category: 'none', params: [], builtin: true, docs: 'misc#none' },
	{ ref: '&gresc', name: 'Grave escape', desc: 'Esc; dengan Shift/GUI menjadi `', category: 'misc', params: [], builtin: true, docs: 'mod-morph#grave-escape' },
	{ ref: '&caps_word', name: 'Caps word', desc: 'Kapital sampai kata selesai', category: 'misc', params: [], builtin: true, docs: 'caps-word' },
	{ ref: '&key_repeat', name: 'Key repeat', desc: 'Ulangi key terakhir', category: 'misc', params: [], builtin: true, docs: 'key-repeat' },
	{ ref: '&bt', name: 'Bluetooth', desc: 'Kontrol profil Bluetooth', category: 'bluetooth', params: [P('Perintah', 'enum', BT_OPTIONS)], builtin: true, docs: 'bluetooth' },
	{ ref: '&out', name: 'Output selection', desc: 'Pilih output USB / BLE', category: 'output', params: [P('Output', 'enum', OUT_OPTIONS)], builtin: true, docs: 'outputs' },
	{ ref: '&ext_power', name: 'External power', desc: 'Kontrol daya eksternal (OLED/RGB)', category: 'output', params: [P('Perintah', 'enum', EP_OPTIONS)], builtin: true, docs: 'power' },
	{ ref: '&rgb_ug', name: 'RGB underglow', desc: 'Kontrol RGB underglow', category: 'lighting', params: [P('Perintah', 'enum', RGB_OPTIONS)], builtin: true, requires: 'CONFIG_ZMK_RGB_UNDERGLOW', docs: 'underglow' },
	{ ref: '&bl', name: 'Backlight', desc: 'Kontrol backlight', category: 'lighting', params: [P('Perintah', 'enum', BL_OPTIONS)], builtin: true, requires: 'CONFIG_ZMK_BACKLIGHT', docs: 'backlight' },
	{ ref: '&mkp', name: 'Mouse click', desc: 'Klik tombol mouse', category: 'mouse', params: [P('Tombol', 'enum', MOUSE_BUTTONS)], builtin: true, requires: POINTING, docs: 'mouse-emulation' },
	{ ref: '&mmv', name: 'Mouse move', desc: 'Gerakkan kursor mouse', category: 'mouse', params: [P('Arah', 'enum', MOUSE_MOVES)], builtin: true, requires: POINTING, docs: 'mouse-emulation' },
	{ ref: '&msc', name: 'Mouse scroll', desc: 'Scroll mouse', category: 'mouse', params: [P('Arah', 'enum', MOUSE_SCROLLS)], builtin: true, requires: POINTING, docs: 'mouse-emulation' },
	{ ref: '&bootloader', name: 'Bootloader', desc: 'Masuk mode bootloader (UF2) untuk flashing', category: 'system', params: [], builtin: true, docs: 'reset' },
	{ ref: '&sys_reset', name: 'System reset', desc: 'Restart keyboard', category: 'system', params: [], builtin: true, docs: 'reset' },
	{ ref: '&soft_off', name: 'Soft off', desc: 'Matikan keyboard (butuh CONFIG_ZMK_PM_SOFT_OFF)', category: 'system', params: [], builtin: true, requires: 'CONFIG_ZMK_PM_SOFT_OFF', docs: 'soft-off' },
	{ ref: '&studio_unlock', name: 'Studio unlock', desc: 'Buka kunci ZMK Studio', category: 'system', params: [], builtin: true, requires: 'CONFIG_ZMK_STUDIO', docs: 'studio-unlock' }
];

export const BUILTIN_MAP = new Map(BUILTIN_BEHAVIORS.map((b) => [b.ref, b]));

/** Behaviors that are only valid inside macros */
export const MACRO_CONTROLS: { ref: string; label: string; desc: string; param?: string }[] = [
	{ ref: '&macro_tap', label: 'TAP', desc: 'Binding berikutnya di-tap' },
	{ ref: '&macro_press', label: 'PRESS', desc: 'Binding berikutnya ditekan (ditahan)' },
	{ ref: '&macro_release', label: 'RELEASE', desc: 'Binding berikutnya dilepas' },
	{ ref: '&macro_pause_for_release', label: 'PAUSE ⏸', desc: 'Tunggu sampai tombol macro dilepas' },
	{ ref: '&macro_wait_time', label: 'WAIT', desc: 'Ubah waktu tunggu (ms)', param: 'ms' },
	{ ref: '&macro_tap_time', label: 'TAP TIME', desc: 'Ubah lama tap (ms)', param: 'ms' },
	{ ref: '&macro_param_1to1', label: 'P1→1', desc: 'Parameter macro 1 → param 1 binding berikutnya' },
	{ ref: '&macro_param_1to2', label: 'P1→2', desc: 'Parameter macro 1 → param 2 binding berikutnya' },
	{ ref: '&macro_param_2to1', label: 'P2→1', desc: 'Parameter macro 2 → param 1 binding berikutnya' },
	{ ref: '&macro_param_2to2', label: 'P2→2', desc: 'Parameter macro 2 → param 2 binding berikutnya' }
];
export const MACRO_CONTROL_MAP = new Map(MACRO_CONTROLS.map((c) => [c.ref, c]));

/** Behavior compatibles the editor understands, with defaults for new nodes */
export const CUSTOM_KINDS = {
	'zmk,behavior-hold-tap': { label: 'Hold-tap', category: 'holdtap' as BehaviorCategory, cells: 2 },
	'zmk,behavior-tap-dance': { label: 'Tap dance', category: 'tapdance' as BehaviorCategory, cells: 0 },
	'zmk,behavior-mod-morph': { label: 'Mod-morph', category: 'modmorph' as BehaviorCategory, cells: 0 },
	'zmk,behavior-sticky-key': { label: 'Sticky key', category: 'sticky' as BehaviorCategory, cells: 1 },
	'zmk,behavior-caps-word': { label: 'Caps word', category: 'misc' as BehaviorCategory, cells: 0 },
	'zmk,behavior-key-repeat': { label: 'Key repeat', category: 'misc' as BehaviorCategory, cells: 0 },
	'zmk,behavior-key-toggle': { label: 'Key toggle', category: 'key' as BehaviorCategory, cells: 1 },
	'zmk,behavior-sensor-rotate': { label: 'Sensor rotate', category: 'misc' as BehaviorCategory, cells: 0 },
	'zmk,behavior-sensor-rotate-var': { label: 'Sensor rotate (var)', category: 'misc' as BehaviorCategory, cells: 2 }
} as const;

export const MACRO_COMPATIBLES: Record<number, string> = {
	0: 'zmk,behavior-macro',
	1: 'zmk,behavior-macro-one-param',
	2: 'zmk,behavior-macro-two-param'
};

/** Map a behavior used inside a hold-tap to the kind of parameter it takes. */
export function paramKindForInner(ref: string): ParamKind {
	if (['&mo', '&to', '&tog', '&sl'].includes(ref)) return 'layer';
	if (['&kp', '&kt', '&sk'].includes(ref)) return 'keycode';
	return 'raw';
}

export const MOD_MASKS = [
	{ value: 'MOD_LSFT', label: 'L⇧' },
	{ value: 'MOD_RSFT', label: 'R⇧' },
	{ value: 'MOD_LCTL', label: 'L⌃' },
	{ value: 'MOD_RCTL', label: 'R⌃' },
	{ value: 'MOD_LALT', label: 'L⌥' },
	{ value: 'MOD_RALT', label: 'R⌥' },
	{ value: 'MOD_LGUI', label: 'L◆' },
	{ value: 'MOD_RGUI', label: 'R◆' }
];

export const DOCS_BASE = 'https://zmk.dev/docs/keymaps/behaviors/';
