export type Category =
  | "group_updates"
  | "game_updates"
  | "your_turn"
  | "secret_messages"
  | "reminders"
  | "rewards";
export type NotificationPreferences = {
  user_id: string;
  push_enabled: boolean;
  group_updates_enabled: boolean;
  game_updates_enabled: boolean;
  your_turn_enabled: boolean;
  secret_messages_enabled: boolean;
  reminders_enabled: boolean;
  rewards_enabled: boolean;
  preferred_reminder_time: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  updated_at: string;
};
export type UserNotification = {
  id: string;
  user_id: string;
  category: Category;
  template_key: string;
  title: string;
  body: string;
  route: string;
  related_session_id: string | null;
  read_at: string | null;
  created_at: string;
  event_key: string;
};
export type NotificationPage = {
  items: UserNotification[];
  unread_count: number;
};
