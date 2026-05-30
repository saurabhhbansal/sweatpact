export type Profile = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  profile_visibility: "public" | "private";
  avatar_url: string | null;
  onboarding_complete: boolean;
  timezone: string;
  gender: "male" | "female";
  gym_lat: number | null;
  gym_lng: number | null;
  gym_radius_m: number;
  weekly_goal: number;
  rest_days: number[];
  period_sync_enabled: boolean;
  period_last_synced_at: string | null;
  notify_unverified_checkin: boolean;
  notify_rest_day: boolean;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type:
    | "challenge_invite_received"
    | "challenge_accepted"
    | "challenge_declined"
    | "challenge_cancelled"
    | "settlement_marked"
    | "penalty_added"
    | "group_checkin"
    | "group_rest_day";
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type ChallengeInvitation = {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  penalty_cents: number;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  created_at: string;
  responded_at: string | null;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  default_penalty_cents: number;
  invite_code: string;
  checkin_notifications: boolean;
  created_at: string;
};

export type CheckinStatus = "verified" | "unverified" | "sick_day" | "gym_closed" | "rest_day" | "period_day" | "rejected";
export type DailyStatus = CheckinStatus | "missed";

export type CheckinEvent = {
  id: string;
  submission_id: string;
  user_id: string;
  group_id: string | null;
  occurred_at: string;
  local_day: string;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
  status: CheckinStatus;
  source: "shortcut" | "manual" | "admin";
};

export type Obligation = {
  id: string;
  penalty_event_id: string | null;
  group_id: string | null;
  from_user: string;
  to_user: string;
  amount_cents: number;
  status: "pending" | "settled" | "disputed" | "voided";
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  penalty_cents: number | null;
  joined_at: string;
};
