/**
 * Physical layouts for the Chocofi / Corne family, taken from ZMK v0.3
 * (app/dts/layouts/foostan/corne/{5,6}column.dtsi). Units: 1/100 key; rotation in 1/100 degree.
 */

export interface PhysKey {
	w: number;
	h: number;
	x: number;
	y: number;
	r: number;
	rx: number;
	ry: number;
	/** helpers for display */
	side: 'L' | 'R';
	row: number; // 0..3 (3 = thumb)
	col: number; // column within the 42-key grid (0..11), thumbs 3..8
	finger: string;
}

export type LayoutSize = 36 | 42;

export interface PhysicalLayout {
	id: string;
	size: LayoutSize;
	name: string;
	zmkRef: string; // phandle of the ZMK physical layout
	keys: PhysKey[];
}

type Raw = [number, number, number, number, number, number, number];

const RAW_6COL: Raw[] = [
	[100, 100, 0, 37, 0, 0, 0], [100, 100, 100, 37, 0, 0, 0], [100, 100, 200, 12, 0, 0, 0], [100, 100, 300, 0, 0, 0, 0], [100, 100, 400, 12, 0, 0, 0], [100, 100, 500, 24, 0, 0, 0],
	[100, 100, 800, 24, 0, 0, 0], [100, 100, 900, 12, 0, 0, 0], [100, 100, 1000, 0, 0, 0, 0], [100, 100, 1100, 12, 0, 0, 0], [100, 100, 1200, 37, 0, 0, 0], [100, 100, 1300, 37, 0, 0, 0],
	[100, 100, 0, 137, 0, 0, 0], [100, 100, 100, 137, 0, 0, 0], [100, 100, 200, 112, 0, 0, 0], [100, 100, 300, 100, 0, 0, 0], [100, 100, 400, 112, 0, 0, 0], [100, 100, 500, 124, 0, 0, 0],
	[100, 100, 800, 124, 0, 0, 0], [100, 100, 900, 112, 0, 0, 0], [100, 100, 1000, 100, 0, 0, 0], [100, 100, 1100, 112, 0, 0, 0], [100, 100, 1200, 137, 0, 0, 0], [100, 100, 1300, 137, 0, 0, 0],
	[100, 100, 0, 237, 0, 0, 0], [100, 100, 100, 237, 0, 0, 0], [100, 100, 200, 212, 0, 0, 0], [100, 100, 300, 200, 0, 0, 0], [100, 100, 400, 212, 0, 0, 0], [100, 100, 500, 224, 0, 0, 0],
	[100, 100, 800, 224, 0, 0, 0], [100, 100, 900, 212, 0, 0, 0], [100, 100, 1000, 200, 0, 0, 0], [100, 100, 1100, 212, 0, 0, 0], [100, 100, 1200, 237, 0, 0, 0], [100, 100, 1300, 237, 0, 0, 0],
	[100, 100, 350, 312, 0, 0, 0], [100, 100, 450, 312, 1200, 450, 412], [100, 150, 548, 283, 2400, 548, 433],
	[100, 150, 752, 283, -2400, 852, 433], [100, 100, 850, 312, -1200, 950, 412], [100, 100, 950, 312, 0, 0, 0]
];

const RAW_5COL: Raw[] = [
	[100, 100, 0, 37, 0, 0, 0], [100, 100, 100, 12, 0, 0, 0], [100, 100, 200, 0, 0, 0, 0], [100, 100, 300, 12, 0, 0, 0], [100, 100, 400, 24, 0, 0, 0],
	[100, 100, 700, 24, 0, 0, 0], [100, 100, 800, 12, 0, 0, 0], [100, 100, 900, 0, 0, 0, 0], [100, 100, 1000, 12, 0, 0, 0], [100, 100, 1100, 37, 0, 0, 0],
	[100, 100, 0, 137, 0, 0, 0], [100, 100, 100, 112, 0, 0, 0], [100, 100, 200, 100, 0, 0, 0], [100, 100, 300, 112, 0, 0, 0], [100, 100, 400, 124, 0, 0, 0],
	[100, 100, 700, 124, 0, 0, 0], [100, 100, 800, 112, 0, 0, 0], [100, 100, 900, 100, 0, 0, 0], [100, 100, 1000, 112, 0, 0, 0], [100, 100, 1100, 137, 0, 0, 0],
	[100, 100, 0, 237, 0, 0, 0], [100, 100, 100, 212, 0, 0, 0], [100, 100, 200, 200, 0, 0, 0], [100, 100, 300, 212, 0, 0, 0], [100, 100, 400, 224, 0, 0, 0],
	[100, 100, 700, 224, 0, 0, 0], [100, 100, 800, 212, 0, 0, 0], [100, 100, 900, 200, 0, 0, 0], [100, 100, 1000, 212, 0, 0, 0], [100, 100, 1100, 237, 0, 0, 0],
	[100, 100, 250, 312, 0, 0, 0], [100, 100, 350, 312, 1200, 350, 412], [100, 150, 448, 283, 2400, 448, 433],
	[100, 150, 652, 283, -2400, 752, 433], [100, 100, 750, 312, -1200, 850, 412], [100, 100, 850, 312, 0, 0, 0]
];

