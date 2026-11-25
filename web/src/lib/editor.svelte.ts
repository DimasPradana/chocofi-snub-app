import { parseKeymap, serializeKeymap, type Keymap, type Binding } from './keymap/model';
import { validate, type Issue } from './keymap/validate';
import { makeCtx, type DescribeCtx } from './keymap/describe';
import { keymapSize } from './keymap/ops';
import { confValues, parseConf, serializeConf, type ConfLine } from './zmk/conf';
import { LAYOUTS, type LayoutSize, pos36to42, pos42to36 } from './zmk/layouts';
import { cells, cellsToNumber, getProp, propCells, setProp } from './dts/ast';

export interface FileInfo {
	path: string;
	size: number;
	mtime: number;
}

export type SideTab = 'key' | 'layers' | 'combos' | 'macros' | 'behaviors' | 'conf' | 'build' | 'source' | 'issues';

const MAX_HISTORY = 200;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((data as { message?: string; error?: string }).message ?? (data as { error?: string }).error ?? res.statusText);
	return data as T;
}

class Editor {
	files = $state<FileInfo[]>([]);
	keymapPath = $state('');
	confPath = $state('');
	km = $state<Keymap | null>(null);
	parseError = $state<string | null>(null);
	savedText = $state(''); // serialized form of what is on disk (normalized)
	diskText = $state(''); // raw text on disk
	mtime = 0;

	confLines = $state<ConfLine[]>([]);
	confSaved = $state('');
	confMtime = 0;
	buildYaml = $state('');

	view = $state<LayoutSize>(42);
	layer = $state(0);
	selected = $state<number | null>(null); // keymap position
	tab = $state<SideTab>('key');
	search = $state('');
	showCombos = $state(true);
	showPositions = $state(false);
	theme = $state<'dark' | 'light'>('dark');
	/** when set, clicking keys toggles positions for this purpose */
	pick = $state<{ kind: 'combo' | 'holdtrigger'; uid: string } | null>(null);
	hoverCombo = $state<string | null>(null);
	selectedCombo = $state<string | null>(null);
	selectedMacro = $state<string | null>(null);
	selectedBehavior = $state<string | null>(null);
	toast = $state<{ msg: string; kind: 'ok' | 'err' | 'info' } | null>(null);
	busy = $state(false);
	buildStatus = $state<string | null>(null);

	past: Keymap[] = [];
	future: Keymap[] = [];
	historyVersion = $state(0);

	generated = $derived(this.km ? safeSerialize($state.snapshot(this.km) as Keymap) : '');
	dirty = $derived(!!this.km && this.generated !== this.savedText);
	confText = $derived(serializeConf(this.confLines));
	confDirty = $derived(this.confLines.length > 0 && this.confText !== this.confSaved);
	conf = $derived(this.effectiveConf());
	ctx = $derived<DescribeCtx | null>(this.km ? makeCtx(this.km) : null);
	size = $derived<LayoutSize>(this.km ? keymapSize(this.km) : 42);
	niceOled = $derived(/nice_oled/.test(this.buildYaml));
	issues = $derived<Issue[]>(this.km ? validate(this.km, this.conf, this.view, { niceOled: this.niceOled }) : []);
	canUndo = $derived(this.historyVersion >= 0 && this.past.length > 0);
	canRedo = $derived(this.historyVersion >= 0 && this.future.length > 0);

	/** .conf values + -DCONFIG_* flags passed via build.yaml cmake-args */
	effectiveConf() {
		const m = confValues(this.confLines);
		for (const match of this.buildYaml.matchAll(/-D(CONFIG_[A-Z0-9_]+)=(\S+)/g)) if (!m.has(match[1])) m.set(match[1], match[2]);
		return m;
	}

	notify(msg: string, kind: 'ok' | 'err' | 'info' = 'info') {
		this.toast = { msg, kind };
		const t = this.toast;
		setTimeout(() => {
			if (this.toast === t) this.toast = null;
		}, kind === 'err' ? 7000 : 3500);
	}

	async init() {
		const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('ke-prefs') : null;
		if (saved) {
			try {
				const p = JSON.parse(saved);
				if (p.view) this.view = p.view;
				if (p.theme) this.theme = p.theme;
				if (typeof p.showCombos === 'boolean') this.showCombos = p.showCombos;
			} catch {
				/* ignore */
			}
		}
		const { files } = await api<{ files: FileInfo[] }>('/api/files');
		this.files = files;
		const keymaps = files.filter((f) => f.path.endsWith('.keymap'));
		const km = (saved && JSON.parse(saved).keymapPath) || keymaps[0]?.path;
		try {
			const by = await api<{ content: string }>('/api/file?path=build.yaml');
			this.buildYaml = by.content;
		} catch {
			this.buildYaml = '';
		}
		if (km) await this.loadKeymap(km);
	}

	savePrefs() {
		localStorage.setItem('ke-prefs', JSON.stringify({ view: this.view, theme: this.theme, showCombos: this.showCombos, keymapPath: this.keymapPath }));
	}

