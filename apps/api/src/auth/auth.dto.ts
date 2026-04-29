import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ type: 'string', format: 'email', example: 'owner@example.com' })
  @IsEmail({}, { message: 'email должен быть корректным email.' })
  @IsNotEmpty({ message: 'Укажите email владельца.' })
  email!: string;

  @ApiProperty({ type: 'string', format: 'password', minLength: 1 })
  @IsString({ message: 'password должен быть строкой.' })
  @IsNotEmpty({ message: 'Укажите пароль.' })
  password!: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: 'string', description: 'JWT Bearer token для owner-only API.' })
  accessToken!: string;

  @ApiProperty({ type: 'string', example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ type: 'number', example: 3600 })
  expiresIn!: number;

  @ApiProperty({ type: 'string' })
  ownerId!: string;

  @ApiProperty({ type: 'string', format: 'email' })
  email!: string;
}
