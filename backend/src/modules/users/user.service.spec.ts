import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { UtilityService } from 'src/utils/utility/utility.service';
import { RoleService } from '../roles/role.service';
import { UserRoleService } from '../user_roles/user_role.service';
import { EntityManager } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  USERS_ERRORS,
  USERS_RESPONSES,
  USER_FIELD_NAMES,
  UserStatus,
} from './constants/user.constants';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { InvitationService } from '../invitation/invitation.service';
import {
  InvitationStatus,
  INVITATION_STATUS_HISTORY,
} from '../invitation/constants/invitation.constants';
import { GetUsersDto } from './dto';
import { PowerlistClientService } from '../powerlist-client/powerlist-client.service';
import { PowerlistAssignmentAction } from '../powerlist/constants/powerlist.constants';

describe('UserService', () => {
  let service: UserService;

  const mockUser = {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'hashedPassword',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    rawQuery: jest.fn(),
  };

  const mockUtilityService = {
    getSuccessMessage: jest.fn(),
    compare: jest.fn(),
    createHash: jest.fn(),
  };

  const mockRoleService = {
    findOne: jest.fn(),
  };

  const mockUserRoleService = {
    create: jest.fn(),
  };

  const mockInvitationService = {
    updateExpiredInvitations: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockEntityManager = {
    transaction: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockPowerlistClientService = {
    manageAssignment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: UtilityService, useValue: mockUtilityService },
        { provide: RoleService, useValue: mockRoleService },
        { provide: UserRoleService, useValue: mockUserRoleService },
        { provide: EntityManager, useValue: mockEntityManager },
        { provide: InvitationService, useValue: mockInvitationService },
        { provide: PowerlistClientService, useValue: mockPowerlistClientService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const mockOptions: GetUsersDto = {
      page: 1,
      pageSize: 10,
    };

    const mockRecords = [mockUser];
    const mockTotalRecords = 1;

    it('should return users and total count', async () => {
      mockInvitationService.updateExpiredInvitations.mockResolvedValue(undefined);
      mockUserRepository.rawQuery
        .mockResolvedValueOnce(mockRecords)
        .mockResolvedValueOnce([{ total: mockTotalRecords }]);

      const result = await service.findAll(mockOptions);

      expect(result).toEqual({
        records: mockRecords,
        totalRecords: mockTotalRecords,
      });
      expect(mockInvitationService.updateExpiredInvitations).toHaveBeenCalled();
      expect(mockUserRepository.rawQuery).toHaveBeenCalledTimes(2);
    });

    it('should throw error when query fails', async () => {
      const error = new Error('Database error');
      mockUserRepository.rawQuery.mockRejectedValue(error);

      await expect(service.findAll(mockOptions)).rejects.toThrow(error);
    });
  });

  describe('findOne', () => {
    const whereCondition = { email: 'john@example.com' };

    it('should return a user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(whereCondition);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: whereCondition,
      });
    });

    it('should throw error when repository fails', async () => {
      const error = new Error('Database error');
      mockUserRepository.findOne.mockRejectedValue(error);

      await expect(service.findOne(whereCondition)).rejects.toThrow(error);
    });
  });

  describe('create', () => {
    const createUserDto = {
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      password: 'password123',
      roleId: '1',
      invitationId: '1',
    };

    const mockCreatedUser = {
      id: '1',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      password: 'hashedPassword',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockInvitationData = {
      id: '1',
      status: InvitationStatus.PENDING,
      statusHistory: [],
      powerlistIds: ['powerlist-1', 'powerlist-2'],
    };

    it('should create user with role, update invitation and assign powerlists', async () => {
      // Setup successful transaction
      mockEntityManager.transaction.mockImplementation(async (cb) => {
        return await cb(mockEntityManager);
      });

      mockUserRepository.create.mockResolvedValue(mockCreatedUser);
      mockInvitationService.findOne.mockResolvedValue(mockInvitationData);
      mockUserRoleService.create.mockResolvedValue(undefined);
      mockPowerlistClientService.manageAssignment.mockResolvedValue(undefined);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockCreatedUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith(createUserDto, expect.any(Object));
      expect(mockUserRoleService.create).toHaveBeenCalledWith(
        { userId: mockCreatedUser.id, roleId: createUserDto.roleId },
        expect.any(Object),
      );
      expect(mockInvitationService.update).toHaveBeenCalledWith(
        { id: createUserDto.invitationId },
        {
          status: InvitationStatus.ACCEPTED,
          statusHistory: expect.arrayContaining([
            expect.objectContaining({
              fromStatus: InvitationStatus.PENDING,
              toStatus: InvitationStatus.ACCEPTED,
              reason: INVITATION_STATUS_HISTORY.INVITATION_ACCEPTED,
            }),
          ]),
          updatedBy: mockCreatedUser.id,
        },
        expect.any(Object),
      );
      expect(mockPowerlistClientService.manageAssignment).toHaveBeenCalledTimes(2);
      mockInvitationData.powerlistIds.forEach((powerlistId) => {
        expect(mockPowerlistClientService.manageAssignment).toHaveBeenCalledWith(
          {
            powerlistId,
            clientId: mockCreatedUser.id,
            action: PowerlistAssignmentAction.ASSIGN,
          },
          mockCreatedUser.id,
        );
      });
    });

    it('should throw error when repository fails', async () => {
      const error = new Error('Database error');

      // Setup failed transaction
      mockEntityManager.transaction.mockImplementation(async () => {
        throw error;
      });

      await expect(service.create(createUserDto)).rejects.toThrow(error);
      expect(mockEntityManager.transaction).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'oldPassword',
      newPassword: 'newPassword',
      confirmPassword: 'newPassword',
    };

    it('should change password successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUtilityService.compare.mockReturnValue(true);
      mockUtilityService.createHash.mockReturnValue('newHashedPassword');
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.changePassword(changePasswordDto, 'john@example.com');

      expect(result).toEqual({ message: USERS_RESPONSES.PASSWORD_UPDATED });
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should throw error for incorrect current password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUtilityService.compare.mockReturnValue(false);

      await expect(service.changePassword(changePasswordDto, 'john@example.com')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUserDetails', () => {
    const mockUserWithRoles = {
      ...mockUser,
      userRoles: [{ role: { name: 'CLIENT' } }],
    };

    it('should return user details with role', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUserWithRoles);

      const result = await service.getUserDetails('1');

      expect(result).toEqual({
        ...mockUser,
        role: 'CLIENT',
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserDetails('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const identifierConditions = { id: '1' };
    const updateData = { firstName: 'Jane' };
    const successMessage = 'Update successful';

    it('should update user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      mockUtilityService.getSuccessMessage.mockReturnValue(successMessage);

      const result = await service.update(identifierConditions, updateData);

      expect(result).toBe(successMessage);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: identifierConditions,
      });
      expect(mockUserRepository.update).toHaveBeenCalledWith(identifierConditions, updateData);
      expect(mockUtilityService.getSuccessMessage).toHaveBeenCalledWith(
        USER_FIELD_NAMES.USER,
        DataSuccessOperationType.UPDATE,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.update(identifierConditions, updateData)).rejects.toThrow(
        new NotFoundException(USERS_ERRORS.NOT_FOUND),
      );
    });

    it('should throw error when update fails', async () => {
      const error = new Error('Update failed');
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.update.mockRejectedValue(error);

      await expect(service.update(identifierConditions, updateData)).rejects.toThrow(error);
    });
  });

  describe('delete', () => {
    it('should delete an archived user', async () => {
      const userId = '1';
      const deletedBy = '2';
      const archivedUser = { ...mockUser, status: UserStatus.ARCHIVED };

      mockUserRepository.findOne.mockResolvedValue(archivedUser);
      mockUserRepository.delete.mockResolvedValue({ affected: 1 });
      mockUtilityService.getSuccessMessage.mockReturnValue('Delete successful');

      const result = await service.delete(userId, deletedBy);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(mockUserRepository.delete).toHaveBeenCalledWith(userId, deletedBy);
      expect(result).toBe('Delete successful');
    });

    it('should throw BadRequestException when trying to delete non-archived user', async () => {
      const userId = '1';
      const deletedBy = '2';
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };

      mockUserRepository.findOne.mockResolvedValue(activeUser);

      await expect(service.delete(userId, deletedBy)).rejects.toThrow(
        new BadRequestException(USERS_ERRORS.USER_NOT_ARCHIVED_TO_DELETE),
      );
    });
  });
});
