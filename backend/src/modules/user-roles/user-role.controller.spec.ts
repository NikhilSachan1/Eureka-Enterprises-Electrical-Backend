import { Test, TestingModule } from '@nestjs/testing';
import { UserRoleController } from './user-role.controller';
import { UserRoleService } from './user-role.service';

describe('RolesController', () => {
  let controller: UserRoleController;

  const mockRolesService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserRoleController],
      providers: [
        {
          provide: UserRoleService,
          useValue: mockRolesService,
        },
      ],
    }).compile();

    controller = module.get<UserRoleController>(UserRoleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
