import {
  ValidateBy,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { ConfigurationService } from '../../configurations/configuration.service';
import { CONFIGURATION_MODULES } from 'src/utils/master-constants/master-constants';
import { CONFIG_SETTING_ERRORS } from '../constants/config-setting.constants';

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

@Injectable()
@ValidatorConstraint({ name: 'isLeaveConfigValid', async: true })
export class IsLeaveConfigValidConstraint implements ValidatorConstraintInterface {
  constructor(private readonly configurationService: ConfigurationService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const object = args.object as any;
    const configId = object.configId;

    if (!configId) {
      return true;
    }

    try {
      const configuration = await this.configurationService.findOne({
        where: { id: configId },
      });

      if (!configuration) {
        return true;
      }

      if (configuration.module === CONFIGURATION_MODULES.LEAVE) {
        return !!(object.effectiveFrom && object.effectiveTo);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  defaultMessage(): string {
    return CONFIG_SETTING_ERRORS.EFFECTIVE_FROM_AND_TO_REQUIRED;
  }
}

export function IsLeaveConfigValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsLeaveConfigValidConstraint,
    });
  };
}
