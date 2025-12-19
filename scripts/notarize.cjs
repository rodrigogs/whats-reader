/**
 * electron-builder afterSign hook
 * Notarizes the macOS app bundle to reduce Gatekeeper warnings.
 *
 * This is intentionally a no-op unless notarization credentials are present.
 */

const path = require('node:path');

let notarize;
try {
	({ notarize } = require('@electron/notarize'));
} catch {
	notarize = null;
}

module.exports = async function notarizeAfterSign(context) {
	if (context.electronPlatformName !== 'darwin') return;
	if (!notarize) {
		console.log('[afterSign] @electron/notarize not installed; skipping notarization');
		return;
	}

	const appName = context.packager.appInfo.productFilename;
	const appPath = path.join(context.appOutDir, `${appName}.app`);

	const hasAppleIdFlow = Boolean(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD);
	const hasApiKeyFlow = Boolean(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER);

	if (!hasAppleIdFlow && !hasApiKeyFlow) {
		console.log('[afterSign] No notarization credentials provided; skipping notarization');
		return;
	}

	console.log(`[afterSign] Notarizing ${appPath}...`);

	// Prefer API key flow when available.
	if (hasApiKeyFlow) {
		await notarize({
			appPath,
			appleApiKey: process.env.APPLE_API_KEY,
			appleApiKeyId: process.env.APPLE_API_KEY_ID,
			appleApiIssuer: process.env.APPLE_API_ISSUER
		});
		console.log('[afterSign] Notarization complete (API key)');
		return;
	}

	// Apple ID flow (requires APPLE_TEAM_ID for some setups)
	await notarize({
		appPath,
		appleId: process.env.APPLE_ID,
		appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
		teamId: process.env.APPLE_TEAM_ID
	});
	console.log('[afterSign] Notarization complete (Apple ID)');
};
