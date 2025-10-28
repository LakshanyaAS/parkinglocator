
import { ParkingNode } from '@/contexts/LocationContext';
import graphData from '@/graph.json';


export const parkingNodes: ParkingNode[] = graphData.nodes.map((node: any) => ({
  id: node.id,
  x: node.x,
  y: node.y,
  type: node.type as 'parking' | 'junction' | 'entrance'|'path',
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
