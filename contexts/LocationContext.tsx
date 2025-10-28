import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ParkingNode {
  id: string;
  x: number;
  y: number;
  type: 'parking' | 'junction' | 'entrance'|'path'|null;
  qrCode: string|null;
}

export interface LocationState {
  vehicleLocation: ParkingNode | null;
  currentLocation: ParkingNode | null;
  path: ParkingNode[];
  isScanning: boolean;
  scanType: 'vehicle' | 'current' | null;
}

interface LocationContextType {
  state: LocationState;
  setVehicleLocation: (location: ParkingNode) => void;
  setCurrentLocation: (location: ParkingNode) => void;
  setPath: (path: ParkingNode[]) => void;
  startScanning: (type: 'vehicle' | 'current') => void;
  stopScanning: () => void;
  reset: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [state, setState] = useState<LocationState>({
    vehicleLocation: null,
    currentLocation: null,
    path: [],
    isScanning: false,
    scanType: null,
  });

  const setVehicleLocation = (location: ParkingNode) => {
    setState(prev => ({ ...prev, vehicleLocation: location }));
  };

  const setCurrentLocation = (location: ParkingNode) => {
    setState(prev => ({ ...prev, currentLocation: location }));
  };

  const setPath = (path: ParkingNode[]) => {
    setState(prev => ({ ...prev, path }));
  };

  const startScanning = (type: 'vehicle' | 'current') => {
    setState(prev => ({ ...prev, isScanning: true, scanType: type }));
  };

  const stopScanning = () => {
    setState(prev => ({ ...prev, isScanning: false, scanType: null }));
  };

  const reset = () => {
    setState({
      vehicleLocation: null,
      currentLocation: null,
      path: [],
      isScanning: false,
      scanType: null,
    });
  };

  return (
    <LocationContext.Provider
      value={{
        state,
        setVehicleLocation,
        setCurrentLocation,
        setPath,
        startScanning,
        stopScanning,
        reset,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};