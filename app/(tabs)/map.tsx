import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Svg, Text as SvgText } from 'react-native-svg';
import { AlertTriangle, ArrowLeft, CheckCircle, Navigation } from 'lucide-react-native';
import { useLocation } from '@/contexts/LocationContext';
import { generateDirections } from '@/utils/astar';
import { parkingNodes } from '@/utils/parkingData';
import { useRealSensors } from '@/hooks/useSensors';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width - 32;
const MAP_HEIGHT = 320;

type Point = { x: number; y: number };
type PathSegment = { start: Point; end: Point; length: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function MapScreen() {
  const router = useRouter();
  const { state } = useLocation();
  const { heading, stepCount, stepLengthMeters } = useRealSensors();

  const [progressPx, setProgressPx] = useState(0);
  const [userPosition, setUserPosition] = useState<Point>({ x: 0, y: 0 });
  const [closestPathIndex, setClosestPathIndex] = useState(0);

  const directions = state.path.length > 0 ? generateDirections(state.path) : [];

  const { transformX, transformY, scale } = useMemo(() => {
    const xs = parkingNodes.map((n) => n.x);
    const ys = parkingNodes.map((n) => n.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = 32;
    const scaleValue = Math.min(
      (MAP_WIDTH - 2 * pad) / (maxX - minX || 1),
      (MAP_HEIGHT - 2 * pad) / (maxY - minY || 1)
    );

    return {
      transformX: (x: number) => (x - minX) * scaleValue + pad,
      transformY: (y: number) => (y - minY) * scaleValue + pad,
      scale: scaleValue,
    };
  }, []);

  const pathPoints = useMemo<Point[]>(
    () => state.path.map((node) => ({ x: transformX(node.x), y: transformY(node.y) })),
    [state.path, transformX, transformY]
  );

  const segments = useMemo<PathSegment[]>(() => {
    const result: PathSegment[] = [];
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const start = pathPoints[i];
      const end = pathPoints[i + 1];
      result.push({ start, end, length: Math.hypot(end.x - start.x, end.y - start.y) });
    }
    return result;
  }, [pathPoints]);

  const totalPathLength = useMemo(
    () => segments.reduce((acc, segment) => acc + segment.length, 0),
    [segments]
  );

  const getPointAtProgress = (distancePx: number): Point => {
    if (pathPoints.length === 0) return { x: 0, y: 0 };
    if (pathPoints.length === 1) return pathPoints[0];
    if (distancePx <= 0) return pathPoints[0];
    if (distancePx >= totalPathLength) return pathPoints[pathPoints.length - 1];

    let traversed = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextTraversed = traversed + segment.length;
      if (distancePx <= nextTraversed) {
        const local = segment.length === 0 ? 0 : (distancePx - traversed) / segment.length;
        return {
          x: segment.start.x + (segment.end.x - segment.start.x) * local,
          y: segment.start.y + (segment.end.y - segment.start.y) * local,
        };
      }
      traversed = nextTraversed;
    }

    return pathPoints[pathPoints.length - 1];
  };

  const getSegmentIndexAtProgress = (distancePx: number): number => {
    if (segments.length === 0) return 0;
    let traversed = 0;
    for (let i = 0; i < segments.length; i++) {
      traversed += segments[i].length;
      if (distancePx <= traversed) return i;
    }
    return segments.length - 1;
  };

  useEffect(() => {
    if (pathPoints.length === 0) {
      setUserPosition({ x: 0, y: 0 });
      setProgressPx(0);
      return;
    }

    setProgressPx(0);
    setClosestPathIndex(0);
    setUserPosition(pathPoints[0]);
  }, [pathPoints]);

  useEffect(() => {
    if (segments.length === 0 || totalPathLength === 0) return;

    const metersToPixels = scale;
    const stepDistancePx = stepLengthMeters * metersToPixels;

    setProgressPx((previous) => {
      const currentIndex = getSegmentIndexAtProgress(previous);
      const currentSegment = segments[currentIndex];
      if (!currentSegment || currentSegment.length === 0) return previous;

      const segmentDir = {
        x: (currentSegment.end.x - currentSegment.start.x) / currentSegment.length,
        y: (currentSegment.end.y - currentSegment.start.y) / currentSegment.length,
      };

      const headingRad = (heading * Math.PI) / 180;
      const headingDir = { x: Math.cos(headingRad), y: Math.sin(headingRad) };
      const dot = headingDir.x * segmentDir.x + headingDir.y * segmentDir.y;
      const sign = dot < -0.2 ? -1 : 1;

      return clamp(previous + sign * stepDistancePx, 0, totalPathLength);
    });
  }, [scale, segments, stepCount, stepLengthMeters, totalPathLength]);

  useEffect(() => {
    if (pathPoints.length === 0) return;
    setUserPosition(getPointAtProgress(progressPx));
    setClosestPathIndex(getSegmentIndexAtProgress(progressPx));
  }, [pathPoints, progressPx]);

  const pathData = useMemo(() => {
    if (pathPoints.length < 2) return '';
    return pathPoints.reduce((d, point, idx) => (idx === 0 ? `M ${point.x} ${point.y}` : `${d} L ${point.x} ${point.y}`), '');
  }, [pathPoints]);

  const hasRoute = state.path.length > 1 && totalPathLength > 0;
  const progressPercent = hasRoute ? Math.min(100, Math.round((progressPx / totalPathLength) * 100)) : 0;
  const remainingSteps = Math.max(0, directions.length - 1 - closestPathIndex);
  const remainingMeters = hasRoute ? Math.max(0, (totalPathLength - progressPx) / scale) : 0;
  const currentInstructionIndex = Math.min(closestPathIndex, Math.max(0, directions.length - 1));

  const getStatusColor = () => {
    if (!state.vehicleLocation || !state.currentLocation) return '#9CA3AF';
    if (!hasRoute) return '#F59E0B';
    return '#10B981';
  };

  const getStatusText = () => {
    if (!state.vehicleLocation) return 'Vehicle location not set';
    if (!state.currentLocation) return 'Current location not set';
    if (!hasRoute) return 'No route available';
    return `On route - ${remainingSteps} steps remaining`;
  };

  const ParkingAndEntrances = useMemo(
    () => (
      <G>
        {parkingNodes
          .filter((n) => n.type === 'parking')
          .map((node) => {
            const cx = transformX(node.x);
            const cy = transformY(node.y);

            return (
              <G key={node.id}>
                <Rect
                  x={cx - 16}
                  y={cy - 10}
                  width={32}
                  height={20}
                  rx={4}
                  fill={state.vehicleLocation?.id === node.id ? '#EF4444' : '#FFFFFF'}
                  stroke={state.vehicleLocation?.id === node.id ? '#DC2626' : '#CBD5E1'}
                  strokeWidth={2}
                />
                <SvgText
                  x={cx}
                  y={cy + 3}
                  fontSize={10}
                  fontWeight="700"
                  fill={state.vehicleLocation?.id === node.id ? '#FFFFFF' : '#475569'}
                  textAnchor="middle"
                >
                  {node.id}
                </SvgText>
              </G>
            );
          })}

        {parkingNodes
          .filter((n) => n.type === 'entrance')
          .map((node) => {
            const x = transformX(node.x);
            const y = transformY(node.y);

            return (
              <G key={node.id}>
                <Rect x={x - 20} y={y - 8} width={40} height={16} rx={8} fill="#F59E0B" />
                <SvgText x={x} y={y + 4} fontSize={9} fontWeight="700" fill="#FFFFFF" textAnchor="middle">
                  ENTRANCE
                </SvgText>
              </G>
            );
          })}
      </G>
    ),
    [state.vehicleLocation, transformX, transformY]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#6B7280" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Navigation size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.title}>Navigation Map</Text>
              <Text style={styles.subtitle}>Smart parking guidance</Text>
            </View>
          </View>
        </View>

        <View style={[styles.statusCard, { borderLeftColor: getStatusColor() }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusTitle}>Navigation Status</Text>
            {state.path.length > 0 ? (
              <CheckCircle size={18} color="#10B981" />
            ) : (
              <AlertTriangle size={18} color="#EF4444" />
            )}
          </View>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{hasRoute ? `${remainingMeters.toFixed(0)} m` : '--'}</Text>
              <Text style={styles.metricLabel}>Remaining</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{hasRoute ? `${remainingSteps}` : '--'}</Text>
              <Text style={styles.metricLabel}>Steps</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{stepCount}</Text>
              <Text style={styles.metricLabel}>Detected</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>Live Route</Text>
            <Text style={styles.mapMeta}>Heading {Math.round(heading)} deg</Text>
          </View>
          <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
            <Defs>
              <LinearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#EF4444" />
                <Stop offset="100%" stopColor="#DC2626" />
              </LinearGradient>
            </Defs>

            <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#F8FAFC" rx={12} />
            {ParkingAndEntrances}

            {pathData && <Path d={pathData} stroke="url(#pathGradient)" strokeWidth={4} fill="none" />}

            {state.currentLocation && pathPoints.length > 0 && (
              <G>
                <Circle cx={userPosition.x} cy={userPosition.y} r={14} fill="#10B981" fillOpacity={0.3} />
                <Circle cx={userPosition.x} cy={userPosition.y} r={7} fill="#10B981" stroke="#FFFFFF" strokeWidth={3} />
                <Line
                  x1={userPosition.x}
                  y1={userPosition.y}
                  x2={userPosition.x + Math.cos((heading * Math.PI) / 180) * 18}
                  y2={userPosition.y + Math.sin((heading * Math.PI) / 180) * 18}
                  stroke="#FFFFFF"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </G>
            )}
          </Svg>
        </View>

        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Map Legend</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendRow}>Live position</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
            <Text style={styles.legendRow}>Walking path</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendRow}>Your vehicle slot</Text>
          </View>
        </View>

        {directions.length > 0 && (
          <View style={styles.directionsContainer}>
            <Text style={styles.directionsTitle}>Step-by-Step Directions</Text>
            {directions.map((direction, index) => (
              <View
                key={index}
                style={[
                  styles.directionItem,
                  index === currentInstructionIndex && hasRoute ? styles.directionItemActive : null,
                ]}
              >
                <View style={[styles.stepBadge, index === currentInstructionIndex && hasRoute ? styles.stepBadgeActive : null]}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text
                  style={[
                    styles.directionText,
                    index === currentInstructionIndex && hasRoute ? styles.directionTextActive : null,
                  ]}
                >
                  {direction}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  scrollContent: { paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  statusCard: {
    backgroundColor: '#FFFFFFF2',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  statusTitle: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  statusText: { fontSize: 18, fontWeight: '700', marginTop: 8, color: '#0F172A' },
  metricsRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  metricPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  metricValue: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  metricLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 999,
  },
  mapContainer: {
    margin: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFFF2',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  mapTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  mapMeta: { fontSize: 12, color: '#475569', fontWeight: '600' },
  legendContainer: {
    backgroundColor: '#FFFFFFF2',
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legendTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#0F172A' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 10, marginRight: 8 },
  legendRow: { fontSize: 14, color: '#334155' },
  directionsContainer: {
    backgroundColor: '#FFFFFFF2',
    margin: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  directionsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#0F172A' },
  directionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  directionItemActive: { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepBadgeActive: { backgroundColor: '#2563EB' },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  directionText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },
  directionTextActive: { color: '#0F172A', fontWeight: '700' },
});
