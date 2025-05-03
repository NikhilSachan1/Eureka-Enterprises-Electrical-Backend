import { Test, TestingModule } from '@nestjs/testing';
import { UtilityService } from './utility.service';
import { DataFailureOperationType, DataSuccessOperationType } from './constants/utility.constants';

describe('UtilityService', () => {
  let service: UtilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UtilityService],
    }).compile();

    service = module.get<UtilityService>(UtilityService);
  });

  describe('createHash', () => {
    it('should create a hash from text', () => {
      const text = 'password123';
      const hashedText = service.createHash(text);

      expect(hashedText).toBeDefined();
      expect(hashedText).not.toBe(text);
      expect(typeof hashedText).toBe('string');
    });

    it('should create different hashes for different inputs', () => {
      const text1 = 'password123';
      const text2 = 'password124';

      const hash1 = service.createHash(text1);
      const hash2 = service.createHash(text2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('compare', () => {
    it('should return true for matching text and hash', () => {
      const text = 'password123';
      const hashedText = service.createHash(text);

      const result = service.compare(text, hashedText);
      expect(result).toBe(true);
    });

    it('should return false for non-matching text and hash', () => {
      const text = 'password123';
      const wrongText = 'password124';
      const hashedText = service.createHash(text);

      const result = service.compare(wrongText, hashedText);
      expect(result).toBe(false);
    });
  });

  describe('hmacHash', () => {
    it('should create a HMAC hash from text', () => {
      const text = 'test-text';
      const hashedText = service.hmacHash(text);

      expect(hashedText).toBeDefined();
      expect(hashedText).not.toBe(text);
      expect(typeof hashedText).toBe('string');
    });

    it('should create consistent hashes for same input', () => {
      const text = 'test-text';
      const hash1 = service.hmacHash(text);
      const hash2 = service.hmacHash(text);

      expect(hash1).toBe(hash2);
    });
  });

  describe('encrypt/decrypt', () => {
    it('should successfully encrypt and decrypt text', () => {
      const originalText = 'sensitive-data';
      const encrypted = service.encrypt(originalText);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toBe(originalText);
      expect(decrypted).toBe(originalText);
    });

    it('should handle special characters', () => {
      const originalText = 'test@123!#$%^&*()';
      const encrypted = service.encrypt(originalText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });

    it('should handle empty strings', () => {
      const originalText = '';
      const encrypted = service.encrypt(originalText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });
  });

  describe('getSuccessMessage', () => {
    it('should return correct success message for create operation', () => {
      const result = service.getSuccessMessage('User', DataSuccessOperationType.CREATE);
      expect(result).toEqual({
        message: 'User has been created successfully.',
      });
    });

    it('should return correct success message for update operation', () => {
      const result = service.getSuccessMessage('Profile', DataSuccessOperationType.UPDATE);
      expect(result).toEqual({
        message: 'Profile has been updated successfully.',
      });
    });
  });

  describe('getFailureMessage', () => {
    it('should return correct failure message for create operation', () => {
      const result = service.getFailureMessage('User', DataFailureOperationType.CREATE);
      expect(result).toEqual({
        message: 'Failed to add User. Please try again later.',
      });
    });

    it('should return correct failure message for update operation', () => {
      const result = service.getFailureMessage('Profile', DataFailureOperationType.UPDATE);
      expect(result).toEqual({
        message: 'Failed to update Profile. Please try again later.',
      });
    });
  });

  describe('capitalizeFirstLetter', () => {
    it('should capitalize first letter and lowercase rest', () => {
      const result = service.capitalizeFirstLetter('hELLo');
      expect(result).toBe('Hello');
    });

    it('should handle empty string', () => {
      const result = service.capitalizeFirstLetter('');
      expect(result).toBe('');
    });

    it('should handle single character', () => {
      const result = service.capitalizeFirstLetter('a');
      expect(result).toBe('A');
    });
  });

  describe('listResponse', () => {
    it('should format list response correctly', () => {
      const records = [{ id: 1 }, { id: 2 }];
      const totalRecords = 2;

      const result = service.listResponse(records, totalRecords);

      expect(result).toEqual({
        records: records,
        totalRecords: totalRecords,
      });
    });

    it('should handle empty records', () => {
      const records = [];
      const totalRecords = 0;

      const result = service.listResponse(records, totalRecords);

      expect(result).toEqual({
        records: [],
        totalRecords: 0,
      });
    });
  });

  describe('normalizePhoneNumber', () => {
    // Test for null, undefined and empty inputs
    it('should return input when phone number is falsy', () => {
      expect(service.normalizePhoneNumber(null)).toBeNull();
      expect(service.normalizePhoneNumber(undefined)).toBeUndefined();
      expect(service.normalizePhoneNumber('')).toBe('');
    });

    // Test for US/Canada numbers (+1 prefix)
    it('should remove country code for US/Canada numbers', () => {
      expect(service.normalizePhoneNumber('+12025550178')).toBe('2025550178');
      expect(service.normalizePhoneNumber('12025550178')).toBe('2025550178');
      expect(service.normalizePhoneNumber('1-202-555-0178')).toBe('2025550178');
      expect(service.normalizePhoneNumber('1 (202) 555-0178')).toBe('2025550178');
    });

    // Test for UK numbers (+44 prefix)
    it('should remove country code for UK numbers', () => {
      expect(service.normalizePhoneNumber('+447911123456')).toBe('7911123456');
      expect(service.normalizePhoneNumber('447911123456')).toBe('7911123456');
      expect(service.normalizePhoneNumber('44-7911-123-456')).toBe('7911123456');
      expect(service.normalizePhoneNumber('44 7911 123 456')).toBe('7911123456');
    });

    // Test for Australian numbers (+61 prefix)
    it('should remove country code for Australian numbers', () => {
      expect(service.normalizePhoneNumber('+61412345678')).toBe('412345678');
      expect(service.normalizePhoneNumber('61412345678')).toBe('412345678');
      expect(service.normalizePhoneNumber('61-412-345-678')).toBe('412345678');
      expect(service.normalizePhoneNumber('61 412 345 678')).toBe('412345678');
    });

    // Test for numbers without country codes
    it('should return the original input for numbers without recognized country codes', () => {
      expect(service.normalizePhoneNumber('2025550178')).toBe('2025550178');
      expect(service.normalizePhoneNumber('202-555-0178')).toBe('202-555-0178');
      expect(service.normalizePhoneNumber('(202) 555-0178')).toBe('(202) 555-0178');
    });

    // Test for numbers with other country codes
    it('should return the original input for numbers with other country codes', () => {
      expect(service.normalizePhoneNumber('+33123456789')).toBe('+33123456789'); // France
      expect(service.normalizePhoneNumber('+49123456789')).toBe('+49123456789'); // Germany
    });

    // Test edge cases
    it('should handle edge cases correctly', () => {
      // US number with exactly 11 digits (10 + country code)
      expect(service.normalizePhoneNumber('12025550178')).toBe('2025550178');

      // US number with less than 11 digits (shouldn't remove the country code)
      expect(service.normalizePhoneNumber('1202555')).toBe('1202555');

      // UK number with exactly 12 digits (10 + country code)
      expect(service.normalizePhoneNumber('447911123456')).toBe('7911123456');

      // UK number with less than 12 digits (shouldn't remove the country code)
      expect(service.normalizePhoneNumber('4479111')).toBe('4479111');

      // Non-numeric characters
      expect(service.normalizePhoneNumber('phone: 2025550178')).toBe('phone: 2025550178');
    });
  });
});
