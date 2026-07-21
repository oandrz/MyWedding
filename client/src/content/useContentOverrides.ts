import { useQuery } from "@tanstack/react-query";

export interface ContentOverrideRow {
  key: string;
  locale: string;
  value: string;
}

export type OverrideMap = Record<string, Record<string, string>>; // [locale][key] = value

export function buildOverrideMap(rows: ContentOverrideRow[]): OverrideMap {
  const map: OverrideMap = {};
  for (const r of rows) {
    if (!r.value) continue; // empty => fall back to default
    (map[r.locale] ??= {})[r.key] = r.value;
  }
  return map;
}

export function useContentOverrides(): { map: OverrideMap; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ overrides: ContentOverrideRow[] }>({
    queryKey: ["/api/content-overrides"],
  });
  const map = buildOverrideMap(data?.overrides ?? []);
  return { map, isLoading };
}
