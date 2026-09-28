// The bridge between the page and the store file (Round 8's shell spike).
//
// The renderer is sandboxed, so this preload is CommonJS and reaches the disk
// only through main. It asks main for the store's contents with a SYNCHRONOUS
// message before any page script runs, so the page can read the store in the
// first module it evaluates, the way `localStorage` is read on the web. Writes
// go back asynchronously; main writes the file atomically.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a sandboxed preload cannot import
const { contextBridge, ipcRenderer } = require('electron');

const initial = ipcRenderer.sendSync('shell-store:read');

contextBridge.exposeInMainWorld('shellStore', {
  shell: 'electron',
  /** The file's text at preload time, or null when there is no file. */
  initial,
  /** Replace the file's text. Resolves once main has renamed it into place. */
  write: (text) => ipcRenderer.invoke('shell-store:write', String(text)),
});
