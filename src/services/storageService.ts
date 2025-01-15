import { ClipboardItem, Settings, ContentType, SearchOptions } from '../types';

class StorageService {
  private cachedSettings?: Settings;

  async getItems(searchOptions?: SearchOptions): Promise<ClipboardItem[]> {
    const { items = [] } = await chrome.storage.local.get('items');
    const settings = await this.getSettings();
    
    // Apply retention time first
    const retentionTime = settings.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionTime;
    
    let filteredItems = (items as ClipboardItem[])
      .filter((item: ClipboardItem) => item.timestamp >= cutoffTime);
    
    // Then enforce max items limit
    filteredItems = filteredItems.slice(0, settings.maxHistoryItems);

    // If we filtered any items, update storage
    if (filteredItems.length < items.length) {
      await this.enforceItemLimit(filteredItems);
    }

    if (searchOptions) {
      filteredItems = this.filterItems(filteredItems, searchOptions);
    }

    return filteredItems;
  }

  private async enforceItemLimit(items: ClipboardItem[]): Promise<void> {
    const settings = await this.getSettings();
    
    // Ensure we never exceed the user's chosen limit
    if (items.length > settings.maxHistoryItems) {
      items.length = settings.maxHistoryItems;
    }
    
    await chrome.storage.local.set({ items });
    chrome.runtime.sendMessage({ 
      action: 'updateBadge',
      count: items.length 
    });
  }

  async addItem(content: string): Promise<ClipboardItem> {
    const settings = await this.getSettings();

    const item: ClipboardItem = {
      id: crypto.randomUUID(),
      content: content,
      type: this.detectContentType(content),
      timestamp: Date.now(),
      metadata: this.generateMetadata(content)
    };

    // Get current items
    const { items = [] } = await chrome.storage.local.get('items');
    const currentItems = items as ClipboardItem[];
    
    // Remove duplicates
    const filteredItems = currentItems.filter(existingItem => 
      existingItem.content !== content
    );

    // Add new item at the beginning
    filteredItems.unshift(item);

    // Enforce the user's chosen limit
    await this.enforceItemLimit(filteredItems);

    return item;
  }

  private filterItems(items: ClipboardItem[], options: SearchOptions): ClipboardItem[] {
    return items.filter((item: ClipboardItem) => {
      const matchesQuery = !options.query || 
        item.content.toLowerCase().includes(options.query.toLowerCase());

      const matchesDate = !options.dateRange ||
        (item.timestamp >= options.dateRange.start &&
         item.timestamp <= options.dateRange.end);

      return matchesQuery && matchesDate;
    });
  }

  private detectContentType(content: string): ContentType {
    // HTML detection
    if (content.trim().startsWith('<!DOCTYPE html') || 
        (content.includes('<html') && content.includes('</html>')) ||
        (content.includes('<body') && content.includes('</body>')) ||
        (content.includes('<head') && content.includes('</head>'))) {
      return ContentType.CODE;
    }

    // Try parsing as JSON
    try {
      JSON.parse(content);
      return ContentType.JSON;
    } catch {}

    // Check for XML
    if (content.trim().startsWith('<?xml') || /<[^>]+>/.test(content)) {
      return ContentType.XML;
    }

    if (content.includes('{') && content.includes('}') &&
        (content.includes('function') || content.includes('class') || 
         content.includes('const') || content.includes('let'))) {
      return ContentType.CODE;
    }

    return ContentType.TEXT;
  }

  private generateMetadata(content: string) {
    return {
      charCount: content.length,
      wordCount: content.trim().split(/\s+/).length,
      language: this.detectLanguage(content),
      url: this.extractUrl(content)
    };
  }

  private detectLanguage(content: string): string {
    return 'unknown';
  }

  private extractUrl(content: string): string | undefined {
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : undefined;
  }

  async getSettings(): Promise<Settings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    const { settings } = await chrome.storage.sync.get('settings');
    const defaultSettings = this.getDefaultSettings();
    const newSettings = {
      ...defaultSettings,
      ...settings
    };
    
    this.cachedSettings = newSettings;
    return newSettings;
  }

  public getDefaultSettings(): Settings {
    return {
      theme: 'system',
      maxHistoryItems: 50,
      retentionDays: 7,
      shortcuts: {
        openPopup: 'Ctrl+Shift+V',
        pasteLast: 'Ctrl+Shift+X'
      }
    };
  }

  async updateSettings(newSettings: Partial<Settings>): Promise<Settings> {
    const currentSettings = await this.getSettings();
    const updatedSettings = {
      ...currentSettings,
      ...newSettings
    };

    // Save the new settings
    await chrome.storage.sync.set({ settings: updatedSettings });
    this.cachedSettings = updatedSettings;

    // Re-apply limits with new settings
    const items = await this.getItems();
    await this.enforceItemLimit(items);

    return updatedSettings;
  }
}

export const storageService = new StorageService();