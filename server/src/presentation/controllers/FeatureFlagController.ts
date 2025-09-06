import { Request, Response } from 'express';
import { ToggleFeatureFlagUseCase } from '../../application/useCases/featureFlag/ToggleFeatureFlagUseCase';
import { GetAllFeatureFlagsUseCase } from '../../application/useCases/featureFlag/GetAllFeatureFlagsUseCase';

export class FeatureFlagController {
  constructor(
    private readonly toggleFeatureFlagUseCase: ToggleFeatureFlagUseCase,
    private readonly getAllFeatureFlagsUseCase: GetAllFeatureFlagsUseCase
  ) {}

  async toggleFeatureFlag(req: Request, res: Response): Promise<void> {
    try {
      const { featureKey } = req.params;
      const { enabled } = req.body;
      
      if (enabled === undefined) {
        res.status(400).json({ error: 'Enabled status is required' });
        return;
      }
      
      const flag = await this.toggleFeatureFlagUseCase.execute(featureKey, enabled);
      
      res.json({
        message: `Feature flag '${flag.featureName}' ${flag.enabled ? 'enabled' : 'disabled'}`,
        featureFlag: this.mapFeatureFlagToResponse(flag)
      });
    } catch (error: any) {
      console.error('Error toggling feature flag:', error);
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to toggle feature flag' });
      }
    }
  }

  async getAllFeatureFlags(req: Request, res: Response): Promise<void> {
    try {
      const flags = await this.getAllFeatureFlagsUseCase.execute();
      
      res.json({
        featureFlags: flags.map(f => this.mapFeatureFlagToResponse(f))
      });
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      res.status(500).json({ error: 'Failed to fetch feature flags' });
    }
  }

  private mapFeatureFlagToResponse(flag: any) {
    return {
      id: flag.id,
      featureKey: flag.featureKey,
      featureName: flag.featureName,
      description: flag.description,
      enabled: flag.enabled,
      updatedAt: flag.updatedAt.toISOString()
    };
  }
}