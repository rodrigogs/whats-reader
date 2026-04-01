// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

interface FileResult {
	path: string;
	name: string;
	buffer: ArrayBuffer;
}

interface ReadResult {
	success: boolean;
	data?: ArrayBuffer;
	error?: string;
}

interface FileReadResult {
	success: boolean;
	buffer?: ArrayBuffer;
	name?: string;
	error?: string;
}

interface DirEntry {
	name: string;
	isDirectory: boolean;
	path: string;
}

interface ReadDirResult {
	success: boolean;
	data?: DirEntry[];
	error?: string;
}

interface ElectronAPI {
	openFile: () => Promise<FileResult | null>;
	openFolder: () => Promise<string | null>;
	readFile: (filePath: string) => Promise<ReadResult>;
	readDir: (dirPath: string) => Promise<ReadDirResult>;
	fileExists: (filePath: string) => Promise<boolean>;
	readFileFromPath: (filePath: string) => Promise<FileReadResult>;
	openExternal: (url: string) => Promise<void>;
	platform: string;
	isElectron: boolean;
	updater?: {
		checkForUpdates: () => Promise<void>;
		downloadUpdate: () => Promise<void>;
		quitAndInstall: () => void;
		onStatus: (
			callback: (data: { event: string; data?: unknown }) => void,
		) => () => void;
	};
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// File System Access API types (experimental, not in default TypeScript libs)
	// See https://wicg.github.io/file-system-access/
	interface FileSystemHandlePermissionDescriptor {
		mode?: 'read' | 'readwrite';
	}

	interface OpenFilePickerOptions {
		types?: {
			description?: string;
			accept: Record<string, string[]>;
		}[];
		multiple?: boolean;
		excludeAcceptAllOption?: boolean;
	}

	interface FileSystemFileHandle {
		queryPermission(
			descriptor?: FileSystemHandlePermissionDescriptor,
		): Promise<PermissionState>;
		requestPermission(
			descriptor?: FileSystemHandlePermissionDescriptor,
		): Promise<PermissionState>;
	}

	interface DataTransferItem {
		getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
	}

	interface Window {
		electronAPI?: ElectronAPI;
		showOpenFilePicker(
			options?: OpenFilePickerOptions,
		): Promise<FileSystemFileHandle[]>;
	}
}

export {};
