const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pintimeDesktop', {
  isElectron: true,
  getPlatform: () => ipcRenderer.invoke('pintime:platform'),
  openDesktopPin: () => ipcRenderer.invoke('desktop-pin:open'),
  closeDesktopPin: () => ipcRenderer.invoke('desktop-pin:close'),
  toggleDesktopPin: () => ipcRenderer.invoke('desktop-pin:toggle'),
  isDesktopPinOpen: () => ipcRenderer.invoke('desktop-pin:is-open'),
  setDesktopPinView: (view) => ipcRenderer.invoke('desktop-pin:set-view', view),
  onDesktopPinChanged: (cb) => {
    const handler = (_e, open) => cb(open)
    ipcRenderer.on('desktop-pin:changed', handler)
    return () => ipcRenderer.removeListener('desktop-pin:changed', handler)
  },
  onDesktopPinView: (cb) => {
    const handler = (_e, view) => cb(view)
    ipcRenderer.on('desktop-pin:view', handler)
    return () => ipcRenderer.removeListener('desktop-pin:view', handler)
  },
  openExternal: (url) => ipcRenderer.invoke('pintime:open-external', url),
})
