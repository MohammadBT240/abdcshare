import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { HelpService } from './help.service';
import {
  CreateHelpCategoryDto,
  HelpCategoryResponseDto,
  UpdateHelpCategoryDto,
} from './presentation/dto/help-category.dto';
import {
  CreateHelpArticleDto,
  HelpArticleListQueryDto,
  HelpArticleListResponseDto,
  HelpArticleResponseDto,
  HelpCategoryWithArticlesDto,
  UpdateHelpArticleDto,
} from './presentation/dto/help-article.dto';
import { HelpImageUploadDto, HelpImageUploadResponseDto } from './presentation/dto/help-image.dto';
import { HelpFeedbackDto, HelpFeedbackStatsDto, HelpSearchResultDto } from './presentation/dto/help-reader.dto';

@ApiTags('help')
@ApiBearerAuth()
@Controller('help')
export class HelpController {
  constructor(private readonly help: HelpService) {}

  // --- reader surface (any authenticated role) ---

  @Get('categories')
  getCategories(@CurrentUser() user: AuthenticatedUser): Promise<HelpCategoryWithArticlesDto[]> {
    return this.help.getCategoriesForViewer(user);
  }

  @Get('articles/:slug')
  getArticle(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HelpArticleResponseDto> {
    return this.help.getArticleBySlug(slug, user);
  }

  @Get('search')
  search(@Query('q') q: string, @CurrentUser() user: AuthenticatedUser): Promise<HelpSearchResultDto[]> {
    return this.help.searchArticles(typeof q === 'string' ? q : '', user);
  }

  /** "Was this helpful?" — one answer per person per article; answering again replaces it. */
  @Put('articles/:slug/feedback')
  @HttpCode(204)
  setFeedback(
    @Param('slug') slug: string,
    @Body() dto: HelpFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.help.setFeedback(slug, dto, user);
  }

  // --- authoring surface (help:manage) ---

  @Post('images')
  @RequirePermission('help:manage')
  uploadImage(@Body() dto: HelpImageUploadDto): Promise<HelpImageUploadResponseDto> {
    return this.help.uploadImage(dto);
  }

  @Get('admin/categories')
  @RequirePermission('help:manage')
  listCategoriesAdmin(): Promise<HelpCategoryResponseDto[]> {
    return this.help.listCategoriesAdmin();
  }

  @Post('categories')
  @RequirePermission('help:manage')
  createCategory(@Body() dto: CreateHelpCategoryDto): Promise<HelpCategoryResponseDto> {
    return this.help.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequirePermission('help:manage')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateHelpCategoryDto,
  ): Promise<HelpCategoryResponseDto> {
    return this.help.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequirePermission('help:manage')
  deleteCategory(@Param('id') id: string): Promise<void> {
    return this.help.deleteCategory(id);
  }

  @Get('admin/articles')
  @RequirePermission('help:manage')
  listArticlesAdmin(@Query() query: HelpArticleListQueryDto): Promise<HelpArticleListResponseDto> {
    return this.help.listArticlesAdmin(query);
  }

  @Get('admin/articles/:id')
  @RequirePermission('help:manage')
  getArticleAdmin(@Param('id') id: string): Promise<HelpArticleResponseDto> {
    return this.help.getArticleByIdAdmin(id);
  }

  @Post('articles')
  @RequirePermission('help:manage')
  createArticle(
    @Body() dto: CreateHelpArticleDto,
    @CurrentUser('userId') userId: string,
  ): Promise<HelpArticleResponseDto> {
    return this.help.createArticle(dto, userId);
  }

  @Patch('articles/:id')
  @RequirePermission('help:manage')
  updateArticle(
    @Param('id') id: string,
    @Body() dto: UpdateHelpArticleDto,
  ): Promise<HelpArticleResponseDto> {
    return this.help.updateArticle(id, dto);
  }

  @Post('articles/:id/publish')
  @RequirePermission('help:manage')
  publishArticle(@Param('id') id: string): Promise<HelpArticleResponseDto> {
    return this.help.publishArticle(id);
  }

  @Post('articles/:id/unpublish')
  @RequirePermission('help:manage')
  unpublishArticle(@Param('id') id: string): Promise<HelpArticleResponseDto> {
    return this.help.unpublishArticle(id);
  }

  @Post('articles/:id/restore-default')
  @RequirePermission('help:manage')
  restoreDefault(@Param('id') id: string): Promise<HelpArticleResponseDto> {
    return this.help.restoreDefault(id);
  }

  @Get('admin/feedback')
  @RequirePermission('help:manage')
  feedback(): Promise<HelpFeedbackStatsDto[]> {
    return this.help.feedbackStats();
  }

  /** Re-read docs/help now (also runs on every API start). */
  @Post('admin/sync')
  @RequirePermission('help:manage')
  runSync() {
    return this.help.runSync();
  }

  @Delete('articles/:id')
  @RequirePermission('help:manage')
  deleteArticle(@Param('id') id: string): Promise<void> {
    return this.help.deleteArticle(id);
  }
}
