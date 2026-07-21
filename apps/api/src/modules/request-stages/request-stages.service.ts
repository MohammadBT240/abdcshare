import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { OrderedCatalogueService } from '../../common/catalogue/ordered-catalogue.service';
import { RequestStageEntity } from './infrastructure/persistence/request-stage.entity';

@Injectable()
export class RequestStagesService extends OrderedCatalogueService<RequestStageEntity> {
  constructor(em: EntityManager) {
    super(em, RequestStageEntity, 'request stage');
  }
}
