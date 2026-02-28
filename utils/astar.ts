import { ParkingNode } from '@/contexts/LocationContext';
import { getNearestWalkableNode, getNodeById, parkingEdges } from './parkingData';
import { MinHeap } from './minheap';

interface AStarNode {
  node: ParkingNode;
  gScore: number;
  hScore: number;
  fScore: number;
  parent: AStarNode | null;
}

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

  const openHeap = new MinHeap<AStarNode>();
  const closedSet = new Set<string>();
  const allNodes = new Map<string, AStarNode>();

  const startNode: AStarNode = {
    node: startAnchor,
    gScore: 0,
    hScore: calculateDistance(startAnchor, goalAnchor, userPreference),
    fScore: calculateDistance(startAnchor, goalAnchor, userPreference),
    parent: null,
  };

  allNodes.set(startAnchor.id, startNode);
  openHeap.insert(startNode.fScore, startNode);

  while (!openHeap.isEmpty()) {
    const current = openHeap.extractMin();
    if (!current) break;
    if (closedSet.has(current.node.id)) continue;

    if (current.node.id === goalAnchor.id) {
      const corePath = reconstructPath(current);

      if (startAnchor.id !== start.id) corePath.unshift(start);
      if (goalAnchor.id !== goal.id) corePath.push(goal);

      return corePath;
    }

    closedSet.add(current.node.id);
    const neighbors = parkingEdges[current.node.id] || [];

    for (const neighborId of neighbors) {
      if (closedSet.has(neighborId)) continue;

      const neighborNode = getNodeById(neighborId);
      if (!neighborNode) continue;
      if (!isWalkableType(neighborNode)) continue;

      const tentativeG =
        current.gScore + calculateDistance(current.node, neighborNode, userPreference);

      let neighborAStarNode = allNodes.get(neighborId);
      if (!neighborAStarNode) {
        neighborAStarNode = {
          node: neighborNode,
          gScore: Number.POSITIVE_INFINITY,
          hScore: calculateDistance(neighborNode, goalAnchor, userPreference),
          fScore: Number.POSITIVE_INFINITY,
          parent: null,
        };
        allNodes.set(neighborId, neighborAStarNode);
      }

      if (tentativeG < neighborAStarNode.gScore) {
        neighborAStarNode.parent = current;
        neighborAStarNode.gScore = tentativeG;
        neighborAStarNode.fScore = tentativeG + neighborAStarNode.hScore;
        openHeap.insert(neighborAStarNode.fScore, neighborAStarNode);
      }
    }
  }

  return [];
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
