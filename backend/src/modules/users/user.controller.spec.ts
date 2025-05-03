import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserStatus } from './constants/user.constants';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('UserController', () => {
  let controller: UserController;

  const mockUserDetails = {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    contactNumber: '1234567890',
    profilePicture: 'http://example.com/profile.jpg',
    status: UserStatus.ACTIVE,
    passwordUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    role: 'CLIENT',
  };

  const mockUserService = {
    findAll: jest.fn(),
    getUserDetails: jest.fn(),
    changePassword: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const mockUsers = [mockUserDetails];

    it('should return users with pagination', async () => {
      const mockResponse = {
        records: mockUsers,
        totalRecords: 1,
      };
      mockUserService.findAll.mockResolvedValue(mockResponse);

      const queryParams = {
        page: 1,
        pageSize: 10,
        search: 'John',
        status: [UserStatus.ACTIVE],
      };

      const result = await controller.findAll(queryParams);

      expect(result).toEqual(mockResponse);
      expect(mockUserService.findAll).toHaveBeenCalledWith(queryParams);
    });

    it('should handle empty results', async () => {
      const emptyResponse = {
        records: [],
        totalRecords: 0,
      };
      mockUserService.findAll.mockResolvedValue(emptyResponse);

      const result = await controller.findAll({});

      expect(result).toEqual(emptyResponse);
      expect(mockUserService.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should return user details with role', async () => {
      mockUserService.getUserDetails.mockResolvedValue(mockUserDetails);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockUserDetails);
      expect(mockUserService.getUserDetails).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserService.getUserDetails.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'oldPassword',
      newPassword: 'newPassword',
      confirmPassword: 'newPassword',
    };
    const mockRequest = { user: { email: 'john@example.com' } };

    it('should change password successfully', async () => {
      const successResponse = { message: 'Password updated successfully' };
      mockUserService.changePassword.mockResolvedValue(successResponse);

      const result = await controller.changePassword(mockRequest, changePasswordDto);

      expect(result).toEqual(successResponse);
      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        changePasswordDto,
        mockRequest.user.email,
      );
    });

    it('should throw BadRequestException when passwords do not match', async () => {
      mockUserService.changePassword.mockRejectedValue(new BadRequestException());

      await expect(
        controller.changePassword(mockRequest, {
          ...changePasswordDto,
          confirmPassword: 'different',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const updateUserDto = {
      firstName: 'Jane',
      lastName: 'Smith',
    };
    const mockRequest = { user: { id: '2' } };

    it('should update user successfully', async () => {
      const successResponse = { message: 'User updated successfully' };
      mockUserService.update.mockResolvedValue(successResponse);

      const result = await controller.update('1', mockRequest, updateUserDto);

      expect(result).toEqual(successResponse);
      expect(mockUserService.update).toHaveBeenCalledWith(
        { id: '1' },
        { ...updateUserDto, updatedBy: '2' },
      );
    });
  });

  describe('delete', () => {
    const mockRequest = { user: { id: '2' } };

    it('should delete archived user successfully', async () => {
      const successResponse = { message: 'User deleted successfully' };
      mockUserService.delete.mockResolvedValue(successResponse);

      const result = await controller.delete('1', mockRequest);

      expect(result).toEqual(successResponse);
      expect(mockUserService.delete).toHaveBeenCalledWith('1', '2');
    });

    it('should throw BadRequestException when trying to delete non-archived user', async () => {
      mockUserService.delete.mockRejectedValue(
        new BadRequestException('User must be archived before deletion'),
      );

      await expect(controller.delete('1', mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
