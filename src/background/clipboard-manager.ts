import { storageService } from '../services/storageService';

export class ClipboardManager {
  private static instance: ClipboardManager;
  private lastClipboardContent: string = '';
  private isListening: boolean = false;
  private port: chrome.runtime.Port | null = null;
  private wakeLockRef: any = null;

  private constructor() {
    this.initializeListeners();
    this.connectNativeHost();
  }

  public static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }

  private async initializeListeners() {
    if (this.isListening) return;
    
    try {
      // @ts-ignore - Wake Lock API
      this.wakeLockRef = await navigator.wakeLock.request('system');
    } catch (err) {
      console.warn('Wake Lock not supported:', err);
    }

    // Listen for clipboard changes using both native host and Clipboard API
    if ('clipboard' in navigator && 'readText' in navigator.clipboard) {
      this.setupClipboardAPI();
    }
    // Always setup polling as fallback and for native host communication
    this.setupPollingFallback();

    // Listen for commands
    chrome.commands.onCommand.addListener(this.handleCommand.bind(this));
    
    // Handle tab focus changes
    chrome.tabs.onActivated.addListener(this.handleTabChange.bind(this));
    
    this.isListening = true;
  }

  private async setupClipboardAPI() {
    const permissions = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
    
    if (permissions.state === 'granted') {
      document.addEventListener('copy', async () => {
        const newContent = await navigator.clipboard.readText();
        this.handleClipboardChange(newContent);
      });
    }
  }

  private async connectNativeHost() {
    try {
      this.port = chrome.runtime.connectNative('com.copycache.clipboard');
      
      this.port.onMessage.addListener((message) => {
        if (message.type === 'clipboardUpdate') {
          this.handleClipboardChange(message.content);
        }
      });

      this.port.onDisconnect.addListener(() => {
        console.warn('Native host disconnected, retrying in 5 seconds...');
        setTimeout(() => this.connectNativeHost(), 5000);
      });
    } catch (error) {
      console.error('Failed to connect to native host:', error);
    }
  }

  private setupPollingFallback() {
    let pollInterval = 1000;
    const maxInterval = 5000;

    const checkClipboard = async () => {
      try {
        let newContent = '';
        
        try {
          newContent = await navigator.clipboard.readText();
        } catch {
          if (this.port) {
            this.port.postMessage({ type: 'getClipboard' });
          }
        }

        if (newContent && newContent !== this.lastClipboardContent) {
          await this.handleClipboardChange(newContent);
          pollInterval = 1000;
        } else {
          pollInterval = Math.min(pollInterval * 1.5, maxInterval);
        }
      } catch (error) {
        console.warn('Clipboard access error:', error);
      }

      setTimeout(checkClipboard, pollInterval);
    };

    checkClipboard();
  }

  public async handleClipboardChange(newContent: string) {
    if (!newContent || newContent === this.lastClipboardContent) return;

    this.lastClipboardContent = newContent;

    try {
      await storageService.addItem(newContent);
      
      // Update badge
      const items = await storageService.getItems();
      this.updateBadge(items.length);

      // Notify any open popup
      chrome.runtime.sendMessage({ 
        action: 'clipboardUpdate',
        content: newContent
      });
    } catch (error) {
      console.error('Error handling clipboard change:', error);
    }
  }

  private async handleCommand(command: string) {
    if (command === 'paste_last') {
      const items = await storageService.getItems();
      if (items.length > 0) {
        await navigator.clipboard.writeText(items[0].content);
      }
    }
  }

  private async handleTabChange() {
    this.isListening = false;
    await this.initializeListeners();
  }

  public updateBadge(count: number) {
    chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  }

  public async reinitialize() {
    this.isListening = false;
    await this.initializeListeners();
  }

  public async cleanup() {
    if (this.wakeLockRef) {
      await this.wakeLockRef.release();
    }
    if (this.port) {
      this.port.disconnect();
    }
    this.isListening = false;
  }
}

export default ClipboardManager;