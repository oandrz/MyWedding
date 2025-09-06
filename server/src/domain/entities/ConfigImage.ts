export class ConfigImage {
  constructor(
    public readonly id: number,
    public readonly imageKey: string,
    public readonly imageUrl: string,
    public readonly imageType: 'banner' | 'gallery' | 'other',
    public readonly title: string | null,
    public readonly description: string | null,
    public readonly isActive: boolean,
    public readonly updatedAt: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.imageKey || this.imageKey.trim().length === 0) {
      throw new Error('Image key is required');
    }
    
    if (!this.imageUrl || !this.isValidUrl(this.imageUrl)) {
      throw new Error('Valid image URL is required');
    }
    
    if (!['banner', 'gallery', 'other'].includes(this.imageType)) {
      throw new Error('Invalid image type');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      // Allow relative URLs starting with /
      if (url.startsWith('/')) return true;
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  activate(): ConfigImage {
    return new ConfigImage(
      this.id,
      this.imageKey,
      this.imageUrl,
      this.imageType,
      this.title,
      this.description,
      true,
      new Date()
    );
  }

  deactivate(): ConfigImage {
    return new ConfigImage(
      this.id,
      this.imageKey,
      this.imageUrl,
      this.imageType,
      this.title,
      this.description,
      false,
      new Date()
    );
  }

  updateUrl(newUrl: string): ConfigImage {
    return new ConfigImage(
      this.id,
      this.imageKey,
      newUrl,
      this.imageType,
      this.title,
      this.description,
      this.isActive,
      new Date()
    );
  }

  static create(params: Omit<ConfigImage, 'id' | 'updatedAt'> & { id?: number; updatedAt?: Date }): ConfigImage {
    const id = params.id || Date.now();
    const updatedAt = params.updatedAt || new Date();
    
    return new ConfigImage(
      id,
      params.imageKey,
      params.imageUrl,
      params.imageType,
      params.title,
      params.description,
      params.isActive,
      updatedAt
    );
  }
}