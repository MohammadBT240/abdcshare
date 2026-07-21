import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';

/**
 * Provides the active {@link StoragePort}. `local` (default) is dependency-free.
 * To enable R2, add an `R2StorageAdapter` (needs `@aws-sdk/client-s3` +
 * `@aws-sdk/s3-request-presigner`) and branch here on `STORAGE_DRIVER=r2`.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER', 'local');
        if (driver === 'r2') {
          // eslint-disable-next-line no-console
          console.warn('[storage] STORAGE_DRIVER=r2 but no R2 adapter is wired yet; using local fallback.');
        }
        return new LocalStorageAdapter(config);
      },
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
