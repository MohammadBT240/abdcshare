import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HelpCategoryEntity } from './infrastructure/persistence/help-category.entity';
import { HelpArticleEntity } from './infrastructure/persistence/help-article.entity';
import { HelpService } from './help.service';
import { HelpController } from './help.controller';

@Module({
  imports: [MikroOrmModule.forFeature([HelpCategoryEntity, HelpArticleEntity])],
  controllers: [HelpController],
  providers: [HelpService],
})
export class HelpModule {}
