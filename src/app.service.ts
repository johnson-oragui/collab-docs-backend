import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): Record<string, string> {
    return { message: 'Collab Docs says Hello!' };
  }
}
