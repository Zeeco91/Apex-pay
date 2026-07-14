import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global so every feature module can inject PrismaService without
 * re-importing this module everywhere — matches the plan's
 * controller → service → repository(Prisma) layering across modules.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
