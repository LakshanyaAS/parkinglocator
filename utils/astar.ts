import { ParkingNode } from '@/contexts/LocationContext';
import { getNearestWalkableNode, getNodeById, parkingEdges, parkingNodes } from './parkingData';
import { MinHeap } from './minheap';

interface AStarNode {
  node: ParkingNode;
  gScore: number;
  hScore: number;
  fScore: number;
  parent: AStarNode | null;
}

export type GraphEdges = { [key: string]: string[] };

export type AStarStats = {
  expandedNodes: number;
  closedSetSize: number;
  openSetPeak: number;
  nodesTotal: number | null;
  exploredPct: number | null;
  pathDistance: number;
  straightLineDistance: number;
  heuristicEnabled: boolean;
};

const FLOOR_HEIGHT = 5;
const VERTICAL_PENALTY = 20;
const PREFERENCE_PENALTY = 50;

const calculateDistance = (
  node1: ParkingNode,
  node2: ParkingNode,
  userPreference?: 'stairs' | 'lift'
): number => {
  const dx = node1.x - node2.x;
  const dy = node1.y - node2.y;
  const dz = (node1.floor - node2.floor) * FLOOR_HEIGHT;

  let cost = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (node1.floor !== node2.floor) {
    cost += VERTICAL_PENALTY;

    if (userPreference === 'stairs' && node2.type === 'lift') {
      cost += PREFERENCE_PENALTY;
    }

    if (userPreference === 'lift' && node2.type === 'stair') {
      cost += PREFERENCE_PENALTY;
    }
  }

  return cost;
};

const reconstructPath = (endNode: AStarNode): ParkingNode[] => {
  const path: ParkingNode[] = [];
  let current: AStarNode | null = endNode;

  while (current) {
    path.unshift(current.node);
    current = current.parent;
  }

  return path;
};

const isWalkableType = (node: ParkingNode) =>
  node.type === 'path' || node.type === 'connection' || node.type === 'lift' || node.type === 'stair';

const toWalkableAnchor = (node: ParkingNode): ParkingNode | null => {
  if (isWalkableType(node)) return node;
  return getNearestWalkableNode(node);
};

const nowMs = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const pathDistance = (
  path: ParkingNode[],
  userPreference?: 'stairs' | 'lift'
): number => {
  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    total += calculateDistance(path[i], path[i + 1], userPreference);
  }
  return total;
};

