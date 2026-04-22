import { Injectable } from '@nestjs/common';

@Injectable()
export class QueueService {
  getStatus() {
    return {
      ready: false,
      state: 'deferred',
      summary:
        'BullMQ integration is intentionally scaffolded in Milestone 0 and wired in Milestone 4.',
    };
  }
}
