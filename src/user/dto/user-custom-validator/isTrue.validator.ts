import {
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsTrueConstraint', async: false })
export class IsTrueConstraint implements ValidatorConstraintInterface {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(value: boolean, _?: ValidationArguments): boolean {
    if (!value) return false;
    return true;
  }

  defaultMessage() {
    return 'Must agree to Terms';
  }
}

export function IsTrue() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [],
      validator: IsTrueConstraint,
    });
  };
}
