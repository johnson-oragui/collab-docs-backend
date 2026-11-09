import { OrganisationRepository } from '@/organisations/organisation.repository';
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
    if (!email?.trim()) return false;
    const emailExists = await this.userRepo.findByEmail(email?.toLowerCase());
    return !emailExists;
  }

  defaultMessage() {
    return 'Email already exists';
  }
}

@ValidatorConstraint({ async: true })
@Injectable()
export class IsOrgEMailUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly orgRepo: OrganisationRepository) {}

  async validate(email: string): Promise<boolean> {
    if (!email?.trim()) return false;
    const emailExists = await this.orgRepo.findBy({
      email: email?.toLowerCase(),
    });
    return !emailExists?.[0];
  }

  defaultMessage() {
    return 'Organisation Email already exists';
  }
}
