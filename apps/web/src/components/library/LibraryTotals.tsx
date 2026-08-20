"use client";

import { Box, Grid } from "@radix-ui/themes";
import { TimeStat } from "@/components/TimeStat";
import { useLibraryCounts } from "./LibraryCounts";

/**
 * The watch-time totals row, reading from the counts context so un/marking
 * a movie in the list below rolls the figures live (the page itself never
 * revalidates, ADR-0012). Layout notes live where the grid was born: six
 * columns keep the rhythm the cells had beside the old count stats, but
 * only from md where the capped container makes a cell 133px; below that
 * three columns down to xs, and full-width rows on phones (see TimeStat).
 */
export function LibraryTotals() {
  const { episodeMinutes, movieMinutes } = useLibraryCounts();
  return (
    <Grid
      columns={{ initial: "1", xs: "3", md: "6" }}
      gapX="4"
      gapY={{ initial: "1", xs: "4" }}
    >
      <TimeStat label="Show time" minutes={episodeMinutes} />
      <TimeStat label="Movie time" minutes={movieMinutes} />
      {/* On phones the stats stack like a column of figures being added,
          so the addends sit tight and the total stands slightly apart —
          the sum line. From xs they are side by side and the offset would
          only break the row's alignment. */}
      <Box mt={{ initial: "2", xs: "0" }}>
        <TimeStat
          label="Total time"
          minutes={episodeMinutes + movieMinutes}
          highlight
        />
      </Box>
    </Grid>
  );
}
