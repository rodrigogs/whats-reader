/**
 * Document utilities for file type detection, formatting, and display
 */

/**
 * Format file size in bytes to human-readable format
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "234 KB")
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	if (bytes < 1024) return `${bytes} B`;

	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;

	const mb = kb / 1024;
	if (mb < 1024) return `${mb.toFixed(1)} MB`;

	const gb = mb / 1024;
	return `${gb.toFixed(1)} GB`;
}

/**
 * Get file extension in uppercase for display
 * @param filename File name
 * @returns Uppercase extension without dot (e.g., "PDF", "DOCX")
 */
export function getFileExtension(filename: string): string {
	const ext = filename.toLowerCase().split('.').pop() || '';
	return ext.toUpperCase() || 'FILE';
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
		// Images (if shown as documents)
		SVG: '#F59E0B',
	};

	return colorMap[ext] || '#64748B';
}
