import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LibraryCategoryEntity } from './infrastructure/persistence/library-category.entity';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';
import { LibraryCollectionEntity } from './infrastructure/persistence/library-collection.entity';
import { LibraryCollectionItemEntity } from './infrastructure/persistence/library-collection-item.entity';
import { LibraryEventEntity } from './infrastructure/persistence/library-event.entity';
import { LibraryReportEntity } from './infrastructure/persistence/library-report.entity';
import { LibraryEventsService } from './library-events.service';
import { LibraryReportsService } from './library-reports.service';
import { LibraryReportsController } from './library-reports.controller';
import { LibraryCollectionsService } from './library-collections.service';
import { LibraryCollectionsController } from './library-collections.controller';
import { LibraryService } from './library.service';
import { LibraryCategoriesService } from './library-categories.service';
import { LibraryDraftSweepService } from './library-draft-sweep.service';
import { LibraryController } from './library.controller';
import { LibraryCategoriesController } from './library-categories.controller';

/** Staff knowledge library (design: docs/superpowers/specs/2026-11-12-staff-library-design.md). */
@Module({
  imports: [MikroOrmModule.forFeature([
      LibraryCategoryEntity,
      LibraryItemEntity,
      LibraryCollectionEntity,
      LibraryCollectionItemEntity,
      LibraryEventEntity,
      LibraryReportEntity,
    ])],
  // Categories controller first so `library/categories` is registered before `library/*` routes.
  controllers: [LibraryCategoriesController, LibraryCollectionsController, LibraryReportsController, LibraryController],
  providers: [
    LibraryService,
    LibraryEventsService,
    LibraryReportsService,
    LibraryCategoriesService,
    LibraryCollectionsService,
    LibraryDraftSweepService,
  ],
  exports: [LibraryService],
})
export class LibraryModule {}
