export class Media {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly email: string,
    public readonly mediaUrl: string,
    public readonly mediaType: 'image' | 'video',
    public readonly caption: string | null,
    public readonly approved: boolean,
    public readonly createdAt: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Media uploader name is required');
    }
    
    if (!this.email || !this.isValidEmail(this.email)) {
      throw new Error('Valid email is required');
    }
    
    if (!this.mediaUrl || !this.isValidUrl(this.mediaUrl)) {
      throw new Error('Valid media URL is required');
    }
    
    if (!['image', 'video'].includes(this.mediaType)) {
      throw new Error('Media type must be either image or video');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

  approve(): Media {
    return new Media(
      this.id,
      this.name,
      this.email,
      this.mediaUrl,
      this.mediaType,
      this.caption,
      true,
      this.createdAt
    );
  }

  reject(): Media {
    return new Media(
      this.id,
      this.name,
      this.email,
      this.mediaUrl,
      this.mediaType,
      this.caption,
      false,
      this.createdAt
    );
  }

  static create(params: Omit<Media, 'id' | 'createdAt'> & { id?: number; createdAt?: Date }): Media {
    const id = params.id || Date.now();
    const createdAt = params.createdAt || new Date();
    
    return new Media(
      id,
      params.name,
      params.email,
      params.mediaUrl,
      params.mediaType,
      params.caption,
      params.approved,
      createdAt
    );
  }
}