const runAStarWithStats = (
  start: ParkingNode,
  goal: ParkingNode,
  edges: GraphEdges,
  getNodeByIdLocal: (id: string) => ParkingNode | null,
  options?: {
    heuristicEnabled?: boolean;
    neighborFilter?: (node: ParkingNode) => boolean;
    nodesTotal?: number;
    userPreference?: 'stairs' | 'lift';
  }
): { path: ParkingNode[]; stats: AStarStats } => {
  const heuristicEnabled = options?.heuristicEnabled !== false;

  if (start.id === goal.id) {
    const direct = [start];
    return {
      path: direct,
      stats: {
        expandedNodes: 1,
        closedSetSize: 1,
        openSetPeak: 1,
        nodesTotal: options?.nodesTotal ?? null,
        exploredPct:
          options?.nodesTotal ? (1 / options.nodesTotal) * 100 : null,
        pathDistance: 0,
        straightLineDistance: 0,
        heuristicEnabled,
      },
    };
  }

  const openHeap = new MinHeap<AStarNode>();
  const closedSet = new Set<string>();
  const allNodes = new Map<string, AStarNode>();
  let expandedNodes = 0;
  let openSetPeak = 0;

  const h0 = heuristicEnabled
    ? calculateDistance(start, goal, options?.userPreference)
    : 0;
  const startNode: AStarNode = {
    node: start,
    gScore: 0,
    hScore: h0,
    fScore: h0,
    parent: null,
  };

  allNodes.set(start.id, startNode);
  openHeap.insert(startNode.fScore, startNode);
  openSetPeak = Math.max(openSetPeak, openHeap.size());

  while (!openHeap.isEmpty()) {
    const current = openHeap.extractMin();
    if (!current) break;
    if (closedSet.has(current.node.id)) continue;

    expandedNodes += 1;

    if (current.node.id === goal.id) {
      const path = reconstructPath(current);
      const straightLineDistance = calculateDistance(
        start,
        goal,
        options?.userPreference
      );
      const totalPathDistance = pathDistance(path, options?.userPreference);
      return {
        path,
        stats: {
          expandedNodes,
          closedSetSize: closedSet.size,
          openSetPeak,
          nodesTotal: options?.nodesTotal ?? null,
          exploredPct: options?.nodesTotal
            ? (expandedNodes / options.nodesTotal) * 100
            : null,
          pathDistance: totalPathDistance,
          straightLineDistance,
          heuristicEnabled,
        },
      };
    }

    closedSet.add(current.node.id);
    const neighbors = edges[current.node.id] || [];

    for (const neighborId of neighbors) {
      if (closedSet.has(neighborId)) continue;

      const neighborNode = getNodeByIdLocal(neighborId);
      if (!neighborNode) continue;
      if (options?.neighborFilter && !options.neighborFilter(neighborNode)) continue;

      const tentativeG =
        current.gScore + calculateDistance(current.node, neighborNode, options?.userPreference);

      let neighborAStarNode = allNodes.get(neighborId);
      if (!neighborAStarNode) {
        const hScore = heuristicEnabled
          ? calculateDistance(neighborNode, goal, options?.userPreference)
          : 0;
        neighborAStarNode = {
          node: neighborNode,
          gScore: Number.POSITIVE_INFINITY,
          hScore,
          fScore: Number.POSITIVE_INFINITY,
          parent: null,
        };
        allNodes.set(neighborId, neighborAStarNode);
      }

      if (tentativeG < neighborAStarNode.gScore) {
        neighborAStarNode.parent = current;
        neighborAStarNode.gScore = tentativeG;
        neighborAStarNode.hScore = heuristicEnabled
          ? neighborAStarNode.hScore
          : 0;
        neighborAStarNode.fScore = tentativeG + neighborAStarNode.hScore;
        openHeap.insert(neighborAStarNode.fScore, neighborAStarNode);
        openSetPeak = Math.max(openSetPeak, openHeap.size());
      }
    }
  }

  return {
    path: [],
    stats: {
      expandedNodes,
      closedSetSize: closedSet.size,
      openSetPeak,
      nodesTotal: options?.nodesTotal ?? null,
      exploredPct: options?.nodesTotal ? (expandedNodes / options.nodesTotal) * 100 : null,
      pathDistance: 0,
      straightLineDistance: 0,
      heuristicEnabled,
    },
  };
};

export const findShortestPathOnGraph = (
  start: ParkingNode,
  goal: ParkingNode,
  edges: GraphEdges,
  getNodeByIdLocal: (id: string) => ParkingNode | null,
  userPreference?: 'stairs' | 'lift'
): ParkingNode[] => {
  const { path } = runAStarWithStats(start, goal, edges, getNodeByIdLocal, {
    userPreference,
  });
  return path;
};

export const findShortestPath = (
  start: ParkingNode,
  goal: ParkingNode,
  userPreference?: 'stairs' | 'lift'
): ParkingNode[] => {
  if (start.id === goal.id) return [start];

  const startAnchor = toWalkableAnchor(start);
  const goalAnchor = toWalkableAnchor(goal);
  if (!startAnchor || !goalAnchor) return [];

  if (startAnchor.id === goalAnchor.id) {
    const directPath: ParkingNode[] = [startAnchor];
    if (startAnchor.id !== start.id) directPath.unshift(start);
    if (startAnchor.id !== goal.id) directPath.push(goal);
    return directPath;
  }
  const { path: corePath } = runAStarWithStats(
    startAnchor,
    goalAnchor,
    parkingEdges,
    getNodeById,
    {
      neighborFilter: isWalkableType,
      userPreference,
    }
  );

  if (corePath.length === 0) return [];
  if (startAnchor.id !== start.id) corePath.unshift(start);
  if (goalAnchor.id !== goal.id) corePath.push(goal);
  return corePath;
};

