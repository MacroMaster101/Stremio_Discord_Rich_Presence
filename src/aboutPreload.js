/**
 * src/aboutPreload.js
 * Preload for the About window. Runs in an isolated context and exposes only a
 * minimal, explicit API to the renderer via contextBridge — the renderer has no
 * direct access to Node, ipcRenderer, or shell.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aboutAPI', {
  /** Fetch app info (version, author, license, icon) from the main process. */
  getInfo: () => ipcRenderer.invoke('about:get-info'),
  /** Open an allow-listed external link by key ('github' | 'discordPortal'). */
  openLink: (key) => ipcRenderer.send('about:open-link', key),
  /** Close the About window. */
  close: () => ipcRenderer.send('about:close')
});
