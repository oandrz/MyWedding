import { FeatureFlag } from '../../../domain/entities/FeatureFlag';
import { IFeatureFlagRepository } from '../../../domain/repositories/IFeatureFlagRepository';

export class ToggleFeatureFlagUseCase {
  constructor(private readonly featureFlagRepository: IFeatureFlagRepository) {}

  async execute(featureKey: string, enabled: boolean): Promise<FeatureFlag> {
    const existingFlag = await this.featureFlagRepository.findByKey(featureKey);
    
    if (!existingFlag) {
      throw new Error(`Feature flag '${featureKey}' not found`);
    }
    
    const updatedFlag = enabled 
      ? existingFlag.enable()
      : existingFlag.disable();
    
    return await this.featureFlagRepository.update(updatedFlag);
  }
}