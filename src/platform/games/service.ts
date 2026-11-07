import { requireSupabase } from "../supabase";
import { gameRegistry } from "./registry";
import type { GameDefinition, GameMetadata } from "./types";
export type CatalogGame = {
  definition: GameDefinition;
  metadata: GameMetadata;
};
export async function loadCatalog(): Promise<CatalogGame[]> {
  const { data, error } = await requireSupabase()
    .from("game_types")
    .select(
      "id,name,description,category,icon_ref,min_players,max_players,availability_status",
    )
    .order("created_at");
  if (error || !data)
    throw new Error("Unable to load games. Check your connection and retry.");
  return data.flatMap((row) => {
    const definition: GameDefinition | undefined = gameRegistry.get(row.id);
    if (!definition) return [];
    return [
      {
        definition,
        metadata: {
          ...row,
          availability_status:
            row.availability_status === "unavailable"
              ? "unavailable"
              : definition.metadata.availability_status === "available"
                ? row.availability_status
                : definition.metadata.availability_status,
        },
      },
    ];
  });
}
