# wombatii
React-native ble experimental project

# adroid debug build via expo

From cmd prompt:
    npx expo run:android

# to create an adroind release

cd android
./gradlew assembleRelease

# to unistall debug build
adb uninstall com.jonniewdt2.wombatii

# to install release build
adb install android/app/build/outputs/apk/release/app-release.apk
