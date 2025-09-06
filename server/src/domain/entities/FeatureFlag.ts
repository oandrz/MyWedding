export class FeatureFlag {
  constructor(
    public readonly id: number,
    public readonly featureKey: string,
    public readonly featureName: string,
    public readonly description: string,
    public readonly enabled: boolean,
    public readonly updatedAt: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.featureKey || this.featureKey.trim().length === 0) {
      throw new Error('Feature key is required');
    }
    
    if (!this.featureName || this.featureName.trim().length === 0) {
      throw new Error('Feature name is required');
    }
    
    if (!this.description || this.description.trim().length === 0) {
      throw new Error('Feature description is required');
    }
  }

  toggle(): FeatureFlag {
    return new FeatureFlag(
      this.id,
      this.featureKey,
      this.featureName,
      this.description,
      !this.enabled,
      new Date()
    );
  }

  enable(): FeatureFlag {
    return new FeatureFlag(
      this.id,
      this.featureKey,
      this.featureName,
      this.description,
      true,
      new Date()
    );
  }

  disable(): FeatureFlag {
    return new FeatureFlag(
      this.id,
      this.featureKey,
      this.featureName,
      this.description,
      false,
      new Date()
    );
  }

  static create(params: Omit<FeatureFlag, 'id' | 'updatedAt'> & { id?: number; updatedAt?: Date }): FeatureFlag {
    const id = params.id || Date.now();
    const updatedAt = params.updatedAt || new Date();
    
    return new FeatureFlag(
      id,
      params.featureKey,
      params.featureName,
      params.description,
      params.enabled,
      updatedAt
    );
  }
}