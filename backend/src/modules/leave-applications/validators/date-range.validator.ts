import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { LEAVE_APPLICATION_ERRORS } from '../constants/leave-application.constants';

export function IsValidDateRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidDateRange',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const dto = args.object as any;
          const fromDate = new Date(dto.fromDate);
          const toDate = new Date(dto.toDate);

          // Check if dates are valid
          if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return false;
          }

          // Check if fromDate <= toDate
          if (fromDate > toDate) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as any;
          const fromDate = new Date(dto.fromDate);
          const toDate = new Date(dto.toDate);

          if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return LEAVE_APPLICATION_ERRORS.INVALID_DATE_FORMAT;
          }

          if (fromDate > toDate) {
            return LEAVE_APPLICATION_ERRORS.FROM_DATE_GREATER_THAN_TO_DATE;
          }

          return LEAVE_APPLICATION_ERRORS.INVALID_DATE_RANGE;
        },
      },
    });
  };
}

export function IsValidDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidDate',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value) return false;

          // Check if it's a valid date string (YYYY-MM-DD format)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(value)) {
            return false;
          }

          const date = new Date(value);
          return !isNaN(date.getTime());
        },
        defaultMessage() {
          return LEAVE_APPLICATION_ERRORS.INVALID_DATE_FORMAT;
        },
      },
    });
  };
}
