import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions,
  KeyboardAvoidingView, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import SettingsHeader, { backToSettings } from '../../components/business/SettingsHeader';

const BUCHAREST  = { latitude: 44.4268, longitude: 26.1025 };
const DELTA      = { latitudeDelta: 0.008, longitudeDelta: 0.008 };
const SCREEN_H   = Dimensions.get('window').height;
const MAP_H      = Math.round(SCREEN_H * 0.52);

export default function SalonLocationScreen() {
  const router = useRouter();
  const { salonProfile, setSalonProfile } = useBusinessStore();
  const mapRef = useRef<MapView>(null);

  // Current center lat/lng (follows the map region center)
  const [region, setRegion] = useState<Region>({
    latitude:  salonProfile?.latitude  ?? BUCHAREST.latitude,
    longitude: salonProfile?.longitude ?? BUCHAREST.longitude,
    ...DELTA,
  });

  const [addressLine1, setAddressLine1] = useState(salonProfile?.addressLine1 ?? '');
  const [city,         setCity]         = useState(salonProfile?.city ?? '');
  const [isMoving,     setIsMoving]     = useState(false);
  const [isGeocoding,  setIsGeocoding]  = useState(false); // reverse geo in progress
  const [loadingGeo,   setLoadingGeo]   = useState(false); // GPS fetch in progress
  const [saving,       setSaving]       = useState(false);

  // Prevent circular update: reverse geocode → address change → re-geocode
  const suppressGeocode = useRef(false);

  // Animated pin lift
  const pinY = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;

  const liftPin = () => {
    Animated.parallel([
      Animated.spring(pinY, { toValue: -12, useNativeDriver: true, speed: 20, bounciness: 4 }),
      Animated.spring(shadowScale, { toValue: 0.5, useNativeDriver: true, speed: 20, bounciness: 0 }),
    ]).start();
  };

  const dropPin = () => {
    Animated.parallel([
      Animated.spring(pinY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }),
      Animated.spring(shadowScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 0 }),
    ]).start();
  };

  // ── On mount: request location ──────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Load profile if not already in store
      let profile = salonProfile;
      if (!profile) {
        profile = await businessApi.getSalonProfile().catch(() => null);
        if (profile) {
          setSalonProfile(profile);
          suppressGeocode.current = true;
          setAddressLine1(profile.addressLine1);
          setCity(profile.city);
        }
      }

      // If stored coords exist, use them; otherwise get device location
      if (profile?.latitude && profile?.longitude) {
        const r: Region = { latitude: profile.latitude, longitude: profile.longitude, ...DELTA };
        setRegion(r);
        mapRef.current?.animateToRegion(r, 400);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      setLoadingGeo(true);
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const r: Region = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, ...DELTA };
        setRegion(r);
        mapRef.current?.animateToRegion(r, 600);
        await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      } catch {
        // fall back to Bucharest
      } finally {
        setLoadingGeo(false);
      }
    };
    init();
  }, []);

  // ── Reverse geocode ─────────────────────────────────────────────────────────
  const reverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const street = [r.street, r.streetNumber].filter(Boolean).join(' ');
        suppressGeocode.current = true; // don't re-geocode when we set these values
        if (street) setAddressLine1(street);
        if (r.city)  setCity(r.city);
      }
    } catch {
      // silently ignore
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── Forward geocode (address → coordinates) ─────────────────────────────────
  const forwardGeocode = async () => {
    if (suppressGeocode.current) {
      suppressGeocode.current = false;
      return;
    }
    const query = [addressLine1.trim(), city.trim()].filter(Boolean).join(', ');
    if (query.length < 5) return;
    try {
      const results = await Location.geocodeAsync(query);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        const r: Region = { latitude, longitude, ...DELTA };
        setRegion(r);
        mapRef.current?.animateToRegion(r, 700);
      }
    } catch {
      // silently ignore — user may still type more
    }
  };

  // ── Map event handlers ──────────────────────────────────────────────────────
  const handleRegionChange = () => {
    if (!isMoving) {
      setIsMoving(true);
      liftPin();
    }
  };

  const handleRegionChangeComplete = async (r: Region) => {
    setIsMoving(false);
    dropPin();
    setRegion(r);
    await reverseGeocode(r.latitude, r.longitude);
  };

  // ── My location button ──────────────────────────────────────────────────────
  const handleUseMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisiune necesară', 'Activează localizarea din Setări.');
      return;
    }
    setLoadingGeo(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const r: Region = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, ...DELTA };
      setRegion(r);
      mapRef.current?.animateToRegion(r, 600);
      await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut obține locația curentă.');
    } finally {
      setLoadingGeo(false);
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!addressLine1.trim() || !city.trim()) {
      Alert.alert('Câmpuri obligatorii', 'Adresa și orașul sunt necesare.');
      return;
    }
    setSaving(true);
    try {
      const id = salonProfile?.id;
      if (!id) {
        Alert.alert('Niciun salon', 'Nu am găsit salonul tău. Reîncarcă pagina și încearcă din nou.');
        return;
      }
      const patch = {
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        latitude: region.latitude,
        longitude: region.longitude,
      };
      await businessApi.updateSalonProfile(id, patch);
      setSalonProfile({ ...salonProfile, ...patch });
      Alert.alert('Salvat', 'Locația salonului a fost actualizată.', [
        { text: 'OK', onPress: () => backToSettings(router) },
      ]);
    } catch {
      Alert.alert('Eroare', 'Nu s-au putut salva modificările. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <SettingsHeader title="Adresă & Locație" />

      {/* ── Map area ── */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
        />

        {/* Fixed crosshair pin — centered, no touch interception */}
        <View style={styles.pinContainer} pointerEvents="none">
          {/* Shadow on the ground */}
          <Animated.View style={[styles.pinShadow, { transform: [{ scaleX: shadowScale }, { scaleY: shadowScale }] }]} />

          {/* The pin */}
          <Animated.View style={[styles.pinOuter, { transform: [{ translateY: pinY }] }]}>
            <View style={styles.pinInner} />
            {/* Tip triangle */}
            <View style={styles.pinTip} />
          </Animated.View>
        </View>

        {/* Reverse geocoding spinner */}
        {isGeocoding && (
          <View style={styles.geocodingBadge} pointerEvents="none">
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.geocodingText}>Identificare adresă…</Text>
          </View>
        )}

        {/* My location button */}
        <TouchableOpacity style={styles.myLocationBtn} onPress={handleUseMyLocation} disabled={loadingGeo}>
          {loadingGeo
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Ionicons name="navigate" size={18} color={Colors.primary} />
          }
          <Text style={styles.myLocationText}>Locația mea</Text>
        </TouchableOpacity>

        {/* Bottom hint */}
        <View style={styles.mapHint} pointerEvents="none">
          <Ionicons name="move-outline" size={14} color={Colors.gray500} />
          <Text style={styles.mapHintText}>Mișcă harta pentru a poziționa pinul exact pe salon</Text>
        </View>
      </View>

      {/* ── Address form (pinned to bottom) ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.bottomPanel}>

          <View style={styles.card}>
            {/* Street */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Stradă & număr</Text>
              <TextInput
                style={styles.fieldInput}
                value={addressLine1}
                onChangeText={(v) => { suppressGeocode.current = false; setAddressLine1(v); }}
                onBlur={forwardGeocode}
                onSubmitEditing={forwardGeocode}
                placeholder="Strada Florilor 12"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            <View style={styles.divider} />
            {/* City */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Oraș</Text>
              <TextInput
                style={styles.fieldInput}
                value={city}
                onChangeText={(v) => { suppressGeocode.current = false; setCity(v); }}
                onBlur={forwardGeocode}
                onSubmitEditing={forwardGeocode}
                placeholder="București"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Coordinates badge */}
          <View style={styles.coordsRow}>
            <Ionicons name="pin-outline" size={12} color={Colors.gray300} />
            <Text style={styles.coordsText}>
              {region.latitude.toFixed(5)}, {region.longitude.toFixed(5)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <><Ionicons name="checkmark-circle" size={20} color={Colors.white} /><Text style={styles.saveBtnText}>Salvează</Text></>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // ── Map ──────────────────────────────────────────────────────────────────────
  mapWrap: { height: MAP_H, position: 'relative' },

  // Fixed pin centered over map
  pinContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinShadow: {
    position: 'absolute',
    width: 16, height: 6, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    // offset so it sits at the tip of the pin (pin height ~44px, shadow at ground level)
    top: '50%',
    marginTop: 18,
  },
  pinOuter: {
    position: 'absolute',
    alignItems: 'center',
    // center the pin so its TIP is at the exact center of the map
    // pin head is 28px, tip is ~8px → total ~36px, we shift up by half
    marginTop: -18,
  },
  pinInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary,
    borderWidth: 3, borderColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pinTip: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Colors.primary,
    marginTop: -1,
  },

  geocodingBadge: {
    position: 'absolute', top: 12, left: '50%', marginLeft: -70,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 7, ...Shadow.md,
    width: 180, justifyContent: 'center',
  },
  geocodingText: { fontSize: FontSize.xs, color: Colors.gray500, fontWeight: FontWeight.medium },

  myLocationBtn: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8, ...Shadow.md,
  },
  myLocationText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },

  mapHint: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  mapHintText: { fontSize: FontSize.xs, color: Colors.gray500, flex: 1 },

  // ── Bottom panel ──────────────────────────────────────────────────────────────
  bottomPanel: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden',
    marginBottom: 6, ...Shadow.sm,
  },
  divider: { height: 1, backgroundColor: Colors.gray50, marginHorizontal: Spacing.md },
  field: { paddingHorizontal: Spacing.md, paddingVertical: 11 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500, marginBottom: 3 },
  fieldInput: { fontSize: FontSize.md, color: Colors.black, padding: 0 },

  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.sm },
  coordsText: {
    fontSize: 10, color: Colors.gray300,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 15,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
