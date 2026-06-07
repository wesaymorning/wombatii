# reset-android.sh
#!/bin/bash
echo "Nuking stale Android build cache..."
rm -rf android/app/.cxx
rm -rf android/app/build
rm -rf android/build
rm -rf node_modules/react-native-ble-manager/android/build
cd android && ./gradlew clean && cd ..
echo "Done! Now run: npx expo run:android"