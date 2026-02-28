import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import { KalmanFilter } from '@/utils/KalmanFilter';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function useRealSensors() {
  const [heading, setHeading] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [stepLengthMeters, setStepLengthMeters] = useState(0.7);

  const headingKalman = useRef(new KalmanFilter(0.01, 3)).current;

  const avgMagnitude = useRef(1);
  const lastStepTime = useRef(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const magSub = Magnetometer.addListener(({ x, y }) => {
      const rawAngle = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
      const smoothHeading = headingKalman.filter(rawAngle);
      setHeading(smoothHeading);
    });
    Magnetometer.setUpdateInterval(80);

    const accSub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      avgMagnitude.current = avgMagnitude.current * 0.9 + magnitude * 0.1;

      const dynamicDelta = magnitude - avgMagnitude.current;
      const now = Date.now();
      const cooldownMs = 320;
      const threshold = 0.14;

      if (dynamicDelta > threshold && now - lastStepTime.current > cooldownMs) {
        lastStepTime.current = now;

        const estimated = clamp(0.6 + dynamicDelta * 1.1, 0.45, 0.9);
        setStepLengthMeters(estimated);
        setStepCount((prev) => prev + 1);
      }
    });
    Accelerometer.setUpdateInterval(40);

    return () => {
      magSub.remove();
      accSub.remove();
    };
  }, [headingKalman]);

  return { heading, stepCount, stepLengthMeters };
}
