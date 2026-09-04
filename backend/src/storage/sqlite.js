import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { hammingDistance } from "../checks/dedupe.js";

/** Persistent perceptual-hash history. SQLite keeps duplicate protection
 * intact across process restarts without adding a separate service. */
export class DuplicateHashStore {
  constructor(filename = process.env.PLOTPROOF_DB_PATH || "data/plotproof.sqlite") {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS submitted_hashes (
        dhash TEXT PRIMARY KEY,
        plot_id TEXT NOT NULL,
        submitted_at INTEGER NOT NULL
      )
    `);
    this.allHashes = this.db.prepare("SELECT dhash, plot_id AS plotId FROM submitted_hashes");
    this.insertHash = this.db.prepare(
      "INSERT INTO submitted_hashes (dhash, plot_id, submitted_at) VALUES (?, ?, ?)"
    );
  }

  checkDuplicate(newHash, threshold = 8) {
    for (const { dhash, plotId } of this.allHashes.all()) {
      const distance = hammingDistance(newHash, dhash);
      if (distance <= threshold) {
        return {
          pass: false,
          reason: `Image matches a previous submission (plot ${plotId}, distance ${distance}/64)`,
        };
      }
    }
    return { pass: true, reason: "No matching prior submission found" };
  }

  recordHash(hash, plotId) {
    this.insertHash.run(hash, plotId, Date.now());
  }

  close() {
    this.db.close();
  }
}
