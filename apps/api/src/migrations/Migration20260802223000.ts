import { Migration } from '@mikro-orm/migrations';

/**
 * Engagement team roles: Partner/Manager/Auditor → Lead/Member.
 * One Lead per engagement (app-enforced); migrate Managers and backfill creators.
 */
export class Migration20260802223000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "engagement_team_members" drop constraint if exists "engagement_team_members_member_role_check";`,
    );

    // Promote earliest Manager per engagement to Lead.
    this.addSql(`
      update "engagement_team_members" tm
      set "member_role" = 'Lead'
      from (
        select distinct on ("engagement_id") "engagement_id", "user_id"
        from "engagement_team_members"
        where "member_role" = 'Manager'
        order by "engagement_id", "assigned_at" asc, "user_id" asc
      ) first_mgr
      where tm."engagement_id" = first_mgr."engagement_id"
        and tm."user_id" = first_mgr."user_id";
    `);

    // Remaining legacy roles → Member.
    this.addSql(`
      update "engagement_team_members"
      set "member_role" = 'Member'
      where "member_role" in ('Partner', 'Manager', 'Auditor');
    `);

    // If creator is already on the team and there is no Lead, promote them.
    this.addSql(`
      update "engagement_team_members" tm
      set "member_role" = 'Lead'
      from "engagements" e
      where tm."engagement_id" = e."id"
        and e."created_by_id" is not null
        and tm."user_id" = e."created_by_id"
        and not exists (
          select 1 from "engagement_team_members" x
          where x."engagement_id" = e."id" and x."member_role" = 'Lead'
        );
    `);

    // Otherwise insert creator as Lead when missing.
    this.addSql(`
      insert into "engagement_team_members" (
        "engagement_id", "user_id", "member_role", "assigned_by_id", "assigned_at"
      )
      select e."id", e."created_by_id", 'Lead', e."created_by_id", now()
      from "engagements" e
      where e."created_by_id" is not null
        and not exists (
          select 1 from "engagement_team_members" tm
          where tm."engagement_id" = e."id" and tm."member_role" = 'Lead'
        )
        and not exists (
          select 1 from "engagement_team_members" tm
          where tm."engagement_id" = e."id" and tm."user_id" = e."created_by_id"
        );
    `);

    this.addSql(`
      alter table "engagement_team_members"
      add constraint "engagement_team_members_member_role_check"
      check ("member_role" in ('Lead', 'Member'));
    `);
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "engagement_team_members" drop constraint if exists "engagement_team_members_member_role_check";`,
    );

    this.addSql(`
      update "engagement_team_members"
      set "member_role" = 'Manager'
      where "member_role" = 'Lead';
    `);
    this.addSql(`
      update "engagement_team_members"
      set "member_role" = 'Auditor'
      where "member_role" = 'Member';
    `);

    this.addSql(`
      alter table "engagement_team_members"
      add constraint "engagement_team_members_member_role_check"
      check ("member_role" in ('Partner', 'Manager', 'Auditor'));
    `);
  }
}