	async loadKeymap(path: string) {
		this.busy = true;
		try {
			const { content, mtime } = await api<{ content: string; mtime: number }>(`/api/file?path=${encodeURIComponent(path)}`);
			this.keymapPath = path;
			this.diskText = content;
			this.mtime = mtime;
			try {
				const km = parseKeymap(content);
				this.km = km;
				this.savedText = safeSerialize(km);
				this.parseError = null;
			} catch (e) {
				this.km = null;
				this.parseError = String((e as Error).message);
			}
			this.past = [];
			this.future = [];
			this.historyVersion++;
			this.layer = 0;
			this.selected = null;
			// sibling .conf with the same base name
			const confPath = path.replace(/\.keymap$/, '.conf');
			if (this.files.some((f) => f.path === confPath)) await this.loadConf(confPath);
			else {
				this.confPath = confPath;
				this.confLines = [];
				this.confSaved = '';
			}
			this.savePrefs();
		} catch (e) {
			this.notify(`Gagal memuat ${path}: ${(e as Error).message}`, 'err');
		} finally {
			this.busy = false;
		}
	}

	async loadConf(path: string) {
		const { content, mtime } = await api<{ content: string; mtime: number }>(`/api/file?path=${encodeURIComponent(path)}`);
		this.confPath = path;
		this.confLines = parseConf(content);
		this.confSaved = serializeConf(this.confLines);
		this.confMtime = mtime;
	}

	/** Apply a change to the keymap with undo support. */
	mutate(fn: (km: Keymap) => void) {
		if (!this.km) return;
		this.past.push($state.snapshot(this.km) as Keymap);
		if (this.past.length > MAX_HISTORY) this.past.shift();
		this.future = [];
		fn(this.km);
		this.historyVersion++;
	}

	undo() {
		if (!this.km || !this.past.length) return;
		this.future.push($state.snapshot(this.km) as Keymap);
		this.km = this.past.pop()!;
		this.clampLayer();
		this.historyVersion++;
	}

	redo() {
		if (!this.km || !this.future.length) return;
		this.past.push($state.snapshot(this.km) as Keymap);
		this.km = this.future.pop()!;
		this.clampLayer();
		this.historyVersion++;
	}

	clampLayer() {
		if (this.km && this.layer >= this.km.layers.length) this.layer = Math.max(0, this.km.layers.length - 1);
	}

	setBinding(layer: number, pos: number, b: Binding) {
		this.mutate((km) => {
			km.layers[layer].bindings[pos] = b;
		});
	}

	/** Keymap position for a key index in the current view (undefined = key does not exist in keymap). */
	kmPos(viewIndex: number): number | undefined {
		if (this.view === this.size) return viewIndex;
		return this.size === 42 ? pos36to42(viewIndex) : pos42to36(viewIndex);
	}

	viewIndex(kmPos: number): number | undefined {
		if (this.view === this.size) return kmPos;
		return this.size === 42 ? pos42to36(kmPos) : pos36to42(kmPos);
	}

	/** keymap positions of one hand plus all thumb keys (for positional hold-tap) */
	sidePositions(side: 'L' | 'R'): number[] {
		return LAYOUTS[this.size].keys.flatMap((k, i) => (k.side === side || k.row === 3 ? [i] : []));
	}

	/** positions currently picked for a hold-trigger behavior */
	get pickPositions(): number[] {
		const p = this.pick;
		if (!p || p.kind !== 'holdtrigger' || !this.km) return [];
		const b = this.km.behaviors.find((x) => x.uid === p.uid);
		if (!b) return [];
		return propCells(getProp(b.node, 'hold-trigger-key-positions'))
			.map((c) => cellsToNumber(c))
			.filter((n): n is number => n !== undefined);
	}

	togglePick(pos: number) {
		const p = this.pick;
		if (!p) return;
		this.mutate((km) => {
			if (p.kind === 'combo') {
				const c = km.combos.find((x) => x.uid === p.uid);
				if (!c) return;
				c.keyPositions = c.keyPositions.includes(pos) ? c.keyPositions.filter((x) => x !== pos) : [...c.keyPositions, pos].sort((a, b) => a - b);
			} else {
				const b = km.behaviors.find((x) => x.uid === p.uid);
				if (!b) return;
				const cur = propCells(getProp(b.node, 'hold-trigger-key-positions'))
					.map((c) => cellsToNumber(c))
					.filter((n): n is number => n !== undefined);
				const next = cur.includes(pos) ? cur.filter((x) => x !== pos) : [...cur, pos].sort((a, b) => a - b);
				setProp(b.node, 'hold-trigger-key-positions', next.length ? [cells(...next)] : undefined);
			}
		});
	}

	get layout() {
		return LAYOUTS[this.view];
	}

	async save() {
		if (!this.km) return;
		this.busy = true;
		try {
			if (this.dirty) {
				const text = this.generated;
				const r = await api<{ mtime: number }>(`/api/file?path=${encodeURIComponent(this.keymapPath)}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ content: text, expectedMtime: this.mtime })
				});
				this.mtime = r.mtime;
				this.diskText = text;
				this.savedText = text;
			}
			if (this.confDirty) {
				const r = await api<{ mtime: number }>(`/api/file?path=${encodeURIComponent(this.confPath)}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ content: this.confText, expectedMtime: this.confMtime || undefined })
				});
				this.confMtime = r.mtime;
				this.confSaved = this.confText;
			}
			this.notify('Tersimpan', 'ok');
			return true;
		} catch (e) {
			this.notify(`Gagal menyimpan: ${(e as Error).message}`, 'err');
			return false;
		} finally {
			this.busy = false;
		}
	}

	async reload() {
		if (this.keymapPath) await this.loadKeymap(this.keymapPath);
	}
}

function safeSerialize(km: Keymap): string {
	try {
		return serializeKeymap(km);
	} catch (e) {
		return `/* serialize error: ${String(e)} */`;
	}
}

export const editor = new Editor();
