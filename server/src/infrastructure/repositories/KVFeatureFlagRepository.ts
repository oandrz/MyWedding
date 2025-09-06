import Database from '@replit/database';
import { FeatureFlag } from '../../domain/entities/FeatureFlag';
import { IFeatureFlagRepository } from '../../domain/repositories/IFeatureFlagRepository';

export class KVFeatureFlagRepository implements IFeatureFlagRepository {
  private kv: Database;
  private currentId: number = 1;

  constructor() {
    this.kv = new Database();
    this.initializeId();
    this.initializeDefaultFlags();
  }

  private async initializeId(): Promise<void> {
    const keys = await this.kv.list('feature_flag:');
    if (keys.ok && keys.value.length > 0) {
      const existingFlags = await this.findAll();
      if (existingFlags.length > 0) {
        this.currentId = Math.max(...existingFlags.map(f => f.id)) + 1;
      }
    }
  }

  private async initializeDefaultFlags(): Promise<void> {
    const existingFlags = await this.findAll();
    if (existingFlags.length === 0) {
      const defaultFlags = [
        {
          featureKey: 'rsvp',
          featureName: 'RSVP Form',
          description: 'Allow guests to submit their attendance confirmation',
          enabled: true
        },
        {
          featureKey: 'messages',
          featureName: 'Message Board',
          description: 'Allow guests to leave congratulatory messages',
          enabled: false
        },
        {
          featureKey: 'gallery',
          featureName: 'Photo Gallery',
          description: 'Display wedding memories and allow photo uploads',
          enabled: true
        },
        {
          featureKey: 'music',
          featureName: 'Background Music',
          description: 'Play background music on the invitation page',
          enabled: false
        },
        {
          featureKey: 'countdown',
          featureName: 'Wedding Countdown',
          description: 'Show countdown timer to wedding date',
          enabled: false
        }
      ];

      for (const flagData of defaultFlags) {
        const flag = FeatureFlag.create({
          id: this.currentId++,
          ...flagData
        });
        await this.create(flag);
      }
    }
  }

  async create(flag: FeatureFlag): Promise<FeatureFlag> {
    const data = this.toStorageFormat(flag);
    await this.kv.set(`feature_flag:${flag.featureKey}`, data);
    return flag;
  }

  async update(flag: FeatureFlag): Promise<FeatureFlag> {
    const data = this.toStorageFormat(flag);
    await this.kv.set(`feature_flag:${flag.featureKey}`, data);
    return flag;
  }

  async findByKey(featureKey: string): Promise<FeatureFlag | null> {
    const result = await this.kv.get(`feature_flag:${featureKey}`);
    if (!result.ok || !result.value) return null;
    return this.fromStorageFormat(result.value);
  }

  async findAll(): Promise<FeatureFlag[]> {
    const keysResult = await this.kv.list('feature_flag:');
    if (!keysResult.ok) return [];
    
    const flags: FeatureFlag[] = [];
    for (const key of keysResult.value) {
      const result = await this.kv.get(key);
      if (result.ok && result.value) {
        flags.push(this.fromStorageFormat(result.value));
      }
    }
    return flags.sort((a, b) => a.featureName.localeCompare(b.featureName));
  }

  private toStorageFormat(flag: FeatureFlag): any {
    return {
      id: flag.id,
      featureKey: flag.featureKey,
      featureName: flag.featureName,
      description: flag.description,
      enabled: flag.enabled,
      updatedAt: flag.updatedAt.toISOString()
    };
  }

  private fromStorageFormat(data: any): FeatureFlag {
    return new FeatureFlag(
      data.id,
      data.featureKey,
      data.featureName,
      data.description,
      data.enabled,
      new Date(data.updatedAt)
    );
  }
}