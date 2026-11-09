-- Let signed-in people use the tables through the Data API. Newer Supabase projects don't grant new
-- public tables to the API roles automatically, so without this every request fails with
-- "permission denied" (42501) even though the row-level security policies would allow it.
-- Grants match the policies: what a policy doesn't allow, the role can't even attempt.
-- Households, members and plans are created only by open_plan(); members are added by an invite (later).

grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, update on public.plans to authenticated;
grant select, insert, update, delete on public.saved_schools, public.visits, public.step_progress,
  public.school_notes, public.user_session to authenticated;
