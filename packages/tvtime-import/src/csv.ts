// Minimal RFC 4180 CSV reader. Hand-rolled rather than a dependency because
// the whole importer ships to the browser (ADR-0015) and the format surface
// we need is small: quoted fields, embedded commas/quotes/newlines, CRLF.
// Returns rows as objects keyed by the header row.

export interface CsvRow {
  /** 1-based line number of the row's first physical line, for reporting. */
  line: number;
  cells: Record<string, string>;
}

/** A structurally broken row (wrong cell count), kept for the skip report. */
export interface MalformedRow {
  line: number;
  cellCount: number;
  expected: number;
}

export interface CsvResult {
  header: string[];
  rows: CsvRow[];
  malformed: MalformedRow[];
}

export function parseCsv(text: string): CsvResult {
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let sawAnything = false;

  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    records.push({ line: recordLine, cells });
    cells = [];
    recordLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    sawAnything = true;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === ",") {
      endCell();
    } else if (ch === "\n") {
      line++;
      endRecord();
    } else if (ch === "\r") {
      // Consumed here; the \n that usually follows ends the record.
      if (text[i + 1] !== "\n") {
        line++;
        endRecord();
      }
    } else {
      cell += ch;
    }
  }
  // A final record without a trailing newline still counts.
  if (cell !== "" || cells.length > 0 || (sawAnything && records.length === 0)) {
    endRecord();
  }

  if (records.length === 0) return { header: [], rows: [], malformed: [] };

  const header = records[0].cells.map((h) => h.trim());
  const rows: CsvRow[] = [];
  const malformed: MalformedRow[] = [];
  for (const record of records.slice(1)) {
    // Fully empty trailing lines are noise, not data loss.
    if (record.cells.length === 1 && record.cells[0].trim() === "") continue;
    if (record.cells.length !== header.length) {
      malformed.push({
        line: record.line,
        cellCount: record.cells.length,
        expected: header.length,
      });
      continue;
    }
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = record.cells[c];
    rows.push({ line: record.line, cells: obj });
  }
  return { header, rows, malformed };
}
