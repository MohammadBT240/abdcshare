import { Module } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { ReferenceController } from './reference.controller';

// Lookup entities are discovered globally (MikroORM glob); the service uses EntityManager directly.
@Module({
  controllers: [ReferenceController],
  providers: [ReferenceService],
})
export class ReferenceModule {}
