import { ApiProperty } from '@nestjs/swagger';

export class BadRequestErrorDto {
  constructor(partial: Partial<BadRequestErrorDto>) {
    Object.assign(partial, BadRequestErrorDto);
  }
  @ApiProperty({
    example: 'Bad Request',
    required: true,
  })
  message: string = 'Bad Request';

  @ApiProperty({
    example: false,
    required: true,
  })
  success: boolean = false;
}
