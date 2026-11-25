import { cellsToNumber } from '../dts/ast';
import { MACRO_CONTROL_MAP } from '../zmk/behaviors';
import { parseKeyExpr } from '../zmk/keycodes';
import { LAYOUTS, isOuterColumn42, type LayoutSize } from '../zmk/layouts';
import { behaviorDef, makeCtx } from './describe';
import type { Binding, Keymap } from './model';
import { layerParamIndexes } from './ops';

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
	severity: Severity;
	message: string;
	layer?: number;
	pos?: number;
	combo?: string;
	hint?: string;
}

export function validate(km: Keymap, conf: Map<string, string>, view: LayoutSize, opts: { niceOled?: boolean } = {}): Issue[] {
	const issues: Issue[] = [];
	const ctx = makeCtx(km);
	const size = km.layers[0]?.bindings.length ?? 0;
	const expected = LAYOUTS[size === 36 ? 36 : 42].keys.length;
	const nLayers = km.layers.length;
	const maxPaired = Number(conf.get('CONFIG_BT_MAX_PAIRED') ?? 5);
	const used = new Set<string>();

	const checkBinding = (b: Binding, where: Omit<Issue, 'severity' | 'message'>, label: string) => {
		used.add(b.behavior);
		if (MACRO_CONTROL_MAP.has(b.behavior)) return;
		const def = behaviorDef(ctx, b.behavior);
		if (!def) {
			issues.push({ severity: 'error', message: `${label}: behavior ${b.behavior} tidak didefinisikan`, ...where, hint: 'Definisikan di tab Behavior/Macro atau periksa ejaan.' });
			return;
		}
		if (def.params.length !== b.params.length && !(b.behavior === '&bt' && b.params.length === 2) && !(b.behavior === '&bl' && b.params.length === 2)) {
			issues.push({ severity: 'error', message: `${label}: ${b.behavior} butuh ${def.params.length} parameter, ada ${b.params.length}`, ...where });
		}
		for (const i of layerParamIndexes(b, km)) {
			const n = cellsToNumber(b.params[i]);
			if (n === undefined || n < 0 || n >= nLayers) issues.push({ severity: 'error', message: `${label}: layer ${b.params[i]} tidak ada (hanya ${nLayers} layer)`, ...where });
		}
		def.params.forEach((p, i) => {
			if ((p.kind === 'keycode' || p.kind === 'mod') && b.params[i]) {
				const pk = parseKeyExpr(b.params[i]);
				if (!pk.keycode && !/^(\d+|0x[0-9a-f]+)$/i.test(pk.base)) issues.push({ severity: 'warning', message: `${label}: keycode "${b.params[i]}" tidak dikenal editor`, ...where, hint: 'Bisa jadi alias/#define yang valid; build akan memastikan.' });
			}
		});
		if (b.behavior === '&bt' && (b.params[0] === 'BT_SEL' || b.params[0] === 'BT_DISC')) {
			const n = cellsToNumber(b.params[1]);
			if (n !== undefined && n >= maxPaired) issues.push({ severity: 'warning', message: `${label}: BT_SEL ${n} (profil ${n + 1}) tidak bisa dipakai, CONFIG_BT_MAX_PAIRED=${maxPaired}`, ...where });
		}
		if (def.requires && conf.get(def.requires) !== 'y' && !(def.requires === 'CONFIG_ZMK_STUDIO' && conf.get('CONFIG_ZMK_STUDIO') === undefined)) {
			issues.push({ severity: def.requires === 'CONFIG_ZMK_POINTING' ? 'error' : 'warning', message: `${label}: ${b.behavior} butuh ${def.requires}=y di .conf`, ...where });
		}
	};

	km.layers.forEach((l, li) => {
		const name = l.displayName ?? l.nodeName;
		if (l.bindings.length !== expected) issues.push({ severity: 'error', message: `Layer "${name}" punya ${l.bindings.length} binding, layout butuh ${expected}`, layer: li });
		l.bindings.forEach((b, pos) => {
			checkBinding(b, { layer: li, pos }, `Layer ${name} pos ${pos}`);
			if (view === 36 && size === 42 && isOuterColumn42(pos) && b.behavior !== '&trans' && b.behavior !== '&none')
				issues.push({ severity: 'warning', message: `Layer ${name} pos ${pos}: ${b.behavior} ${b.params.join(' ')} ada di kolom luar (tidak terlihat di tampilan 36)`, layer: li, pos });
		});
		if (opts.niceOled) {
			if (!l.displayName) issues.push({ severity: 'info', message: `Layer "${l.nodeName}" tanpa display-name: indikator layer nice_oled akan kosong`, layer: li });
			else if (l.displayName.length > 4) issues.push({ severity: 'info', message: `display-name "${l.displayName}" > 4 karakter, bisa terpotong di OLED 32px`, layer: li });
		}
	});

	// layer reachability
	const reachable = new Set<number>([0]);
	let changed = true;
	const activators: [number, number][] = []; // from layer -> to layer
	km.layers.forEach((l, li) =>
		l.bindings.forEach((b) => {
			for (const i of layerParamIndexes(b, km)) {
				const n = cellsToNumber(b.params[i]);
				if (n !== undefined) activators.push([li, n]);
			}
		})
	);
	const comboTargets: number[] = [];
	for (const c of km.combos) for (const i of layerParamIndexes(c.binding, km)) {
		const n = cellsToNumber(c.binding.params[i]);
		if (n !== undefined) comboTargets.push(n);
	}
	while (changed) {
		changed = false;
		for (const [from, to] of activators) if (reachable.has(from) && !reachable.has(to)) (reachable.add(to), (changed = true));
		for (const t of comboTargets) if (!reachable.has(t)) (reachable.add(t), (changed = true));
		for (const c of km.conditionalLayers) if (c.ifLayers.every((l) => reachable.has(l)) && !reachable.has(c.thenLayer)) (reachable.add(c.thenLayer), (changed = true));
	}
	km.layers.forEach((l, li) => {
		if (!reachable.has(li)) issues.push({ severity: 'warning', message: `Layer "${l.displayName ?? l.nodeName}" (${li}) tidak bisa dijangkau dari layer 0`, layer: li, hint: 'Tambahkan &mo/&lt/&to/&tog atau conditional layer.' });
	});

	// combos
	const seen = new Map<string, string>();
	for (const c of km.combos) {
		checkBinding(c.binding, { combo: c.nodeName }, `Combo ${c.nodeName}`);
		if (c.keyPositions.length < 2) issues.push({ severity: 'error', message: `Combo ${c.nodeName}: minimal 2 posisi tombol`, combo: c.nodeName });
		for (const p of c.keyPositions) if (p < 0 || p >= expected) issues.push({ severity: 'error', message: `Combo ${c.nodeName}: posisi ${p} di luar layout`, combo: c.nodeName });
		if (view === 36 && size === 42 && c.keyPositions.some(isOuterColumn42)) issues.push({ severity: 'warning', message: `Combo ${c.nodeName} memakai kolom luar (tidak terlihat di tampilan 36)`, combo: c.nodeName });
		const k = [...c.keyPositions].sort((a, b) => a - b).join(',') + '|' + (c.layers ?? []).join(',');
		if (seen.has(k)) issues.push({ severity: 'warning', message: `Combo ${c.nodeName} memakai posisi yang sama dengan ${seen.get(k)}`, combo: c.nodeName });
		seen.set(k, c.nodeName);
		if (c.binding.behavior === '&tog' && cellsToNumber(c.binding.params[0]) === 0) issues.push({ severity: 'info', message: `Combo ${c.nodeName}: &tog 0 men-toggle layer default, biasanya tidak berefek`, combo: c.nodeName });
		const maxKeys = Number(conf.get('CONFIG_ZMK_COMBO_MAX_KEYS_PER_COMBO') ?? 4);
		if (c.keyPositions.length > maxKeys) issues.push({ severity: 'error', message: `Combo ${c.nodeName}: ${c.keyPositions.length} tombol > CONFIG_ZMK_COMBO_MAX_KEYS_PER_COMBO (${maxKeys})`, combo: c.nodeName });
	}
	const perKey = new Map<number, number>();
	for (const c of km.combos) for (const p of c.keyPositions) perKey.set(p, (perKey.get(p) ?? 0) + 1);
	const maxPerKey = Number(conf.get('CONFIG_ZMK_COMBO_MAX_COMBOS_PER_KEY') ?? 5);
	for (const [p, n] of perKey) if (n > maxPerKey) issues.push({ severity: 'error', message: `Posisi ${p} dipakai ${n} combo > CONFIG_ZMK_COMBO_MAX_COMBOS_PER_KEY (${maxPerKey})`, pos: p, hint: `Tambahkan CONFIG_ZMK_COMBO_MAX_COMBOS_PER_KEY=${n} di .conf` });

	for (const m of km.macros) m.bindings.forEach((b) => checkBinding(b, {}, `Macro ${m.nodeName}`));

	// studio
	if (conf.get('CONFIG_ZMK_STUDIO') === 'y' && conf.get('CONFIG_ZMK_STUDIO_LOCKING') !== 'n' && !used.has('&studio_unlock'))
		issues.push({ severity: 'info', message: 'ZMK Studio aktif dengan locking, tapi tidak ada &studio_unlock di keymap', hint: 'Tambahkan &studio_unlock atau set CONFIG_ZMK_STUDIO_LOCKING=n (build.yaml sudah memberi -DCONFIG_ZMK_STUDIO_LOCKING=n).' });

	// nice_oled conflicts
	if (opts.niceOled) {
		for (const w of ['BATTERY', 'OUTPUT', 'LAYER', 'WPM']) {
			const k = `CONFIG_ZMK_WIDGET_${w}_STATUS`;
			if (conf.get(k) !== 'n') issues.push({ severity: 'error', message: `${k} harus =n saat memakai nice_oled (build gagal: multiple definition)` });
		}
	}

	for (const b of km.behaviors) {
		const ref = b.labels.map((l) => `&${l}`).find((r) => used.has(r));
		if (!ref) issues.push({ severity: 'info', message: `Behavior "${b.nodeName}" didefinisikan tapi tidak dipakai` });
	}
	for (const m of km.macros) {
		if (!m.labels.some((l) => used.has(`&${l}`))) issues.push({ severity: 'info', message: `Macro "${m.nodeName}" didefinisikan tapi tidak dipakai` });
	}
	return issues;
}
