import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { OrderedCatalogueService } from '../../common/catalogue/ordered-catalogue.service';
import { RequestStatusEntity } from './infrastructure/persistence/request-status.entity';

@Injectable()
export class RequestStatusesService extends OrderedCatalogueService<RequestStatusEntity> {
  constructor(em: EntityManager) {
    super(em, RequestStatusEntity, 'request status');
  }
}
