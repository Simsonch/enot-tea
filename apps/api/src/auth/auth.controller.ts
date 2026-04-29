import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuthErrorBodyDto, ApiValidationErrorBodyDto } from '../openapi/error-models.js';
import { AuthService } from './auth.service.js';
import { LoginDto, LoginResponseDto } from './auth.dto.js';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Войти владельцем и получить JWT Bearer token' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ type: ApiValidationErrorBodyDto })
  @ApiUnauthorizedResponse({
    type: ApiAuthErrorBodyDto,
    description: 'Неверные owner credentials',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
