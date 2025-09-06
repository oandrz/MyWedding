import { FeatureFlag } from '../entities/FeatureFlag';

export interface IFeatureFlagRepository {
  create(flag: FeatureFlag): Promise<FeatureFlag>;
  update(flag: FeatureFlag): Promise<FeatureFlag>;
  findByKey(featureKey: string): Promise<FeatureFlag | null>;
  findAll(): Promise<FeatureFlag[]>;
}