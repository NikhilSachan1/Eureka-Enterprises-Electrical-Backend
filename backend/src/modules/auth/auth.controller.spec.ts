import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { BadRequestException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    signIn: jest.fn(),
    signUp: jest.fn(),
    forgetPassword: jest.fn(),
    resetPassword: jest.fn(),
    resetPasswordTokenValidation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    const signInDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockSignInResponse = {
      token: 'jwt-token',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'test@example.com',
      role: 'ADMIN',
    };

    it('should successfully sign in user', async () => {
      mockAuthService.signIn.mockResolvedValue(mockSignInResponse);

      const result = await controller.signIn(signInDto);

      expect(result).toEqual({
        token: 'jwt-token',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        role: 'ADMIN',
      });
      expect(mockAuthService.signIn).toHaveBeenCalledWith(signInDto);
    });

    it('should throw error when sign in fails', async () => {
      const error = new BadRequestException('Invalid credentials');
      mockAuthService.signIn.mockRejectedValue(error);

      await expect(controller.signIn(signInDto)).rejects.toThrow(error);
    });
  });

  describe('signUp', () => {
    const signupDto = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      contactNumber: '1234567890',
      invitationToken: 'token123',
    };

    const mockSignUpResponse = {
      message: 'User registered successfully',
    };

    it('should successfully sign up user', async () => {
      mockAuthService.signUp.mockResolvedValue(mockSignUpResponse);

      const result = await controller.signUp(signupDto);

      expect(result).toEqual(mockSignUpResponse);
      expect(mockAuthService.signUp).toHaveBeenCalledWith(signupDto);
    });

    it('should throw error when sign up fails', async () => {
      const error = new BadRequestException('Registration failed');
      mockAuthService.signUp.mockRejectedValue(error);

      await expect(controller.signUp(signupDto)).rejects.toThrow(error);
    });
  });

  describe('forgetPassword', () => {
    const forgetPasswordDto = {
      email: 'test@example.com',
    };

    const mockForgetPasswordResponse = {
      message: 'Reset password link sent successfully',
    };

    it('should successfully initiate forget password process', async () => {
      mockAuthService.forgetPassword.mockResolvedValue(mockForgetPasswordResponse);

      const result = await controller.forgetPassword(forgetPasswordDto);

      expect(result).toEqual(mockForgetPasswordResponse);
      expect(mockAuthService.forgetPassword).toHaveBeenCalledWith(forgetPasswordDto.email);
    });

    it('should throw error when forget password fails', async () => {
      const error = new Error('Forget password failed');
      mockAuthService.forgetPassword.mockRejectedValue(error);

      await expect(controller.forgetPassword(forgetPasswordDto)).rejects.toThrow(error);
    });
  });

  describe('resetPassword', () => {
    const token = 'reset-token';
    const resetPasswordDto = {
      newPassword: 'newPassword123!',
      confirmPassword: 'newPassword123!',
    };

    const mockResetPasswordResponse = {
      message: 'Password reset successfully',
    };

    it('should successfully reset password', async () => {
      mockAuthService.resetPassword.mockResolvedValue(mockResetPasswordResponse);

      const result = await controller.resetPassword(token, resetPasswordDto);

      expect(result).toEqual(mockResetPasswordResponse);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(resetPasswordDto, token);
    });

    it('should throw error when reset password fails', async () => {
      const error = new Error('Reset password failed');
      mockAuthService.resetPassword.mockRejectedValue(error);

      await expect(controller.resetPassword(token, resetPasswordDto)).rejects.toThrow(error);
    });
  });

  describe('resetPasswordTokenValidation', () => {
    const token = 'validation-token';
    const mockRedirectLink = 'http://frontend.com/reset-password';

    it('should successfully redirect to the appropriate link', async () => {
      const mockResponse = {
        redirect: jest.fn(),
      } as unknown as Response;

      mockAuthService.resetPasswordTokenValidation.mockResolvedValue(mockRedirectLink);

      await controller.resetPasswordTokenValidation(mockResponse, token);

      expect(mockAuthService.resetPasswordTokenValidation).toHaveBeenCalledWith(token);
      expect(mockResponse.redirect).toHaveBeenCalledWith(mockRedirectLink);
    });

    it('should throw error when token validation fails', async () => {
      const mockResponse = {
        redirect: jest.fn(),
      } as unknown as Response;

      const error = new Error('Token validation failed');
      mockAuthService.resetPasswordTokenValidation.mockRejectedValue(error);

      await expect(controller.resetPasswordTokenValidation(mockResponse, token)).rejects.toThrow(
        error,
      );
    });
  });
});
