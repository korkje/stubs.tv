// Types generated from the Supabase schema. Regenerate after every migration:
//   npm run generate -w @stubs/db     (requires a running local Supabase)
export type { Database, Json } from "./database.types";

import type { Database } from "./database.types";

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export type Series = Tables<"series">;
export type Season = Tables<"seasons">;
export type Episode = Tables<"episodes">;
export type Movie = Tables<"movies">;
export type Person = Tables<"people">;
export type Profile = Tables<"profiles">;
