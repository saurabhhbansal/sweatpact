import type { SupabaseClient } from "@supabase/supabase-js";
import { listUserMemberships, normalizeRelation } from "@/lib/groups";
import { sendPushToUser } from "@/lib/push";

type ActivityStatus = "verified" | "unverified" | "rest_day";

/**
 * Notifies the other members of the actor's challenges that the actor logged
 * activity today. Gating:
 *   - verified check-in  → per-group `checkin_notifications` flag
 *   - unverified check-in → per-group flag AND actor's `notify_unverified_checkin`
 *   - rest day            → actor's `notify_rest_day`
 *
 * Best-effort: never throws. A failure here must not break the check-in itself.
 */
export async function notifyGroupCheckin(
  admin: SupabaseClient,
  params: { actorId: string; status: ActivityStatus; localDay: string }
): Promise<void> {
  const { actorId, status, localDay } = params;
  try {
    const { data: actor } = await admin
      .from("profiles")
      .select("name, username, notify_unverified_checkin, notify_rest_day")
      .eq("id", actorId)
      .maybeSingle();

    // Respect per-user opt-outs.
    if (status === "unverified" && actor && actor.notify_unverified_checkin === false) {
      return;
    }
    if (status === "rest_day" && actor && actor.notify_rest_day === false) {
      return;
    }

    const actorName =
      actor?.name?.trim() ||
      (actor?.username ? `@${actor.username}` : "Someone");

    const memberships = await listUserMemberships(admin, actorId);

    // Which groups should this activity broadcast to?
    const enabledGroups = memberships.filter((membership) => {
      const group = normalizeRelation(membership.group);
      if (!group) return false;
      if (status === "rest_day") {
        // Rest-day broadcast is the user's choice (already checked above).
        return true;
      }
      // Verified / unverified check-ins respect the per-group toggle.
      return group.checkin_notifications !== false;
    });

    if (enabledGroups.length === 0) return;

    const groupIds = enabledGroups.map((m) => m.group_id);

    // All recipients (every member of those groups except the actor).
    const { data: members } = await admin
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds)
      .neq("user_id", actorId);

    if (!members || members.length === 0) return;

    const type = status === "rest_day" ? "group_rest_day" : "group_checkin";

    const verb =
      status === "rest_day"
        ? "took a rest day"
        : status === "unverified"
          ? "logged an unverified check-in"
          : "checked in";

    const notificationRows = members.map((member) => ({
      user_id: member.user_id,
      type,
      payload: {
        group_id: member.group_id,
        actor_id: actorId,
        actor_name: actor?.name ?? null,
        actor_username: actor?.username ?? null,
        status,
      },
    }));

    if (notificationRows.length > 0) {
      await admin.from("notifications").insert(notificationRows);
    }

    await Promise.all(
      members.map((member) =>
        sendPushToUser(admin, member.user_id, {
          title: "SweatPact",
          body: `${actorName} ${verb}`,
          url: `/groups/${member.group_id}`,
          tag: `group-checkin-${member.group_id}-${localDay}`,
        })
      )
    );
  } catch {
    // Swallow — notifications are best-effort.
  }
}
