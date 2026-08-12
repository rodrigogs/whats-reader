import { describe, expect, it } from 'vitest';
import { createRuneCounter } from './rune-counter.svelte';

describe('GH-67 Svelte-aware global-search test pipeline', () => {
	it('compiles a rune module and observes $state mutation', () => {
		const counter = createRuneCounter();

		expect(counter.count).toBe(0);
		counter.increment();
		expect(counter.count).toBe(1);
	});
});
