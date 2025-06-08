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
}
