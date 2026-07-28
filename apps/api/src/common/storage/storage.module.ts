import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';
import { R2StorageAdapter } from './r2-storage.adapter';

/** Provides the active {@link StoragePort} (`local` or `r2`). */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER', 'local');
        if (driver === 'r2') return new R2StorageAdapter(config);
        return new LocalStorageAdapter(config);
      },
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
