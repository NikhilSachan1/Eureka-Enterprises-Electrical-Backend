import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserService } from './user.service';
import { CreateSystemUserDto, UpdateSystemUserDto } from './dto';
import { SYSTEM_USER_ID, UserStatus } from './constants/user.constants';

jest.mock('env-configs', () => ({ Environments: { FE_BASE_URL: 'http://localhost' } }), {
  virtual: true,
});
jest.mock('../notifications/notification.service', () => ({ NotificationService: class {} }));
jest.mock('../common/email/email.service', () => ({ EmailService: class {} }));
jest.mock('../common/whatsapp/whatsapp.service', () => ({ WhatsAppService: class {} }));
jest.mock('../common/file-upload/files.service', () => ({ FilesService: class {} }));
jest.mock('../salary-structures/salary-structure.service', () => ({
  SalaryStructureService: class {},
}));
jest.mock('../leave-balances/leave-credit.service', () => ({ LeaveCreditService: class {} }));

const ADMIN = {
  id: 'admin-id',
  email: 'a@x.com',
  roles: ['ADMIN'],
  activeRole: 'ADMIN',
  role: 'ADMIN',
};
const SUPER_ADMIN = {
  ...ADMIN,
  roles: ['SUPER_ADMIN'],
  activeRole: 'SUPER_ADMIN',
  role: 'SUPER_ADMIN',
};

const dto = {
  firstName: 'Mayank',
  lastName: 'Sharma',
  email: 'mayank@example.com',
  contactNumber: '+919876543210',
  roles: ['ADMIN'],
};

