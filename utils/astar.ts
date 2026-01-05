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

export const generateDirections = (
  path: ParkingNode[],
  startHeading: Heading = 'north'
): string[] => {
  if (path.length <= 1) return ['You are at your destination'];

  const steps: string[] = [];
  let currentHeading = startHeading;

  let lastInstruction: string | null = null;

  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i];
    const next = path[i + 1];

    const dx = next.x - current.x;
    const dy = next.y - current.y;

    const movementHeading = getHeadingFromVector(dx, dy);

    // convert to angles
    const currentAngle = headingToAngle[currentHeading];
    const moveAngle = headingToAngle[movementHeading];

    let diff = (moveAngle - currentAngle + 360) % 360;

    let instruction = '';

    if (i === 0) {
      // FIRST STEP IS ALWAYS STRAIGHT
      instruction = 'Walk straight';
    } else if (diff === 0) {
      instruction = 'Walk straight';
    } else if (diff === 90) {
      instruction = 'Turn right';
    } else if (diff === 270) {
      instruction = 'Turn left';
    } else {
      instruction = 'Turn around';
    }

    // MERGE repeated "Walk straight"
    if (instruction === 'Walk straight' && lastInstruction === 'Walk straight') {
      // skip adding duplicate
    } else {
      steps.push(instruction);
      lastInstruction = instruction;
    }

    currentHeading = movementHeading;
  }

  steps.push('You have arrived at your destination!');
  return steps;
};
