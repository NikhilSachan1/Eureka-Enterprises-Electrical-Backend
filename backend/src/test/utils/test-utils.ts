import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserEntity } from '../../modules/users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

export const createTestingModule = async (metadata: ModuleMetadata): Promise<TestingModule> => {
  return Test.createTestingModule(metadata).compile();
};

export const createMockService = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

export const createMockUser = (overrides = {}): UserEntity => {
  const user = new UserEntity();
  Object.assign(user, {
    id: uuidv4(),
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword123',
    is_verified: false,
    verification_token: null,
    profile_picture_url: null,
    password_updated_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  });
  return user;
};

export const createAuthenticatedRequest = (user = createMockUser()) => ({
  user,
});
