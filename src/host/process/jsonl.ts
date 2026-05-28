export interface JsonlFramer {
  push(chunk: Buffer | string): unknown[];
}

export function createJsonlFramer(): JsonlFramer {
  let buffer = "";

  return {
    push(chunk) {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      return takeJsonlEntries(
        () => buffer,
        (nextBuffer) => {
          buffer = nextBuffer;
        },
      );
    },
  };
}

function takeJsonlEntries(read: () => string, write: (value: string) => void): unknown[] {
  const payloads: unknown[] = [];
  let working = read();

  while (true) {
    const newlineIndex = working.indexOf("\n");
    if (newlineIndex < 0) break;

    const line = working.slice(0, newlineIndex).replace(/\r$/, "");
    working = working.slice(newlineIndex + 1);
    if (!line.trim()) continue;

    try {
      payloads.push(JSON.parse(line) as unknown);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSONL payload: ${detail}`);
    }
  }

  write(working);
  return payloads;
}
