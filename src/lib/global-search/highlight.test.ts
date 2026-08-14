import { describe, expect, it } from 'vitest';
import { findLiteralRanges } from './highlight';

describe('GH-67 literal range highlight (case-insensitive, no accent folding)', () => {
	it('returns an empty array for an empty query', () => {
		expect(findLiteralRanges('anything', '')).toEqual([]);
	});

	it('returns an empty array when the query is not present', () => {
		expect(findLiteralRanges('hello world', 'xyz')).toEqual([]);
	});

	it('finds a single case-insensitive match', () => {
		expect(findLiteralRanges('Hello World', 'world')).toEqual([
			{ start: 6, end: 11 },
		]);
	});

	it('preserves the original case of the matched text', () => {
		const text = 'MiXeD CaSe';
		const ranges = findLiteralRanges(text, 'mixed');
		expect(ranges).toEqual([{ start: 0, end: 5 }]);
		expect(text.slice(ranges[0].start, ranges[0].end)).toBe('MiXeD');
	});

	it('finds every non-overlapping occurrence', () => {
		expect(findLiteralRanges('foo foo foo', 'foo')).toEqual([
			{ start: 0, end: 3 },
			{ start: 4, end: 7 },
			{ start: 8, end: 11 },
		]);
	});

	it('scans left-to-right so overlapping matches do not overlap', () => {
		expect(findLiteralRanges('aaaa', 'aa')).toEqual([
			{ start: 0, end: 2 },
			{ start: 2, end: 4 },
		]);
	});

	it('matches unicode text by UTF-16 code-unit offset (slice-compatible)', () => {
		const text = 'Café é bom';
		const ranges = findLiteralRanges(text, 'café');
		expect(ranges).toEqual([{ start: 0, end: 4 }]);
		expect(text.slice(ranges[0].start, ranges[0].end)).toBe('Café');
	});

	it('never performs accent folding', () => {
		expect(findLiteralRanges('café', 'cafe')).toEqual([]);
	});
});
