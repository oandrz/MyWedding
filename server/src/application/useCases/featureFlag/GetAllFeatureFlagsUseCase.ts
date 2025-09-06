import { FeatureFlag } from '../../../domain/entities/FeatureFlag';
import { IFeatureFlagRepository } from '../../../domain/repositories/IFeatureFlagRepository';

export class GetAllFeatureFlagsUseCase {
  constructor(private readonly featureFlagRepository: IFeatureFlagRepository) {}

  async execute(): Promise<FeatureFlag[]> {
    return await this.featureFlagRepository.findAll();
  }
}