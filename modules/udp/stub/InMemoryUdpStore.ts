import type { UserDataResponse } from '../domain/models/UserData';

type UserDataRecord = UserDataResponse;

const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class InMemoryUdpStore {
  private readonly store = new Map<string, UserDataRecord>();

  constructor(initialRecords: UserDataRecord[] = []) {
    this.replaceAll(initialRecords);
  }

  get(userId: string): UserDataRecord | undefined {
    const record = this.store.get(userId);
    return record
      ? { userId: record.userId, data: clone(record.data) }
      : undefined;
  }

  upsert(userId: string, data: Record<string, unknown>): UserDataRecord {
    const nextRecord: UserDataRecord = {
      userId,
      data: clone(data),
    };

    this.store.set(userId, nextRecord);
    return this.get(userId) as UserDataRecord;
  }

  delete(userId: string): boolean {
    return this.store.delete(userId);
  }

  replaceAll(records: UserDataRecord[] = []): void {
    this.store.clear();

    records.forEach((record) => {
      if (!record?.userId || !isRecord(record.data)) {
        return;
      }

      this.store.set(record.userId, {
        userId: record.userId,
        data: clone(record.data),
      });
    });
  }
}

export const parseSeedData = (
  rawSeed?: string,
  logger: Pick<Console, 'warn'> = console,
): UserDataRecord[] => {
  if (!rawSeed) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawSeed);

    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (entry): entry is UserDataRecord =>
            typeof entry?.userId === 'string' && isRecord(entry.data),
        )
        .map((entry) => ({
          userId: entry.userId,
          data: clone(entry.data),
        }));
    }

    if (isRecord(parsed)) {
      return Object.entries(parsed)
        .filter(([userId]) => typeof userId === 'string')
        .map(([userId, value]) => ({
          userId,
          data: isRecord(value) ? clone(value) : {},
        }));
    }

    return [];
  } catch (error) {
    logger.warn(
      'UDP stub: Unable to parse UDP_STUB_SEED_DATA. Falling back to empty store.',
      error,
    );
    return [];
  }
};

export const createStoreFromSeed = (seed?: string): InMemoryUdpStore =>
  new InMemoryUdpStore(parseSeedData(seed));
