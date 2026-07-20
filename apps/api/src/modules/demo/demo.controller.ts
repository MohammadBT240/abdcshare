import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { EntityManager } from '@mikro-orm/postgresql';
import { EVENT } from '@abdcshare/shared';
import { OutboxService } from '../outbox/outbox.service';

class PingDto {
  @IsString() @MaxLength(200)
  message!: string;
}

@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
  ) {}

  /** Writes an outbox row inside a transaction — the "hello async" slice. */
  @Post('outbox')
  async ping(@Body() dto: PingDto): Promise<{ outboxId: string }> {
    return this.em.transactional(async () => {
      const row = this.outbox.enqueue(EVENT.UserCreated, { message: dto.message });
      return { outboxId: row.id };
    });
  }
}
