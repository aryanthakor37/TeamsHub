const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('teamsHubDesktop', {
  isDesktop: true,
  platform: process.platform,
  
  // Window management
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Native Notifications
  sendNotification: (title, body, onClickData) => {
    ipcRenderer.send('notification:show', { title, body, onClickData });
  },

  // Update App Badge
  setBadgeCount: (count) => {
    ipcRenderer.send('badge:update', count);
  },

  // Multi-Tenant Session Control
  getTenants: () => ipcRenderer.invoke('tenants:list'),
  openTenantPane: (tenantId, paneNumber) => {
    ipcRenderer.send('tenant:open', { tenantId, paneNumber });
  },
  switchTenantView: (tenantId) => {
    ipcRenderer.send('tenant:switch', tenantId);
  },

  // Event Listeners
  onTenantMessage: (callback) => {
    ipcRenderer.on('tenant:message-received', (event, data) => callback(data));
  },
  onNavigateToChat: (callback) => {
    ipcRenderer.on('navigate:chat', (event, data) => callback(data));
  }
});
