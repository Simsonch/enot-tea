import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthDbResponseDto } from '../openapi/response-models.js';
import { HealthService } from './health.service.js';

@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('db')
  @ApiOperation({ summary: 'Проверка подключения к БД' })
  @ApiOkResponse({ type: HealthDbResponseDto })
  async db() {
    return this.healthService.checkDb();
  }
}