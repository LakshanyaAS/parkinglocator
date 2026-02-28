import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Car, MapPin, Navigation, RotateCcw, Play } from 'lucide-react-native';
import { ParkingNode, useLocation } from '@/contexts/LocationContext';
import { findShortestPathOnGraph, findShortestPathWithStats, generateDirections } from '@/utils/astar';
import { getNodeById } from '@/utils/parkingData';

export default function HomeScreen() {
  const nowMs = () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  const router = useRouter();
  const { state, setPath, reset, setVehicleLocation, setCurrentLocation } = useLocation();
  const [lastPathMs, setLastPathMs] = useState<number | null>(null);
  const [benchStats, setBenchStats] = useState<{
    iterations: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
  } | null>(null);
  const [bigBenchStats, setBigBenchStats] = useState<{
    iterations: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    nodes: number;
  } | null>(null);

  const bigGraph = useMemo(() => {
    const width = 80;
    const height = 80;
    const nodesById = new Map<string, ParkingNode>();
    const edges: { [key: string]: string[] } = {};

    const idFor = (x: number, y: number) => `G${x}_${y}`;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const id = idFor(x, y);
        nodesById.set(id, {
          id,
          x,
          y,
          x_px: x,
          y_px: y,
          type: 'path',
        });
        edges[id] = [];
      }
    }

    const link = (a: string, b: string) => {
      edges[a].push(b);
      edges[b].push(a);
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const id = idFor(x, y);
        if (x + 1 < width) link(id, idFor(x + 1, y));
        if (y + 1 < height) link(id, idFor(x, y + 1));
      }
    }

    const start = nodesById.get(idFor(0, 0))!;
    const goal = nodesById.get(idFor(width - 1, height - 1))!;
    const getNode = (id: string) => nodesById.get(id) ?? null;
    return { start, goal, edges, getNode, nodes: nodesById.size };
  }, []);

  
  useEffect(() => {
    if (state.vehicleLocation && state.currentLocation) {
      const { path: newPath, durationMs } = findShortestPathWithStats(
        state.currentLocation,
        state.vehicleLocation
      );
      setLastPathMs(durationMs);

      const iterations = 50;
      const samples: number[] = [];
      for (let i = 0; i < iterations; i += 1) {
        const { durationMs: ms } = findShortestPathWithStats(
          state.currentLocation,
          state.vehicleLocation
        );
        samples.push(ms);
      }
      samples.sort((a, b) => a - b);
      const avgMs = samples.reduce((acc, v) => acc + v, 0) / samples.length;
      const p50Ms = samples[Math.floor(0.5 * (samples.length - 1))];
      const p95Ms = samples[Math.floor(0.95 * (samples.length - 1))];
      setBenchStats({ iterations, avgMs, p50Ms, p95Ms });
      console.log(
        `[path-bench] n=${iterations} avg=${avgMs.toFixed(2)}ms p50=${p50Ms.toFixed(
          2
        )}ms p95=${p95Ms.toFixed(2)}ms`
      );

      const isDifferent =
        newPath.length !== state.path.length ||
        newPath.some((node, idx) => node.id !== state.path[idx]?.id);

      if (isDifferent) {
        setPath(newPath);
      }
    }
  }, [state.vehicleLocation, state.currentLocation, state.path]);

  useEffect(() => {
    const iterations = 30;
    const samples: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
      const t0 = nowMs();
      findShortestPathOnGraph(bigGraph.start, bigGraph.goal, bigGraph.edges, bigGraph.getNode);
      const t1 = nowMs();
      samples.push(t1 - t0);
    }
    samples.sort((a, b) => a - b);
    const avgMs = samples.reduce((acc, v) => acc + v, 0) / samples.length;
    const p50Ms = samples[Math.floor(0.5 * (samples.length - 1))];
    const p95Ms = samples[Math.floor(0.95 * (samples.length - 1))];
    setBigBenchStats({ iterations, avgMs, p50Ms, p95Ms, nodes: bigGraph.nodes });
    console.log(
      `[big-graph-bench] nodes=${bigGraph.nodes} n=${iterations} avg=${avgMs.toFixed(
        2
      )}ms p50=${p50Ms.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms`
    );
  }, [bigGraph]);

 const handleScanVehicle = () => {
  router.push({ pathname: '/scanner', params: { mode: 'vehicle' } });
};

