// hooks/useSensors.ts
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

interface Offset {
  x: number;
  y: number;
}

export function useRealSensors() {
  const [heading, setHeading] = useState(0); // device rotation in degrees
  const [userOffset, setUserOffset] = useState<Offset>({ x: 0, y: 0 });

  useEffect(() => {
    // --- Web fallback ---
    if (Platform.OS === 'web') {
      // simulate movement with small random offsets
      const interval = setInterval(() => {
        setUserOffset(prev => ({
          x: prev.x + (Math.random() - 0.5) * 2,
          y: prev.y + (Math.random() - 0.5) * 2,
        }));
      }, 200);
      return () => clearInterval(interval);
    }

    // --- Native accelerometer subscription ---
    const subscription = Accelerometer.addListener(({ x, y }) => {
      const speed = 8; // adjust for sensitivity
      setUserOffset(prev => ({
        x: prev.x + x * speed,
        y: prev.y + y * speed,
      }));
      setHeading(Math.atan2(y, x) * (180 / Math.PI));
    });

    Accelerometer.setUpdateInterval(200);

    return () => {
      subscription && subscription.remove();
    };
  }, []);

  return { heading, userOffset };
}
