<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { lineDiff } from '#lib/diff';

	let mode = $state<'diff' | 'full'>('diff');
	const diff = $derived(lineDiff(editor.diskText, editor.generated));
	const changes = $derived(diff.filter((d) => d.kind !== 'same').length);
	// collapse unchanged regions in diff mode
	const view = $derived.by(() => {
		if (mode === 'full') return diff;
		const keep = new Set<number>();
		diff.forEach((d, i) => {
			if (d.kind !== 'same') for (let k = i - 3; k <= i + 3; k++) keep.add(k);
		});
		const out: (typeof diff[number] | { kind: 'gap'; n: number })[] = [];
		let gap = 0;
		diff.forEach((d, i) => {
			if (keep.has(i)) {
				if (gap) out.push({ kind: 'gap', n: gap });
				gap = 0;
				out.push(d);
			} else gap++;
		});
		if (gap) out.push({ kind: 'gap', n: gap });
		return out;
	});

	function copy() {
		navigator.clipboard?.writeText(editor.generated);
		editor.notify('Source disalin ke clipboard', 'ok');
	}
</script>

<div class="row">
	<code class="grow small">{editor.keymapPath}</code>
	<span class="chip">{changes} baris berubah</span>
	<button class:active={mode === 'diff'} onclick={() => (mode = 'diff')}>Diff</button>
	<button class:active={mode === 'full'} onclick={() => (mode = 'full')}>Penuh</button>
	<button onclick={copy}>Salin</button>
</div>
<p class="muted small">Devicetree yang akan ditulis. Komentar, <code>#include</code>, dan properti yang tidak dikelola editor dipertahankan.</p>
<pre class="src">{#each view as d, i (i)}{#if d.kind === 'gap'}<div class="gap">⋯ {d.n} baris tidak berubah</div>{:else}<div class="ln {d.kind}"><span class="no">{d.kind === 'add' ? '+' : d.kind === 'del' ? '−' : ' '}{(d.b ?? d.a ?? '').toString().padStart(4)}</span>{d.text || ' '}</div>{/if}{/each}{#if mode === 'diff' && !changes}<div class="muted">Tidak ada perubahan dibanding file di disk.</div>{/if}</pre>

<style>
	.src {
		margin: 6px 0 0;
		background: var(--bg-2);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 0;
		font-family: var(--mono);
		font-size: 11px;
		line-height: 1.5;
		max-height: calc(100vh - 230px);
		overflow: auto;
	}
	.ln {
		white-space: pre;
		padding-right: 10px;
	}
	.no {
		display: inline-block;
		width: 52px;
		color: var(--text-3);
		user-select: none;
		padding-left: 4px;
	}
	.add {
		background: color-mix(in srgb, var(--ok) 16%, transparent);
	}
	.del {
		background: color-mix(in srgb, var(--danger) 16%, transparent);
		text-decoration: line-through;
		text-decoration-color: color-mix(in srgb, var(--danger) 50%, transparent);
	}
	.gap {
		color: var(--text-3);
		padding: 2px 12px;
		font-style: italic;
		background: var(--panel-2);
	}
</style>
