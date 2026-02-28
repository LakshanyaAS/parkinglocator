
import { ParkingNode } from '@/contexts/LocationContext';
import graphData from '@/graph.json';


export const parkingNodes: ParkingNode[] = graphData.nodes.map((node: any) => ({
  id: node.id,
  x_px: node.x_px,
  y_px: node.y_px,
  x:node.x,
  y:node.y,
  floor:node.floor ?? 1,
  type: node.type as 'parking' |  'entrance'|'path'|'connection'|'lift'|'stair',
  qrCode: node.qrCode ?? undefined, 
}));

export const parkingEdges: { [key: string]: string[] } = {};

graphData.edges.forEach((edge: { from_id: string; to_id: string; weight?: number }) => {
  if (!parkingEdges[edge.from_id]) parkingEdges[edge.from_id] = [];
  parkingEdges[edge.from_id].push(edge.to_id);

  if (!parkingEdges[edge.to_id]) parkingEdges[edge.to_id] = [];
  parkingEdges[edge.to_id].push(edge.from_id);
});





export const getNodeByQRCode = (qrCode: string): ParkingNode | null => {
  return parkingNodes.find(node => node.qrCode === qrCode) || null;
};


export const getNodeById = (id: string): ParkingNode | null => {
  return parkingNodes.find(node => node.id === id) || null;
};
export const getNearestWalkableNode = (slot: ParkingNode): ParkingNode | null => {

  const walkableNodes = parkingNodes.filter(
    node =>
      node.type === 'path' ||
      node.type === 'connection' ||
      node.type === 'lift' ||
      node.type === 'stair'
  );

  if (walkableNodes.length === 0) return null;

  let nearest = walkableNodes[0];
  let minDistance = Infinity;

  for (const node of walkableNodes) {

    const dx = slot.x - node.x;
    const dy = slot.y - node.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = node;
    }
  }

  return nearest;
};

