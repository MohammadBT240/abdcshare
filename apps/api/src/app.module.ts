import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { validateEnv } from './config/env.schema';
import mikroOrmConfig from './database/mikro-orm.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
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
import { CompanyProfileModule } from './modules/company-profile/company-profile.module';
import { DemoModule } from './modules/demo/demo.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    JwtModule.register({ global: true }),
    MikroOrmModule.forRoot(mikroOrmConfig),
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
    CompanyProfileModule,
    DemoModule,
    HealthModule,
  ],
  providers: [
    // Global auth-by-default: JwtAuthGuard authenticates (unless @Public),
    // then PermissionsGuard enforces @RequirePermission(...).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
