import { Injectable } from '@nestjs/common';
import { compareSync, hashSync } from 'bcryptjs';
import { Environments } from '../../../env-configs';
import * as CryptoJS from 'crypto-js';
import { DataFailureOperationType, DataSuccessOperationType } from './constants/utility.constants';
import { createHmac } from 'crypto';
import * as moment from 'moment-timezone';
import { USER_RESPONSE_FIELDS } from '../master-constants/master-constants';

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

  getCurrentYear() {
    return new Date().getFullYear();
  }

  getMonthName(month: number, short = false): string {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = months[month - 1] || '';
    return short ? monthName.slice(0, 3) : monthName;
  }

  numberToWords(num: number): string {
    if (num === 0) return 'Zero Rupees Only';
    num = Math.round(num);
    let words = '';

    if (num >= 10000000) {
      words += this.convertBelowThousand(Math.floor(num / 10000000)) + ' Crore ';
      num %= 10000000;
    }
    if (num >= 100000) {
      words += this.convertBelowThousand(Math.floor(num / 100000)) + ' Lakh ';
      num %= 100000;
    }
    if (num >= 1000) {
      words += this.convertBelowThousand(Math.floor(num / 1000)) + ' Thousand ';
      num %= 1000;
    }
    if (num >= 100) {
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      words += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num > 0) {
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const teens = [
        'Ten',
        'Eleven',
        'Twelve',
        'Thirteen',
        'Fourteen',
        'Fifteen',
        'Sixteen',
        'Seventeen',
        'Eighteen',
        'Nineteen',
      ];
      const tens = [
        '',
        '',
        'Twenty',
        'Thirty',
        'Forty',
        'Fifty',
        'Sixty',
        'Seventy',
        'Eighty',
        'Ninety',
      ];

      if (num < 10) words += ones[num];
      else if (num < 20) words += teens[num - 10];
      else {
        words += tens[Math.floor(num / 10)];
        if (num % 10 > 0) words += ' ' + ones[num % 10];
      }
    }
    return words.trim() + ' Rupees Only';
  }

  private convertBelowThousand(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = [
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];
    const tens = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ];

    let result = '';
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)];
      num %= 10;
      if (num > 0) result += ' ' + ones[num];
    } else if (num >= 10) {
      result += teens[num - 10];
    } else if (num > 0) {
      result += ones[num];
    }
    return result.trim();
  }
}

export const getUserSelectFields = (alias: string, prefix?: string): string => {
  // Skip 'id' when no prefix to avoid overwriting main table's id field
  // The user id is already available via foreign key column (e.g., userId, approvalBy)
  const fieldsToSelect = prefix
    ? USER_RESPONSE_FIELDS
    : USER_RESPONSE_FIELDS.filter((f) => f !== 'id');

  return fieldsToSelect
    .map((field) => {
      const aliasName = prefix
        ? `${prefix}${field.charAt(0).toUpperCase() + field.slice(1)}`
        : field;
      return `${alias}."${field}" as "${aliasName}"`;
    })
    .join(', ');
};

export const getUserJsonBuildObject = (alias: string): string => {
  const fields = USER_RESPONSE_FIELDS;
  const jsonFields = fields.map((field) => `'${field}', ${alias}."${field}"`).join(', ');
  return `json_build_object(${jsonFields})`;
};
