// Parser exports

export type {
	ArchiveId,
	ArchiveMessageKey,
} from '../global-search/archive-identity';
export {
	createArchiveMessageKey,
	createSessionArchiveId,
} from '../global-search/archive-identity';
export type { ChatMessage, ParsedChat } from './chat-parser';
export {
	formatTime,
	getChatStats,
	groupMessagesByDate,
	parseChat,
} from './chat-parser';
export type { ContactInfo } from './vcf-parser';
export { formatPhoneNumber, isPhoneNumber, parseVcf } from './vcf-parser';
export type {
	DateFlatItem,
	FlatItem,
	MediaFile,
	MessageFlatItem,
	ParsedZipChat,
	ParseProgress,
} from './zip-parser';
export {
	cleanupMediaUrls,
	loadMediaFile,
	parseZipFile,
	preloadMedia,
	readFileAsArrayBuffer,
} from './zip-parser';
