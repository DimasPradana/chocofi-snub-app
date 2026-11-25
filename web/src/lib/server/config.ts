import { resolve, relative, join } from 'node:path';

export const CONFIG_DIR = resolve(process.env.ZMK_CONFIG_DIR ?? '..');
export const FIRMWARE_DIR = resolve(process.env.FIRMWARE_DIR ?? '../firmware');
export const BUILDER_URL = process.env.BUILDER_URL ?? 'http://localhost:8080';

/** The repo also holds the app itself: only these paths are config (standard ZMK user-config layout). */
export const CONFIG_PATHS = ['config', 'build.yaml'];

const ALLOWED_EXT = /\.(keymap|conf|ya?ml|json|dtsi|overlay|h|md|defconfig|shield)$/i;

/** Resolve a user-supplied relative path inside CONFIG_DIR, rejecting traversal. */
export function safePath(rel: string | null): string {
	if (!rel) throw new Error('path wajib diisi');
	const abs = resolve(join(CONFIG_DIR, rel));
	const r = relative(CONFIG_DIR, abs);
	if (r.startsWith('..') || r.includes('/.git/') || r.startsWith('.git')) throw new Error('path di luar repo config');
	if (!CONFIG_PATHS.some((c) => r === c || r.startsWith(c + '/'))) throw new Error('hanya config/ dan build.yaml yang bisa diakses');
	if (!ALLOWED_EXT.test(abs) && !/Kconfig/.test(abs)) throw new Error('tipe file tidak diizinkan');
	return abs;
}
