import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../users/user.service';
import { JwtService } from '@nestjs/jwt';
import { UtilityService } from 'src/utils/utility/utility.service';
import { MailService } from '../common/email/email.service';
import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { AUTH_ERRORS, AUTH_RESPONSES } from './constants/auth.constants';
import { Environments } from '../../../env-configs';
import { UserStatus } from '../users/constants/user.constants';
import { InvitationService } from '../invitation/invitation.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockUserService = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    getUserDetails: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockUtilityService = {
    compare: jest.fn(),
    createHash: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  const mockMailService = {
    sendMail: jest.fn(),
  };

  const mockInvitationService = {
    verifyInvitation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: UtilityService, useValue: mockUtilityService },
        { provide: MailService, useValue: mockMailService },
        { provide: InvitationService, useValue: mockInvitationService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      mockUserService.findOne.mockResolvedValue(mockUser);
      mockUtilityService.compare.mockReturnValue(true);

      const result = await service.validateUser('test@example.com', 'password123');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.findOne.mockResolvedValue(null);

      await expect(service.validateUser('test@example.com', 'password123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user is archived', async () => {
      mockUserService.findOne.mockResolvedValue({
        ...mockUser,
        status: UserStatus.ARCHIVED,
      });

      await expect(service.validateUser('test@example.com', 'password123')).rejects.toThrow(
        new NotFoundException(AUTH_ERRORS.EMAIL_NOT_EXISTS),
      );
    });

    it('should return null when password does not match', async () => {
      mockUserService.findOne.mockResolvedValue(mockUser);
      mockUtilityService.compare.mockReturnValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');
      expect(result).toBeNull();
    });
  });

  describe('signIn', () => {
    const signInDto = { email: 'test@example.com', password: 'password123' };
    const mockUserDetails = {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'test@example.com',
      role: 'ADMIN',
    };

    it('should return token and user details when signIn is successful', async () => {
      const mockToken = 'jwt-token';
      jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser);
      mockUserService.getUserDetails.mockResolvedValue(mockUserDetails);
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.signIn(signInDto);

      expect(result).toEqual({
        token: mockToken,
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        role: 'ADMIN',
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        id: mockUserDetails.id,
        email: mockUserDetails.email,
        role: mockUserDetails.role,
      });
    });

    it('should throw BadRequestException when credentials are invalid', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        new BadRequestException(AUTH_ERRORS.INVALID_CREDENTIALS),
      );
    });
  });

  describe('forgetPassword', () => {
    it('should send reset password email successfully', async () => {
      mockUserService.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('token');
      mockUtilityService.encrypt.mockReturnValue('encrypted-token');
      mockMailService.sendMail.mockResolvedValue(true);

      const result = await service.forgetPassword('test@example.com');

      expect(result).toEqual({ message: AUTH_RESPONSES.FORGET_PASSWORD });
      expect(mockMailService.sendMail).toHaveBeenCalled();
    });

    it('should throw NotFoundException when email does not exist', async () => {
      mockUserService.findOne.mockResolvedValue(null);

      await expect(service.forgetPassword('test@example.com')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto = {
      newPassword: 'newPassword123!',
      confirmPassword: 'newPassword123!',
    };

    it('should successfully reset password', async () => {
      mockUtilityService.decrypt.mockReturnValue('decrypted-token');
      jest.spyOn(service, 'validateJWT').mockResolvedValue({ email: 'test@example.com' });
      mockUserService.findOne.mockResolvedValue(mockUser);
      mockUtilityService.createHash.mockReturnValue('newHashedPassword');

      const result = await service.resetPassword(resetPasswordDto, 'encrypted-token');

      expect(result).toEqual({ message: AUTH_RESPONSES.PASSWORD_RESET });
      expect(mockUserService.update).toHaveBeenCalled();
    });

    it('should throw GoneException when token is expired', async () => {
      mockUtilityService.decrypt.mockReturnValue('decrypted-token');
      jest.spyOn(service, 'validateJWT').mockResolvedValue(false);

      await expect(service.resetPassword(resetPasswordDto, 'encrypted-token')).rejects.toThrow(
        GoneException,
      );
    });

    it('should throw BadRequestException when passwords do not match in reset password', async () => {
      mockUtilityService.decrypt.mockReturnValue('decrypted-token');
      jest.spyOn(service, 'validateJWT').mockResolvedValue({ email: 'test@example.com' });

      const mismatchedPasswordsDto = {
        newPassword: 'newPassword123!',
        confirmPassword: 'differentPassword123!',
      };

      await expect(
        service.resetPassword(mismatchedPasswordsDto, 'encrypted-token'),
      ).rejects.toThrow(new BadRequestException(AUTH_ERRORS.PASSWORDS_DO_NOT_MATCH));
    });
  });

  describe('resetPasswordTokenValidation', () => {
    it('should return success redirect URL when token is valid', async () => {
      mockUtilityService.decrypt.mockReturnValue('decrypted-token');
      jest.spyOn(service, 'validateJWT').mockResolvedValue({ email: 'test@example.com' });
      mockJwtService.decode.mockReturnValue({ email: 'test@example.com' });

      const result = await service.resetPasswordTokenValidation('encrypted-token');

      expect(result).toContain(Environments.FE_BASE_URL);
    });

    it('should return failure redirect URL when token is invalid', async () => {
      mockUtilityService.decrypt.mockReturnValue('decrypted-token');
      jest.spyOn(service, 'validateJWT').mockResolvedValue(false);
      mockJwtService.decode.mockReturnValue({ email: 'test@example.com' });

      const result = await service.resetPasswordTokenValidation('encrypted-token');

      expect(result).toContain(Environments.FE_BASE_URL);
    });
  });

  describe('validateJWT', () => {
    it('should return payload when token is valid', async () => {
      const mockPayload = {
        id: '1',
        email: 'test@example.com',
        role: 'ADMIN',
      };
      mockJwtService.verify.mockResolvedValue(mockPayload);

      const result = await service.validateJWT('valid-token');

      expect(result).toEqual(mockPayload);
    });

    it('should return false when token is invalid', async () => {
      mockJwtService.verify.mockRejectedValue(new Error());

      const result = await service.validateJWT('invalid-token');

      expect(result).toBeFalsy();
    });
  });

  describe('signUp', () => {
    const signupDto = {
      email: 'test@example.com',
      password: 'password123!',
      confirmPassword: 'password123!',
      contactNumber: '1234567890',
      invitationToken: 'valid-token',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockInvitationResponse = {
      email: 'test@example.com',
      roleId: '1',
      id: 'invitation-id',
    };

    it('should successfully create a new user', async () => {
      mockInvitationService.verifyInvitation.mockResolvedValue(mockInvitationResponse);
      mockUserService.findOne.mockResolvedValue(null);
      mockUtilityService.createHash.mockReturnValue('hashedPassword');
      mockUserService.create.mockResolvedValue({ id: '1' });

      const result = await service.signUp(signupDto);

      expect(result).toEqual({ message: AUTH_RESPONSES.SIGNUP_SUCCESS });
      expect(mockUserService.create).toHaveBeenCalledWith({
        ...signupDto,
        password: 'hashedPassword',
        status: UserStatus.ACTIVE,
        roleId: '1',
        invitationId: 'invitation-id',
      });
    });

    it('should throw BadRequestException when passwords do not match', async () => {
      const mismatchedPasswords = {
        ...signupDto,
        confirmPassword: 'different',
      };

      await expect(service.signUp(mismatchedPasswords)).rejects.toThrow(
        new BadRequestException(AUTH_ERRORS.PASSWORDS_DO_NOT_MATCH),
      );
    });

    it('should throw BadRequestException when invitation email does not match signup email', async () => {
      mockInvitationService.verifyInvitation.mockResolvedValue({
        ...mockInvitationResponse,
        email: 'different@example.com',
      });

      await expect(service.signUp(signupDto)).rejects.toThrow(
        new BadRequestException(AUTH_ERRORS.INVITATION_EMAIL_MISMATCH),
      );
    });

    it('should throw BadRequestException when user already exists', async () => {
      mockInvitationService.verifyInvitation.mockResolvedValue(mockInvitationResponse);
      mockUserService.findOne.mockResolvedValue(mockUser);

      await expect(service.signUp(signupDto)).rejects.toThrow(
        new BadRequestException(AUTH_ERRORS.EMAIL_ALREADY_EXISTS),
      );
    });

    it('should propagate errors from invitation verification', async () => {
      const verificationError = new Error('Invitation verification failed');
      mockInvitationService.verifyInvitation.mockRejectedValue(verificationError);

      await expect(
        service.signUp({
          email: 'test@example.com',
          password: 'password123!',
          confirmPassword: 'password123!',
          invitationToken: 'invalid-token',
          firstName: 'John',
          lastName: 'Doe',
          contactNumber: '1234567890',
        }),
      ).rejects.toThrow(verificationError);
    });
  });
});
