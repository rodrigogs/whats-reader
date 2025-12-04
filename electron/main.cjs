const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
	app.quit();
}

let mainWindow;

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
			sandbox: false
		},
		titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
		backgroundColor: '#ECE5DD',
		icon: path.join(__dirname, '../static/favicon.png')
	};

	// Only apply trafficLightPosition on macOS
	if (process.platform === 'darwin') {
		windowOptions.trafficLightPosition = { x: 15, y: 12 };
	}

	// Create the browser window.
	mainWindow = new BrowserWindow(windowOptions);

	// In development, load from Vite dev server
	// In production, load from built files
	if (process.env.NODE_ENV === 'development') {
		mainWindow.loadURL('http://localhost:5173');
		mainWindow.webContents.openDevTools();
	} else {
		mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
	}
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
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
			{ name: 'All Files', extensions: ['*'] }
		]
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
		buffer: fileContent.buffer
	};
});

ipcMain.handle('dialog:openFolder', async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openDirectory']
	});

	if (result.canceled || result.filePaths.length === 0) {
		return null;
	}

	return result.filePaths[0];
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
	try {
		const content = fs.readFileSync(filePath);
		return { success: true, data: content.buffer };
	} catch (error) {
		return { success: false, error: error.message };
	}
});

ipcMain.handle('fs:readDir', async (event, dirPath) => {
	try {
		const files = fs.readdirSync(dirPath, { withFileTypes: true });
		return {
			success: true,
			data: files.map((f) => ({
				name: f.name,
				isDirectory: f.isDirectory(),
				path: path.join(dirPath, f.name)
			}))
		};
	} catch (error) {
		return { success: false, error: error.message };
	}
});

ipcMain.handle('fs:fileExists', async (event, filePath) => {
	return fs.existsSync(filePath);
});
