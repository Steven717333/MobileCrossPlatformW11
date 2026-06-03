import React, { useState } from 'react';
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

import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { decode } from 'base64-arraybuffer';
import MapView, { Marker, Region, UrlTile } from 'react-native-maps';

import { supabase } from '../../lib/supabase';
import { sendLocalNotification } from '@/lib/notifications';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const { height } = Dimensions.get('window');

const HomeScreen = () => {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [marker, setMarker] = useState<Coordinates | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  // SAVE DATA ke Supabase + kirim Push Notification via Firebase
  const saveData = async () => {
    if (!image) {
      Alert.alert('Error', 'Please take a photo first');
      return;
    }
    if (!marker) {
      Alert.alert('Error', 'Location not found');
      return;
    }

    setLoading(true);

    try {
      // Baca foto sebagai base64
      const base64 = await FileSystem.readAsStringAsync(image, {
        encoding: 'base64',
      });

      const fileName = `photo_${Date.now()}.jpg`;

      // Upload ke Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, decode(base64), { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // Ambil public URL
      const { data: publicUrlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      // Simpan ke Supabase Database
      const { error: dbError } = await supabase
        .from('photos')
        .insert([{
          image_url: imageUrl,
          latitude: marker.latitude,
          longitude: marker.longitude,
        }]);

      if (dbError) throw dbError;

      // Kirim notifikasi sukses via Firebase
      await sendLocalNotification(
        '✅ Data Berhasil Disimpan',
        `Foto tersimpan ke Supabase.\nLat: ${marker.latitude.toFixed(6)}\nLng: ${marker.longitude.toFixed(6)}`,
        {
          latitude: String(marker.latitude),
          longitude: String(marker.longitude),
          image_url: imageUrl,
        }
      );

      Alert.alert('Success', 'Photo and location saved successfully');

    } catch (error: any) {

      // Kirim notifikasi gagal via Firebase
      await sendLocalNotification(
        '❌ Data Gagal Disimpan',
        `Error: ${error.message}\nLat: ${marker?.latitude.toFixed(6) ?? '-'}\nLng: ${marker?.longitude.toFixed(6) ?? '-'}`,
        {
          latitude: String(marker?.latitude ?? ''),
          longitude: String(marker?.longitude ?? ''),
          error: error.message,
        }
      );

      Alert.alert('Error', error.message);

    } finally {
      setLoading(false);
    }
  };

  const region: Region | undefined = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;

  return (
    <View style={styles.container}>
      {!location ? (
        <View style={styles.center}>
          <Text style={styles.title}>Supabase + Firebase Notification</Text>
          <Button title="Get Geo Location" onPress={getLocation} />
        </View>
      ) : (
        <>
          <MapView
            style={styles.map}
            initialRegion={region}
            onPress={(e) => setMarker(e.nativeEvent.coordinate)}
          >
            <UrlTile
              urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              zIndex={1}
            />
            {marker && (
              <Marker
                coordinate={marker}
                title="Photo Location"
                draggable
                onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
              />
            )}
          </MapView>

          <ScrollView style={styles.info}>
            <Text style={styles.sectionTitle}>📍 Device Location</Text>
            <Text style={styles.coordText}>Latitude: {location.latitude}</Text>
            <Text style={styles.coordText}>Longitude: {location.longitude}</Text>

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>📌 Marker Position</Text>
            <Text style={styles.coordText}>Latitude: {marker?.latitude ?? '-'}</Text>
            <Text style={styles.coordText}>Longitude: {marker?.longitude ?? '-'}</Text>

            <View style={styles.button}>
              <Button title="📷 Open Camera" onPress={openCamera} />
            </View>

            <View style={styles.button}>
              <Button
                title={loading ? 'Saving...' : '💾 Save To Supabase'}
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
  button: { marginTop: 10 },
  image: { width: 220, height: 220, marginTop: 15, borderRadius: 10, alignSelf: 'center' },
});
