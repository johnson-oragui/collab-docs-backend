import {
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsPasswordMatchConstraint', async: false })
export class IsPasswordMatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, args?: ValidationArguments): boolean {
    let relatedProperty = '';
    if (args && args.constraints) {
      [relatedProperty] = args.constraints as string[];
      return value === (args.object as Record<string, string>)[relatedProperty];
    }
    return true;
  }

  defaultMessage() {
    return 'Passwords do not match';
  }
}

export function IsPasswordMatch(property: string) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      constraints: [property],
      validator: IsPasswordMatchConstraint,
    });
  };
}
