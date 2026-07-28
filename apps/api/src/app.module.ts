import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { validateEnv } from './config/env.schema';
import mikroOrmConfig from './database/mikro-orm.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { StorageModule } from './common/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { OutboxModule } from './modules/outbox/outbox.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { RequestClassesModule } from './modules/request-classes/request-classes.module';
import { RequestTypesModule } from './modules/request-types/request-types.module';
import { RequestStagesModule } from './modules/request-stages/request-stages.module';
import { RequestStatusesModule } from './modules/request-statuses/request-statuses.module';
import { EngagementTypesModule } from './modules/engagement-types/engagement-types.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { EngagementsModule } from './modules/engagements/engagements.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ReportReviewsModule } from './modules/report-reviews/report-reviews.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { InsightsModule } from './modules/insights/insights.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { DiscussionsModule } from './modules/discussions/discussions.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { CompanyProfileModule } from './modules/company-profile/company-profile.module';
import { DemoModule } from './modules/demo/demo.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    JwtModule.register({ global: true }),
    MikroOrmModule.forRoot(mikroOrmConfig),
    StorageModule,
    AuditModule,
    OutboxModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ReferenceModule,
    RequestClassesModule,
    RequestTypesModule,
    RequestStagesModule,
    RequestStatusesModule,
    EngagementTypesModule,
    DepartmentsModule,
    EngagementsModule,
    RequestsModule,
    SubmissionsModule,
    DocumentsModule,
    ReportReviewsModule,
    NotificationsModule,
    InsightsModule,
    RemindersModule,
    DiscussionsModule,
    ReviewsModule,
    CompanyProfileModule,
    DemoModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
