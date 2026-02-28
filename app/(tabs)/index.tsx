import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Car, MapPin, Navigation, RotateCcw, Play } from 'lucide-react-native';
import { ParkingNode, useLocation } from '@/contexts/LocationContext';
import {
  findShortestPathOnGraphWithStats,
  findShortestPathWithStats,
  generateDirections,
} from '@/utils/astar';
import { getNodeById } from '@/utils/parkingData';

export default function HomeScreen() {
  const router = useRouter();
  const { state, setPath, reset, setVehicleLocation, setCurrentLocation } = useLocation();
  const [lastPathMs, setLastPathMs] = useState<number | null>(null);
  const [lastStats, setLastStats] = useState<{
    expandedNodes: number;
    exploredPct: number | null;
    openSetPeak: number;
    closedSetSize: number;
    pathRatio: number | null;
  } | null>(null);
  const [benchStats, setBenchStats] = useState<{
    iterations: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    avgExpanded: number;
    avgExploredPct: number | null;
    avgOpenPeak: number;
    avgClosed: number;
    avgPathRatio: number | null;
  } | null>(null);
  const [dijkstraStats, setDijkstraStats] = useState<{
    iterations: number;
    avgMs: number;
    avgExpanded: number;
    avgExploredPct: number | null;
    avgOpenPeak: number;
    avgClosed: number;
  } | null>(null);
  const [bigBenchStats, setBigBenchStats] = useState<{
    iterations: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    nodes: number;
    avgExpanded: number;
  } | null>(null);
  const [midBenchStats, setMidBenchStats] = useState<{
    iterations: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    nodes: number;
    avgExpanded: number;
  } | null>(null);
  const [midCompareStats, setMidCompareStats] = useState<{
    iterations: number;
    aStarExpanded: number;
    dijkstraExpanded: number;
    aStarMs: number;
    dijkstraMs: number;
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
          floor: 0,
          type: 'path',
          qrCode: null,
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

  const midGraph = useMemo(() => {
    const width = 60;
    const height = 60;
    const nodesById = new Map<string, ParkingNode>();
    const edges: { [key: string]: string[] } = {};

    const idFor = (x: number, y: number) => `M${x}_${y}`;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const id = idFor(x, y);
        nodesById.set(id, {
          id,
          x,
          y,
          x_px: x,
          y_px: y,
          floor: 0,
          type: 'path',
          qrCode: null,
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
      const avg = (arr: number[]) => arr.reduce((acc, v) => acc + v, 0) / arr.length;

      const single = findShortestPathWithStats(
        state.currentLocation,
        state.vehicleLocation,
        undefined,
        { heuristicEnabled: true }
      );
      setLastPathMs(single.durationMs);
      setLastStats({
        expandedNodes: single.stats.expandedNodes,
        exploredPct: single.stats.exploredPct,
        openSetPeak: single.stats.openSetPeak,
        closedSetSize: single.stats.closedSetSize,
        pathRatio:
          single.stats.pathDistance > 0
            ? single.stats.straightLineDistance / single.stats.pathDistance
            : null,
      });

      const iterations = 50;
      const aMs: number[] = [];
      const aExpanded: number[] = [];
      const aExplored: number[] = [];
      const aOpenPeak: number[] = [];
      const aClosed: number[] = [];
      const aPathRatio: number[] = [];

      const dMs: number[] = [];
      const dExpanded: number[] = [];
      const dExplored: number[] = [];
      const dOpenPeak: number[] = [];
      const dClosed: number[] = [];

      for (let i = 0; i < iterations; i += 1) {
        const a = findShortestPathWithStats(
          state.currentLocation,
          state.vehicleLocation,
          undefined,
          { heuristicEnabled: true }
        );
        aMs.push(a.durationMs);
        aExpanded.push(a.stats.expandedNodes);
        if (a.stats.exploredPct !== null) aExplored.push(a.stats.exploredPct);
        aOpenPeak.push(a.stats.openSetPeak);
        aClosed.push(a.stats.closedSetSize);
        if (a.stats.pathDistance > 0) {
          aPathRatio.push(a.stats.straightLineDistance / a.stats.pathDistance);
        }

        const d = findShortestPathWithStats(
          state.currentLocation,
          state.vehicleLocation,
          undefined,
          { heuristicEnabled: false }
        );
        dMs.push(d.durationMs);
        dExpanded.push(d.stats.expandedNodes);
        if (d.stats.exploredPct !== null) dExplored.push(d.stats.exploredPct);
        dOpenPeak.push(d.stats.openSetPeak);
        dClosed.push(d.stats.closedSetSize);
      }

      aMs.sort((a, b) => a - b);
      const avgMs = avg(aMs);
      const p50Ms = aMs[Math.floor(0.5 * (aMs.length - 1))];
      const p95Ms = aMs[Math.floor(0.95 * (aMs.length - 1))];
      setBenchStats({
        iterations,
        avgMs,
        p50Ms,
        p95Ms,
        avgExpanded: avg(aExpanded),
        avgExploredPct: aExplored.length > 0 ? avg(aExplored) : null,
        avgOpenPeak: avg(aOpenPeak),
        avgClosed: avg(aClosed),
        avgPathRatio: aPathRatio.length > 0 ? avg(aPathRatio) : null,
      });

      setDijkstraStats({
        iterations,
        avgMs: avg(dMs),
        avgExpanded: avg(dExpanded),
        avgExploredPct: dExplored.length > 0 ? avg(dExplored) : null,
        avgOpenPeak: avg(dOpenPeak),
        avgClosed: avg(dClosed),
      });

      console.log(
        `[path-bench] A* n=${iterations} avg=${avgMs.toFixed(2)}ms p50=${p50Ms.toFixed(
          2
        )}ms p95=${p95Ms.toFixed(2)}ms expanded=${avg(aExpanded).toFixed(1)}`
      );
      console.log(
        `[path-bench] Dijkstra n=${iterations} avg=${avg(dMs).toFixed(
          2
        )}ms expanded=${avg(dExpanded).toFixed(1)}`
      );

      const newPath = single.path;
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
    const expanded: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
      const result = findShortestPathOnGraphWithStats(
        bigGraph.start,
        bigGraph.goal,
        bigGraph.edges,
        bigGraph.getNode,
        { nodesTotal: bigGraph.nodes, heuristicEnabled: true }
      );
      samples.push(result.durationMs);
      expanded.push(result.stats.expandedNodes);
    }
    samples.sort((a, b) => a - b);
    const avgMs = samples.reduce((acc, v) => acc + v, 0) / samples.length;
    const p50Ms = samples[Math.floor(0.5 * (samples.length - 1))];
    const p95Ms = samples[Math.floor(0.95 * (samples.length - 1))];
    const avgExpanded =
      expanded.reduce((acc, v) => acc + v, 0) / expanded.length;
    setBigBenchStats({ iterations, avgMs, p50Ms, p95Ms, nodes: bigGraph.nodes, avgExpanded });
    console.log(
      `[big-graph-bench] nodes=${bigGraph.nodes} n=${iterations} avg=${avgMs.toFixed(
        2
      )}ms p50=${p50Ms.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms expanded=${avgExpanded.toFixed(1)}`
    );
  }, [bigGraph]);

  useEffect(() => {
    const iterations = 30;
    const samples: number[] = [];
    const expanded: number[] = [];
    const dSamples: number[] = [];
    const dExpanded: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
      const a = findShortestPathOnGraphWithStats(
        midGraph.start,
        midGraph.goal,
        midGraph.edges,
        midGraph.getNode,
        { nodesTotal: midGraph.nodes, heuristicEnabled: true }
      );
      samples.push(a.durationMs);
      expanded.push(a.stats.expandedNodes);

      const d = findShortestPathOnGraphWithStats(
        midGraph.start,
        midGraph.goal,
        midGraph.edges,
        midGraph.getNode,
        { nodesTotal: midGraph.nodes, heuristicEnabled: false }
      );
      dSamples.push(d.durationMs);
      dExpanded.push(d.stats.expandedNodes);
    }
    samples.sort((a, b) => a - b);
    const avgMs = samples.reduce((acc, v) => acc + v, 0) / samples.length;
    const p50Ms = samples[Math.floor(0.5 * (samples.length - 1))];
    const p95Ms = samples[Math.floor(0.95 * (samples.length - 1))];
    const avgExpanded =
      expanded.reduce((acc, v) => acc + v, 0) / expanded.length;
    setMidBenchStats({ iterations, avgMs, p50Ms, p95Ms, nodes: midGraph.nodes, avgExpanded });

    const avgDijkstraMs = dSamples.reduce((acc, v) => acc + v, 0) / dSamples.length;
    const avgDijkstraExpanded =
      dExpanded.reduce((acc, v) => acc + v, 0) / dExpanded.length;
    setMidCompareStats({
      iterations,
      aStarExpanded: avgExpanded,
      dijkstraExpanded: avgDijkstraExpanded,
      aStarMs: avgMs,
      dijkstraMs: avgDijkstraMs,
    });
    console.log(
      `[mid-graph-bench] nodes=${midGraph.nodes} n=${iterations} avg=${avgMs.toFixed(
        2
      )}ms p50=${p50Ms.toFixed(2)}ms p95=${p95Ms.toFixed(
        2
      )}ms expanded=${avgExpanded.toFixed(1)}`
    );
    console.log(
      `[mid-graph-bench] Dijkstra n=${iterations} avg=${avgDijkstraMs.toFixed(
        2
      )}ms expanded=${avgDijkstraExpanded.toFixed(1)}`
    );
  }, [midGraph]);

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
  const scaleTime =
    midBenchStats && bigBenchStats ? bigBenchStats.avgMs / midBenchStats.avgMs : null;
  const scaleExpanded =
    midBenchStats && bigBenchStats
      ? bigBenchStats.avgExpanded / midBenchStats.avgExpanded
      : null;

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
            {lastStats && (
              <Text style={styles.pathSubtext}>
                Expanded: {Math.round(lastStats.expandedNodes)} nodes | Explored:{' '}
                {lastStats.exploredPct !== null ? `${lastStats.exploredPct.toFixed(2)}%` : 'n/a'}
              </Text>
            )}
            {lastStats && (
              <Text style={styles.pathSubtext}>
                Open peak: {Math.round(lastStats.openSetPeak)} | Closed:{' '}
                {Math.round(lastStats.closedSetSize)} | Path ratio:{' '}
                {lastStats.pathRatio !== null ? lastStats.pathRatio.toFixed(3) : 'n/a'}
              </Text>
            )}
            {lastPathMs !== null && (
              <Text style={styles.pathSubtext}>
                Computation: {lastPathMs.toFixed(2)} ms
              </Text>
            )}
            {benchStats && (
              <Text style={styles.pathSubtext}>
                Benchmark (n={benchStats.iterations}): avg {benchStats.avgMs.toFixed(2)}
                ms, p50 {benchStats.p50Ms.toFixed(2)} ms, p95{' '}
                {benchStats.p95Ms.toFixed(2)} ms, expanded {benchStats.avgExpanded.toFixed(1)}
                {benchStats.avgExploredPct !== null
                  ? ` (${benchStats.avgExploredPct.toFixed(2)}%)`
                  : ''}
              </Text>
            )}
            {benchStats && (
              <Text style={styles.pathSubtext}>
                Memory proxy: open peak {benchStats.avgOpenPeak.toFixed(1)} | closed{' '}
                {benchStats.avgClosed.toFixed(1)} | path ratio{' '}
                {benchStats.avgPathRatio !== null ? benchStats.avgPathRatio.toFixed(3) : 'n/a'}
              </Text>
            )}
            {dijkstraStats && (
              <Text style={styles.pathSubtext}>
                Dijkstra (n={dijkstraStats.iterations}): avg {dijkstraStats.avgMs.toFixed(2)}
                ms, expanded {dijkstraStats.avgExpanded.toFixed(1)}
                {dijkstraStats.avgExploredPct !== null
                  ? ` (${dijkstraStats.avgExploredPct.toFixed(2)}%)`
                  : ''}
              </Text>
            )}
            {bigBenchStats && (
              <Text style={styles.pathSubtext}>
                Big Graph ({bigBenchStats.nodes} nodes, n={bigBenchStats.iterations}): avg{' '}
                {bigBenchStats.avgMs.toFixed(2)} ms, p50 {bigBenchStats.p50Ms.toFixed(2)} ms,
                p95 {bigBenchStats.p95Ms.toFixed(2)} ms, expanded{' '}
                {bigBenchStats.avgExpanded.toFixed(1)}
              </Text>
            )}
            {midBenchStats && (
              <Text style={styles.pathSubtext}>
                Mid Graph ({midBenchStats.nodes} nodes, n={midBenchStats.iterations}): avg{' '}
                {midBenchStats.avgMs.toFixed(2)} ms, p50 {midBenchStats.p50Ms.toFixed(2)} ms,
                p95 {midBenchStats.p95Ms.toFixed(2)} ms, expanded{' '}
                {midBenchStats.avgExpanded.toFixed(1)}
              </Text>
            )}
            {midCompareStats && (
              <Text style={styles.pathSubtext}>
                Mid Graph A* vs Dijkstra: expanded {midCompareStats.aStarExpanded.toFixed(1)}
                vs {midCompareStats.dijkstraExpanded.toFixed(1)}, avg ms{' '}
                {midCompareStats.aStarMs.toFixed(2)} vs{' '}
                {midCompareStats.dijkstraMs.toFixed(2)}
              </Text>
            )}
            {scaleTime !== null && scaleExpanded !== null && (
              <Text style={styles.pathSubtext}>
                Scalability (6400 vs 3600): time x{scaleTime.toFixed(2)}, expanded x
                {scaleExpanded.toFixed(2)}
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
