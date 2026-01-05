import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Car, MapPin, Navigation, RotateCcw, Play } from 'lucide-react-native';
import { useLocation } from '@/contexts/LocationContext';
import { findShortestPath, generateDirections } from '@/utils/astar';
import { getNodeById } from '@/utils/parkingData';

export default function HomeScreen() {
  const router = useRouter();
  const { state, setPath, reset, setVehicleLocation, setCurrentLocation } = useLocation();

  
  useEffect(() => {
    if (state.vehicleLocation && state.currentLocation) {
      const newPath = findShortestPath(state.currentLocation, state.vehicleLocation);

      const isDifferent =
        newPath.length !== state.path.length ||
        newPath.some((node, idx) => node.id !== state.path[idx]?.id);

      if (isDifferent) {
        setPath(newPath);
      }
    }
  }, [state.vehicleLocation, state.currentLocation, state.path]);

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
