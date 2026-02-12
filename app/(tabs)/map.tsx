import React, { useMemo, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Rect, Circle, Line, Path, Polygon, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useLocation } from '@/contexts/LocationContext';
import { parkingNodes } from '@/utils/parkingData';
import { generateDirections } from '@/utils/astar';
import { useRealSensors } from '@/hooks/useSensors';
import {
  Navigation,
  Car,
  MapPin,
  ArrowLeft,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width - 32;
const MAP_HEIGHT = 320;
const PATH_DEVIATION_THRESHOLD = 25;

export default function MapScreen() {
  const router = useRouter();
  const { state } = useLocation();
  const { heading, stepDelta } = useRealSensors();

  const [userPosition, setUserPosition] = useState({ x: 0, y: 0 });
  const [isOnPath, setIsOnPath] = useState(true);
  const [closestPathIndex, setClosestPathIndex] = useState(0);
  const [deviationDistance, setDeviationDistance] = useState(0);

  const directions = state.path.length > 0 ? generateDirections(state.path) : [];

  /* ---------------- Map scaling ---------------- */
  const { transformX, transformY, padding } = useMemo(() => {
    const xs = parkingNodes.map(n => n.x);
    const ys = parkingNodes.map(n => n.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = 32;
    const scale = Math.min(
      (MAP_WIDTH - 2 * pad) / (maxX - minX || 1),
      (MAP_HEIGHT - 2 * pad) / (maxY - minY || 1)
    );

    return {
      transformX: (x: number) => (x - minX) * scale + pad,
      transformY: (y: number) => (y - minY) * scale + pad,
      padding: pad,
    };
  }, []);

  /* ---------------- User movement (REAL) ---------------- */
  useEffect(() => {
    if (!state.currentLocation) return;

    // Anchor once using QR
    if (userPosition.x === 0 && userPosition.y === 0) {
      setUserPosition({
        x: transformX(state.currentLocation.x),
        y: transformY(state.currentLocation.y),
      });
      return;
    }

    // Move only when a step is detected
    if (stepDelta.dx !== 0 || stepDelta.dy !== 0) {
      setUserPosition(prev => ({
        x: prev.x + stepDelta.dx,
        y: prev.y + stepDelta.dy,
      }));
    }
  }, [stepDelta, state.currentLocation]);

  /* ---------------- Path points ---------------- */
  const pathPoints = useMemo(
    () =>
      state.path.map(node => ({
        x: transformX(node.x),
        y: transformY(node.y),
      })),
    [state.path, transformX, transformY]
  );

  const pathData = useMemo(() => {
    if (pathPoints.length < 2) return '';
    return pathPoints.reduce(
      (d, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`),
      ''
    );
  }, [pathPoints]);

  /* ---------------- On-path detection ---------------- */
  useEffect(() => {
    if (pathPoints.length < 2) return;

    let minDist = Infinity;
    let idx = 0;

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i];
      const p2 = pathPoints[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((userPosition.x - p1.x) * dx + (userPosition.y - p1.y) * dy) /
            (dx * dx + dy * dy)
        )
      );

      const px = p1.x + t * dx;
      const py = p1.y + t * dy;
      const dist = Math.hypot(userPosition.x - px, userPosition.y - py);

      if (dist < minDist) {
        minDist = dist;
        idx = i;
      }
    }

    setDeviationDistance(minDist);
    setClosestPathIndex(idx);
    setIsOnPath(minDist <= PATH_DEVIATION_THRESHOLD);
  }, [userPosition, pathPoints]);

  /* ---------------- Status helpers ---------------- */
  const getStatusColor = () => {
    if (!state.vehicleLocation || !state.currentLocation) return '#9CA3AF';
    if (state.path.length === 0) return '#F59E0B';
    return isOnPath ? '#10B981' : '#EF4444';
  };

  const getStatusText = () => {
    if (!state.vehicleLocation) return 'Vehicle location not set';
    if (!state.currentLocation) return 'Current location not set';
    if (!isOnPath) return `Off path (${deviationDistance.toFixed(0)}px)`;
    return `On track – ${Math.max(0, directions.length - 1 - closestPathIndex)} steps remaining`;
  };

  const ParkingAndEntrances = useMemo(
  () => (
    <G>
      {parkingNodes
        .filter(n => n.type === 'parking')
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
        .filter(n => n.type === 'entrance')
        .map(node => {
          const x = transformX(node.x);
          const y = transformY(node.y);

          return (
            <G key={node.id}>
              <Rect
                x={x - 20}
                y={y - 8}
                width={40}
                height={16}
                rx={8}
                fill="#F59E0B"
              />
              <SvgText
                x={x}
                y={y + 4}
                fontSize={9}
                fontWeight="700"
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


  /* ============================ UI ============================ */
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

        {/* Status */}
        <View style={[styles.statusCard, { borderLeftColor: getStatusColor() }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusTitle}>Navigation Status</Text>
            {isOnPath ? (
              <CheckCircle size={18} color="#10B981" />
            ) : (
              <AlertTriangle size={18} color="#EF4444" />
            )}
          </View>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
            <Defs>
              <LinearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#EF4444" />
                <Stop offset="100%" stopColor="#DC2626" />
              </LinearGradient>
            </Defs>

            <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#F8FAFC" rx={12} />
            <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#F8FAFC" rx={12} />

{ParkingAndEntrances}

{pathData && (
  <Path
    d={pathData}
    stroke="url(#pathGradient)"
    strokeWidth={4}
    fill="none"
  />
)}

            {pathData && (
              <Path d={pathData} stroke="url(#pathGradient)" strokeWidth={4} fill="none" />
            )}

            {/* User */}
            {state.currentLocation && (
              <G>
                <Circle cx={userPosition.x} cy={userPosition.y} r={14} fill="#10B981" fillOpacity={0.3} />
                <Circle cx={userPosition.x} cy={userPosition.y} r={7} fill="#10B981" stroke="#FFF" strokeWidth={3} />
                <Line
                  x1={userPosition.x}
                  y1={userPosition.y}
                  x2={userPosition.x + Math.cos((heading * Math.PI) / 180) * 18}
                  y2={userPosition.y + Math.sin((heading * Math.PI) / 180) * 18}
                  stroke="#FFF"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </G>
            )}
          </Svg>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Map Legend</Text>
          <Text>🟢 Live Position</Text>
          <Text>🔴 Walking Path</Text>
          <Text>🚗 Vehicle</Text>
        </View>

        {/* Directions */}
        {directions.length > 0 && (
          <View style={styles.directionsContainer}>
            <Text style={styles.directionsTitle}>Step-by-Step Directions</Text>
            {directions.map((d, i) => (
              <Text key={i} style={styles.directionText}>
                {i + 1}. {d}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ============================ STYLES ============================ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: 40 },
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
  statusCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  statusTitle: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  statusText: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  mapContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
  },
  legendContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
  },
  legendTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  directionsContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  directionsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  directionText: { fontSize: 14, marginVertical: 4 },
});
