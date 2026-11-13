import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HelpCategoryEntity } from './infrastructure/persistence/help-category.entity';
import { HelpArticleEntity } from './infrastructure/persistence/help-article.entity';
import { HelpFeedbackEntity } from './infrastructure/persistence/help-feedback.entity';
import { HelpAssetEntity } from './infrastructure/persistence/help-asset.entity';
import { HelpService } from './help.service';
import { HelpController } from './help.controller';
import { HelpSyncService } from './sync/help-sync.service';

@Module({
  imports: [MikroOrmModule.forFeature([HelpCategoryEntity, HelpArticleEntity, HelpFeedbackEntity, HelpAssetEntity])],
  controllers: [HelpController],
  providers: [HelpService, HelpSyncService],
  exports: [HelpSyncService],
})
export class HelpModule {}
