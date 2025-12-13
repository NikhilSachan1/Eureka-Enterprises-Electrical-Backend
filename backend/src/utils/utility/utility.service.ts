import { Injectable } from '@nestjs/common';
import { compareSync, hashSync } from 'bcryptjs';
import { Environments } from '../../../env-configs';
import * as CryptoJS from 'crypto-js';
import { DataFailureOperationType, DataSuccessOperationType } from './constants/utility.constants';
import { createHmac } from 'crypto';
import * as moment from 'moment-timezone';

@Injectable()
export class UtilityService {
  createHash(text: string) {
    const hashedText = hashSync(text, Environments.SALT_CHARACTER_LENGTH);
    return hashedText;
  }

  compare(text: string, hashedText: string) {
    return compareSync(text, hashedText);
  }

  hmacHash(text: string): string {
    const hmac = createHmac(Environments.HASHING_ALGORITHM, Environments.HASH_KEY);
    hmac.update(text);
    return hmac.digest('hex');
  }

  encrypt(text: string) {
    const ciphertext = CryptoJS.AES.encrypt(text, Environments.HASH_KEY).toString();
    return Buffer.from(ciphertext).toString('base64url');
  }

  decrypt(hash: string) {
    const ciphertext = Buffer.from(hash, 'base64url').toString('utf8');
    const bytes = CryptoJS.AES.decrypt(ciphertext, Environments.HASH_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  getSuccessMessage(fieldName: string, operation: DataSuccessOperationType) {
    return { message: `${fieldName} has been ${operation} successfully.` };
  }

  getFailureMessage(fieldName: string, operation: DataFailureOperationType) {
    return { message: `Failed to ${operation} ${fieldName}. Please try again later.` };
  }

  capitalizeFirstLetter(str: string) {
    if (str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  listResponse(records: any[], totalRecords: string | number) {
    return {
      records,
      totalRecords: parseInt(totalRecords.toString()),
    };
  }

  toTitleCase(str: string) {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  convertLocalTimeToUTC(timeString: string, timezone = 'Asia/Kolkata'): Date {
    const today = new Date();
    const [hours, minutes] = timeString.split(':').map(Number);

    const localMoment = moment.tz(
      {
        year: today.getFullYear(),
        month: today.getMonth(),
        date: today.getDate(),
        hour: hours,
        minute: minutes,
      },
      timezone,
    );

    return localMoment.utc().toDate();
  }

  getCurrentFinancialYear() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const financialYear = month < 3 ? year - 1 : year;
    return `${financialYear}-${financialYear + 1}`;
  }

  getFinancialYear(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const financialYear = month < 3 ? year - 1 : year;
    return `${financialYear}-${financialYear + 1}`;
  }

  generateSecurePassword(length = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '@#$%&*!';
    const allChars = uppercase + lowercase + numbers + special;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  convertEmptyStringsToNull<T extends Record<string, any>>(data: T): T {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = value === '' ? null : value;
    }
    return result as T;
  }
}
