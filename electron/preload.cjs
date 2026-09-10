const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	// File dialogs
	openFile: () => ipcRenderer.invoke('dialog:openFile'),
	openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

	// File system operations
	readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
	readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
	fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),

	// Persistence file operations
	readFileFromPath: (filePath) =>
		ipcRenderer.invoke('file:readFromPath', filePath),

	// Resolve the absolute path of a dropped/selected File (Electron 32+ removed
	// the non-standard File#path; webUtils.getPathForFile is the replacement).
	getPathForFile: (file) => webUtils.getPathForFile(file),

	// External links
	openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

	// Auto-updater
	updater: {
		checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
		downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
		quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
		onStatus: (callback) => {
			const subscription = (_event, data) => callback(data);
			ipcRenderer.on('auto-update-status', subscription);
			return () =>
				ipcRenderer.removeListener('auto-update-status', subscription);
		},
	},

	// Platform info
	platform: process.platform,
	isElectron: true,
});