const FINGERS_6 = ['pinky', 'pinky', 'ring', 'middle', 'index', 'index', 'index', 'index', 'middle', 'ring', 'pinky', 'pinky'];
const FINGER_LABEL: Record<string, string> = {
	pinky: 'Kelingking',
	ring: 'Manis',
	middle: 'Tengah',
	index: 'Telunjuk',
	thumb: 'Jempol'
};
export const fingerLabel = (f: string) => FINGER_LABEL[f] ?? f;

function build(raw: Raw[], size: LayoutSize): PhysKey[] {
	const perRow = size === 42 ? 12 : 10;
	return raw.map(([w, h, x, y, r, rx, ry], i) => {
		const isThumb = i >= perRow * 3;
		const row = isThumb ? 3 : Math.floor(i / perRow);
		const c = isThumb ? i - perRow * 3 : i % perRow;
		const col = isThumb ? 3 + c : size === 42 ? c : c + 1;
		return {
			w,
			h,
			x,
			y,
			r: r / 100,
			rx,
			ry,
			side: (isThumb ? c < 3 : c < perRow / 2) ? 'L' : 'R',
			row,
			col,
			finger: isThumb ? 'thumb' : FINGERS_6[col]
		};
	});
}

export const LAYOUTS: Record<LayoutSize, PhysicalLayout> = {
	42: { id: '6col', size: 42, name: '42 tombol (6 kolom)', zmkRef: '&foostan_corne_6col_layout', keys: build(RAW_6COL, 42) },
	36: { id: '5col', size: 36, name: '36 tombol (5 kolom)', zmkRef: '&foostan_corne_5col_layout', keys: build(RAW_5COL, 36) }
};

/* ---------- position mapping (ZMK position map "five") ---------- */

/** 42-key position -> 36-key position (undefined for the outer columns). */
export function pos42to36(p: number): number | undefined {
	if (p >= 36) return p - 6;
	const row = Math.floor(p / 12);
	const col = p % 12;
	if (col === 0 || col === 11) return undefined;
	return row * 10 + col - 1;
}

export function pos36to42(p: number): number {
	if (p >= 30) return p + 6;
	const row = Math.floor(p / 10);
	return row * 12 + (p % 10) + 1;
}

export function isOuterColumn42(p: number) {
	return p < 36 && (p % 12 === 0 || p % 12 === 11);
}

export function mapPosition(p: number, from: LayoutSize, to: LayoutSize): number | undefined {
	if (from === to) return p;
	return from === 42 ? pos42to36(p) : pos36to42(p);
}

/** Bounding box of a layout in layout units (rotation-aware) */
export function layoutBounds(keys: PhysKey[]) {
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const k of keys) {
		const rad = (k.r * Math.PI) / 180;
		const corners = [
			[k.x, k.y],
			[k.x + k.w, k.y],
			[k.x, k.y + k.h],
			[k.x + k.w, k.y + k.h]
		];
		for (const [cx, cy] of corners) {
			const dx = cx - k.rx,
				dy = cy - k.ry;
			const x = k.r ? k.rx + dx * Math.cos(rad) - dy * Math.sin(rad) : cx;
			const y = k.r ? k.ry + dx * Math.sin(rad) + dy * Math.cos(rad) : cy;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}
	return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Center point of a key (rotation-aware), used for combo overlays */
export function keyCenter(k: PhysKey) {
	const cx = k.x + k.w / 2,
		cy = k.y + k.h / 2;
	if (!k.r) return { x: cx, y: cy };
	const rad = (k.r * Math.PI) / 180;
	const dx = cx - k.rx,
		dy = cy - k.ry;
	return { x: k.rx + dx * Math.cos(rad) - dy * Math.sin(rad), y: k.ry + dx * Math.sin(rad) + dy * Math.cos(rad) };
}
