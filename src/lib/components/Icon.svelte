<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Supported icon names for the Icon component
 */
type IconName =
	// Navigation
	| 'menu'
	| 'close'
	| 'chevron-left'
	| 'chevron-right'
	| 'chevron-down'
	| 'chevron-up'
	| 'arrow-left'
	| 'arrow-right'
	// Media
	| 'image'
	| 'video'
	| 'play'
	| 'audio'
	| 'music'
	| 'document'
	| 'file'
	| 'download'
	| 'upload'
	| 'photo'
	| 'photo-simple'
	| 'camera'
	// Actions
	| 'search'
	| 'bookmark'
	| 'bookmark-outline'
	| 'trash'
	| 'edit'
	| 'calendar'
	| 'eye-off'
	| 'plus'
	| 'minus'
	// Status
	| 'sun'
	| 'moon'
	| 'spinner'
	| 'spinner-circle'
	| 'loading'
	| 'check'
	| 'alert'
	// Social
	| 'whatsapp'
	| 'user'
	| 'users'
	| 'chat'
	| 'message'
	// Development
	| 'github'
	| 'code'
	| 'star'
	| 'chart-bar'
	// Security
	| 'shield'
	| 'wifi-off'
	| 'lock'
	// Utility
	| 'dots-vertical'
	| 'language'
	| 'cloud-upload'
	| 'arrow-circle-right'
	| 'microphone'
	| 'circle'
	| 'tag';

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface Props extends Omit<HTMLAttributes<SVGElement>, 'size'> {
	name: IconName;
	size?: IconSize;
	/**
	 * For icons that have both filled and outline variants (like bookmark)
	 */
	filled?: boolean;
	/**
	 * Custom stroke width (overrides icon definition default)
	 */
	'stroke-width'?: number | string;
}

let {
	name,
	size = 'md',
	filled = false,
	'stroke-width': strokeWidthProp,
	class: className,
	...rest
}: Props = $props();

const sizeClasses: Record<IconSize, string> = {
	xs: 'w-3 h-3',
	sm: 'w-4 h-4',
	md: 'w-5 h-5',
	lg: 'w-6 h-6',
	xl: 'w-8 h-8',
	'2xl': 'w-12 h-12',
};

// Icon path definitions
const icons: Record<
	IconName,
	{
		path: string;
		fill?: string;
		stroke?: string;
		strokeWidth?: string;
		viewBox?: string;
	}
