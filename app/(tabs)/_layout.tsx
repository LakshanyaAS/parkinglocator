import { Stack } from 'expo-router';

export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="scanner" />
      <Stack.Screen name="map" />
    </Stack>
  );
}
