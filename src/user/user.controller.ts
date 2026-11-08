import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../jwt-service/current-user-decorator';
import { CustomJwtAuthGuard } from '../jwt-service/jwt.auth.guard';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserDataResponseDto } from './dto/user.data.dto';
import { plainToInstance } from 'class-transformer';
import { UserResponseEntity } from './dto/user.create.dto';
import { type UserSchema } from './schema/user.schema';

@ApiTags('USERS')
@Controller('api/v1/users')
export default class UserController {
  constructor() {}

  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: UserDataResponseDto })
  @UseGuards(CustomJwtAuthGuard)
  @Get('/me')
  @HttpCode(HttpStatus.OK)
  getMe(@CurrentUser() user: UserSchema): UserDataResponseDto {
    return new UserDataResponseDto({
      data: plainToInstance(UserResponseEntity, user, {
        excludeExtraneousValues: true,
      }),
    });
  }
}