export const findShortestPathWithStats = (
  start: ParkingNode,
  goal: ParkingNode,
  userPreference?: 'stairs' | 'lift',
  options?: { heuristicEnabled?: boolean }
): { path: ParkingNode[]; durationMs: number; stats: AStarStats } => {
  const t0 = nowMs();
  if (start.id === goal.id) {
    const t1 = nowMs();
    return {
      path: [start],
      durationMs: t1 - t0,
      stats: {
        expandedNodes: 1,
        closedSetSize: 1,
        openSetPeak: 1,
        nodesTotal: parkingNodes.length,
        exploredPct: parkingNodes.length ? (1 / parkingNodes.length) * 100 : null,
        pathDistance: 0,
        straightLineDistance: 0,
        heuristicEnabled: options?.heuristicEnabled !== false,
      },
    };
  }

  const startAnchor = toWalkableAnchor(start);
  const goalAnchor = toWalkableAnchor(goal);
  if (!startAnchor || !goalAnchor) {
    const t1 = nowMs();
    return {
      path: [],
      durationMs: t1 - t0,
      stats: {
        expandedNodes: 0,
        closedSetSize: 0,
        openSetPeak: 0,
        nodesTotal: parkingNodes.length,
        exploredPct: 0,
        pathDistance: 0,
        straightLineDistance: 0,
        heuristicEnabled: options?.heuristicEnabled !== false,
      },
    };
  }

  const { path: corePath, stats } = runAStarWithStats(
    startAnchor,
    goalAnchor,
    parkingEdges,
    getNodeById,
    {
      neighborFilter: isWalkableType,
      userPreference,
      nodesTotal: parkingNodes.length,
      heuristicEnabled: options?.heuristicEnabled,
    }
  );

  const finalPath = [...corePath];
  if (finalPath.length > 0) {
    if (startAnchor.id !== start.id) finalPath.unshift(start);
    if (goalAnchor.id !== goal.id) finalPath.push(goal);
  }

  const t1 = nowMs();
  const straightLineDistance = calculateDistance(startAnchor, goalAnchor, userPreference);
  const totalPathDistance = pathDistance(finalPath, userPreference);
  return {
    path: finalPath,
    durationMs: t1 - t0,
    stats: {
      ...stats,
      pathDistance: totalPathDistance,
      straightLineDistance,
    },
  };
};

export const findShortestPathOnGraphWithStats = (
  start: ParkingNode,
  goal: ParkingNode,
  edges: GraphEdges,
  getNodeByIdLocal: (id: string) => ParkingNode | null,
  options?: { heuristicEnabled?: boolean; nodesTotal?: number }
): { path: ParkingNode[]; durationMs: number; stats: AStarStats } => {
  const t0 = nowMs();
  const { path, stats } = runAStarWithStats(start, goal, edges, getNodeByIdLocal, {
    heuristicEnabled: options?.heuristicEnabled,
    nodesTotal: options?.nodesTotal,
  });
  const t1 = nowMs();
  return { path, durationMs: t1 - t0, stats };
};

export const generateDirections = (path: ParkingNode[]): string[] => {
  if (!path || path.length < 2) {
    return ['You are at your destination'];
  }

  const steps: string[] = [];

  const getDir = (a: ParkingNode, b: ParkingNode) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'E' : 'W';
    }
    return dy > 0 ? 'S' : 'N';
  };

  const getTurn = (from: string, to: string) => {
    const dirs = ['N', 'E', 'S', 'W'];
    const i1 = dirs.indexOf(from);
    const i2 = dirs.indexOf(to);

    if (i1 === i2) return 'straight';
    if ((i1 + 1) % 4 === i2) return 'right';
    if ((i1 + 3) % 4 === i2) return 'left';
    return 'back';
  };

  const dist = (a: ParkingNode, b: ParkingNode) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = (b.floor - a.floor) * FLOOR_HEIGHT;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  let prevDir: string | null = null;
  let accumulated = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i];
    const next = path[i + 1];

    if (current.floor !== next.floor) {
      if (accumulated > 0) {
        steps.push(`Walk straight for ${accumulated.toFixed(1)} m`);
        accumulated = 0;
      }

      if (next.type === 'stair') {
        steps.push(`Take stairs to Floor ${next.floor}`);
      } else if (next.type === 'lift') {
        steps.push(`Take lift to Floor ${next.floor}`);
      } else {
        steps.push(`Move to Floor ${next.floor}`);
      }

      prevDir = null;
      continue;
    }

    const dir = getDir(current, next);
    const d = dist(current, next);

    if (prevDir === null) {
      prevDir = dir;
      accumulated += d;
      continue;
    }

    const turn = getTurn(prevDir, dir);

    if (turn === 'straight') {
      accumulated += d;
    } else {
      steps.push(`Walk straight for ${accumulated.toFixed(1)} m`);
      if (turn === 'left') steps.push('Turn left');
      if (turn === 'right') steps.push('Turn right');
      if (turn === 'back') steps.push('Turn around');

      accumulated = d;
      prevDir = dir;
    }
  }

  if (accumulated > 0) {
    steps.push(`Walk straight for ${accumulated.toFixed(1)} m`);
  }

  steps.push('You have arrived at your destination!');
  return steps;
};
