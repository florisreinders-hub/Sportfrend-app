-- Fixes "Opslaan mislukt: je hebt geen toegang tot deze gegevens" when
-- choosing a plan on the Pricing screen.
--
-- Root cause: public.subscriptions had RLS policies for SELECT and UPDATE
-- but none for INSERT. selectPendingPlan()/upsertSubscription() (lib/api.ts)
-- both call .upsert(), which Postgres compiles to
-- `INSERT ... ON CONFLICT (user_id) DO UPDATE` - and Postgres requires
-- INSERT privilege (i.e. a passing INSERT policy) for that statement even
-- when the row already exists and it ends up just updating it, not only
-- when it actually inserts a new row. With no INSERT policy at all, RLS
-- rejected the upsert unconditionally, regardless of whether the user
-- already had a subscriptions row.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once.

drop policy if exists "Users can insert their own subscription" on public.subscriptions;
create policy "Users can insert their own subscription"
  on public.subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Also adds an explicit `with check` to the existing UPDATE policy (it
-- only had `using`) so a row can't be updated to point at a different
-- user_id either - the same belt-and-suspenders pattern already used for
-- swipes/profiles elsewhere in 0001_init.sql.
drop policy if exists "Users can update their own subscription" on public.subscriptions;
create policy "Users can update their own subscription"
  on public.subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
