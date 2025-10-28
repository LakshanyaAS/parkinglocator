#!/bin/bash
set -e

# Fix React Native Gradle plugin compatibility
PLUGIN_FILE="node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/build.gradle.kts"

if [ -f "$PLUGIN_FILE" ]; then
  echo "🩹 Patching $PLUGIN_FILE ..."
  sed -i 's/allWarningsAsErrors =/allWarningsAsErrors.set(/' "$PLUGIN_FILE"
  sed -i 's/\:\? false/)\n/' "$PLUGIN_FILE"
fi
