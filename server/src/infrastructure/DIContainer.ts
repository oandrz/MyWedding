// Dependency Injection Container following the Dependency Inversion Principle
import { IRsvpRepository } from '../domain/repositories/IRsvpRepository';
import { IMediaRepository } from '../domain/repositories/IMediaRepository';
import { IFeatureFlagRepository } from '../domain/repositories/IFeatureFlagRepository';
import { IConfigImageRepository } from '../domain/repositories/IConfigImageRepository';

import { KVRsvpRepository } from './repositories/KVRsvpRepository';
import { KVMediaRepository } from './repositories/KVMediaRepository';
import { KVFeatureFlagRepository } from './repositories/KVFeatureFlagRepository';
import { KVConfigImageRepository } from './repositories/KVConfigImageRepository';

import { CreateRsvpUseCase } from '../application/useCases/rsvp/CreateRsvpUseCase';
import { GetAllRsvpsUseCase } from '../application/useCases/rsvp/GetAllRsvpsUseCase';
import { ToggleFeatureFlagUseCase } from '../application/useCases/featureFlag/ToggleFeatureFlagUseCase';
import { GetAllFeatureFlagsUseCase } from '../application/useCases/featureFlag/GetAllFeatureFlagsUseCase';
import { CreateMediaUseCase } from '../application/useCases/media/CreateMediaUseCase';
import { ApproveMediaUseCase } from '../application/useCases/media/ApproveMediaUseCase';
import { GetAllMediaUseCase } from '../application/useCases/media/GetAllMediaUseCase';
import { GetApprovedMediaUseCase } from '../application/useCases/media/GetApprovedMediaUseCase';
import { CreateConfigImageUseCase } from '../application/useCases/configImage/CreateConfigImageUseCase';
import { UpdateConfigImageUseCase } from '../application/useCases/configImage/UpdateConfigImageUseCase';
import { GetConfigImagesByTypeUseCase } from '../application/useCases/configImage/GetConfigImagesByTypeUseCase';
import { GetAllConfigImagesUseCase } from '../application/useCases/configImage/GetAllConfigImagesUseCase';
import { DeleteConfigImageUseCase } from '../application/useCases/configImage/DeleteConfigImageUseCase';

import { RsvpController } from '../presentation/controllers/RsvpController';
import { FeatureFlagController } from '../presentation/controllers/FeatureFlagController';
import { MediaController } from '../presentation/controllers/MediaController';
import { ConfigImageController } from '../presentation/controllers/ConfigImageController';

export class DIContainer {
  private static instance: DIContainer;
  
  // Repositories (Singletons)
  private rsvpRepository?: IRsvpRepository;
  private mediaRepository?: IMediaRepository;
  private featureFlagRepository?: IFeatureFlagRepository;
  private configImageRepository?: IConfigImageRepository;
  
  private constructor() {}
  
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }
  
  // Repository getters with lazy initialization
  getRsvpRepository(): IRsvpRepository {
    if (!this.rsvpRepository) {
      this.rsvpRepository = new KVRsvpRepository();
    }
    return this.rsvpRepository;
  }
  
  getMediaRepository(): IMediaRepository {
    if (!this.mediaRepository) {
      this.mediaRepository = new KVMediaRepository();
    }
    return this.mediaRepository;
  }
  
  getFeatureFlagRepository(): IFeatureFlagRepository {
    if (!this.featureFlagRepository) {
      this.featureFlagRepository = new KVFeatureFlagRepository();
    }
    return this.featureFlagRepository;
  }
  
  getConfigImageRepository(): IConfigImageRepository {
    if (!this.configImageRepository) {
      this.configImageRepository = new KVConfigImageRepository();
    }
    return this.configImageRepository;
  }
  
  // Use Case factories
  createRsvpUseCase(): CreateRsvpUseCase {
    return new CreateRsvpUseCase(this.getRsvpRepository());
  }
  
  getAllRsvpsUseCase(): GetAllRsvpsUseCase {
    return new GetAllRsvpsUseCase(this.getRsvpRepository());
  }
  
  toggleFeatureFlagUseCase(): ToggleFeatureFlagUseCase {
    return new ToggleFeatureFlagUseCase(this.getFeatureFlagRepository());
  }
  
  getAllFeatureFlagsUseCase(): GetAllFeatureFlagsUseCase {
    return new GetAllFeatureFlagsUseCase(this.getFeatureFlagRepository());
  }
  
  createMediaUseCase(): CreateMediaUseCase {
    return new CreateMediaUseCase(this.getMediaRepository());
  }
  
  approveMediaUseCase(): ApproveMediaUseCase {
    return new ApproveMediaUseCase(this.getMediaRepository());
  }
  
  getAllMediaUseCase(): GetAllMediaUseCase {
    return new GetAllMediaUseCase(this.getMediaRepository());
  }
  
  getApprovedMediaUseCase(): GetApprovedMediaUseCase {
    return new GetApprovedMediaUseCase(this.getMediaRepository());
  }
  
  createConfigImageUseCase(): CreateConfigImageUseCase {
    return new CreateConfigImageUseCase(this.getConfigImageRepository());
  }
  
  updateConfigImageUseCase(): UpdateConfigImageUseCase {
    return new UpdateConfigImageUseCase(this.getConfigImageRepository());
  }
  
  getConfigImagesByTypeUseCase(): GetConfigImagesByTypeUseCase {
    return new GetConfigImagesByTypeUseCase(this.getConfigImageRepository());
  }
  
  getAllConfigImagesUseCase(): GetAllConfigImagesUseCase {
    return new GetAllConfigImagesUseCase(this.getConfigImageRepository());
  }
  
  deleteConfigImageUseCase(): DeleteConfigImageUseCase {
    return new DeleteConfigImageUseCase(this.getConfigImageRepository());
  }
  
  // Controller factories
  createRsvpController(): RsvpController {
    return new RsvpController(
      this.createRsvpUseCase(),
      this.getAllRsvpsUseCase()
    );
  }
  
  createFeatureFlagController(): FeatureFlagController {
    return new FeatureFlagController(
      this.toggleFeatureFlagUseCase(),
      this.getAllFeatureFlagsUseCase()
    );
  }
  
  createMediaController(): MediaController {
    return new MediaController(
      this.createMediaUseCase(),
      this.approveMediaUseCase(),
      this.getAllMediaUseCase(),
      this.getApprovedMediaUseCase()
    );
  }
  
  createConfigImageController(): ConfigImageController {
    return new ConfigImageController(
      this.createConfigImageUseCase(),
      this.updateConfigImageUseCase(),
      this.getConfigImagesByTypeUseCase(),
      this.getAllConfigImagesUseCase(),
      this.deleteConfigImageUseCase()
    );
  }
}