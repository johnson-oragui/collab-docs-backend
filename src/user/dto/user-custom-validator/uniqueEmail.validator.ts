import { UserRepository } from '@/user/user.repository';
import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: true })
@Injectable()
export class IsEMailUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly userRepo: UserRepository) {}

  async validate(email: string): Promise<boolean> {
    const emailExists = await this.userRepo.findByEmail(email.toLowerCase());
    return !emailExists;
  }

  defaultMessage() {
    return 'Email already exists';
  }
}
