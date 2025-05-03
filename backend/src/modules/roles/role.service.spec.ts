import { Test, TestingModule } from '@nestjs/testing';
import { RoleService } from './role.service';
import { RoleRepository } from './role.repository';
import { FindOneOptions } from 'typeorm';
import { RoleEntity } from './entities/role.entity';

describe('RoleService', () => {
  let service: RoleService;
  let repository: RoleRepository;

  const mockRole = {
    id: '1',
    name: 'ADMIN',
    description: 'Administrator role',
    createdBy: '',
    updatedBy: '',
    deletedBy: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockRoleRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: RoleRepository,
          useValue: mockRoleRepository,
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    repository = module.get<RoleRepository>(RoleRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should find a role successfully', async () => {
      const whereCondition: FindOneOptions<RoleEntity> = {
        where: { name: 'ADMIN' },
      };

      mockRoleRepository.findOne.mockResolvedValue(mockRole);

      const result = await service.findOne(whereCondition);

      expect(repository.findOne).toHaveBeenCalledWith(whereCondition);
      expect(result).toEqual(mockRole);
    });

    it('should propagate errors from repository', async () => {
      const whereCondition: FindOneOptions<RoleEntity> = {
        where: { name: 'ADMIN' },
      };

      const error = new Error('Database error');
      mockRoleRepository.findOne.mockRejectedValue(error);

      await expect(service.findOne(whereCondition)).rejects.toThrow(error);
      expect(repository.findOne).toHaveBeenCalledWith(whereCondition);
    });
  });
});
