import { Controller, Get } from '@nestjs/common';
import { LevelsService } from './levels.service';

@Controller('levels')
export class LevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  @Get()
  async findAll() {
    const levels = await this.levelsService.findAllActive();
    return { success: true, data: levels };
  }
}
