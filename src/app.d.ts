// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

interface FileResult {
  path: string;
  name: string;
  buffer: ArrayBuffer;
}

interface ReadResult {
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
}

interface DirEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface ReadDirResult {
  success: boolean;
  data?: DirEntry[];
  error?: string;
}

interface ElectronAPI {
  openFile: () => Promise<FileResult | null>;
  openFolder: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<ReadResult>;
  readDir: (dirPath: string) => Promise<ReadDirResult>;
  fileExists: (filePath: string) => Promise<boolean>;
  platform: string;
  isElectron: boolean;
}

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
