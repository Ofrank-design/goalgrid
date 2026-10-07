import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { cleanSearchTerm, containsPattern } from "./search-term";

export interface CommunitySearchResult {
  id: string;
  username: string;
  excerpt: string;
  createdAt: string;
}

/** Search only public community content exposed through the feed view. */
export async function searchCommunityContent(query: string, limit = 8): Promise<CommunitySearchResult[]> {
  const term = cleanSearchTerm(query);
  if (term.length < 2) return [];

  try {
    const sb = await supabaseServer();
    const pattern = containsPattern(term);
    // Two bound filters instead of one interpolated .or() string, so commas, parentheses and dots in user text cannot alter the query.
    const find = (column: "body" | "username") => sb
      .from("posts_feed")
      .select("id,body,created_at,username")
      .ilike(column, pattern)
      .order("created_at", { ascending: false })
      .limit(limit);
    const [byBody, byName] = await Promise.all([find("body"), find("username")]);
    const unique = new Map<string, { id: unknown; body: unknown; created_at: unknown; username: unknown }>();
    for (const row of [...(byBody.data ?? []), ...(byName.data ?? [])]) unique.set(String(row.id), row);
    const data = [...unique.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);

    return data.map((row) => ({
      id: String(row.id),
      username: String(row.username),
      excerpt: String(row.body).replace(/\s+/g, " ").slice(0, 150),
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}
