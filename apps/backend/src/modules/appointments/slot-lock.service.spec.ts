import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, Logger } from '@nestjs/common';
import { SlotLockService } from './slot-lock.service';

describe('SlotLockService — Redis degradation', () => {
  let service: SlotLockService;

  const redisMock = {
    set: jest.fn(),
    get: jest.fn(),
    eval: jest.fn(),
    ttl: jest.fn(),
  };

  const SALON = 'salon-1';
  const STAFF = 'staff-1';
  const START = new Date('2026-07-10T10:00:00.000Z');
  const SESSION = 'session-1';
  const CONN_ERROR = new Error('connect ECONNREFUSED 127.0.0.1:6379');

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotLockService,
        { provide: 'REDIS_CLIENT', useValue: redisMock },
      ],
    }).compile();

    service = module.get<SlotLockService>(SlotLockService);
  });

  it('isLocked returns false when Redis is unreachable (fail-open)', async () => {
    // Arrange
    redisMock.get.mockRejectedValue(CONN_ERROR);

    // Act + Assert — availability must keep working without Redis
    await expect(service.isLocked(SALON, STAFF, START)).resolves.toBe(false);
  });

  it('acquireLock proceeds when Redis is unreachable (DB overlap check remains the real guard)', async () => {
    // Arrange
    redisMock.set.mockRejectedValue(CONN_ERROR);

    // Act + Assert
    await expect(
      service.acquireLock(SALON, STAFF, START, SESSION),
    ).resolves.toContain('slotlock:');
  });

  it('acquireLock still rejects a slot held by another session when Redis works', async () => {
    // Arrange
    redisMock.set.mockResolvedValue(null); // NX failed — key exists
    redisMock.get.mockResolvedValue('someone-else');

    // Act + Assert
    await expect(
      service.acquireLock(SALON, STAFF, START, SESSION),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('releaseLock swallows Redis connection errors', async () => {
    // Arrange
    redisMock.eval.mockRejectedValue(CONN_ERROR);

    // Act + Assert
    await expect(
      service.releaseLock(SALON, STAFF, START, SESSION),
    ).resolves.toBeUndefined();
  });

  it('getLockTtl returns null when Redis is unreachable', async () => {
    // Arrange
    redisMock.ttl.mockRejectedValue(CONN_ERROR);

    // Act + Assert
    await expect(service.getLockTtl(SALON, STAFF, START)).resolves.toBeNull();
  });
});
