<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { gridFlow } from '$lib/settings.svelte';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import RowsIcon from '@lucide/svelte/icons/rows-3';
	import ColumnsIcon from '@lucide/svelte/icons/columns-3';
	import ISOPreferredFitDialog from '$lib/components/ISOPreferredFitDialog.svelte';
	import ISOReverseLookupDialog from '$lib/components/ISOReverseLookupDialog.svelte';

	let preferredFitOpen = $state(false);
	let reverseLookupOpen = $state(false);
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="icon" aria-label="Settings" title="Settings">
				<SettingsIcon class="size-4" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-64" align="end">
		<p class="mb-3 text-sm font-medium">Settings</p>

		<div class="flex items-center justify-between gap-2">
			<span class="text-sm text-muted-foreground">Grid layout</span>
			<div class="flex gap-1">
				<Button
					variant={gridFlow.current === 'row' ? 'secondary' : 'ghost'}
					size="icon-sm"
					aria-label="Fill rows first"
					title="Fill rows first"
					onclick={() => (gridFlow.current = 'row')}
				>
					<RowsIcon class="size-3.5" />
				</Button>
				<Button
					variant={gridFlow.current === 'column' ? 'secondary' : 'ghost'}
					size="icon-sm"
					aria-label="Fill columns first"
					title="Fill columns first"
					onclick={() => (gridFlow.current = 'column')}
				>
					<ColumnsIcon class="size-3.5" />
				</Button>
			</div>
		</div>

		<div class="mt-3 flex flex-col gap-2 border-t pt-3">
			<span class="text-sm text-muted-foreground">Lookup tools (dev)</span>
			<Button variant="outline" size="sm" onclick={() => (preferredFitOpen = true)}>
				Find preferred fit
			</Button>
			<Button variant="outline" size="sm" onclick={() => (reverseLookupOpen = true)}>
				Lookup tolerance
			</Button>
		</div>
	</Popover.Content>
</Popover.Root>

<ISOPreferredFitDialog bind:open={preferredFitOpen} />
<ISOReverseLookupDialog bind:open={reverseLookupOpen} />
