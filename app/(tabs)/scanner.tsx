import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { QrCode, X } from "lucide-react-native";
import { Html5Qrcode } from "html5-qrcode"; // ✅ for web
import { useLocation } from "@/contexts/LocationContext";
import { getNodeByQRCode } from "@/utils/parkingData";
import { useLocalSearchParams } from 'expo-router';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>("back");
  const [hasScanned, setHasScanned] = useState(false);
  const { state, setVehicleLocation, setCurrentLocation } = useLocation();
  const html5QrCodeRef = useRef<any>(null);
  const params = useLocalSearchParams();
  const mode = params.mode as 'vehicle' | 'current';

  // Request camera permission for mobile
  useEffect(() => {
    if (Platform.OS !== "web" && !permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // ✅ Web: setup html5-qrcode
  useEffect(() => {
    if (Platform.OS === "web") {
      const qrRegionId = "html5qr-code-full-region";
      html5QrCodeRef.current = new Html5Qrcode(qrRegionId);

      Html5Qrcode.getCameras().then((devices) => {
        if (devices && devices.length) {
          const cameraId = devices[0].id;
          html5QrCodeRef.current
            .start(
              cameraId,
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
              },
              (decodedText: string) => handleBarCodeScanned({ data: decodedText }),
              (errorMessage: string) => {
                // console.log("QR error:", errorMessage);
              }
            )
            .catch((err: any) => console.error("QR start failed:", err));
        }
      });

      return () => {
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current.stop().catch(() => {});
          html5QrCodeRef.current.clear();
        }
      };
    }
  }, []);

 const handleBarCodeScanned = ({ data }: { data: string }) => {
  if (hasScanned) return;
  setHasScanned(true);

  const node = getNodeByQRCode(data);

  if (!node) {
    Alert.alert("Invalid QR Code", "This QR code is not recognized.", [
      { text: "Try Again", onPress: () => setHasScanned(false) },
    ]);
    return;
  }

  // REPLACE ENTIRE LOGIC WITH THIS:
  if (mode === 'vehicle') {
    setVehicleLocation(node);
    Alert.alert("✅ Vehicle Location Set", `Parked at ${node.id}`, [
      { text: "OK", onPress: () => router.back() },
    ]);
  } else if (mode === 'current') {
    if (node.id === state.vehicleLocation?.id) {
      Alert.alert("Same Location", "You are already at your vehicle.", [
        { text: "OK", onPress: () => setHasScanned(false) },
      ]);
      return;
    }
    setCurrentLocation(node);
    Alert.alert("✅ Current Location Set", `You are at ${node.id}`, [
      { text: "View Map", onPress: () => router.push("/map") },
      { text: "OK", onPress: () => router.back() },
    ]);
  }
};

  if (Platform.OS !== "web" && !permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (Platform.OS !== "web" && !permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>No camera permission.</Text>
        <TouchableOpacity onPress={requestPermission}>
          <Text>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Scanner</Text>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        {Platform.OS === "web" ? (
          <div id="html5qr-code-full-region" style={{ width: "100%", height: "100%" }} />
        ) : (
          <CameraView
            style={styles.camera}
            facing={facing}
            onBarcodeScanned={hasScanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  headerTitle: { color: "#fff", fontSize: 18, marginLeft: 12 },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
});
