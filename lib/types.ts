export type Board = {
  id: string;
  name: string;
  path: string;
  ext: string;
};

export type Post = {
  id: string;
  board: string;
  title: string;
  body: string;
  file_ext: string;
  author_hash: string;
  ip_hash?: string;
  report_count: number;
  is_deleted: boolean;
  is_hidden?: boolean;
  created_at: string;
  isDraft?: boolean;
};

export type Comment = {
  id: string;
  post_id: string;
  parent_id?: string | null;
  body: string;
  author_hash: string;
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_hash: string;
  actor_hash: string;
  post_id: string;
  comment_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type AdminEvent = {
  id: string;
  event_type: string;
  post_id: string | null;
  author_hash: string | null;
  ip_hash: string | null;
  message: string;
  created_at: string;
};

export type BlockedIdentity = {
  id: string;
  kind: "author_hash" | "ip_hash";
  value: string;
  reason: string | null;
  created_at: string;
};

export type ForbiddenWord = {
  id: string;
  term: string;
  is_active: boolean;
  created_at: string;
};
