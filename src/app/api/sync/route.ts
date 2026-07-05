import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

// Dumb encrypted vault with compare-and-swap versioning. The client
// derives `id` from its pairing code; `data` is an AES-GCM blob the
// server cannot decrypt. Knowing an id neither reveals the code nor
// the plaintext.

const ID_RE = /^[0-9a-f]{64}$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_DATA_LENGTH = 512_000;

function bad(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: {
    id?: unknown;
    action?: unknown;
    version?: unknown;
    data?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON");
  }

  const { id, action } = body;
  if (typeof id !== "string" || !ID_RE.test(id)) return bad("Invalid sync id");

  const db = await getDb();

  if (action === "pull") {
    const result = await db.execute({
      sql: "SELECT version, data FROM sync_blobs WHERE id = ?",
      args: [id],
    });
    const row = result.rows[0];
    return NextResponse.json({
      ok: true,
      version: row ? Number(row.version) : 0,
      data: row ? String(row.data) : null,
    });
  }

  if (action === "push") {
    const { version, data } = body;
    if (
      typeof version !== "number" ||
      !Number.isInteger(version) ||
      version < 0
    ) {
      return bad("Invalid version");
    }
    if (
      typeof data !== "string" ||
      data.length === 0 ||
      data.length > MAX_DATA_LENGTH ||
      !BASE64_RE.test(data)
    ) {
      return bad("Invalid data");
    }

    const now = new Date().toISOString();
    if (version === 0) {
      try {
        await db.execute({
          sql: "INSERT INTO sync_blobs (id, version, data, updated_at) VALUES (?, 1, ?, ?)",
          args: [id, data, now],
        });
        return NextResponse.json({ ok: true, version: 1 });
      } catch {
        // Row already exists — fall through to the conflict response.
      }
    } else {
      const result = await db.execute({
        sql: "UPDATE sync_blobs SET version = version + 1, data = ?, updated_at = ? WHERE id = ? AND version = ?",
        args: [data, now, id, version],
      });
      if (result.rowsAffected === 1) {
        return NextResponse.json({ ok: true, version: version + 1 });
      }
    }

    const current = await db.execute({
      sql: "SELECT version, data FROM sync_blobs WHERE id = ?",
      args: [id],
    });
    const row = current.rows[0];
    return NextResponse.json(
      {
        ok: false,
        error: "conflict",
        version: row ? Number(row.version) : 0,
        data: row ? String(row.data) : null,
      },
      { status: 409 },
    );
  }

  if (action === "delete") {
    await db.execute({
      sql: "DELETE FROM sync_blobs WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ ok: true });
  }

  return bad("Unknown action");
}
