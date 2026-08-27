import type { ErrorCode, SerializedError } from '../models/messages';

/**
 * Thai copy shown to the user. Every code maps to something the user can act on,
 * rather than to a stack trace they cannot.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  RATE_LIMITED: 'Roblox กำลังจำกัด request — รอสักครู่แล้วลองใหม่',
  NOT_AUTHENTICATED: 'ยังไม่ได้ล็อกอิน roblox.com — โควต้าถูกจำกัดเหลือ 3 ครั้ง/นาที',
  NOT_LOGGED_IN: 'ต้องล็อกอิน roblox.com ก่อนถึงจะเข้าเซิร์ฟเวอร์ได้',
  NO_ROBLOX_TAB: 'ต้องเปิดหน้า roblox.com ค้างไว้อย่างน้อย 1 แท็บ',
  NETWORK: 'เชื่อมต่อไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่',
  API_ERROR: 'โหลดรายชื่อเซิร์ฟเวอร์ไม่สำเร็จ',
  NO_SERVERS: 'ไม่พบเซิร์ฟเวอร์ที่ตรงกับเงื่อนไข',
  SERVER_GONE: 'เซิร์ฟเวอร์นี้หายไปแล้ว',
  JOIN_FAILED: 'เปิด Roblox เข้าเซิร์ฟเวอร์ไม่สำเร็จ',
  LAUNCHER_MISSING: 'ไม่พบตัวเปิดเกมของ Roblox ในหน้านี้',
  NO_EXPERIENCE: 'เปิดหน้าเกมของ Roblox ก่อน',
  USER_NOT_FOUND: 'ไม่พบผู้ใช้ชื่อนี้',
  TIMEOUT: 'หมดเวลารอการตอบกลับ',
  INTERNAL: 'เกิดข้อผิดพลาดภายใน',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryAfterMs?: number;
  readonly httpStatus?: number;

  constructor(
    code: ErrorCode,
    message?: string,
    opts: { retryAfterMs?: number; httpStatus?: number; cause?: unknown } = {},
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    if (opts.retryAfterMs !== undefined) this.retryAfterMs = opts.retryAfterMs;
    if (opts.httpStatus !== undefined) this.httpStatus = opts.httpStatus;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }

  toJSON(): SerializedError {
    const out: SerializedError = { code: this.code, message: this.message };
    if (this.retryAfterMs !== undefined) out.retryAfterMs = this.retryAfterMs;
    if (this.httpStatus !== undefined) out.httpStatus = this.httpStatus;
    return out;
  }

  static from(err: unknown): AppError {
    if (err instanceof AppError) return err;
    if (err instanceof Error) {
      // A bare "Failed to fetch" is what an offline or blocked request looks like.
      const offline = /failed to fetch|networkerror|load failed/i.test(err.message);
      return new AppError(offline ? 'NETWORK' : 'INTERNAL', err.message, { cause: err });
    }
    return new AppError('INTERNAL', String(err));
  }
}

export function serializeError(err: unknown): SerializedError {
  return AppError.from(err).toJSON();
}

/** Rebuilds an AppError on the receiving side of a message boundary. */
export function deserializeError(payload: SerializedError): AppError {
  const opts: { retryAfterMs?: number; httpStatus?: number } = {};
  if (payload.retryAfterMs !== undefined) opts.retryAfterMs = payload.retryAfterMs;
  if (payload.httpStatus !== undefined) opts.httpStatus = payload.httpStatus;
  return new AppError(payload.code, payload.message, opts);
}
