import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Application context — no HTTP server; the worker just runs consumers/schedulers.
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: false });
  app.enableShutdownHooks();
  new Logger('worker').log('worker started — consuming queues');
}
void bootstrap();
