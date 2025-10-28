import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("floorplans.db");

// Initialize tables
export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS FloorPlans (
      floorId TEXT PRIMARY KEY,
      name TEXT
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS Nodes (
      nodeId TEXT PRIMARY KEY,
      floorId TEXT,
      x INTEGER,
      y INTEGER,
      type TEXT,
      qrCode TEXT,
      FOREIGN KEY (floorId) REFERENCES FloorPlans(floorId)
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS Edges (
      edgeId INTEGER PRIMARY KEY AUTOINCREMENT,
      fromNodeId TEXT,
      toNodeId TEXT,
      distance REAL,
      FOREIGN KEY (fromNodeId) REFERENCES Nodes(nodeId),
      FOREIGN KEY (toNodeId) REFERENCES Nodes(nodeId)
    );
  `);
}

//
// --- Helper functions ---
//

// FloorPlans
export async function addFloorPlan(floorId: string, name: string) {
  await db.runAsync(
    "INSERT OR REPLACE INTO FloorPlans (floorId, name) VALUES (?, ?)",
    [floorId, name]
  );
}

export async function getFloorPlans() {
  return await db.getAllAsync("SELECT * FROM FloorPlans");
}

// Nodes
export async function addNode(
  nodeId: string,
  floorId: string,
  x: number,
  y: number,
  type: string,
  qrCode?: string
) {
  await db.runAsync(
    "INSERT OR REPLACE INTO Nodes (nodeId, floorId, x, y, type, qrCode) VALUES (?, ?, ?, ?, ?, ?)",
    [nodeId, floorId, x, y, type, qrCode || null]
  );
}

export async function getNodesByFloor(floorId: string) {
  return await db.getAllAsync("SELECT * FROM Nodes WHERE floorId = ?", [floorId]);
}

export async function getNodeByQr(qrCode: string) {
  return await db.getFirstAsync("SELECT * FROM Nodes WHERE qrCode = ?", [qrCode]);
}

// Edges
export async function addEdge(fromNodeId: string, toNodeId: string, distance: number) {
  await db.runAsync(
    "INSERT INTO Edges (fromNodeId, toNodeId, distance) VALUES (?, ?, ?)",
    [fromNodeId, toNodeId, distance]
  );
}

export async function getEdgesByFloor(floorId: string) {
  return await db.getAllAsync(
    `SELECT e.* 
     FROM Edges e 
     JOIN Nodes n ON e.fromNodeId = n.nodeId 
     WHERE n.floorId = ?`,
    [floorId]
  );
}

export default db;
