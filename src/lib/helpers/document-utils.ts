/**
 * Document utilities for file type detection, formatting, and display
 */

/**
 * Format file size in bytes to human-readable format
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "1 MB", "234 KB")
 */
export function formatFileSize(bytes: number): string {
	// Guard against negative or non-finite values to avoid confusing output like "-5 B" or "NaN B"
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	if (bytes < 1024) return `${Math.round(bytes)} B`;

	const kb = bytes / 1024;
	if (kb < 1024) return `${Math.round(kb)} KB`;

	const mb = kb / 1024;
	if (mb < 1024) return `${Math.round(mb)} MB`;

	const gb = mb / 1024;
	return `${Math.round(gb)} GB`;
}

/**
 * Get file extension in uppercase for display
 * @param filename File name
 * @returns Uppercase extension without dot (e.g., "PDF", "DOCX"), or empty string if none
 */
export function getFileExtension(filename: string): string {
	const lastDotIndex = filename.lastIndexOf('.');

	// No dot, leading dot, or trailing dot: treat as no extension
	if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
		return '';
	}

	const ext = filename.slice(lastDotIndex + 1).toLowerCase();
	return ext.toUpperCase();
}

/**
 * Get background color for document type based on file extension
 * Uses industry-standard colors (Microsoft Office colors, PDF red, etc.)
 * @param filename File name
 * @returns Hex color string for the document type
 */
export function getDocumentColor(filename: string): string {
	const ext = getFileExtension(filename);

	const colorMap: Record<string, string> = {
		// PDF - Adobe Red
		PDF: '#DC2626',
		// Microsoft Word - Blue
		DOC: '#2563EB',
		DOCX: '#2563EB',
		// Microsoft Excel - Green
		XLS: '#16A34A',
		XLSX: '#16A34A',
		CSV: '#16A34A',
		// Microsoft PowerPoint - Orange
		PPT: '#EA580C',
		PPTX: '#EA580C',
		// Archives - Amber
		ZIP: '#D97706',
		RAR: '#D97706',
		'7Z': '#D97706',
		TAR: '#D97706',
		GZ: '#D97706',
		// Text files - Gray
		TXT: '#6B7280',
		RTF: '#6B7280',
		MD: '#6B7280',
		// Code files - Purple
		JSON: '#7C3AED',
		XML: '#7C3AED',
		HTML: '#7C3AED',
		CSS: '#7C3AED',
		JS: '#7C3AED',
		TS: '#7C3AED',
		// SVG files - Amber (when categorized as documents)
		// Note: SVG files are primarily handled as images in gallery-thumbnails.ts
		// but may appear as documents in some contexts
		SVG: '#F59E0B',
	};

	return colorMap[ext] || '#64748B';
}