const handleScanCurrent = () => {
  if (!state.vehicleLocation) {
    Alert.alert('Vehicle Location Required', 'Please scan your vehicle first');
    return;
  }
  router.push({ pathname: '/scanner', params: { mode: 'current' } });
};

  const handleViewMap = () => {
    router.push('/map');
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Locations',
      'This will clear both vehicle and current locations. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: reset },
      ]
    );
  };

  const handleDemo = () => {
  
    const vehicleNode = getNodeById('P15');
    const currentNode = getNodeById('P4');
    
    if (vehicleNode && currentNode) {
      setVehicleLocation(vehicleNode);
      setCurrentLocation(currentNode);
      
      Alert.alert(
        'Demo Mode Activated',
        'Vehicle set at ${vehicleNode.id}, Current location at ${currentNode.id}. Path calculated!',
        [
          { text: 'View Map', onPress: () => router.push('/map') },
          { text: 'OK' },
        ]
      );
    }
  };


  const directions = useMemo(() => generateDirections(state.path), [state.path]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Parking Locator</Text>
          <Text style={styles.subtitle}>Find your way back to your vehicle</Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Car size={24} color="#2563EB" />
              <Text style={styles.statusTitle}>Vehicle Location</Text>
            </View>
            <Text style={styles.statusValue}>
              {state.vehicleLocation ? state.vehicleLocation.id : 'Not Set'}
            </Text>
            <Text style={styles.statusSubtext}>
              {state.vehicleLocation ? 'Vehicle parked at this spot' : 'Scan QR code at your parking spot'}
            </Text>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <MapPin size={24} color="#059669" />
              <Text style={styles.statusTitle}>Current Location</Text>
            </View>
            <Text style={styles.statusValue}>
              {state.currentLocation ? state.currentLocation.id : 'Not Set'}
            </Text>
            <Text style={styles.statusSubtext}>
              {state.currentLocation ? 'Your current position' : 'Scan QR code at your current location'}
            </Text>
          </View>
        </View>

        {state.path.length > 1 && (
          <View style={styles.pathCard}>
            <View style={styles.pathHeader}>
              <Navigation size={24} color="#DC2626" />
              <Text style={styles.pathTitle}>Path Found</Text>
            </View>
            <Text style={styles.pathText}>
              {directions.length-1 } steps to your vehicle
            </Text>
            <Text style={styles.pathSubtext}>
              Path: {state.path.map(node => node.id).join(' → ')}
            </Text>
            {lastPathMs !== null && (
              <Text style={styles.pathSubtext}>
                Computation: {lastPathMs.toFixed(2)} ms
              </Text>
            )}
            {benchStats && (
              <Text style={styles.pathSubtext}>
                Benchmark (n={benchStats.iterations}): avg {benchStats.avgMs.toFixed(2)}
                ms, p50 {benchStats.p50Ms.toFixed(2)} ms, p95{' '}
                {benchStats.p95Ms.toFixed(2)} ms
              </Text>
            )}
            {bigBenchStats && (
              <Text style={styles.pathSubtext}>
                Big Graph ({bigBenchStats.nodes} nodes, n={bigBenchStats.iterations}): avg{' '}
                {bigBenchStats.avgMs.toFixed(2)} ms, p50 {bigBenchStats.p50Ms.toFixed(2)} ms,
                p95 {bigBenchStats.p95Ms.toFixed(2)} ms
              </Text>
            )}
          </View>
        )}

        {state.path.length > 1 && (
          <View style={styles.directionsPreview}>
            <Text style={styles.directionsTitle}>Quick Directions:</Text>
            {directions.slice(0, 3).map((direction, index) => (
              <Text key={index} style={styles.directionText}>
                {index + 1}. {direction}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleScanVehicle}
          >
            <Car size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Scan Vehicle Location</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.secondaryButton,
              !state.vehicleLocation && styles.disabledButton
            ]}
            onPress={handleScanCurrent}
            disabled={!state.vehicleLocation}
          >
            <MapPin size={20} color={!state.vehicleLocation ? "#9CA3AF" : "#059669"} />
            <Text style={[
              styles.buttonText,
              styles.secondaryButtonText,
              !state.vehicleLocation && styles.disabledButtonText
            ]}>
              Scan Current Location
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.tertiaryButton]}
            onPress={handleViewMap}
          >
            <Navigation size={20} color="#DC2626" />
            <Text style={[styles.buttonText, styles.tertiaryButtonText]}>View Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.demoButton]}
            onPress={handleDemo}
          >
            <Play size={20} color="#7C3AED" />
            <Text style={[styles.buttonText, styles.demoButtonText]}>Try Demo</Text>
          </TouchableOpacity>

          {(state.vehicleLocation || state.currentLocation) && (
            <TouchableOpacity
              style={[styles.button, styles.resetButton]}
              onPress={handleReset}
            >
              <RotateCcw size={20} color="#6B7280" />
              <Text style={[styles.buttonText, styles.resetButtonText]}>Reset All</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center' },
  statusContainer: { marginBottom: 20 },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginLeft: 12 },
  statusValue: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  statusSubtext: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  pathCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  pathHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pathTitle: { fontSize: 18, fontWeight: '600', color: '#DC2626', marginLeft: 12 },
  pathText: { fontSize: 16, fontWeight: '600', color: '#991B1B', marginBottom: 4 },
  pathSubtext: { fontSize: 12, color: '#7F1D1D', lineHeight: 16 },
  directionsPreview: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  directionsTitle: { fontSize: 16, fontWeight: '600', color: '#0369A1', marginBottom: 8 },
  directionText: { fontSize: 14, color: '#0C4A6E', marginBottom: 4, paddingLeft: 8 },
  demoButton: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#7C3AED' },
  buttonContainer: { gap: 12 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 56,
  },
  primaryButton: { backgroundColor: '#2563EB' },
  secondaryButton: { backgroundColor: '#059669' },
  tertiaryButton: { backgroundColor: '#DC2626' },
  resetButton: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  disabledButton: { backgroundColor: '#F3F4F6' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginLeft: 8 },
  secondaryButtonText: { color: '#FFFFFF' },
  tertiaryButtonText: { color: '#FFFFFF' },
  demoButtonText: { color: '#7C3AED' },
  resetButtonText: { color: '#6B7280' },
  disabledButtonText: { color: '#9CA3AF' },
});
