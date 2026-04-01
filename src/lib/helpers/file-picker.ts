/**
 * Shared file-picker helpers for ZIP imports.
 *
 * Centralises the showOpenFilePicker (Web) and electronAPI.openFile (Electron)
 * patterns so they are not duplicated across FileDropZone, ReselectFileModal,
 * and +page.svelte.
 */

/**
 * Open the native file picker for ZIP files (Web — File System Access API).
 * Returns null if the API is not supported or the user cancelled.
 */
export async function openZipFilePicker(multiple = false): Promise<{
	files: FileList;
	handles?: FileSystemFileHandle[];
} | null> {
	if (!('showOpenFilePicker' in window)) return null;

	try {
		const handles = await window.showOpenFilePicker({
			types: [
				{
					description: 'WhatsApp ZIP files',
					accept: { 'application/zip': ['.zip'] },
				},
			],
			multiple,
		});
		if (!handles?.length) return null;

		const dt = new DataTransfer();
		for (const h of handles) {
			dt.items.add(await h.getFile());
		}
		return { files: dt.files, handles };
	} catch {
		// User cancelled or API failed
		return null;
	}
}

/**
 * Open a file via Electron's native dialog and return a File + absolute path.
 * Returns null when not running in Electron or the user cancelled.
 */
export async function openElectronFile(): Promise<{
	file: File;
	path: string;
} | null> {
	if (!window.electronAPI) return null;

	const result = await window.electronAPI.openFile();
	if (!result) return null;

	const blob = new Blob([result.buffer]);
	const file = new File([blob], result.name, { type: 'application/zip' });
	return { file, path: result.path };
}

/**
 * Extract the absolute file path that Electron attaches to drag-dropped files.
 * Returns undefined when not running in Electron or the property is absent.
 */
export function getElectronFilePath(file: File): string | undefined {
	return 'path' in file ? (file as File & { path: string }).path : undefined;
}
