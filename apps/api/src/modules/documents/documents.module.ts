import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DocumentEntity } from './infrastructure/persistence/document.entity';
import { DocumentFileEntity } from './infrastructure/persistence/document-file.entity';
import { DocumentParticipantEntity } from './infrastructure/persistence/document-participant.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([DocumentEntity, DocumentFileEntity, DocumentParticipantEntity]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
