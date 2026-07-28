import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

const SUGGESTED_CITIES = [
  'București',
  'Cluj-Napoca',
  'Timișoara',
  'Iași',
  'Brașov',
  'Constanța',
];

interface Props {
  visible: boolean;
  currentCity: string;
  onSelect: (city: string, coords?: { latitude: number; longitude: number }) => void;
  onClose: () => void;
}

export default function LocationPicker({ visible, currentCity, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [locLoading, setLocLoading] = useState(false);

  const filtered = SUGGESTED_CITIES.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase()),
  );

  const handleUseCurrentLocation = async () => {
    if (locLoading) return;
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const city = place?.city ?? place?.subregion ?? place?.region ?? currentCity;
      onSelect(city, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      // keep current city on error
    } finally {
      setLocLoading(false);
    }
  };

  const handleQuerySubmit = () => {
    const trimmed = query.trim();
    if (trimmed) onSelect(trimmed);
  };

  const topPad = Math.max(insets.top, 24);
  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingTop: topPad, paddingBottom: bottomPad }]}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Selectează orașul</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.black} />
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={styles.inputRow}>
            <Ionicons name="search-outline" size={18} color={Colors.gray500} />
            <TextInput
              style={styles.input}
              placeholder="Caută un oraș..."
              placeholderTextColor={Colors.gray400}
              value={query}
              onChangeText={setQuery}
              returnKeyType="done"
              onSubmitEditing={handleQuerySubmit}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.gray400} />
              </TouchableOpacity>
            )}
          </View>

          {/* Use current location button */}
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={handleUseCurrentLocation}
            activeOpacity={0.8}
          >
            {locLoading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
            }
            <Text style={styles.locationBtnText}>Folosește locația curentă</Text>
          </TouchableOpacity>

          {/* Suggested cities */}
          <Text style={styles.sectionLabel}>Orașe sugerate</Text>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.cityRow, item === currentCity && styles.cityRowActive]}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={item === currentCity ? Colors.primary : Colors.gray500}
                />
                <Text style={[styles.cityText, item === currentCity && styles.cityTextActive]}>
                  {item}
                </Text>
                {item === currentCity && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} style={styles.checkmark} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.black,
    fontWeight: FontWeight.medium,
    padding: 0,
    margin: 0,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  locationBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.gray500,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cityRowActive: {
    backgroundColor: Colors.primaryLight,
  },
  cityText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.black,
  },
  cityTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  checkmark: {
    marginLeft: 'auto' as unknown as number,
  },
});
