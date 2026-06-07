import { FlatList, 
    Image, 
    NativeEventEmitter, 
    NativeModules, 
    PermissionsAndroid, 
    StyleSheet, 
    Text, 
    TouchableOpacity, 
    View, 
    Platform,
    Alert,
    Linking,
    ScrollView } from 'react-native'
import React, { useEffect, useState } from 'react'
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import BleManager, { 
    BleDisconnectPeripheralEvent,
    BleManagerDidUpdateValueForCharacteristicEvent,
    Peripheral } 
    from 'react-native-ble-manager';
import { Collapsible } from '@/assets/components/Collapsible';
import {LogBox} from 'react-native';
import { fonts, fontSize } from '../utils/fonts';
import { colors } from '../utils/colors';
import companyIdentifiers from '../data/company_identifiers';

const SERVICE_UUIDS: string[] = {};

export interface Stats {
    name: string;
    count: number;
}

  function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

const BleDevices = () => {

    const [isScanning, setIsScanning] = useState(false);
    const [currentDevice, setCurrentDevice] = useState(null);
    const [deviceStats, setDeviceStats] = useState<{ name: string; count: number }[]>([]);
    const [refreshCount, setRefreshCount] = useState<number>(0);

    const [peripherals, setPeripherals] = useState(
        new Map<Peripheral["id"], Peripheral>()
    );

    const [companyDevices, setCompanyDevices] = useState([]);

    const BleManagerModule = NativeModules.BleManager;
    const bleEmitter = new NativeEventEmitter({
        ...BleManagerModule,
        addListener: BleManagerModule?.addListener ?? (() => {}),
        removeListeners: BleManagerModule?.removeListeners ?? (() => {}),
        });

    useEffect(() => {
        BleManager.start({ showAlert: false })
        .then(() => console.debug("BleManager started."))
        .catch((error: any) =>
            console.error("BleManager could not be started.", error)
        );

        const listeners: any[] = [
            BleManager.onDiscoverPeripheral(handleDiscoverPeripheral),
            BleManager.onStopScan(handleStopScan),
            BleManager.onConnectPeripheral(handleConnectPeripheral),
            BleManager.onDidUpdateValueForCharacteristic(handleUpdateValueForCharacteristic),
            BleManager.onDisconnectPeripheral(handleDisconnectedPeripheral),
        ];

        requestPermissions();

        return () => {
            for (const listener of listeners) {
                listener.remove();
            }
        };
    }, []);

    useEffect(() => {

        if (refreshCount == 5) {
            updateStats();
            setRefreshCount(0);
        }
        else {
            setRefreshCount((prev) => prev + 1);
        }   
    }, [peripherals]);

    const updateStats = () => {

        let statoos: Record<string, number> = {};
        peripherals.forEach((value, key) => {

            for (const [key, valueo] of Object.entries(value.advertising.manufacturerData)) {

                let compId = key;
                let compStringo = companyIdentifiers[compId];
                if (compStringo === undefined) {
                    compStringo = compId;
                }

                if (statoos.hasOwnProperty(compStringo)) { statoos[compStringo] += 1; }
                else { statoos[compStringo] = 1; }

                let deviceStatsList = [];
                for (const [key, value] of Object.entries(statoos)) {
                    deviceStatsList.push({"name": key, "count": value});
                }
                setDeviceStats(deviceStatsList);
            }
        });

    }

    const requestPermissions = async() => {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        ])

        if (granted) {
            console.log("permissions granted");
            //startScanning()
        }
    }

    const handleDisconnectedPeripheral = (
            event: BleDisconnectPeripheralEvent
        ) => {
            console.debug(`[handleDisconnectedPeripheral][${event.peripheral}] disconnected.`);
            setPeripherals((map) => {
            let p = map.get(event.peripheral);
            if (p) {
                p.connected = false;
                return new Map(map.set(event.peripheral, p));
            }
            return map;
            });
        };

    const handleConnectPeripheral = (event: any) => {
        console.log(`[handleConnectPeripheral][${event.peripheral}] connected.`);
    };

    const handleUpdateValueForCharacteristic = async (
        data: BleManagerDidUpdateValueForCharacteristicEvent
    ) => {
        console.debug(
        `[handleUpdateValueForCharacteristic] received data from '${data.peripheral}' with characteristic='${data.characteristic}' and value='${data.value}====='`
        );
    };

    const handleStopScan = () => {
        setIsScanning(false);
        console.debug("[handleStopScan] scan is stopped.");
    };

    const handleDiscoverPeripheral = (peripheral: Peripheral) => {
        console.debug("[handleDiscoverPeripheral] new BLE peripheral=", peripheral);

        setPeripherals((map) => {
            return new Map(map.set(peripheral.id, peripheral));
        });
    };

    const startScanning = () => {
        if (!isScanning) {
             BleManager.scan({ serviceUUIDs: [], seconds: 10, allowDuplicates: false }).then(() => {
                // Success code
                setIsScanning(true);
                console.log("Scan started");
            })
            .catch((error: any) => {
                // Failure code
                console.error("scan start error :::: " + error);
            });
        }
    }

    const stopScanning = () => {
        BleManager.stopScan().then(() => {
            // Success code
            console.log("Scan stopped");
        })
        .catch((error: any) => {
            // Failure code
            console.error("scan stop error :::: " + error);
        });
    }

    const onConnect = async (item: any, index: number) => {
        console.log("CONNECTED DEVICE:::", item)
        try {
            await BleManager.connect(item.id);
            console.log('Connected');
            setCurrentDevice(item)

            const res = await BleManager.retrieveServices(item.id);
            console.log("RES::::", JSON.stringify(res))
            onServicesDiscovered(res, item)
        } catch (error) {
            // Failure code
            console.error(error);
        }
    };

    const onDisconnect = () => {
        BleManager.disconnect(currentDevice?.id).then(() => {
            setCurrentDevice(null)
            //clearInterval(distanceInterval);
            //setStatus('Lock');
        })
    }

    const onServicesDiscovered = (result: any, item: any) => {
        const services = result?.services;
        const characteristics = result?.characteristics;

        services.forEach((service: any) => {
            const serviceUUID = service.uuid;

            onChangeCharacteristics(serviceUUID, characteristics, item)
        });
    };

    const onChangeCharacteristics = (serviceUUID: any, result: any, item: any) => {
        console.log("SERVICE UUIDS:::", serviceUUID)
        // console.log("RESULT", result)
        result.forEach((characteristic: any) => {
            const characteristicUUID = characteristic.characteristic
            console.log('characteristic:' + characteristicUUID);
            /*
            if (characteristicUUID === "00002a01-0000-1000-8000-00805f9b34fb") {
                readCharacteristic(characteristicUUID, serviceUUID, item)
            }
            if (characteristicUUID === TEMPERATURE_UUID || characteristicUUID === HUMIDITY_UUID) {
                BleManager.startNotification(item.id, serviceUUID, characteristicUUID)
                    .then(() => {
                        console.log('Notification started for characteristic:', characteristicUUID);
                    })
                    .catch(error => {
                        console.error('Notification error:', error);
                    });
            }
                    */

        })
    }

    const enableBluetooth = async () => {
        try {
            console.debug("[enableBluetooth]");
            await BleManager.enableBluetooth();
        } catch (error) {
        console.error("[enableBluetooth] thrown", error);
        }
    };

    const onScanPress = async () => {
        const state = await BleManager.checkState();

        console.log("BLE state:" + state);

        if (state === "off") {
            if (Platform.OS == "ios") {
                Alert.alert(
                "Enable Bluetooth",
                "Please enable Bluetooth in Settings to continue.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                    text: "Open Settings",
                    onPress: () => {
                        Linking.openURL("App-Prefs:Bluetooth");
                    },
                    },
                ]
                );
            } else {
                enableBluetooth();
            }
        }
        if (!isScanning) {
            // clear peripherals list
            setPeripherals(new Map<Peripheral["id"], Peripheral>());
            // clear device stats list
            setDeviceStats([]);

            try {
                console.debug("[startScan] starting scan...");
                setIsScanning(true);
                BleManager.scan(SERVICE_UUIDS)
                .then(() => {
                    console.debug("[startScan] scan promise returned successfully.");
                })
                .catch((err: any) => {
                    console.error("[startScan] ble scan returned in error", err);
                });
            } catch (error) {
                console.error("[startScan] ble scan error thrown", error);
            }
        } else {
            console.debug("[startScan] stopping scan...");
            setIsScanning(false);
            BleManager.stopScan().then(() => {
                // Success code
                console.log("Scan stopped");
            })
            .catch((err: any) => {
                console.error("[startScan] ble stop scan returned in error", err);
            });
        }
    };

    const deviceItem = ({item, index}: any) => {
        return (
            <View key={item.id} style={styles.bleCard}>
                {!item.name ? <Text>{item.id}</Text> : <Text>{item.name}</Text> }
                
                <Text>{item.rssi}dBm</Text>

                {item.advertising.isConnectable ?
                    item.id === currentDevice?.id      
                        ? 
                        <TouchableOpacity onPress={() => onDisconnect()} style={styles.buttonDisconnect}>
                            <Text style={styles.btnTxt}>Disconnect</Text>
                        </TouchableOpacity>
                        :
                        <TouchableOpacity onPress={() => onConnect(item, index)} style={styles.buttonConnect}>
                            <Text style={styles.btnTxt}>Connect</Text>
                        </TouchableOpacity>
                    : null
                }   
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Bluetooth Demo -> Wombatii</Text>
            {isScanning?
                <TouchableOpacity style={styles.stopScanButton} onPress={onScanPress}>
                    <Text style={styles.scanButtonText}>Stop Scan</Text>
                </TouchableOpacity>        
            :
                <TouchableOpacity style={styles.startScanButton} onPress={onScanPress}> 
                    <Text style={styles.scanButtonText}>Start Scan</Text>
                </TouchableOpacity>             
            }
            <ScrollView>
                <View>
                    <Collapsible title="Manufacturer stats">
                        {deviceStats.length === 0 ?         
                        <></>
                        :         
                        deviceStats.map((item, index) => <Text key={item.name}>{item.name}:{item.count} </Text>)       
                        } 
                    </Collapsible>
                </View>
                
    
                <View>
                    <Collapsible title="Discovered devices">
                        <FlatList
                            data={Array.from(peripherals.values())}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={deviceItem}
                        />
                    </Collapsible>
                </View>
            </ScrollView>

        </View>
    )
}

