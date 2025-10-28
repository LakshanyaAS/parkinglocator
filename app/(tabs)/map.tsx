import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Rect, Circle, Line,Path, Polygon, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useLocation } from '@/contexts/LocationContext';
import { parkingNodes,parkingEdges } from '@/utils/parkingData';
import {generateDirections}  from '@/utils/astar';
import { Navigation, Car, MapPin, ArrowLeft, Clock, Route, Zap } from 'lucide-react-native';
import { Accelerometer } from 'expo-sensors';
import { Platform } from 'react-native';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width - 32;
const MAP_HEIGHT = 320;

export default function MapScreen() {
  const router = useRouter();
  const { state } = useLocation();
// Ensure this is a function call
// --- Simulated movement offset based on device motion ---
const [userOffset, setUserOffset] = React.useState({ x: 0, y: 0 });

React.useEffect(() => {
  let subscription: { remove: () => void } | undefined;


  if (Platform.OS !== 'web') {
    subscription = Accelerometer.addListener(({ x, y }) => {
      const speed = 8; // adjust to control sensitivity
      setUserOffset(prev => ({
        x: prev.x + x * speed,
        y: prev.y + y * speed,
      }));
    });
    Accelerometer.setUpdateInterval(200);
  }

  return () => subscription && subscription.remove();
}, []);



const directions: string[] = state.path.length > 0 && generateDirections
    ? generateDirections(state.path)
    : [];


  // Calculate scale factors based on node coordinates
  const allNodes = parkingNodes;
  const minX = Math.min(...allNodes.map(n => n.x));
  const maxX = Math.max(...allNodes.map(n => n.x));
  const minY = Math.min(...allNodes.map(n => n.y));
  const maxY = Math.max(...allNodes.map(n => n.y));
  
  const padding = 40;
  const scaleX = (MAP_WIDTH - 2 * padding) / (maxX - minX);
  const scaleY = (MAP_HEIGHT - 2 * padding) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY * 1.1); // Slight Y-boost for horizontal paths

  const transformX = (x: number) => (x - minX) * scale + padding;
  const transformY = (y: number) => (y - minY) * scale + padding;

  const getStatusColor = () => {
    if (!state.vehicleLocation || !state.currentLocation) return '#9CA3AF';
    return state.path.length > 0 ? '#10B981' : '#F59E0B';
  };

  const getStatusText = () => {
    if (!state.vehicleLocation) return 'Vehicle location not set';
    if (!state.currentLocation) return 'Current location not set';
    if (state.path.length === 0) return 'No path available';
    return `${state.path.length - 1} steps to your vehicle`;
  };

  // Function to calculate a simple control point for slight curve
  const getControlPoint = (startX: number, startY: number, endX: number, endY: number, offset: number = 8) => {  // Reduced from 15 to 8
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 20) return { x: midX, y: midY };  // Skip curve for very short segments to avoid over-waving
  const nx = -dy / length * offset;
  const ny = dx / length * offset;
  return { x: midX + nx, y: midY + ny };
};

