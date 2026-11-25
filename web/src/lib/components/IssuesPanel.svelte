<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import type { Issue } from '#lib/keymap/validate';

	const order = { error: 0, warning: 1, info: 2 };
	const sorted = $derived([...editor.issues].sort((a, b) => order[a.severity] - order[b.severity]));

	function go(i: Issue) {
		if (i.layer !== undefined) editor.layer = i.layer;
		if (i.pos !== undefined) {
			editor.selected = i.pos;
			editor.tab = 'key';
		} else if (i.combo) {
			const c = editor.km?.combos.find((x) => x.nodeName === i.combo);
			if (c) {
				editor.selectedCombo = c.uid;
				editor.tab = 'combos';
			}
		}
	}
</script>

{#if !sorted.length}
	<p class="ok">✓ Tidak ada masalah terdeteksi.</p>
{/if}
<div class="list">
	{#each sorted as i, idx (idx)}
		<button class="list-item issue {i.severity}" onclick={() => go(i)}>
			<span class="ic">{i.severity === 'error' ? '✕' : i.severity === 'warning' ? '!' : 'i'}</span>
			<span class="grow">
				<span>{i.message}</span>
				{#if i.hint}<span class="muted small hint">{i.hint}</span>{/if}
			</span>
		</button>
	{/each}
</div>
<p class="muted small">Validasi berjalan langsung di browser. Build tetap jadi penentu akhir; error compiler muncul di log Build.</p>

<style>
	.ok {
		color: var(--ok);
	}
	.issue {
		align-items: flex-start;
		font-size: 12px;
	}
	.issue .grow {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ic {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 11px;
		font-weight: 800;
		flex: none;
	}
	.error .ic {
		background: var(--danger);
		color: #fff;
	}
	.warning .ic {
		background: var(--warn);
		color: #1b1405;
	}
	.info .ic {
		background: var(--info);
		color: #fff;
	}
	.hint {
		font-size: 11px;
	}
</style>
