import React, { useMemo, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Rect, Circle, Line, Path, Polygon, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useLocation } from '@/contexts/LocationContext';
import { parkingNodes } from '@/utils/parkingData';
import { generateDirections } from '@/utils/astar';
import { useRealSensors } from '@/hooks/useSensors';
import { Navigation, Car, MapPin, ArrowLeft, Clock, Route, Zap, AlertTriangle, CheckCircle } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width - 32;
const MAP_HEIGHT = 320;
const PATH_DEVIATION_THRESHOLD = 25;

// simple throttle helper (no external deps)
const useThrottledValue = <T,>(value: T, intervalMs: number): T => {
  const [throttled, setThrottled] = useState(value);
  const last = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - last.current >= intervalMs) {
      last.current = now;
      setThrottled(value);
    }
  }, [value, intervalMs]);

  return throttled;
};

export default function MapScreen() {
  const router = useRouter();
  const { state } = useLocation();
  const { heading, userOffset } = useRealSensors();

  const [userPosition, setUserPosition] = useState({ x: 0, y: 0 });
  const [isOnPath, setIsOnPath] = useState(true);
  const [closestPathIndex, setClosestPathIndex] = useState(0);
  const [deviationDistance, setDeviationDistance] = useState(0);

  const directions = state.path.length > 0 ? generateDirections(state.path) : [];

  // 1) SCALE & transform functions (memoized)
  const { transformX, transformY, padding } = useMemo(() => {
    const allNodes = parkingNodes;
    if (allNodes.length === 0) {
      return {
        transformX: (x: number) => x,
        transformY: (y: number) => y,
        padding: 24,
      };
    }

    const xs = allNodes.map(n => n.x);
    const ys = allNodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = 32;
    const scaleX = (MAP_WIDTH - 2 * pad) / (maxX - minX || 1);
    const scaleY = (MAP_HEIGHT - 2 * pad) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY * 1.1);

    const tx = (x: number) => (x - minX) * scale + pad;
    const ty = (y: number) => (y - minY) * scale + pad;

    return { transformX: tx, transformY: ty, padding: pad };
  }, []);

  // 2) Throttle sensor updates (e.g. 8 fps)
  const throttledHeading = useThrottledValue(heading, 120);
  const throttledOffset = useThrottledValue(userOffset, 120);

  // 3) Update user position (lightweight)
  useEffect(() => {
    if (state.currentLocation) {
      const sensorScale = 0.5;
      setUserPosition({
        x: transformX(state.currentLocation.x) + throttledOffset.x * sensorScale,
        y: transformY(state.currentLocation.y) + throttledOffset.y * sensorScale,
      });
    }
  }, [throttledOffset, state.currentLocation, transformX, transformY]);

  const distanceToSegment = (
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  };

  // 4) Precompute path points in pixel space (memo)
  const pathPoints = useMemo(
    () =>
      state.path.map(node => ({
        x: transformX(node.x),
        y: transformY(node.y),
      })),
    [state.path, transformX, transformY]
  );

  // simple polyline path (no randomness)
  const pathData = useMemo(() => {
    if (pathPoints.length <= 1) return '';
    let d = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
    for (let i = 1; i < pathPoints.length; i++) {
      d += ` L ${pathPoints[i].x} ${pathPoints[i].y}`;
    }
    return d;
  }, [pathPoints]);

  // 5) On-path check using precomputed pathPoints
  useEffect(() => {
    if (pathPoints.length < 2) return;

    let minDistance = Infinity;
    let closestSegmentIndex = 0;

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i];
      const p2 = pathPoints[i + 1];

      const distance = distanceToSegment(
        userPosition.x,
        userPosition.y,
        p1.x,
        p1.y,
        p2.x,
        p2.y
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestSegmentIndex = i;
      }
    }

    setDeviationDistance(minDistance);
    setClosestPathIndex(closestSegmentIndex);
    setIsOnPath(minDistance <= PATH_DEVIATION_THRESHOLD);
  }, [userPosition, pathPoints]);

  const getStatusColor = () => {
    if (!state.vehicleLocation || !state.currentLocation) return '#9CA3AF';
    if (state.path.length === 0) return '#F59E0B';
    return isOnPath ? '#10B981' : '#EF4444';
  };

  const getStatusText = () => {
    if (!state.vehicleLocation) return 'Vehicle location not set';
    if (!state.currentLocation) return 'Current location not set';
    if (state.path.length === 0) return 'No path available';

    const remainingSteps = directions.length - 1 - closestPathIndex;
    if (!isOnPath) {
      return `Off path - ${deviationDistance.toFixed(0)}px deviation`;
    }
    return `On track - ${Math.max(0, remainingSteps)} steps remaining`;
  };

  // 6) Memoized static SVG parts (grid, parking, entrances)
  const Grid = useMemo(
    () => (
      <G>
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
      </G>
    ),
    [padding]
  );

  const ParkingAndEntrances = useMemo(
    () => (
      <G>
        {parkingNodes
          .filter(node => node.type === 'parking')
          .map(node => {
            const cx = transformX(node.x);
            const cy = transformY(node.y);
            return (
              <G key={node.id}>
                <Rect
                  x={cx - 16}
                  y={cy - 10}
                  width={32}
                  height={20}
                  fill={state.vehicleLocation?.id === node.id ? '#EF4444' : '#FFFFFF'}
                  stroke={state.vehicleLocation?.id === node.id ? '#DC2626' : '#CBD5E1'}
                  strokeWidth={2}
                  rx={4}
                />
                <SvgText
                  x={cx}
                  y={cy + 2}
                  fontSize={10}
                  fontWeight="600"
                  fill={state.vehicleLocation?.id === node.id ? '#FFFFFF' : '#475569'}
                  textAnchor="middle"
                >
                  {node.id}
                </SvgText>
              </G>
            );
          })}

        {parkingNodes
          .filter(node => node.type === 'entrance')
          .map(node => {
            const ex = transformX(node.x);
            const ey = transformY(node.y);
            return (
              <G key={node.id}>
                <Rect
                  x={ex - 20}
                  y={ey - 8}
                  width={40}
                  height={16}
                  fill="#F59E0B"
                  stroke="#D97706"
                  strokeWidth={2}
                  rx={8}
                />
                <SvgText
                  x={ex}
                  y={ey + 2}
                  fontSize={8}
                  fontWeight="600"
                  fill="#FFFFFF"
                  textAnchor="middle"
                >
                  ENTRANCE
                </SvgText>
              </G>
            );
          })}
      </G>
    ),
    [transformX, transformY, state.vehicleLocation]
  );

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
            {state.path.length > 0 &&
              (isOnPath ? (
                <CheckCircle size={20} color="#10B981" style={{ marginLeft: 8 }} />
              ) : (
                <AlertTriangle size={20} color="#EF4444" style={{ marginLeft: 8 }} />
              ))}
          </View>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {/* Map */}
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
                  <Stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                  <Stop offset="100%" stopColor="#DC2626" stopOpacity={1} />
                </LinearGradient>
              </Defs>

              <Rect
                x={0}
                y={0}
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                fill="#F8FAFC"
                stroke="#E2E8F0"
                strokeWidth={2}
                rx={12}
              />

              {Grid}
              {ParkingAndEntrances}

              {pathData !== '' && (
                <Path
                  d={pathData}
                  fill="none"
                  stroke="url(#pathGradient)"
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              )}

              {pathPoints.map((p, index) => {
                const isPassed = index <= closestPathIndex;
                return (
                  <Circle
                    key={`path-dot-${index}`}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill={isPassed ? '#10B981' : '#DC2626'}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                );
              })}

              {state.currentLocation && state.path.length > 0 && (
                <G>
                  <Circle
                    cx={userPosition.x}
                    cy={userPosition.y}
                    r={14}
                    fill={isOnPath ? '#10B981' : '#F59E0B'}
                    fillOpacity={0.3}
                  />
                  <Circle
                    cx={userPosition.x}
                    cy={userPosition.y}
                    r={8}
                    fill={isOnPath ? '#10B981' : '#F59E0B'}
                    stroke="#FFFFFF"
                    strokeWidth={3}
                  />
                  <Circle cx={userPosition.x} cy={userPosition.y} r={3} fill="#FFFFFF" />
                  <Line
                    x1={userPosition.x}
                    y1={userPosition.y}
                    x2={userPosition.x + Math.cos((throttledHeading * Math.PI) / 180) * 15}
                    y2={userPosition.y + Math.sin((throttledHeading * Math.PI) / 180) * 15}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </G>
              )}

              {state.currentLocation && (
                <G>
                  <Circle
                    cx={transformX(state.currentLocation.x)}
                    cy={transformY(state.currentLocation.y)}
                    r={6}
                    fill="#3B82F6"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                  <SvgText
                    x={transformX(state.currentLocation.x)}
                    y={transformY(state.currentLocation.y) - 12}
                    fontSize={9}
                    fontWeight="700"
                    fill="#3B82F6"
                    textAnchor="middle"
                  >
                    START
                  </SvgText>
                </G>
              )}

              {state.vehicleLocation && (
                <G>
                  <Polygon
                    points={`${transformX(state.vehicleLocation.x) - 8},${transformY(
                      state.vehicleLocation.y
                    ) - 10} ${transformX(state.vehicleLocation.x)},${transformY(
                      state.vehicleLocation.y
                    ) + 10} ${transformX(state.vehicleLocation.x) + 8},${transformY(
                      state.vehicleLocation.y
                    ) - 10}`}
                    fill="#EF4444"
                    stroke="#FFFFFF"
                    strokeWidth={3}
                  />
                  <SvgText
                    x={transformX(state.vehicleLocation.x)}
                    y={transformY(state.vehicleLocation.y) - 18}
                    fontSize={10}
                    fontWeight="700"
                    fill="#EF4444"
                    textAnchor="middle"
                  >
                    CAR
                  </SvgText>
                </G>
              )}
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
              <Text style={styles.legendText}>Live Position</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIcon, styles.legendStart]} />
              <Text style={styles.legendText}>Start Point</Text>
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
              {directions.map((direction, index) => {
                const isCurrentStep = index === closestPathIndex;
                const isPassed = index < closestPathIndex;
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.directionItem,
                      isCurrentStep && styles.currentStep,
                      isPassed && styles.passedStep
                    ]}
                  >
                    <View style={[
                      styles.stepBadge,
                      isCurrentStep && styles.currentStepBadge,
                      isPassed && styles.passedStepBadge
                    ]}>
                      <Text style={styles.stepNumber}>{index + 1}</Text>
                    </View>
                    <Text style={[
                      styles.directionText,
                      isPassed && styles.passedDirectionText
                    ]}>
                      {direction}
                    </Text>
                  </View>
                );
              })}
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
              Set your vehicle and current locations to see the optimal path with real-time tracking.
            </Text>
            <TouchableOpacity 
              style={styles.demoButton}
              onPress={() => router.push('/')}
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
    marginBottom: 8,
  },
  routeText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
  },
  sensorInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sensorText: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'monospace',
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
  legendStart: {
    backgroundColor: '#3B82F6',
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
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  currentStep: {
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  passedStep: {
    opacity: 0.5,
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
  currentStepBadge: {
    backgroundColor: '#10B981',
  },
  passedStepBadge: {
    backgroundColor: '#94A3B8',
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
  passedDirectionText: {
    textDecorationLine: 'line-through',
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

