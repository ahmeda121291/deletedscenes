export type PieceType = "essay" | "story" | "movie" | "misc";
export type PieceStatus = "draft" | "unlisted" | "published";
export type DevelopIntensity = "cleanup" | "shape" | "cut";
export type ChunkPosition = "only" | "first" | "middle" | "last";

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface TmdbInfo {
  tmdb_id: number;
  media_type?: "movie" | "tv";
  year: string | null;
  /** Director for movies; creator for TV shows. */
  director: string | null;
  original_title?: string | null;
}

export interface Piece {
  id: string;
  title: string;
  slug: string;
  type: PieceType;
  collection_id: string | null;
  raw_content: string | null;
  developed_content: string | null;
  excerpt: string | null;
  tags: string[];
  status: PieceStatus;
  show_raw: boolean;
  word_count: number;
  view_count: number;
  tmdb: TmdbInfo | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The columns the public site selects — everything except view_count,
 * which the anon role cannot read (column-level grant). */
export const PUBLIC_PIECE_COLUMNS =
  "id, title, slug, type, collection_id, developed_content, raw_content, excerpt, tags, status, show_raw, word_count, tmdb, published_at, created_at, updated_at";

export type PublicPiece = Omit<Piece, "view_count">;

export interface PieceVersion {
  id: string;
  piece_id: string;
  developed_content: string | null;
  created_at: string;
}

export interface MediaItem {
  id: string;
  piece_id: string | null;
  storage_path: string;
  type: "image" | "video";
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface RantMessage {
  role: "writer";
  text: string;
  ts: string;
}

export interface DarkroomSession {
  id: string;
  piece_id: string | null;
  messages: RantMessage[];
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  id: number;
  epigraph: string | null;
  about_md: string | null;
}

export interface DevelopMeta {
  titles: string[];
  tags: string[];
  suggested_collection: string;
  excerpt: string;
}
