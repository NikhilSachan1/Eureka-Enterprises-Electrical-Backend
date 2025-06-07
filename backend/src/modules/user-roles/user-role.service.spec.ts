import { Test, TestingModule } from '@nestjs/testing';
import { UserRoleService } from './user-role.service';
import { UserRoleRepository } from './user-role.repository';
import { CreateUserRoleDto } from './dto/user-role.dto';
import { EntityManager } from 'typeorm';

describe('UserRoleService', () => {
  let service: UserRoleService;
  let repository: UserRoleRepository;

  const mockUserRolesRepository = {
    create: jest.fn(),
  };

  const mockEntityManager = {} as EntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRoleService,
        {
          provide: UserRoleRepository,
          useValue: mockUserRolesRepository,
        },
      ],
    }).compile();

    service = module.get<UserRoleService>(UserRoleService);
    repository = module.get<UserRoleRepository>(UserRoleRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user role successfully', async () => {
      const createUserRoleDto = {
        userId: '1',
        roleId: '1',
      };

      const mockCreatedUserRole = {
        id: 'new-uuid',
        user: { id: createUserRoleDto.userId },
        role: { id: createUserRoleDto.roleId },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRolesRepository.create.mockResolvedValue(mockCreatedUserRole);

      const result = await service.create(createUserRoleDto, mockEntityManager);

      expect(repository.create).toHaveBeenCalledWith(createUserRoleDto, mockEntityManager);
      expect(result).toEqual(mockCreatedUserRole);
    });

    it('should propagate errors from repository', async () => {
      const createUserRoleDto: CreateUserRoleDto = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        roleId: '987fcdeb-51a2-43d7-9876-543210987000',
      };

      const error = new Error('Database error');
      mockUserRolesRepository.create.mockRejectedValue(error);

      await expect(service.create(createUserRoleDto, mockEntityManager)).rejects.toThrow(error);

      expect(repository.create).toHaveBeenCalledWith(createUserRoleDto, mockEntityManager);
    });
  });
});
