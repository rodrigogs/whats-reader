#!/usr/bin/env node
/**
 * Cleanup script to remove unnecessary dependencies that bloat the Electron build
 * Runs after npm install to keep node_modules lean
 * Cross-platform compatible (Windows, macOS, Linux)
 */

const fs = require('node:fs');
const path = require('node:path');

const packagesToRemove = [
	'onnxruntime-node', // 210MB - not used (only onnxruntime-web is needed)
];

console.log('Cleaning up unnecessary dependencies...');

let totalSaved = 0;

for (const pkg of packagesToRemove) {
	const pkgPath = path.resolve(__dirname, '..', 'node_modules', pkg);
	
	if (fs.existsSync(pkgPath)) {
		try {
			// Get size before removal
			const size = getDirectorySize(pkgPath);
			const sizeMB = (size / 1024 / 1024).toFixed(1);
			
			// Remove the package (rmSync works on all platforms)
			fs.rmSync(pkgPath, { recursive: true, force: true, maxRetries: 3 });
			totalSaved += size;
			
			console.log(`  Removed ${pkg} (${sizeMB}MB)`);
		} catch (err) {
			console.warn(`  Warning: Could not remove ${pkg}: ${err.message}`);
		}
	}
}

if (totalSaved > 0) {
	const totalMB = (totalSaved / 1024 / 1024).toFixed(1);
	console.log(`Saved ${totalMB}MB total`);
} else {
	console.log('  (nothing to clean)');
}

function getDirectorySize(dirPath) {
	let size = 0;
	
	try {
		const files = fs.readdirSync(dirPath, { withFileTypes: true });
		
		for (const file of files) {
			const fullPath = path.join(dirPath, file.name);
			
			try {
				if (file.isDirectory()) {
					size += getDirectorySize(fullPath);
				} else if (file.isFile()) {
					const stats = fs.statSync(fullPath);
					size += stats.size;
				}
			} catch (err) {
				// Skip files/dirs we can't access (permissions, etc)
			}
		}
	} catch (err) {
		// Skip directories we can't read
	}
	
	return size;
}
