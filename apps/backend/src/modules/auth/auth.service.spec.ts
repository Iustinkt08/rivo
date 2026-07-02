import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService — completeProfile role clamp', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const USER_ID = 'user-1';
  const dtoBase = { firstName: 'Ana', lastName: 'Pop' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    prismaMock.user.update.mockResolvedValue({ id: USER_ID });
  });

  const roleSentToUpdate = () =>
    prismaMock.user.update.mock.calls[0][0].data.role;

  it('never persists a self-assigned SUPER_ADMIN role', async () => {
    // Arrange — DTO validation already rejects this; defense in depth.
    prismaMock.user.findUnique.mockResolvedValue({ role: UserRole.CLIENT });

    // Act
    await service.completeProfile(USER_ID, {
      ...dtoBase,
      role: UserRole.SUPER_ADMIN,
    } as any);

    // Assert
    expect(roleSentToUpdate()).toBe(UserRole.CLIENT);
  });

  it('preserves a STAFF_MEMBER role even when ADMIN_SALON is requested', async () => {
    // Arrange
    prismaMock.user.findUnique.mockResolvedValue({
      role: UserRole.STAFF_MEMBER,
    });

    // Act
    await service.completeProfile(USER_ID, {
      ...dtoBase,
      role: UserRole.ADMIN_SALON,
    } as any);

    // Assert
    expect(roleSentToUpdate()).toBe(UserRole.STAFF_MEMBER);
  });

  it('keeps the current role when none is requested (no silent downgrade)', async () => {
    // Arrange
    prismaMock.user.findUnique.mockResolvedValue({
      role: UserRole.ADMIN_SALON,
    });

    // Act
    await service.completeProfile(USER_ID, { ...dtoBase } as any);

    // Assert
    expect(roleSentToUpdate()).toBe(UserRole.ADMIN_SALON);
  });

  it('allows a CLIENT to become ADMIN_SALON (legitimate business signup)', async () => {
    // Arrange
    prismaMock.user.findUnique.mockResolvedValue({ role: UserRole.CLIENT });

    // Act
    await service.completeProfile(USER_ID, {
      ...dtoBase,
      role: UserRole.ADMIN_SALON,
    } as any);

    // Assert
    expect(roleSentToUpdate()).toBe(UserRole.ADMIN_SALON);
  });
});
