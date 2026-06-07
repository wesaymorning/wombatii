import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import BleDevices from './assets/components/BleDevices';

import { fonts, fontSize } from './assets/utils/fonts';
import { colors } from './assets/utils/colors';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>wombatii</Text>
      <BleDevices />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSize.font20,
    color: colors.white
  }
});
