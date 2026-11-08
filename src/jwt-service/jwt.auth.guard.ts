import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomJwtService } from './jwt.service';
import { AuthenticatedRequest } from '../commons/http/request.interface';
import { UserRepository } from '../user/user.repository';
import { Request } from 'express';
import { UserSchema } from '../user/schema/user.schema';

@Injectable()
export class CustomJwtAuthGuard implements CanActivate {
  constructor(
    private readonly customJwtService: CustomJwtService,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & AuthenticatedRequest>();
    const authHeader = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.substring(7);
    const payload = this.customJwtService.verify(token);
    if (payload && !payload.sub) return false;

    const user = await this.userRepository.findById(payload.sub as string);
    if (!user) {
      throw new UnauthorizedException();
    }

    req['user'] = user;
    return true;
  }
}