// Updated memoized path data for continuous path with optional subtle curves
const pathData = useMemo(() => {
  if (state.path.length <= 1) return '';

  const points = state.path.map(node => ({ x: transformX(node.x), y: transformY(node.y) }));
  let d = `M ${points[0].x} ${points[0].y}`; // Start at first point

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (i > 0 && Math.random() > 0.3) {  // Add subtle curve only ~70% of segments for natural variation
      const { x: cx, y: cy } = getControlPoint(start.x, start.y, end.x, end.y);
      d += ` Q ${cx} ${cy}, ${end.x} ${end.y}`;
    } else {
      d += ` L ${end.x} ${end.y}`; // Straight line for continuity
    }
  }

  return d;
}, [state.path, transformX, transformY]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#6B7280" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Navigation size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Navigation Map</Text>
          </View>
        </View>

        {/* Status Card */}
        <View style={[styles.statusCard, { borderLeftColor: getStatusColor() }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusTitle}>Navigation Status</Text>
          </View>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {state.vehicleLocation && state.currentLocation && (
            <View style={styles.routeInfo}>
              <Route size={16} color="#6B7280" />
              <Text style={styles.routeText}>
                From {state.currentLocation.id} to {state.vehicleLocation.id}
              </Text>
            </View>
          )}
        </View>

        {/* Map Container */}
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>Parking Layout</Text>
            <View style={styles.mapStats}>
              <Clock size={14} color="#6B7280" />
              <Text style={styles.mapStatsText}>
                {state.path.length > 0 ? `~${Math.ceil(state.path.length * 0.5)} min walk` : 'Set locations'}
              </Text>
            </View>
          </View>

          <View style={styles.svgContainer}>
            <Svg width={MAP_WIDTH} height={MAP_HEIGHT} style={styles.map}>
              <Defs>
                <LinearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#DC2626" stopOpacity="1" />
                </LinearGradient>
              </Defs>

              {/* Background */}
              <Rect
                x="0"
                y="0"
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                fill="#F8FAFC"
                stroke="#E2E8F0"
                strokeWidth="2"
                rx="12"
              />

              {/* Grid pattern */}
              {[...Array(8)].map((_, i) => (
                <Line
                  key={`grid-v-${i}`}
                  x1={padding + (i * (MAP_WIDTH - 2 * padding) / 7)}
                  y1={padding}
                  x2={padding + (i * (MAP_WIDTH - 2 * padding) / 7)}
                  y2={MAP_HEIGHT - padding}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                />
              ))}
              {[...Array(6)].map((_, i) => (
                <Line
                  key={`grid-h-${i}`}
                  x1={padding}
                  y1={padding + (i * (MAP_HEIGHT - 2 * padding) / 5)}
                  x2={MAP_WIDTH - padding}
                  y2={padding + (i * (MAP_HEIGHT - 2 * padding) / 5)}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                />
              ))}
                        


              {/* Parking spaces */}
              {parkingNodes
                .filter(node => node.type === 'parking')
                .map(node => {
                  const isVehicleHere = state.vehicleLocation?.id === node.id;
                  return (
                    <g key={node.id}>
                      <Rect
                        x={transformX(node.x) - 16}
                        y={transformY(node.y) - 10}
                        width="32"
                        height="20"
                        fill={isVehicleHere ? '#EF4444' : '#FFFFFF'}
                        stroke={isVehicleHere ? '#DC2626' : '#CBD5E1'}
                        strokeWidth="2"
                        rx="4"
                      />
                      <SvgText
                        x={transformX(node.x)}
                        y={transformY(node.y) + 2}
                        fontSize="10"
                        fontWeight="600"
                        fill={isVehicleHere ? '#FFFFFF' : '#475569'}
                        textAnchor="middle"
                      >
                        {node.id}
                      </SvgText>
                    </g>
                  );
                })}

              {/* Continuous path with slight curves */}
              {state.path.length > 1 && (
                <Path
                  d={pathData}
                  fill="none"
                  stroke="url(#pathGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              )}

              {/* Path dots for better visibility */}
              {state.path.map((node, index) => (
                <Circle
                  key={`path-dot-${index}`}
                  cx={transformX(node.x)}
                  cy={transformY(node.y)}
                  r="3"
                  fill="#DC2626"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              ))}
              

              {/* Current location marker */}
              {/* Current location marker with movement */}
{state.currentLocation && (
  <g>
    <Circle
      cx={transformX(state.currentLocation.x) + userOffset.x}
      cy={transformY(state.currentLocation.y) + userOffset.y}
      r="12"
      fill="#10B981"
      stroke="#FFFFFF"
      strokeWidth="3"
    />
    <Circle
      cx={transformX(state.currentLocation.x) + userOffset.x}
      cy={transformY(state.currentLocation.y) + userOffset.y}
      r="6"
      fill="#FFFFFF"
    />
    <SvgText
      x={transformX(state.currentLocation.x) + userOffset.x}
      y={transformY(state.currentLocation.y) + userOffset.y - 20}
      fontSize="10"
      fontWeight="700"
      fill="#10B981"
      textAnchor="middle"
    >
      YOU
    </SvgText>
  </g>
)}


              {/* Vehicle location marker */}
              {state.vehicleLocation && (
                <g>
                  <Polygon
                    points={`${transformX(state.vehicleLocation.x) - 8},${transformY(state.vehicleLocation.y) - 10} ${transformX(state.vehicleLocation.x)},${transformY(state.vehicleLocation.y) + 10} ${transformX(state.vehicleLocation.x) + 8},${transformY(state.vehicleLocation.y) - 10}`}
                    fill="#EF4444"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <SvgText
                    x={transformX(state.vehicleLocation.x)}
                    y={transformY(state.vehicleLocation.y) - 18}
                    fontSize="10"
                    fontWeight="700"
                    fill="#4444efff"
                    textAnchor="middle"
                  >
                    CAR
                  </SvgText>
                </g>
              )}

              {/* Entrance markers */}
              {parkingNodes
                .filter(node => node.type === 'entrance')
                .map(node => (
                  <g key={node.id}>
                    <Rect
                      x={transformX(node.x) - 20}
                      y={transformY(node.y) - 8}
                      width="40"
                      height="16"
                      fill="#F59E0B"
                      stroke="#D97706"
                      strokeWidth="2"
                      rx="8"
                    />
                    <SvgText
                      x={transformX(node.x)}
                      y={transformY(node.y) + 2}
                      fontSize="8"
                      fontWeight="600"
                      fill="#FFFFFF"
                      textAnchor="middle"
                    >
                      ENTRANCE
                    </SvgText>
                  </g>
                ))}
            </Svg>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Map Legend</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendItem}>
              <View style={[styles.legendIcon, styles.legendCar]} />
              <Text style={styles.legendText}>Your Vehicle</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIcon, styles.legendYou]} />
              <Text style={styles.legendText}>Your Location</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIcon, styles.legendEntrance]} />
              <Text style={styles.legendText}>Entrance</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIcon, styles.legendPath]} />
              <Text style={styles.legendText}>Walking Path</Text>
            </View>
          </View>
        </View>

        {/* Turn-by-turn directions */}
        {directions.length > 0 && (
          <View style={styles.directionsContainer}>
            <View style={styles.directionsHeader}>
              <View style={styles.directionsIcon}>
                <Zap size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.directionsTitle}>Step-by-Step Directions</Text>
            </View>
            <View style={styles.directionsList}>
              {directions.map((direction, index) => (
                <View key={index} style={styles.directionItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                  </View>
                  <Text style={styles.directionText}>{direction}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!state.vehicleLocation && !state.currentLocation && (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Car size={40} color="#CBD5E1" />
              <MapPin size={40} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyStateTitle}>Ready to Navigate?</Text>
            <Text style={styles.emptyStateText}>
              Set your vehicle and current locations to see the optimal path on this interactive map.
            </Text>
            <TouchableOpacity 
              style={styles.demoButton}
              onPress={() => {
                router.push('/');
                // The demo will be triggered from the home screen
              }}
            >
              <Text style={styles.demoButtonText}>Try Demo Mode</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
  },
  mapContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  mapStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapStatsText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
  },
  svgContainer: {
    padding: 16,
  },
  map: {
    width: '100%',
  },
  legendContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '45%',
  },
  legendIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
    borderRadius: 2,
  },
  legendCar: {
    backgroundColor: '#EF4444',
  },
  legendYou: {
    backgroundColor: '#10B981',
    borderRadius: 8,
  },
  legendEntrance: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
  },
  legendPath: {
    backgroundColor: '#DC2626',
  },
  legendText: {
    fontSize: 14,
    color: '#64748B',
  },
  directionsContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  directionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#3B82F6',
  },
  directionsIcon: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  directionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  directionsList: {
    padding: 20,
  },
  directionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepBadge: {
    width: 28,
    height: 28,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  directionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    paddingTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyStateIcon: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  demoButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  demoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});