import { ApiProperty } from '@nestjs/swagger';

export class ValidationErrorField {
  @ApiProperty({ type: 'string', example: 'toStatus' })
  field!: string;

  @ApiProperty({ type: 'array', items: { type: 'string' } })
  messages!: string[];
}
