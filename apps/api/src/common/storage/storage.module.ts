import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';
import { R2StorageAdapter } from './r2-storage.adapter';
import { LocalMultipartController } from './local-multipart.controller';
import { LocalStorageController } from './local-storage.controller';

/** Provides the active {@link StoragePort} (`local` or `r2`). */
@Global()
@Module({
  controllers: [LocalMultipartController, LocalStorageController],
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
