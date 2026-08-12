export const GLOBAL_SEARCH_SYNTHETIC_SEED = 'gh67-v1';
export const GLOBAL_SEARCH_SYNTHETIC_SIZES = [
	10_000, 100_000, 250_000, 1_000_000,
] as const;

export type GlobalSearchSyntheticSize =
	(typeof GLOBAL_SEARCH_SYNTHETIC_SIZES)[number];

export type GlobalSearchSyntheticDataset = {
	seed: typeof GLOBAL_SEARCH_SYNTHETIC_SEED;
	size: GlobalSearchSyntheticSize;
	chatCount: number;
};

export type GlobalSearchSyntheticMessage = {
	archiveId: string;
	chatTitle: string;
	ordinal: number;
	messageId: string;
	timestamp: number | null;
	sender: string;
	content: string;
};

const CHAT_TITLES = [
	'Family Group',
	'Family Group',
	'Project Alpha',
	'Project Alpha',
	'東京 friends',
	'Café mañana',
	'HTML <Team>',
	'Emoji 🚀 Crew',
];

const SENDERS = [
	'Ana ação',
	'李雷',
	'Miyuki 東京',
	'Noah 😀',
	'gh67-v1-sender',
	'Zoë Café',
];

const CONTENT_VARIANTS = [
	'Plain deterministic baseline message for global search.',
	'Unicode emoji payload 😀 🚀 ✨ with mixed scripts.',
	'Acentos e cedilha: ação, café, coração, mañana.',
	'CJK payload: 東京 消息 漢字 こんにちは 세계.',
	'HTML-like text: <script>alert("x")</script> <b>bold</b> &lt;safe&gt;.',
	'gh67-v1-query gh67-v1-snippet gh67-v1-content /gh67/synthetic/path',
];

export function createGlobalSearchSyntheticDataset(options: {
	size: GlobalSearchSyntheticSize;
}): GlobalSearchSyntheticDataset {
	if (!isGlobalSearchSyntheticSize(options.size)) {
		throw new Error(`Unsupported GH-67 synthetic size: ${options.size}`);
	}

	return {
		seed: GLOBAL_SEARCH_SYNTHETIC_SEED,
		size: options.size,
		chatCount: CHAT_TITLES.length,
	};
}

export function* iterateGlobalSearchSyntheticMessages(
	dataset: GlobalSearchSyntheticDataset,
): Generator<GlobalSearchSyntheticMessage> {
	for (let ordinal = 0; ordinal < dataset.size; ordinal += 1) {
		yield getGlobalSearchSyntheticMessage(dataset, ordinal);
	}
}

export function getGlobalSearchSyntheticMessage(
	dataset: GlobalSearchSyntheticDataset,
	ordinal: number,
): GlobalSearchSyntheticMessage {
	if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= dataset.size) {
		throw new Error(`Synthetic message ordinal out of range: ${ordinal}`);
	}

	const chatIndex = ordinal % CHAT_TITLES.length;
	return {
		archiveId: `${GLOBAL_SEARCH_SYNTHETIC_SEED}-archive-${chatIndex.toString().padStart(2, '0')}`,
		chatTitle: CHAT_TITLES[chatIndex],
		ordinal,
		messageId: `${GLOBAL_SEARCH_SYNTHETIC_SEED}-message-id-${ordinal % 32}`,
		timestamp:
			ordinal % 17 === 0 ? null : Date.UTC(2020, 0, 1) + ordinal * 60_000,
		sender: SENDERS[ordinal % SENDERS.length],
		content: buildSyntheticContent(ordinal),
	};
}

export function isGlobalSearchSyntheticSize(
	size: number,
): size is GlobalSearchSyntheticSize {
	return GLOBAL_SEARCH_SYNTHETIC_SIZES.includes(
		size as GlobalSearchSyntheticSize,
	);
}

function buildSyntheticContent(ordinal: number): string {
	if (ordinal === 5) {
		return `${CONTENT_VARIANTS.join(' ')} ${'x'.repeat(256 * 1024 + 1)}`;
	}

	return `${CONTENT_VARIANTS[ordinal % CONTENT_VARIANTS.length]} #${ordinal}`;
}
