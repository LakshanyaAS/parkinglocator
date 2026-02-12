import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Accelerometer, Magnetometer } from 'expo-sensors';

export function useRealSensors() {
  const [heading, setHeading] = useState(0);
  const [stepDelta, setStepDelta] = useState({ dx: 0, dy: 0 });

  const lastMagnitude = useRef(0);
  const lastStepTime = useRef(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Compass
    const magSub = Magnetometer.addListener(({ x, y }) => {
      const angle = Math.atan2(y, x) * (180 / Math.PI);
      setHeading((angle + 360) % 360);
    });
    Magnetometer.setUpdateInterval(150);

    // Step detection
    const accSub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      const diff = Math.abs(mag - lastMagnitude.current);
      lastMagnitude.current = mag;

      const now = Date.now();

      if (diff > 0.18 && now - lastStepTime.current > 350) {
        lastStepTime.current = now;

        const stepPx = 6; // walking distance
        const rad = (heading * Math.PI) / 180;

        setStepDelta({
          dx: Math.cos(rad) * stepPx,
          dy: Math.sin(rad) * stepPx,
        });
      } else {
        setStepDelta({ dx: 0, dy: 0 });
      }
    });

    Accelerometer.setUpdateInterval(100);

    return () => {
      magSub.remove();
      accSub.remove();
    };
  }, [heading]);

  return { heading, stepDelta };
}