export default BleDevices

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
        paddingVertical: "10%",
        paddingHorizontal: 20,
    },
    header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1710e0",
  },
    bleCard: {
        width: "98%",
        padding: 10,
        alignSelf: "center",
        marginVertical: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.secondary,
        elevation: 5,
        borderRadius: 5
    },
    bleCardConnectable: {
        width: "98%",
        padding: 10,
        alignSelf: "center",
        marginVertical: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.connectable,
        elevation: 5,
        borderRadius: 5
    },
    nameTxt: {
        fontFamily: fonts.bold,
        fontSize: fontSize.font18,
        color: colors.text
    },
    button: {
        width: 100,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.primary,
        borderRadius: 5
    },
    buttonConnect: {
        width: 100,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.connect,
        borderRadius: 5
    },
    buttonDisconnect: {
        width: 100,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.disconnect,
        borderRadius: 5
    },
    btnTxt: {
        fontFamily: fonts.bold,
        fontSize: fontSize.font18,
        color: colors.white
    },
    label: {
        fontSize: 20,
        textAlign: 'center',
        color: colors.text,
        fontFamily: fonts.bold,
    },
    icon: {
        width: 60,
        height: 60,
        resizeMode: "contain",
        marginVertical: hp(2)
    },
    tempCard: {
        width: wp(45),
        backgroundColor: colors.secondary,
        elevation: 2,
        paddingVertical: hp(1.5),
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center"
    },
    fullRow: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: hp(2),
        alignSelf: "center"
    },
    scanBtn: {
        width: "90%",
        height: 50,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.primary,
        borderRadius: 5,
        alignSelf: "center",
        marginBottom: hp(2)
    },
    scanButton: {
        backgroundColor: "#007AFF",
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    startScanButton: {
        backgroundColor: "#007AFF",
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    stopScanButton: {
        backgroundColor: "#ec4310",
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    scanButtonText: {
        color: "#fff",
        fontSize: 16,
        textAlign: "center",
        fontWeight: "500",
    },
})