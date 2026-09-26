import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator.js';
import { AppConfig } from '../../config/app.config.js';
import { ForbiddenException } from '../../common/exceptions.js';
import { QUEUE_NAMES, QueueService } from './queue.service.js';

/**
 * Development-only queue probe.
 *
 * Exists to verify API → Redis → worker end to end without waiting for a real
 * job to be built. Guarded at the handler rather than only by a decorator,
 * because an endpoint that enqueues arbitrary work must not exist in production
 * even if someone mis-wires a route later.
 */
@ApiTags('development')
@Controller('dev')
export class QueueController {
  constructor(
    private readonly queues: QueueService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('queue/example')
  @ApiOperation({
    summary: 'Enqueue a test job (development only)',
    description: 'Verifies that the API can reach Redis and that the worker consumes jobs.',
  })
  async enqueueExample(@Body() body: { message?: string }) {
    if (this.config.isProduction) {
      throw new ForbiddenException('Not available.');
    }

    const jobId = await this.queues.enqueue(QUEUE_NAMES.EXAMPLE, 'ping', {
      message: body?.message ?? 'hello from the API',
      enqueuedAt: new Date().toISOString(),
    });

    return { queued: true, queue: QUEUE_NAMES.EXAMPLE, jobId };
  }
}
