import { CustomJwtAuthGuard } from '@/commons/guards/jwt.auth.guard';
import {
  Controller,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('USERS')
@Controller('api/v1/users')
@UseGuards(CustomJwtAuthGuard)
export default class UserController {
  constructor() {}
}
