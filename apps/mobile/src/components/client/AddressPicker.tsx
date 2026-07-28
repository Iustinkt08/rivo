import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { Address, addressesApi, CreateAddressDto } from '../../services/api/addresses';

type Method = 'map' | 'location' | 'manual';

const BUCHAREST = { latitude: 44.4268, longitude: 26.1025 };
const DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };
const MAP_H = Math.round(Dimensions.get('window').height * 0.32);

const TABS: { key: Method; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'map',      label: 'Hartă',        icon: 'map-outline' },
  { key: 'location', label: 'Locația mea',  icon: 'navigate-outline' },
  { key: 'manual',   label: 'Manual',       icon: 'create-outline' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (address: Address) => void;
  address?: Address | null;
  initialLabel?: string;
}

export default function AddressPicker({ visible, onClose, onSave, address, initialLabel }: Props) {
  const mapRef = useRef<MapView>(null);

  const [method, setMethod]           = useState<Method>('map');
  const [label, setLabel]             = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity]               = useState('');
  const [county, setCounty]           = useState('');
  const [country, setCountry]         = useState('Romania');
  const [postalCode, setPostalCode]   = useState('');
  const [latitude, setLatitude]       = useState<number | null>(null);
  const [longitude, setLongitude]     = useState<number | null>(null);
  const [markerCoord, setMarkerCoord] = useState(BUCHAREST);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [loadingLoc, setLoadingLoc]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const locationTabInit = useRef(false);

  // Pre-fill form when editing an existing address or when modal opens
  useEffect(() => {
    if (!visible) return;
    locationTabInit.current = false;
    if (address) {
      setLabel(address.label);
      setAddressLine1(address.addressLine1);
      setAddressLine2(address.addressLine2 ?? '');
      setCity(address.city);
      setCounty(address.county ?? '');
      setCountry(address.country);
      setPostalCode(address.postalCode ?? '');
      setLatitude(address.latitude ?? null);
      setLongitude(address.longitude ?? null);
      const coord = address.latitude && address.longitude
        ? { latitude: address.latitude, longitude: address.longitude }
        : BUCHAREST;
      setMarkerCoord(coord);
    } else {
      setLabel(initialLabel ?? '');
      setAddressLine1(''); setAddressLine2(''); setCity('');
      setCounty(''); setCountry('Romania'); setPostalCode('');
      setLatitude(null); setLongitude(null);
      setMarkerCoord(BUCHAREST);
    }
    setMethod('map');
  }, [visible]);

  // Auto-fetch location when "Locația mea" tab is first selected
  useEffect(() => {
    if (method === 'location' && !locationTabInit.current) {
      locationTabInit.current = true;
      fetchMyLocation();
    }
  }, [method]);

  const reverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const street = [r.street, r.streetNumber].filter(Boolean).join(' ');
        if (street) setAddressLine1(street);
        if (r.city)    setCity(r.city);
        if (r.region)  setCounty(r.region);
        if (r.country) setCountry(r.country);
        if (r.postalCode) setPostalCode(r.postalCode);
      }
    } catch {
      // silently ignore
    } finally {
      setIsGeocoding(false);
    }
  };

  const fetchMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisiune necesară', 'Activează localizarea din Setări pentru a folosi această funcție.');
      return;
    }
    setLoadingLoc(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setMarkerCoord(coord);
      setLatitude(coord.latitude);
      setLongitude(coord.longitude);
      mapRef.current?.animateToRegion({ ...coord, ...DELTA }, 600);
      await reverseGeocode(coord.latitude, coord.longitude);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut obține locația curentă.');
    } finally {
      setLoadingLoc(false);
    }
  };

  const handleMarkerDragEnd = async (coord: { latitude: number; longitude: number }) => {
    setMarkerCoord(coord);
    setLatitude(coord.latitude);
    setLongitude(coord.longitude);
    await reverseGeocode(coord.latitude, coord.longitude);
  };

  const handleForwardGeocode = async () => {
    const query = [addressLine1.trim(), city.trim(), country.trim()].filter(Boolean).join(', ');
    if (query.length < 5) return;
    setIsGeocoding(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (results.length > 0) {
        const { latitude: lat, longitude: lng } = results[0];
        setLatitude(lat); setLongitude(lng);
        const coord = { latitude: lat, longitude: lng };
        setMarkerCoord(coord);
        mapRef.current?.animateToRegion({ ...coord, ...DELTA }, 600);
      }
    } catch {
      // silently ignore
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!addressLine1.trim()) {
      Alert.alert('Câmp obligatoriu', 'Introdu adresa (strada).');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Câmp obligatoriu', 'Introdu orașul.');
      return;
    }
    setSaving(true);
    try {
      const dto: CreateAddressDto = {
        label:        label.trim() || 'Adresă',
        addressLine1: addressLine1.trim(),
        city:         city.trim(),
        country:      country.trim() || 'Romania',
        ...(addressLine2.trim() ? { addressLine2: addressLine2.trim() } : {}),
        ...(county.trim()      ? { county: county.trim() }             : {}),
        ...(postalCode.trim()  ? { postalCode: postalCode.trim() }     : {}),
        ...(latitude != null   ? { latitude }                          : {}),
        ...(longitude != null  ? { longitude }                         : {}),
      };
      const isEdit = !!address?.id && !address.id.startsWith('local-');
      const saved = isEdit
        ? await addressesApi.update(address!.id, dto)
        : await addressesApi.create(dto);
      onSave(saved);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva adresa. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderMapTab = () => (
    <View style={{ height: MAP_H }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ ...markerCoord, ...DELTA }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={markerCoord}
          draggable
          pinColor={Colors.primary}
          onDragEnd={(e) => handleMarkerDragEnd(e.nativeEvent.coordinate)}
        />
      </MapView>

      {isGeocoding && (
        <View style={styles.geocodeBadge} pointerEvents="none">
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.geocodeText}>Identificare adresă…</Text>
        </View>
      )}

      <TouchableOpacity style={styles.myLocBtn} onPress={fetchMyLocation} disabled={loadingLoc}>
        {loadingLoc
          ? <ActivityIndicator size="small" color={Colors.primary} />
          : <Ionicons name="navigate" size={16} color={Colors.primary} />
        }
        <Text style={styles.myLocText}>Locația mea</Text>
      </TouchableOpacity>

      <View style={styles.mapHint} pointerEvents="none">
        <Ionicons name="move-outline" size={12} color={Colors.gray500} />
        <Text style={styles.mapHintText}>Trage pinul pentru a ajusta poziția</Text>
      </View>
    </View>
  );

  const renderLocationTab = () => (
    <View style={styles.locationTab}>
      {loadingLoc ? (
        <View style={styles.locLoadingRow}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.locLoadingText}>Se obține locația…</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.locRefreshBtn} onPress={fetchMyLocation}>
          <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
          <Text style={styles.locRefreshText}>Reîncarcă locația curentă</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderManualTab = () => (
    <View style={styles.manualTab}>
      <TouchableOpacity style={styles.geocodeBtn} onPress={handleForwardGeocode} disabled={isGeocoding}>
        {isGeocoding
          ? <ActivityIndicator size="small" color={Colors.white} />
          : <><Ionicons name="search-outline" size={15} color={Colors.white} />
            <Text style={styles.geocodeBtnText}>Găsește pe hartă</Text></>
        }
      </TouchableOpacity>
    </View>
  );

  const renderAddressForm = () => (
    <View style={styles.form}>
      <FormField label="Etichetă (ex: Acasă, Serviciu)" value={label} onChangeText={setLabel} placeholder="Acasă" />
      <FormField label="Stradă și număr *" value={addressLine1} onChangeText={setAddressLine1} placeholder="Strada Florilor 12" autoCapitalize="words" />
      <FormField label="Detalii (ap., bl., sc.)" value={addressLine2} onChangeText={setAddressLine2} placeholder="Ap. 4, Bl. A" autoCapitalize="words" />
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <FormField label="Oraș *" value={city} onChangeText={setCity} placeholder="București" autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Județ" value={county} onChangeText={setCounty} placeholder="Ilfov" autoCapitalize="words" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <FormField label="Țară" value={country} onChangeText={setCountry} placeholder="Romania" autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Cod poștal" value={postalCode} onChangeText={setPostalCode} placeholder="010101" keyboardType="numeric" />
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {address ? 'Editează adresa' : 'Adaugă adresă'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Text style={styles.saveBtnText}>Salvează</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Method tabs */}
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, method === tab.key && styles.tabActive]}
              onPress={() => setMethod(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={15}
                color={method === tab.key ? Colors.primary : Colors.gray500}
              />
              <Text style={[styles.tabText, method === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {method === 'map'      && renderMapTab()}
        {method === 'location' && renderLocationTab()}
        {method === 'manual'   && renderManualTab()}

        {/* Shared address form */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {renderAddressForm()}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function FormField({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={ff.wrap}>
      <Text style={ff.label}>{label}</Text>
      <TextInput
        style={ff.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray300}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
    </View>
  );
}

const ff = StyleSheet.create({
  wrap:  { marginBottom: Spacing.sm },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.md, color: Colors.black,
    borderWidth: 1, borderColor: Colors.border,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  saveBtn:      { paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  saveBtnText:  { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.bold },

  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: Colors.primary },
  tabText:       { fontSize: FontSize.sm, color: Colors.gray500, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },

  // Map tab
  geocodeBadge: {
    position: 'absolute', top: 10, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 7, ...Shadow.md,
  },
  geocodeText:  { fontSize: FontSize.xs, color: Colors.gray500 },
  myLocBtn: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.white, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7, ...Shadow.md,
  },
  myLocText:    { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  mapHint: {
    position: 'absolute', bottom: 8, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  mapHintText:  { fontSize: FontSize.xs, color: Colors.gray500, flex: 1 },

  // Location tab
  locationTab:    { padding: Spacing.lg, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  locLoadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  locLoadingText: { fontSize: FontSize.md, color: Colors.gray500 },
  locRefreshBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locRefreshText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Manual tab
  manualTab: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  geocodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 9, marginBottom: Spacing.sm,
  },
  geocodeBtnText: { fontSize: FontSize.sm, color: Colors.white, fontWeight: FontWeight.semibold },

  // Form
  form: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  row:  { flexDirection: 'row' },
});
