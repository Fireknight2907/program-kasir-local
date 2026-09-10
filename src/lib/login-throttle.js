import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
export async function allowLogin(username) {
  const key = createHash('sha256').update(username).digest('hex');
  const rows = await prisma.$queryRaw`
    INSERT INTO "LoginThrottle" ("key", "count", "expiresAt") VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginThrottle"."expiresAt" <= NOW() THEN 1 ELSE LEAST("LoginThrottle"."count" + 1, 11) END,
      "expiresAt" = CASE WHEN "LoginThrottle"."expiresAt" <= NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "LoginThrottle"."expiresAt" END
    RETURNING "count"
  `;
  return rows[0].count <= 10;
}

export async function clearLoginAttempts(username) {
  const key = createHash('sha256').update(username).digest('hex');
  await prisma.loginThrottle.deleteMany({where:{key}});
}
