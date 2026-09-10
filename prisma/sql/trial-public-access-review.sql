-- Applied 2026-09-10: eight application tables; server Prisma access verified.
-- The application currently connects via Prisma using a bypass-RLS server role.
-- This does not fix the separate public Storage INSERT policy.
-- After application, re-test Next.js routes and anonymous Data API denial.
BEGIN;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LoginThrottle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."User", public."Transaction", public."Order",
  public."OrderItem", public."OrderSubmission", public."LoginThrottle",
  public."MenuItem", public."Category" FROM anon, authenticated;
COMMIT;