describe('UserService system users', () => {
  let service: UserService;
  let userRepository: any;
  let userRoleService: any;
  let salaryStructureService: any;
  let leaveCreditService: any;
  let emailService: any;

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue({ records: [], totalRecords: 0 }),
      create: jest.fn().mockImplementation(async (user) => ({ id: 'new-id', ...user })),
      update: jest.fn(),
      delete: jest.fn(),
    };
    userRoleService = { create: jest.fn(), findAll: jest.fn().mockResolvedValue([]) };
    salaryStructureService = { create: jest.fn() };
    leaveCreditService = { creditLeavesForNewEmployee: jest.fn() };
    emailService = { sendMail: jest.fn().mockResolvedValue(undefined) };

    const utilityService = {
      generateSecurePassword: () => 'temp-password',
      createHash: (value: string) => `hash:${value}`,
      convertEmptyStringsToNull: (value: unknown) => value,
      getSuccessMessage: () => ({ message: 'ok' }),
    };
    const roleService = { findOne: jest.fn().mockResolvedValue({ id: 'role-id' }) };
    const configurationService = { findOne: jest.fn().mockResolvedValue(null) };
    const dataSource = {
      transaction: (run: (manager: unknown) => unknown) => run({}),
      query: jest.fn().mockResolvedValue([]),
    };

    service = new UserService(
      userRepository,
      utilityService as any,
      configurationService as any,
      {} as any,
      roleService as any,
      userRoleService,
      {} as any,
      {} as any,
      salaryStructureService,
      leaveCreditService,
      dataSource as any,
      {} as any,
      emailService,
      {} as any,
      {} as any,
    );
  });

  describe('createSystemUser', () => {
    it('creates a login-only user with no employee id, salary or leave credit', async () => {
      const result = await service.createSystemUser(dto, undefined, ADMIN);

      expect(result.id).toBe('new-id');
      const saved = userRepository.create.mock.calls[0][0];
      expect(saved.isSystemUser).toBe(true);
      expect(saved.status).toBe(UserStatus.ACTIVE);
      expect(saved.password).toBe('hash:temp-password');
      expect(saved.employeeId).toBeUndefined();
      expect(saved.roles).toBeUndefined();

      expect(userRoleService.create).toHaveBeenCalledWith(
        { userId: 'new-id', roleId: 'role-id' },
        expect.anything(),
      );
      expect(salaryStructureService.create).not.toHaveBeenCalled();
      expect(leaveCreditService.creditLeavesForNewEmployee).not.toHaveBeenCalled();
      expect(emailService.sendMail).toHaveBeenCalledTimes(1);
      const { emailData } = emailService.sendMail.mock.calls[0][0];
      expect(emailData.designation).toBeUndefined();
      expect(emailData.dateOfJoining).toBeUndefined();
    });

    it.each(['EMPLOYEE', 'DRIVER', 'employee'])('rejects the %s role', async (role) => {
      await expect(
        service.createSystemUser({ ...dto, roles: ['ADMIN', role] }, undefined, ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('lets only a Super Admin assign the Super Admin role', async () => {
      const withSuperAdmin = { ...dto, roles: ['SUPER_ADMIN'] };

      await expect(service.createSystemUser(withSuperAdmin, undefined, ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.createSystemUser(withSuperAdmin, undefined, SUPER_ADMIN),
      ).resolves.toBeDefined();
    });

    it('rejects an email held by a soft-deleted user', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'old-id' });

      await expect(service.createSystemUser(dto, undefined, ADMIN)).rejects.toThrow(
        BadRequestException,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
        withDeleted: true,
      });
    });
  });

  it('asks the repository for system users only', async () => {
    await service.findAllSystemUsers({});

    expect(userRepository.findAll).toHaveBeenCalledWith({}, true);
  });

  describe('reads and writes by id', () => {
    it('does not treat an employee id as a system user', async () => {
      await expect(service.getSystemUser('employee-id')).rejects.toThrow(NotFoundException);
      await expect(service.updateSystemUser('employee-id', {}, undefined, ADMIN)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteSystemUser('employee-id', ADMIN)).rejects.toThrow(
        NotFoundException,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'employee-id', isSystemUser: true },
      });
      expect(userRepository.update).not.toHaveBeenCalled();
      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    it('does not expose the internal bot, which carries the same flag', async () => {
      userRepository.findOne.mockResolvedValue({ id: SYSTEM_USER_ID });

      await expect(service.getSystemUser(SYSTEM_USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('stops an Admin from editing or deleting a Super Admin', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'target', status: UserStatus.ARCHIVED });
      userRoleService.findAll.mockResolvedValue([{ role: { name: 'SUPER_ADMIN' } }]);

      await expect(
        service.updateSystemUser('target', { email: 'new@example.com' }, undefined, ADMIN),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.deleteSystemUser('target', ADMIN)).rejects.toThrow(ForbiddenException);
      expect(userRepository.update).not.toHaveBeenCalled();
      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    it('requires archiving before delete', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'target', status: UserStatus.ACTIVE });

      await expect(service.deleteSystemUser('target', ADMIN)).rejects.toThrow(BadRequestException);
      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    it('returns only the basic details and never the password', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'target',
        firstName: 'Mayank',
        password: 'hash',
        accountNumber: '123',
      });
      userRoleService.findAll.mockResolvedValue([{ role: { name: 'ADMIN' } }]);

      const result: any = await service.getSystemUser('target');

      expect(result.firstName).toBe('Mayank');
      expect(result.roles).toEqual([{ name: 'ADMIN' }]);
      expect(result.password).toBeUndefined();
      expect(result.accountNumber).toBeUndefined();
    });
  });

  describe('DTOs', () => {
    const errorsOn = (cls: any, body: object) =>
      validate(plainToInstance(cls, body) as object, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).then((errors) => errors.map((error) => error.property));

    it('accepts the listed fields, with one role sent as a plain multipart value', async () => {
      await expect(errorsOn(CreateSystemUserDto, { ...dto, roles: 'ADMIN' })).resolves.toEqual([]);
    });

    it('needs only name, email, contact number and role', async () => {
      const errors = await errorsOn(CreateSystemUserDto, {});

      expect(errors.sort()).toEqual(['contactNumber', 'email', 'firstName', 'lastName', 'roles']);
    });

    it.each([
      ['salary'],
      ['employeeId'],
      ['isSystemUser'],
      ['accountNumber'],
      ['dateOfBirth'],
      ['dateOfJoining'],
      ['designation'],
    ])(
      'rejects %s on create and update',
      async (field) => {
        const extra = { [field]: 'x' };

        await expect(errorsOn(CreateSystemUserDto, { ...dto, ...extra })).resolves.toEqual([field]);
        await expect(errorsOn(UpdateSystemUserDto, extra)).resolves.toEqual([field]);
      },
    );

    it('update takes a partial body but not roles or the SYSTEM status', async () => {
      await expect(errorsOn(UpdateSystemUserDto, { firstName: 'New' })).resolves.toEqual([]);
      await expect(errorsOn(UpdateSystemUserDto, { status: 'ARCHIVED' })).resolves.toEqual([]);
      await expect(errorsOn(UpdateSystemUserDto, { status: 'SYSTEM' })).resolves.toEqual([
        'status',
      ]);
      await expect(errorsOn(UpdateSystemUserDto, { roles: ['ADMIN'] })).resolves.toEqual(['roles']);
    });
  });
});
