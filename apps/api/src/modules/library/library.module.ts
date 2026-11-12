import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LibraryCategoryEntity } from './infrastructure/persistence/library-category.entity';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';
import { LibraryService } from './library.service';
import { LibraryCategoriesService } from './library-categories.service';
import { LibraryDraftSweepService } from './library-draft-sweep.service';
import { LibraryController } from './library.controller';
import { LibraryCategoriesController } from './library-categories.controller';

/** Staff knowledge library (design: docs/superpowers/specs/2026-11-12-staff-library-design.md). */
@Module({
  imports: [MikroOrmModule.forFeature([LibraryCategoryEntity, LibraryItemEntity])],
  // Categories controller first so `library/categories` is registered before `library/*` routes.
  controllers: [LibraryCategoriesController, LibraryController],
  providers: [LibraryService, LibraryCategoriesService, LibraryDraftSweepService],
  exports: [LibraryService],
})
export class LibraryModule {}
