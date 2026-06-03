import React, { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { decode } from 'base64-arraybuffer';

import { useSelector } from 'react-redux';
import { useAppDispatch } from '@/store/hooks';
import { RootState } from '@/store/store';
import {
  incrementFirestoreSuccess,
  incrementFirestoreFailed,
  incrementFcmSuccess,
  incrementFcmFailed,
} from '@/store/firebaseStats.slice';

import { supabase } from '../../lib/supabase';
import { sendLocalNotification } from '@/lib/notifications';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const { height } = Dimensions.get('window');

const buildLeafletHTML = (lat: number, lng: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    #map { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${lat}, ${lng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);

    function sendCoords(lat, lng) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: lat, longitude: lng }));
    }

    sendCoords(${lat}, ${lng});

    marker.on('dragend', function(e) {
      var pos = e.target.getLatLng();
      sendCoords(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      sendCoords(e.latlng.lat, e.latlng.lng);
    });
  </script>
</body>
</html>
`;

const HomeScreen = () => {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [marker, setMarker] = useState<Coordinates | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dispatch = useAppDispatch();
  const firestoreSuccess = useSelector((state: RootState) => state.firebaseStats.firestoreSuccess);
  const firestoreFailed = useSelector((state: RootState) => state.firebaseStats.firestoreFailed);
  const fcmSuccess = useSelector((state: RootState) => state.firebaseStats.fcmSuccess);
  const fcmFailed = useSelector((state: RootState) => state.firebaseStats.fcmFailed);

  // GET LOCATION
  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow location access');
        return;
      }
      const loc = await Location.getCurrentPositionAsync();
      const coords: Coordinates = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(coords);
      setMarker(coords);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // OPEN CAMERA
  const openCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission denied', 'Camera permission required');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // SAVE DATA + Redux stats
  const saveData = async () => {
    if (!image || !marker) return;
    setLoading(true);

    let firestoreOk = false;

    try {
      const base64 = await FileSystem.readAsStringAsync(image, {
        encoding: 'base64',
      });

      const fileName = `photo_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, decode(base64), { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('photos')
        .insert([{
          image_url: publicUrlData.publicUrl,
          latitude: marker.latitude,
          longitude: marker.longitude,
        }]);

      if (dbError) throw dbError;

      dispatch(incrementFirestoreSuccess());
      firestoreOk = true;
    } catch {
      dispatch(incrementFirestoreFailed());
      firestoreOk = false;
    }

    try {
      const fsSuccess = firestoreOk ? firestoreSuccess + 1 : firestoreSuccess;
      const fsFailed = firestoreOk ? firestoreFailed : firestoreFailed + 1;

      await sendLocalNotification(
        firestoreOk ? 'Firebase Sync Success' : 'Firebase Sync Failed',
        `Firestore: ${fsSuccess} successful, ${fsFailed} unsuccessful.\nFCM: ${fcmSuccess + 1} successful, ${fcmFailed} unsuccessful.\nLat: ${marker.latitude.toFixed(6)}, Lng: ${marker.longitude.toFixed(6)}`,
        {
          latitude: String(marker.latitude),
          longitude: String(marker.longitude),
        }
      );

      dispatch(incrementFcmSuccess());
    } catch {
      dispatch(incrementFcmFailed());
    }

    setLoading(false);

    if (firestoreOk) {
      Alert.alert('Success', 'Data berhasil disimpan!');
    } else {
      Alert.alert('Error', 'Gagal menyimpan data.');
    }
  };

  return (
    <View style={styles.container}>
      {!location ? (
        <View style={styles.center}>
          <Text style={styles.title}>Supabase + Firebase Notification</Text>
          <Button title="Get Geo Location" onPress={getLocation} />
        </View>
      ) : (
        <>
          <WebView
            style={styles.map}
            originWhitelist={['*']}
            source={{ html: buildLeafletHTML(location.latitude, location.longitude) }}
            onMessage={(event) => {
              try {
                const coords = JSON.parse(event.nativeEvent.data);
                setMarker(coords);
              } catch {}
            }}
            javaScriptEnabled
          />

          <ScrollView style={styles.info}>
            <Text style={styles.sectionTitle}>Device Location</Text>
            <Text style={styles.coordText}>Latitude: {location.latitude}</Text>
            <Text style={styles.coordText}>Longitude: {location.longitude}</Text>

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Marker Position</Text>
            <Text style={styles.coordText}>Latitude: {marker?.latitude ?? '-'}</Text>
            <Text style={styles.coordText}>Longitude: {marker?.longitude ?? '-'}</Text>

            <View style={styles.statsBox}>
              <Text style={styles.statsTitle}>Firebase Stats (Session)</Text>
              <Text style={styles.statsText}>
                Firestore: {firestoreSuccess} successful, {firestoreFailed} unsuccessful
              </Text>
              <Text style={styles.statsText}>
                FCM: {fcmSuccess} successful, {fcmFailed} unsuccessful
              </Text>
            </View>

            <View style={styles.button}>
              <Button title="Open Camera" onPress={openCamera} />
            </View>

            <View style={styles.button}>
              <Button
                title={loading ? 'Saving...' : 'Save To Supabase'}
                onPress={saveData}
                disabled={loading}
              />
            </View>

            {image && (
              <Image source={{ uri: image }} style={styles.image} />
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#1f2937', textAlign: 'center' },
  map: { width: '100%', height: height * 0.5 },
  info: { flex: 1, padding: 16, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151' },
  coordText: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  statsBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  statsTitle: { fontSize: 14, fontWeight: '700', color: '#1e3a8a', marginBottom: 4 },
  statsText: { fontSize: 13, color: '#374151', marginTop: 2 },
  button: { marginTop: 10 },
  image: { width: 220, height: 220, marginTop: 15, borderRadius: 10, alignSelf: 'center' },
});
