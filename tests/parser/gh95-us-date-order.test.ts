import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { parseChat } from '../../src/lib/parser/chat-parser.ts';

const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe('GH-95 US month-first 24h exports', () => {
	it('infers month-first from a later line with second component > 12', () => {
		const chat = parseChat(
			[
				'01/12/2020, 14:30 - Alex: first',
				'01/13/2020, 09:00 - Sara: second',
			].join('\n'),
		);
		assert.equal(chat.messages.length, 2);
		assert.deepEqual(ymd(chat.messages[0].timestamp), [2020, 1, 12]);
		assert.deepEqual(ymd(chat.messages[1].timestamp), [2020, 1, 13]);
	});

	it('handles bracketed iOS month-first', () => {
		const chat = parseChat(
			'[1/12/20, 14:30:00] A: x\n[1/13/20, 14:31:00] B: y',
		);
		assert.equal(chat.messages.length, 2);
		assert.deepEqual(ymd(chat.messages[0].timestamp), [2020, 1, 12]);
	});

	it('does not reinterpret localized day-first AM/PM lines as month-first', () => {
		const chat = parseChat(
			'01/13/2020, 14:30 - Alex: US evidence\n06/07/2018 1:55 p. m. - Sara: localized',
		);
		assert.equal(chat.messages.length, 2);
		assert.deepEqual(ymd(chat.messages[1].timestamp), [2018, 7, 6]);
	});

	it('does not infer an order from an invalid 24-hour timestamp', () => {
		const chat = parseChat(
			'01/13/2020, 25:00 - malformed evidence\n03/04/2020, 10:00 - Alex: day-first default',
		);
		assert.equal(chat.messages.length, 1);
		assert.deepEqual(ymd(chat.messages[0].timestamp), [2020, 4, 3]);
	});

	it('keeps day-first when any first component > 12', () => {
		const chat = parseChat(
			'01/12/2020, 14:30 - A: x\n13/01/2020, 09:00 - B: y',
		);
		assert.deepEqual(ymd(chat.messages[0].timestamp), [2020, 12, 1]);
		assert.deepEqual(ymd(chat.messages[1].timestamp), [2020, 1, 13]);
	});

	it('keeps day-first default for fully ambiguous chats', () => {
		const chat = parseChat('01/12/2020, 14:30 - A: x');
		assert.deepEqual(ymd(chat.messages[0].timestamp), [2020, 12, 1]);
	});
});
