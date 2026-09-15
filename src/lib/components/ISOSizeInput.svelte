<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	let {
		value = $bindable(''),
		class: wrapperClass,
		icon,
		...restProps
	}: Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & {
		value?: string;
		icon?: Snippet;
	} = $props();
</script>

<div class={cn('relative', wrapperClass)}>
	{#if icon}
		<div class="text-muted-foreground absolute inset-y-0 left-0 flex items-center pl-2">
			{@render icon()}
		</div>
	{/if}
	<Input
		type="number"
		bind:value
		class={cn(
			buttonVariants({ variant: 'outline' }),
			'w-full text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
			icon && 'pl-8'
		)}
		{...restProps}
	/>
</div>
