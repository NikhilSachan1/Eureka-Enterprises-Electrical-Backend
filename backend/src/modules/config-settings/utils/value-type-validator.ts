import { BadRequestException } from '@nestjs/common';
import {
  ValueType,
  CONFIG_SETTING_ERRORS,
  VALUE_TYPE_DESCRIPTIONS,
} from '../constants/config-setting.constants';

export class ValueTypeValidator {
  static validate(value: any, expectedType: string, configKey: string): void {
    const typeEnum = expectedType.toLowerCase() as ValueType;

    if (!Object.values(ValueType).includes(typeEnum)) {
      throw new BadRequestException(
        CONFIG_SETTING_ERRORS.UNSUPPORTED_VALUE_TYPE(expectedType, configKey),
      );
    }

    const validators = {
      [ValueType.JSON]: () => this.validateJsonObject(value, configKey),
      [ValueType.ARRAY]: () => this.validateArray(value, configKey),
      [ValueType.NUMBER]: () => this.validateNumber(value, configKey),
      [ValueType.TEXT]: () => this.validateText(value, configKey),
      [ValueType.BOOLEAN]: () => this.validateBoolean(value, configKey),
    };

    validators[typeEnum]();
  }

  private static validateJsonObject(value: any, configKey: string): void {
    if (!this.isValidJsonObject(value)) {
      throw new BadRequestException(
        CONFIG_SETTING_ERRORS.INVALID_VALUE_TYPE(
          configKey,
          VALUE_TYPE_DESCRIPTIONS[ValueType.JSON],
          this.getValueTypeDescription(value),
        ),
      );
    }
  }

  private static validateArray(value: any, configKey: string): void {
    if (!Array.isArray(value)) {
      throw new BadRequestException(
        CONFIG_SETTING_ERRORS.INVALID_VALUE_TYPE(
          configKey,
          VALUE_TYPE_DESCRIPTIONS[ValueType.ARRAY],
          this.getValueTypeDescription(value),
        ),
      );
    }
  }

  private static validateNumber(value: any, configKey: string): void {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new BadRequestException(
        CONFIG_SETTING_ERRORS.INVALID_VALUE_TYPE(
          configKey,
          VALUE_TYPE_DESCRIPTIONS[ValueType.NUMBER],
          this.getValueTypeDescription(value),
        ),
      );
    }
  }

  private static validateText(value: any, configKey: string): void {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        CONFIG_SETTING_ERRORS.INVALID_VALUE_TYPE(
          configKey,
          VALUE_TYPE_DESCRIPTIONS[ValueType.TEXT],
          this.getValueTypeDescription(value),
        ),
      );
    }
  }

  private static validateBoolean(value: any, configKey: string): void {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(
        CONFIG_SETTING_ERRORS.INVALID_VALUE_TYPE(
          configKey,
          VALUE_TYPE_DESCRIPTIONS[ValueType.BOOLEAN],
          this.getValueTypeDescription(value),
        ),
      );
    }
  }

  private static isValidJsonObject(value: any): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    );
  }

  private static getValueTypeDescription(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }
}
