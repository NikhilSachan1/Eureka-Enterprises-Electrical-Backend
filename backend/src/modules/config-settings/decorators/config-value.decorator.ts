import { ValidateBy } from 'class-validator';

export function IsValidConfigValue() {
  return ValidateBy({
    name: 'isValidConfigValue',
    validator: {
      validate(value: any) {
        return value !== undefined && value !== null;
      },
      defaultMessage() {
        return 'Config value cannot be null or undefined';
      },
    },
  });
}
