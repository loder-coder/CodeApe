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
  report_count: number;
  is_deleted: boolean;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  body: string;
  author_hash: string;
  created_at: string;
};
