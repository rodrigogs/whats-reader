/**
 * electron-builder afterPack hook
 * Removes unused dependencies AFTER packaging to reduce app size
 * Runs after dependencies are analyzed but before final installer creation
 */

const fs = require('node:fs');
const path = require('node:path');

module.exports = async function (context) {
	const appOutDir = context.appOutDir;
	const platform = context.electronPlatformName;
	
	console.log(`\n[afterPack] Running cleanup for ${platform}...`);
	console.log(`[afterPack] App directory: ${appOutDir}`);

	// Paths differ by platform
	let nodeModulesPath;
	
	if (platform === 'darwin') {
		// macOS: WhatsApp Backup Reader.app/Contents/Resources/app.asar.unpacked/node_modules
		nodeModulesPath = path.join(
			appOutDir,
			`${context.packager.appInfo.productFilename}.app`,
			'Contents',
			'Resources',
			'app.asar.unpacked',
			'node_modules'
		);
	} else if (platform === 'win32') {
		// Windows: resources/app.asar.unpacked/node_modules
		nodeModulesPath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules');
	} else {
		// Linux: resources/app.asar.unpacked/node_modules
		nodeModulesPath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules');
	}

	console.log(`[afterPack] Node modules path: ${nodeModulesPath}`);

	if (!fs.existsSync(nodeModulesPath)) {
		console.log('[afterPack] ⚠️  Node modules directory not found, skipping cleanup');
		return;
	}

	// Packages to remove (not actually used, only listed as peer deps)
	const packagesToRemove = ['onnxruntime-node'];
	let totalSaved = 0;

	for (const pkg of packagesToRemove) {
		const pkgPath = path.join(nodeModulesPath, pkg);
		
		if (fs.existsSync(pkgPath)) {
			try {
				// Calculate size before removal
				const sizeBefore = getDirectorySize(pkgPath);
				
				// Remove package
				fs.rmSync(pkgPath, {
					recursive: true,
					force: true,
					maxRetries: 3, // Windows compatibility
					retryDelay: 100
				});
				
				totalSaved += sizeBefore;
				console.log(`[afterPack] ✅ Removed ${pkg} (saved ${formatBytes(sizeBefore)})`);
			} catch (error) {
				console.error(`[afterPack] ⚠️  Failed to remove ${pkg}:`, error.message);
			}
		} else {
			console.log(`[afterPack] ℹ️  ${pkg} not found, skipping`);
		}
	}

	if (totalSaved > 0) {
		console.log(`[afterPack] 🎉 Total space saved: ${formatBytes(totalSaved)}\n`);
	} else {
		console.log('[afterPack] No packages removed\n');
	}
};

// Helper: Calculate directory size recursively
function getDirectorySize(dirPath) {
	let size = 0;

	try {
		const items = fs.readdirSync(dirPath);

		for (const item of items) {
			const itemPath = path.join(dirPath, item);
			const stats = fs.statSync(itemPath);

			if (stats.isDirectory()) {
				size += getDirectorySize(itemPath);
			} else {
				size += stats.size;
			}
		}
	} catch (error) {
		// Ignore permission errors
	}

	return size;
}

// Helper: Format bytes to human-readable
function formatBytes(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
