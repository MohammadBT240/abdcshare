import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { SearchService, type SearchResults } from './search.service';
import { DashboardService, type DashboardSummary } from './dashboard.service';

@ApiTags('insights')
@ApiBearerAuth()
@Controller()
export class InsightsController {
  constructor(
    private readonly search: SearchService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Quick cross-entity search (scoped). Any authenticated user. */
  @Get('search')
  runSearch(
    @Query('q') q: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SearchResults> {
    return this.search.search(q ?? '', user);
  }

  /** Home-dashboard headline numbers (scoped to the caller). */
  @Get('dashboard')
  summary(@CurrentUser() user: AuthenticatedUser): Promise<DashboardSummary> {
    return this.dashboard.summary(user);
  }
}
