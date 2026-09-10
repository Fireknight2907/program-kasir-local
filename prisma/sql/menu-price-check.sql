-- Applied 2026-09-10 after confirming no negative menu prices existed.
-- Run once per installation; never silently rewrite historical prices.
ALTER TABLE public."MenuItem" ADD CONSTRAINT "MenuItem_price_nonnegative" CHECK (price >= 0);
