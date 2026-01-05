import { ParkingNode } from '@/contexts/LocationContext';
import { parkingNodes, parkingEdges, getNodeById } from './parkingData';

interface AStarNode {
  node: ParkingNode;
  gScore: number; 
  hScore: number; 
  fScore: number; 
  parent: AStarNode | null;
}


const calculateDistance = (node1: ParkingNode, node2: ParkingNode): number => {
  const dx = node1.x - node2.x;
  const dy = node1.y - node2.y;
  return Math.sqrt(dx * dx + dy * dy);
};


export const findShortestPath = (start: ParkingNode, goal: ParkingNode): ParkingNode[] => {
  if (start.id === goal.id) {
    return [start];
  }

  const openSet: AStarNode[] = [];
  const closedSet: Set<string> = new Set();
  
  const startAStarNode: AStarNode = {
    node: start,
    gScore: 0,
    hScore: calculateDistance(start, goal),
    fScore: calculateDistance(start, goal),
    parent: null,
  };
  
  openSet.push(startAStarNode);
  const allNodes: Map<string, AStarNode> = new Map();
  allNodes.set(start.id, startAStarNode);

  while (openSet.length > 0) {
    
    openSet.sort((a, b) => a.fScore - b.fScore);
    const current = openSet.shift()!;
    
    
    if (current.node.id === goal.id) {
      const path: ParkingNode[] = [];
      let currentNode: AStarNode | null = current;
      
      while (currentNode) {
        path.unshift(currentNode.node);
        currentNode = currentNode.parent;
      }
      
      return path;
    }
    
    closedSet.add(current.node.id);
    
   
    const neighbors = parkingEdges[current.node.id] || [];
    
    for (const neighborId of neighbors) {
      if (closedSet.has(neighborId)) {
        continue;
      }
      
      const neighborNode = getNodeById(neighborId);
      if (!neighborNode) {
        continue;
      }
      
      const tentativeGScore = current.gScore + calculateDistance(current.node, neighborNode);
      
      let neighborAStarNode = allNodes.get(neighborId);
      
      if (!neighborAStarNode) {
        neighborAStarNode = {
          node: neighborNode,
          gScore: Infinity,
          hScore: calculateDistance(neighborNode, goal),
          fScore: Infinity,
          parent: null,
        };
        allNodes.set(neighborId, neighborAStarNode);
      }
      
      if (tentativeGScore < neighborAStarNode.gScore) {
        neighborAStarNode.parent = current;
        neighborAStarNode.gScore = tentativeGScore;
        neighborAStarNode.fScore = tentativeGScore + neighborAStarNode.hScore;
        
        if (!openSet.includes(neighborAStarNode)) {
          openSet.push(neighborAStarNode);
        }
      }
    }
  }
  
 
  return [];
};

type Heading = 'north' | 'east' | 'south' | 'west';

const headingToAngle: Record<Heading, number> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};

const getHeadingFromVector = (dx: number, dy: number): Heading => {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  } else {
    return dy > 0 ? 'south' : 'north';
  }
};

export const generateDirections = (path: ParkingNode[]): string[] => {
  if (!path || path.length < 2) {
    return ["You are at your destination"];
  }

  const steps: string[] = [];

  const getDir = (a: ParkingNode, b: ParkingNode) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "E" : "W";
    }
    return dy > 0 ? "S" : "N";
  };

  const getTurn = (from: string, to: string) => {
    const dirs = ["N", "E", "S", "W"];
    const i1 = dirs.indexOf(from);
    const i2 = dirs.indexOf(to);

    if (i1 === i2) return "straight";
    if ((i1 + 1) % 4 === i2) return "right";
    if ((i1 + 3) % 4 === i2) return "left";
    return "back";
  };

  const dist = (a: ParkingNode, b: ParkingNode) => {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  };

  let prevDir: string | null = null;
  let accumulated = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const dir = getDir(path[i], path[i + 1]);
    const d = dist(path[i], path[i + 1]);

    if (prevDir === null) {
      prevDir = dir;
      accumulated += d;
      continue;
    }

    const turn = getTurn(prevDir, dir);

    if (turn === "straight") {
      accumulated += d;
    } else {
      // finish previous straight instruction
      steps.push(
        `Walk straight for ${accumulated.toFixed(1)} m`
      );

      if (turn === "left") steps.push("Turn left");
      if (turn === "right") steps.push("Turn right");
      if (turn === "back") steps.push("Turn around");

      accumulated = d;
      prevDir = dir;
    }
  }

  // final straight segment
  steps.push(`Walk straight for ${accumulated.toFixed(1)} m`);
  steps.push("You have arrived at your destination!");

  return steps;
};
