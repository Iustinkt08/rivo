import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { StaffAuthService } from './staff-auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StaffAuthService', () => {
  let service: StaffAuthService;

  const prismaMock = {
    staff: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
  const configMock = {
    get: jest.fn().mockReturnValue('test-secret-at-least-32-chars-long!!'),
  };

  const PASSWORD = 'parola-sigura';
  let staffRow: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    staffRow = {
      id: 'staff-1',
      salonId: 'salon-1',
      userId: 'user-9',
      username: 'ana.pop',
      passwordHash: bcrypt.hashSync(PASSWORD, 4),
      firstName: 'Ana',
      lastName: 'Pop',
      specialty: 'Hairstylist',
      avatarEmoji: '💇',
      avatarUrl: null,
      isActive: true,
      salon: { id: 'salon-1', name: 'Salon' },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffAuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<StaffAuthService>(StaffAuthService);
    service.onModuleInit();

    prismaMock.staff.findUnique.mockResolvedValue(staffRow);
  });

  it('logs in with valid credentials and returns a verifiable token', async () => {
    // Act
    const result = await service.login('Ana.Pop ', PASSWORD); // normalized

    // Assert
    expect(result.staff).toMatchObject({ id: 'staff-1', salonId: 'salon-1' });
    expect(result.salon).toEqual({ id: 'salon-1', name: 'Salon' });
    const payload = await service.verifyToken(result.accessToken);
    expect(payload).toMatchObject({
      sub: 'user-9',
      role: 'STAFF_MEMBER',
      staffId: 'staff-1',
      salonId: 'salon-1',
    });
  });

  it('rejects a wrong password with a generic message', async () => {
    await expect(service.login('ana.pop', 'gresit')).rejects.toThrow(
      new UnauthorizedException('Invalid credentials'),
    );
  });

  it('rejects an unknown username with the same generic message', async () => {
    // Arrange
    prismaMock.staff.findUnique.mockResolvedValue(null);

    // Act + Assert
    await expect(service.login('nimeni', PASSWORD)).rejects.toThrow(
      new UnauthorizedException('Invalid credentials'),
    );
  });

  it('rejects inactive staff or staff without a linked user', async () => {
    // Arrange
    prismaMock.staff.findUnique.mockResolvedValue({
      ...staffRow,
      isActive: false,
    });

    // Act + Assert
    await expect(service.login('ana.pop', PASSWORD)).rejects.toThrow(
      new UnauthorizedException('Invalid credentials'),
    );
  });

  it('rejects a tampered token', async () => {
    // Arrange
    const { accessToken } = await service.login('ana.pop', PASSWORD);
    const tampered = accessToken.slice(0, -3) + 'abc';

    // Act + Assert
    await expect(service.verifyToken(tampered)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('changes the password only when the current one matches', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue(staffRow);
    prismaMock.staff.update.mockResolvedValue({});

    // Act
    await service.changePassword('user-9', PASSWORD, 'parola-noua-123');

    // Assert
    const update = prismaMock.staff.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'staff-1' });
    expect(
      bcrypt.compareSync('parola-noua-123', update.data.passwordHash),
    ).toBe(true);

    // Wrong current password
    await expect(
      service.changePassword('user-9', 'gresit', 'alta-parola-123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
