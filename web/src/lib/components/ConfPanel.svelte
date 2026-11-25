<script lang="ts">
	import { editor } from '#lib/editor.svelte';
	import { CONF_GROUPS, CONF_MAP, CONF_OPTIONS, parseConf, setConf, type ConfOption } from '#lib/zmk/conf';

	let mode = $state<'form' | 'raw'>('form');
	let filter = $state('');
	let showAll = $state(false);
	let raw = $state('');
	$effect(() => {
		if (mode === 'raw') raw = editor.confText;
	});

	const values = $derived(new Map(editor.confLines.filter((l) => l.kind === 'option' && !l.commented).map((l) => [(l as { key: string }).key, (l as { value: string }).value])));
	const fromBuild = $derived(new Map([...editor.buildYaml.matchAll(/-D(CONFIG_[A-Z0-9_]+)=(\S+)/g)].map((m) => [m[1], m[2]])));
	const unknown = $derived(editor.confLines.filter((l) => l.kind === 'option' && !CONF_MAP.has(l.key)) as { key: string; value: string; commented: boolean }[]);

	function set(key: string, value: string | undefined) {
		editor.confLines = setConf(editor.confLines, key, value);
	}

	function setBool(o: ConfOption, on: boolean | undefined) {
		if (on && o.exclusive) {
			for (const other of CONF_OPTIONS) if (other.exclusive === o.exclusive && other.key !== o.key && values.get(other.key) === 'y') set(other.key, 'n');
		}
		set(o.key, on === undefined ? undefined : on ? 'y' : 'n');
	}

	const groups = $derived(
		CONF_GROUPS.map((g) => ({
			g,
			opts: CONF_OPTIONS.filter((o) => o.group === g).filter((o) => {
				const q = filter.toLowerCase();
				if (q && !o.key.toLowerCase().includes(q) && !o.desc.toLowerCase().includes(q)) return false;
				if (!editor.niceOled && o.group.startsWith('nice_oled')) return false;
				return showAll || values.has(o.key) || !!q;
			})
		})).filter((x) => x.opts.length)
	);
</script>

{#if !editor.confPath}
	<p class="muted">Tidak ada file .conf.</p>
{:else}
	<div class="row">
		<code class="grow small">{editor.confPath}{editor.confDirty ? ' •' : ''}</code>
		<button class:active={mode === 'form'} onclick={() => (mode = 'form')}>Form</button>
		<button class:active={mode === 'raw'} onclick={() => (mode = 'raw')}>Raw</button>
	</div>

	{#if mode === 'form'}
		<div class="row top">
			<input type="search" class="grow" placeholder="Cari opsi Kconfig…" bind:value={filter} />
			<label class="inline small"><input type="checkbox" bind:checked={showAll} /> Semua opsi</label>
		</div>
		<p class="muted small">Menampilkan opsi yang sudah di-set{showAll ? ' + semua opsi yang dikenal' : ''}. Nilai dari <code>build.yaml</code> (cmake-args) ditandai <span class="chip">build.yaml</span>.</p>

		{#each groups as { g, opts } (g)}
			<div class="section-title">{g}</div>
			<div class="opts">
				{#each opts as o (o.key)}
					{@const v = values.get(o.key)}
					{@const isSet = v !== undefined}
					<div class="opt" class:set={isSet} class:warn={!!o.warn && v === 'y'}>
						<div class="ohead">
							<code class="okey" title={o.key}>{o.key.replace('CONFIG_', '')}</code>
							{#if fromBuild.has(o.key)}<span class="chip" title="Di-set lewat cmake-args di build.yaml">build.yaml={fromBuild.get(o.key)}</span>{/if}
							{#if o.side}<span class="chip">{o.side === 'central' ? 'kiri' : o.side === 'peripheral' ? 'kanan' : ''}</span>{/if}
							<span class="grow"></span>
							{#if o.type === 'bool'}
								<select value={v ?? ''} onchange={(e) => setBool(o, e.currentTarget.value === '' ? undefined : e.currentTarget.value === 'y')}>
									<option value="">default{o.default ? ` (${o.default})` : ''}</option>
									<option value="y">y — aktif</option>
									<option value="n">n — mati</option>
								</select>
							{:else if o.type === 'int'}
								<input type="number" value={v ?? ''} placeholder={o.default ?? 'default'} onchange={(e) => set(o.key, e.currentTarget.value === '' ? undefined : e.currentTarget.value)} />
								{#if o.unit}<span class="muted small">{o.unit}</span>{/if}
							{:else}
								<input value={v ?? ''} placeholder={o.default ?? ''} onchange={(e) => set(o.key, e.currentTarget.value === '' ? undefined : e.currentTarget.value.startsWith('"') ? e.currentTarget.value : `"${e.currentTarget.value}"`)} />
							{/if}
						</div>
						<div class="muted small">{o.desc}{#if o.unit === 'ms' && v}&nbsp;· {(Number(v) / 1000).toLocaleString('id')} detik{/if}</div>
						{#if o.warn && v === 'y'}<div class="small warntext">⚠ {o.warn}</div>{/if}
					</div>
				{/each}
			</div>
		{/each}

		{#if unknown.length}
			<div class="section-title">Opsi lain di file</div>
			{#each unknown as u (u.key)}
				<div class="row opt-raw">
					<code class="grow small">{u.commented ? '# ' : ''}{u.key}</code>
					<input class="mono" value={u.value} onchange={(e) => set(u.key, e.currentTarget.value)} />
					<button class="ghost danger" onclick={() => set(u.key, undefined)}>✕</button>
				</div>
			{/each}
		{/if}
	{:else}
		<textarea class="raw" bind:value={raw} spellcheck="false"></textarea>
		<div class="row">
			<button class="primary" onclick={() => (editor.confLines = parseConf(raw))}>Terapkan</button>
			<span class="muted small">Ctrl+S untuk menyimpan ke disk.</span>
		</div>
	{/if}
{/if}

<style>
	.top {
		margin-top: 8px;
	}
	.opts {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.opt {
		border-left: 2px solid var(--border);
		padding: 4px 8px;
	}
	.opt.set {
		border-left-color: var(--accent);
	}
	.opt.warn {
		border-left-color: var(--danger);
	}
	.ohead {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.okey {
		font-size: 11px;
		word-break: break-all;
	}
	.ohead input[type='number'] {
		width: 110px;
	}
	.warntext {
		color: var(--danger);
	}
	.raw {
		width: 100%;
		min-height: 420px;
		margin: 8px 0;
	}
	.opt-raw {
		margin-bottom: 4px;
	}
</style>