> = {
	// Navigation
	menu: {
		path: 'M4 6h16M4 12h16M4 18h16',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	close: {
		path: 'M6 18L18 6M6 6l12 12',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'chevron-left': {
		path: 'M15 19l-7-7 7-7',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'chevron-right': {
		path: 'M9 5l7 7-7 7',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'chevron-down': {
		path: 'M19 9l-7 7-7-7',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'chevron-up': {
		path: 'M5 15l7-7 7 7',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'arrow-left': {
		path: 'M11 19l-7-7 7-7m8 14l-7-7 7-7',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'arrow-right': {
		path: 'M13 5l7 7-7 7M5 12h14',
		stroke: 'currentColor',
		strokeWidth: '2',
	},

	// Media
	image: {
		path: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
		fill: 'currentColor',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	video: {
		path: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	play: {
		path: 'M14.752 11.168l-5.197-3.029A1 1 0 008 9.032v5.936a1 1 0 001.555.832l5.197-3.029a1 1 0 000-1.664z',
		fill: 'currentColor',
	},
	audio: {
		path: 'M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 12v.01',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	music: {
		path: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	document: {
		path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	file: {
		path: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	download: {
		path: 'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	upload: {
		path: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	photo: {
		path: 'M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z M7 15l3-3 3 3 3-3 2 2 M9.5 9.5a.5.5 0 11-1 0 .5.5 0 011 0z',
		fill: 'currentColor',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'photo-simple': {
		path: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z',
		fill: 'currentColor',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	camera: {
		path: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},

	// Actions
	search: {
		path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	bookmark: {
		path: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
		fill: 'currentColor',
	},
	'bookmark-outline': {
		path: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	trash: {
		path: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	edit: {
		path: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	calendar: {
		path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'eye-off': {
		path: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	plus: {
		path: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	minus: { path: 'M9 12h6', stroke: 'currentColor', strokeWidth: '2' },

	// Status
	sun: {
		path: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	moon: {
		path: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	spinner: {
		path: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'spinner-circle': {
		path: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
		stroke: 'currentColor',
		strokeWidth: '2',
		viewBox: '0 0 24 24',
	},
	loading: {
		path: 'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	check: { path: 'M5 13l4 4L19 7', stroke: 'currentColor', strokeWidth: '2' },
	alert: {
		path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},

	// Social
	whatsapp: {
		path: 'M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z',
		fill: 'currentColor',
		viewBox: '0 0 24 24',
	},
	user: {
		path: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	users: {
		path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	chat: {
		path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
		stroke: 'currentColor',
		strokeWidth: '1',
	},
	message: {
		path: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},

	// Development
	github: {
		path: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
		fill: 'currentColor',
		viewBox: '0 0 24 24',
	},
	code: {
		path: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	star: {
		path: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
		fill: 'currentColor',
	},
	'chart-bar': {
		path: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},

	// Security
	shield: {
		path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'wifi-off': {
		path: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0M1 1l22 22',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	lock: {
		path: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},

	// Utility
	'dots-vertical': {
		path: 'M12 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm0 5.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm0 5.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
		fill: 'currentColor',
	},
	language: {
		path: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'cloud-upload': {
		path: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	'arrow-circle-right': {
		path: 'M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	microphone: {
		path: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	circle: {
		path: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
	tag: {
		path: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
		stroke: 'currentColor',
		strokeWidth: '2',
	},
};

const iconDef = $derived(icons[name]);
const viewBox = $derived(iconDef?.viewBox || '0 0 24 24');

// Determine fill/stroke for icons that support variants
const actualFill = $derived.by(() => {
	if (name === 'bookmark' && !filled) {
		return 'none';
	}
	if (name === 'bookmark-outline' || (name === 'bookmark' && filled)) {
		return iconDef?.fill || 'none';
	}
	if (name === 'photo' && filled) {
		return 'currentColor';
	}
	if (name === 'photo' && !filled) {
		return 'none';
	}
	if (name === 'photo-simple' && filled) {
		return 'currentColor';
	}
	if (name === 'photo-simple' && !filled) {
		return 'none';
	}
	if (name === 'image' && filled) {
		return 'currentColor';
	}
	if (name === 'image' && !filled) {
		return 'none';
	}
	return iconDef?.fill || 'none';
});

const actualStroke = $derived.by(() => {
	if (name === 'bookmark' && !filled) {
		return 'currentColor';
	}
	if (name === 'bookmark' && filled) {
		return 'none';
	}
	if (name === 'bookmark-outline') {
		return 'currentColor';
	}
	if (name === 'photo' || name === 'photo-simple' || name === 'image') {
		return 'currentColor';
	}
	return iconDef?.stroke || 'none';
});

const actualStrokeWidth = $derived.by(() => {
	// If stroke-width prop is explicitly provided, use it
	if (strokeWidthProp !== undefined) {
		return String(strokeWidthProp);
	}
	// Special case for bookmark outline
	if (name === 'bookmark' && !filled) {
		return '2';
	}
	// Use icon definition default
	return iconDef?.strokeWidth;
});
</script>

<svg
	{viewBox}
	fill={actualFill}
	stroke={actualStroke}
	stroke-width={actualStrokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={`${sizeClasses[size]} ${className || ''}`}
	{...rest}
>
	{#if name === 'photo' && filled}
		<!-- Filled photo icon with contrasting internal details -->
		<rect x="2" y="4" width="20" height="16" rx="2" fill="currentColor" stroke="none" />
		<path d="M6 16l4-4 4 4 4-4 2 2" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
		<circle cx="8" cy="9" r="1.5" fill="rgba(0,0,0,0.5)" stroke="none" />
	{:else}
		<path d={iconDef?.path} />
	{/if}
</svg>
