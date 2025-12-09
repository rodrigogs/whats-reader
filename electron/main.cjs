const {
	app,
	BrowserWindow,
	ipcMain,
	dialog,
	protocol,
	Menu,
	shell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let mainWindow;

// Get the build directory path
const getBuildPath = () => {
	// In production, __dirname is inside the app.asar
	return path.join(__dirname, '../build');
};

const createWindow = () => {
	// Build window options
	const windowOptions = {
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
		titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
		backgroundColor: '#ECE5DD',
		icon: path.join(
			__dirname,
			'../static',
			process.platform === 'win32' ? 'icon.ico' : 'icon.png',
		),
		// Hide menu bar on Windows
		autoHideMenuBar: true,
	};

	// Only apply trafficLightPosition on macOS
	if (process.platform === 'darwin') {
		windowOptions.trafficLightPosition = { x: 15, y: 12 };
	}

	// Remove menu bar completely on Windows
	if (process.platform === 'win32') {
		Menu.setApplicationMenu(null);
	}

	// Create the browser window.
	mainWindow = new BrowserWindow(windowOptions);

	// In development, load from Vite dev server
	// In production, load from built files using custom protocol
	if (process.env.NODE_ENV === 'development') {
		mainWindow.loadURL('http://localhost:5173');
		mainWindow.webContents.openDevTools();
	} else {
		// Load root path, not /index.html - SvelteKit router needs the path to be /
		mainWindow.loadURL('app://localhost/');
	}
};

// Register custom protocol for serving local files
// This allows absolute paths like /favicon.ico to work
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'app',
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
		},
	},
]);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
	// Register protocol handler for 'app://' scheme
	protocol.handle('app', async (request) => {
		// Parse the URL to get just the pathname
		const requestUrl = new URL(request.url);
		let pathname = requestUrl.pathname;

		// Remove leading slash and decode
		pathname = decodeURIComponent(pathname.replace(/^\/+/, ''));

		// Default to index.html for empty path or root
		if (!pathname || pathname === '' || pathname === '.') {
			pathname = 'index.html';
		}

		const buildPath = getBuildPath();
		const filePath = path.join(buildPath, pathname);

		// Determine MIME type based on extension
		const ext = path.extname(pathname).toLowerCase();
		const mimeTypes = {
			'.html': 'text/html',
			'.js': 'text/javascript',
			'.mjs': 'text/javascript',
			'.css': 'text/css',
			'.json': 'application/json',
			'.png': 'image/png',
			'.jpg': 'image/jpeg',
			'.jpeg': 'image/jpeg',
			'.gif': 'image/gif',
			'.svg': 'image/svg+xml',
			'.ico': 'image/x-icon',
			'.woff': 'font/woff',
			'.woff2': 'font/woff2',
			'.ttf': 'font/ttf',
			'.wasm': 'application/wasm',
			'.webmanifest': 'application/manifest+json',
		};
		const mimeType = mimeTypes[ext] || 'application/octet-stream';

		try {
			// Read file using fs (works with ASAR)
			const data = fs.readFileSync(filePath);
			return new Response(data, {
				headers: { 'Content-Type': mimeType },
			});
		} catch (err) {
			console.error('[Protocol] Error reading file:', filePath, err.message);
			return new Response('Not Found', { status: 404 });
		}
	});

	createWindow();

	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// IPC Handlers for file operations
ipcMain.handle('dialog:openFile', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openFile'],
		filters: [
			{ name: 'WhatsApp Exports', extensions: ['zip'] },
			{ name: 'All Files', extensions: ['*'] },
		],
	});

	if (result.canceled || result.filePaths.length === 0) {
		return null;
	}

	const filePath = result.filePaths[0];
	const fileName = path.basename(filePath);
	const fileContent = fs.readFileSync(filePath);

	return {
		path: filePath,
		name: fileName,
		buffer: fileContent.buffer,
	};
});

ipcMain.handle('dialog:openFolder', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openDirectory'],
	});

	if (result.canceled || result.filePaths.length === 0) {
		return null;
	}

	return result.filePaths[0];
});

ipcMain.handle('fs:readFile', async (_event, filePath) => {
	try {
		const content = fs.readFileSync(filePath);
		return { success: true, data: content.buffer };
	} catch (error) {
		return { success: false, error: error.message };
	}
});

ipcMain.handle('fs:readDir', async (_event, dirPath) => {
	try {
		const files = fs.readdirSync(dirPath, { withFileTypes: true });
		return {
			success: true,
			data: files.map((f) => ({
				name: f.name,
				isDirectory: f.isDirectory(),
				path: path.join(dirPath, f.name),
			})),
		};
	} catch (error) {
		return { success: false, error: error.message };
	}
});

ipcMain.handle('fs:fileExists', async (_event, filePath) => {
	return fs.existsSync(filePath);
});

ipcMain.handle('shell:openExternal', async (_event, url) => {
	// Validate URL before opening
	if (!url.startsWith('https://github.com/rodrigogs/whats-reader')) {
		throw new Error('Invalid URL');
	}
	await shell.openExternal(url);
});
