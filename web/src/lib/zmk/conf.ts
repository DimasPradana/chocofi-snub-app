/** Kconfig (.conf) parsing + catalog of common ZMK / nice_oled options. */

export type ConfLine =
	| { kind: 'option'; key: string; value: string; commented: boolean; raw: string }
	| { kind: 'comment'; text: string }
	| { kind: 'blank' };

export function parseConf(text: string): ConfLine[] {
	return text.split('\n').map((raw): ConfLine => {
		const t = raw.trim();
		if (!t) return { kind: 'blank' };
		const m = t.match(/^(#\s*)?(CONFIG_[A-Z0-9_]+)\s*=\s*(.*)$/);
		if (m) return { kind: 'option', key: m[2], value: m[3].trim(), commented: !!m[1], raw };
		const notSet = t.match(/^#\s*(CONFIG_[A-Z0-9_]+) is not set/);
		if (notSet) return { kind: 'option', key: notSet[1], value: 'n', commented: false, raw };
		return { kind: 'comment', text: raw };
	});
}

export function serializeConf(lines: ConfLine[]): string {
	return (
		lines
			.map((l) => {
				if (l.kind === 'blank') return '';
				if (l.kind === 'comment') return l.text;
				return `${l.commented ? '# ' : ''}${l.key}=${l.value}`;
			})
			.join('\n')
			.replace(/\n+$/, '') + '\n'
	);
}

/** Effective (uncommented) values */
export function confValues(lines: ConfLine[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const l of lines) if (l.kind === 'option' && !l.commented) m.set(l.key, l.value);
	return m;
}

export function setConf(lines: ConfLine[], key: string, value: string | undefined): ConfLine[] {
	const out = [...lines];
	const idx = out.findIndex((l) => l.kind === 'option' && l.key === key);
	if (value === undefined) {
		if (idx >= 0) out.splice(idx, 1);
		return out;
	}
	const line: ConfLine = { kind: 'option', key, value, commented: false, raw: '' };
	if (idx >= 0) out[idx] = line;
	else {
		while (out.length && out[out.length - 1].kind === 'blank') out.pop();
		out.push(line);
	}
	return out;
}

export type OptType = 'bool' | 'int' | 'string';

export interface ConfOption {
	key: string;
	type: OptType;
	group: string;
	desc: string;
	default?: string;
	unit?: string;
	/** options in the same exclusive group (radio) */
	exclusive?: string;
	side?: 'central' | 'peripheral' | 'both';
	warn?: string;
}

const o = (key: string, type: OptType, group: string, desc: string, extra: Partial<ConfOption> = {}): ConfOption => ({ key: `CONFIG_${key}`, type, group, desc, ...extra });

export const CONF_GROUPS = ['Umum', 'Power & Sleep', 'Bluetooth', 'Fitur', 'Combo & Macro', 'Display', 'nice_oled: umum', 'nice_oled: kiri (central)', 'nice_oled: kanan (peripheral)', 'Debug'];

export const CONF_OPTIONS: ConfOption[] = [
	o('ZMK_KEYBOARD_NAME', 'string', 'Umum', 'Nama keyboard yang tampil di Bluetooth/USB (maks 16 karakter)', { default: '"Corne"' }),
	o('ZMK_HID_REPORT_TYPE_NKRO', 'bool', 'Umum', 'Gunakan NKRO (N-key rollover) alih-alih 6KRO'),
	o('ZMK_HID_CONSUMER_REPORT_USAGES_FULL', 'bool', 'Umum', 'Dukung seluruh keycode consumer (media) — beberapa host bermasalah'),

	o('ZMK_SLEEP', 'bool', 'Power & Sleep', 'Aktifkan deep sleep untuk menghemat baterai'),
	o('ZMK_IDLE_TIMEOUT', 'int', 'Power & Sleep', 'Waktu sampai status idle (layar mati, dsb.)', { unit: 'ms', default: '30000' }),
	o('ZMK_IDLE_SLEEP_TIMEOUT', 'int', 'Power & Sleep', 'Waktu sampai deep sleep', { unit: 'ms', default: '900000' }),
	o('ZMK_PM_SOFT_OFF', 'bool', 'Power & Sleep', 'Aktifkan soft-off (dibutuhkan &soft_off)'),
	o('ZMK_EXT_POWER', 'bool', 'Power & Sleep', 'Kontrol daya eksternal (VCC untuk OLED/RGB)'),

	o('BT_MAX_CONN', 'int', 'Bluetooth', 'Jumlah koneksi BLE simultan (profil + split)', { default: '5' }),
	o('BT_MAX_PAIRED', 'int', 'Bluetooth', 'Jumlah profil pairing yang disimpan (BT_SEL 0..n-1)', { default: '5' }),
	o('BT_CTLR_TX_PWR_PLUS_8', 'bool', 'Bluetooth', 'Daya pancar BLE +8 dBm (jangkauan lebih jauh, baterai lebih boros)'),
	o('ZMK_BLE_EXPERIMENTAL_CONN', 'bool', 'Bluetooth', 'Pengaturan koneksi BLE eksperimental (kompatibilitas)'),
	o('ZMK_BLE_PASSKEY_ENTRY', 'bool', 'Bluetooth', 'Pairing dengan passkey'),
	o('ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_FETCHING', 'bool', 'Bluetooth', 'Central mengambil level baterai sisi kanan'),
	o('ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_PROXY', 'bool', 'Bluetooth', 'Laporkan baterai sisi kanan ke host'),

	o('ZMK_POINTING', 'bool', 'Fitur', 'Mouse emulation — wajib untuk &mkp, &mmv, &msc'),
	o('ZMK_STUDIO', 'bool', 'Fitur', 'ZMK Studio (remap runtime via USB)'),
	o('ZMK_STUDIO_LOCKING', 'bool', 'Fitur', 'Studio butuh &studio_unlock sebelum bisa diubah', { default: 'y' }),
	o('ZMK_RGB_UNDERGLOW', 'bool', 'Fitur', 'RGB underglow (dibutuhkan &rgb_ug)'),
	o('WS2812_STRIP', 'bool', 'Fitur', 'Driver LED WS2812'),
	o('ZMK_BACKLIGHT', 'bool', 'Fitur', 'Backlight (dibutuhkan &bl)'),

	o('ZMK_COMBO_MAX_PRESSED_COMBOS', 'int', 'Combo & Macro', 'Maksimum combo yang ditekan bersamaan', { default: '4' }),
	o('ZMK_COMBO_MAX_COMBOS_PER_KEY', 'int', 'Combo & Macro', 'Maksimum combo per tombol', { default: '5' }),
	o('ZMK_COMBO_MAX_KEYS_PER_COMBO', 'int', 'Combo & Macro', 'Maksimum tombol per combo', { default: '4' }),
	o('ZMK_MACRO_DEFAULT_WAIT_MS', 'int', 'Combo & Macro', 'Waktu tunggu default antar langkah macro', { unit: 'ms', default: '15' }),
	o('ZMK_MACRO_DEFAULT_TAP_MS', 'int', 'Combo & Macro', 'Lama tap default dalam macro', { unit: 'ms', default: '30' }),

	o('ZMK_DISPLAY', 'bool', 'Display', 'Aktifkan OLED'),
	o('ZMK_DISPLAY_BLANK_ON_IDLE', 'bool', 'Display', 'Matikan layar saat idle'),
	o('ZMK_DISPLAY_STATUS_SCREEN_CUSTOM', 'bool', 'Display', 'Pakai status screen custom (wajib y untuk nice_oled)'),
	o('ZMK_WIDGET_BATTERY_STATUS', 'bool', 'Display', 'Widget baterai bawaan ZMK', { warn: 'Harus n saat memakai nice_oled (multiple definition)' }),
	o('ZMK_WIDGET_OUTPUT_STATUS', 'bool', 'Display', 'Widget output bawaan ZMK', { warn: 'Harus n saat memakai nice_oled' }),
	o('ZMK_WIDGET_LAYER_STATUS', 'bool', 'Display', 'Widget layer bawaan ZMK', { warn: 'Harus n saat memakai nice_oled' }),
	o('ZMK_WIDGET_WPM_STATUS', 'bool', 'Display', 'Widget WPM bawaan ZMK', { warn: 'Harus n saat memakai nice_oled' }),

	o('NICE_OLED_ON', 'bool', 'nice_oled: umum', 'Mode OLED nice_oled (jangan diubah)', { default: 'y' }),
	o('NICE_OLED_WIDGET_INVERTED', 'bool', 'nice_oled: umum', 'Balik warna (latar putih)'),
	o('NICE_OLED_WIDGET_OUTPUT_BACKGROUND', 'bool', 'nice_oled: umum', 'Latar belakang pada ikon output'),
	o('NICE_OLED_SHOW_SLEEP_ART_ON_IDLE', 'bool', 'nice_oled: umum', 'Gambar "sleep" saat idle'),
	o('NICE_OLED_SHOW_SLEEP_ART_ON_SLEEP', 'bool', 'nice_oled: umum', 'Gambar "sleep" saat deep sleep'),

	o('NICE_OLED_WIDGET_LAYER', 'bool', 'nice_oled: kiri (central)', 'Indikator nama layer (dari display-name)', { default: 'y', side: 'central' }),
	o('NICE_OLED_WIDGET_LAYER_CUSTOM_Y', 'int', 'nice_oled: kiri (central)', 'Posisi Y nama layer', { unit: 'px', side: 'central' }),
	o('NICE_OLED_WIDGET_PROFILE_BIG', 'bool', 'nice_oled: kiri (central)', 'Indikator profil BT versi besar', { side: 'central' }),
	o('NICE_OLED_WIDGET_PROFILE_CUSTOM_Y', 'int', 'nice_oled: kiri (central)', 'Posisi Y titik profil BT (200 = sembunyikan)', { unit: 'px', side: 'central' }),
	o('NICE_OLED_WIDGET_PROFILE_TEXT_CUSTOM_Y', 'int', 'nice_oled: kiri (central)', 'Posisi Y angka profil (200 = sembunyikan)', { unit: 'px', side: 'central' }),
	o('NICE_OLED_WIDGET_WPM', 'bool', 'nice_oled: kiri (central)', 'Widget WPM (induk opsi WPM)', { default: 'y', side: 'central' }),
	o('NICE_OLED_WIDGET_WPM_BONGO_CAT', 'bool', 'nice_oled: kiri (central)', 'Animasi Bongo Cat', { default: 'y', exclusive: 'wpm-anim', side: 'central' }),
	o('NICE_OLED_WIDGET_WPM_BONGO_CAT_ANIMATION_MS', 'int', 'nice_oled: kiri (central)', 'Kecepatan frame Bongo Cat', { unit: 'ms', default: '300', side: 'central' }),
	o('NICE_OLED_WIDGET_WPM_LUNA', 'bool', 'nice_oled: kiri (central)', 'Animasi anjing Luna', { exclusive: 'wpm-anim', side: 'central' }),
	o('NICE_OLED_WIDGET_WPM_LUNA_ANIMATION_MS', 'int', 'nice_oled: kiri (central)', 'Kecepatan frame Luna', { unit: 'ms', default: '300', side: 'central' }),
	o('NICE_OLED_WIDGET_WPM_NUMBER', 'bool', 'nice_oled: kiri (central)', 'Tampilkan angka WPM', { side: 'central' }),
	o('NICE_OLED_WIDGET_WPM_SPEEDOMETER', 'bool', 'nice_oled: kiri (central)', 'Speedometer WPM', { side: 'central' }),
	o('NICE_OLED_WIDGET_WPM_GRAPH', 'bool', 'nice_oled: kiri (central)', 'Grafik WPM', { side: 'central' }),
	o('NICE_OLED_WIDGET_WPM_GRAPH_FIXED_RANGE_MAX', 'int', 'nice_oled: kiri (central)', 'Batas atas speedometer/grafik', { default: '100', side: 'central' }),
	o('NICE_OLED_WIDGET_MODIFIERS_INDICATORS', 'bool', 'nice_oled: kiri (central)', 'Indikator modifier (Ctrl/Shift/Alt/Gui)', { default: 'y', side: 'central' }),
	o('NICE_OLED_WIDGET_MODIFIERS_INDICATORS_FIXED_SYMBOL', 'bool', 'nice_oled: kiri (central)', 'Modifier sebagai ikon', { default: 'y', exclusive: 'mod-style', side: 'central' }),
	o('NICE_OLED_WIDGET_MODIFIERS_INDICATORS_FIXED_LETTER', 'bool', 'nice_oled: kiri (central)', 'Modifier sebagai huruf C S A G', { exclusive: 'mod-style', side: 'central' }),
	o('NICE_OLED_WIDGET_MODIFIERS_INDICATORS_FIXED_SYMBOL_MACOS', 'bool', 'nice_oled: kiri (central)', 'Ikon modifier gaya macOS', { default: 'y', exclusive: 'mod-os', side: 'central' }),
	o('NICE_OLED_WIDGET_MODIFIERS_INDICATORS_FIXED_SYMBOL_WINDOWS', 'bool', 'nice_oled: kiri (central)', 'Ikon modifier gaya Windows', { exclusive: 'mod-os', side: 'central' }),
	o('NICE_OLED_WIDGET_HID_INDICATORS', 'bool', 'nice_oled: kiri (central)', 'Indikator Caps/Num Lock dari host', { default: 'y', side: 'central' }),
	o('NICE_OLED_WIDGET_CENTRAL_SHOW_BATTERY_PERIPHERAL_ALL', 'bool', 'nice_oled: kiri (central)', '(eksperimental) Tampilkan baterai kiri & kanan', { side: 'central' }),
	o('NICE_OLED_WIDGET_RAW_HID', 'bool', 'nice_oled: kiri (central)', 'Jam/volume/cuaca dari PC (butuh zmk-hid-host)', { side: 'central' }),

	o('NICE_OLED_WIDGET_ANIMATION_PERIPHERAL', 'bool', 'nice_oled: kanan (peripheral)', 'Aktifkan animasi di kanan', { default: 'y', side: 'peripheral' }),
	o('NICE_OLED_WIDGET_ANIMATION_PERIPHERAL_CAT', 'bool', 'nice_oled: kanan (peripheral)', 'Animasi kucing', { default: 'y', exclusive: 'peri-anim', side: 'peripheral' }),
	o('NICE_OLED_WIDGET_ANIMATION_PERIPHERAL_GEM', 'bool', 'nice_oled: kanan (peripheral)', 'Animasi kristal', { exclusive: 'peri-anim', side: 'peripheral' }),
	o('NICE_OLED_WIDGET_ANIMATION_PERIPHERAL_HEAD', 'bool', 'nice_oled: kanan (peripheral)', 'Animasi kepala', { exclusive: 'peri-anim', side: 'peripheral' }),
	o('NICE_OLED_WIDGET_ANIMATION_PERIPHERAL_POKEMON', 'bool', 'nice_oled: kanan (peripheral)', 'Animasi Pokemon', { exclusive: 'peri-anim', side: 'peripheral' }),
	o('NICE_OLED_WIDGET_ANIMATION_PERIPHERAL_SPACEMAN', 'bool', 'nice_oled: kanan (peripheral)', 'Animasi astronot', { exclusive: 'peri-anim', side: 'peripheral' }),
	o('NICE_OLED_WIDGET_ANIMATION_PERIPHERAL_MS', 'int', 'nice_oled: kanan (peripheral)', 'Durasi satu putaran animasi (≤ ~2000000)', { unit: 'ms', side: 'peripheral' }),
	o('NICE_OLED_WIDGET_ANIMATION_PERIPHERAL_CUSTOM_Y', 'int', 'nice_oled: kanan (peripheral)', 'Posisi Y animasi (200 = sembunyikan)', { unit: 'px', side: 'peripheral' }),
	o('NICE_OLED_WIDGET_STATIC_IMAGE_PERIPHERAL', 'bool', 'nice_oled: kanan (peripheral)', 'Gambar diam pengganti animasi', { side: 'peripheral' }),
	o('NICE_OLED_WIDGET_STATIC_IMAGE_PERIPHERAL_VIM', 'bool', 'nice_oled: kanan (peripheral)', 'Gambar diam logo Vim', { side: 'peripheral' }),

	o('ZMK_USB_LOGGING', 'bool', 'Debug', 'Log lewat USB serial (boros, hanya untuk debug)')
];

export const CONF_MAP = new Map(CONF_OPTIONS.map((c) => [c.key, c]));
