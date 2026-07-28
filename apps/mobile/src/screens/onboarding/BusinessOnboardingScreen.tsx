import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore, BusinessStaff, SalonProfile } from '../../store/businessStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api/client';
import { supabase } from '../../services/supabase';
import { uploadSalonLogo } from '../../services/storage';

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7; // steps 1–7 (0 = welcome, 8 = done)

const BRAND_GRADIENTS: { id: string; colors: [string, string]; label: string }[] = [
  { id: 'navira',    colors: ['#A22921', '#EF6351'], label: 'NAVIRA Red' },
  { id: 'violet',    colors: ['#7C3AED', '#C084FC'], label: 'Violet Royal' },
  { id: 'rose',      colors: ['#F43F5E', '#FB923C'], label: 'Rose Gold' },
  { id: 'emerald',   colors: ['#059669', '#34D399'], label: 'Smarald' },
  { id: 'sky',       colors: ['#0EA5E9', '#6EE7F7'], label: 'Sky Blue' },
  { id: 'golden',    colors: ['#D97706', '#FCD34D'], label: 'Golden Hour' },
  { id: 'blush',     colors: ['#EC4899', '#FCA5A5'], label: 'Blush Pink' },
  { id: 'midnight',  colors: ['#1E3A8A', '#6366F1'], label: 'Midnight' },
  { id: 'forest',    colors: ['#166534', '#4ADE80'], label: 'Forest' },
];
const STAFF_EMOJIS  = ['👩‍🦱', '👨‍🦰', '👩‍🦳', '👩‍🦲', '👨‍🦳', '👩', '👨', '👱‍♀️', '👱'];
const DAY_LABELS    = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
const DAY_KEYS      = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

interface HourEntry { openTime: string; closeTime: string; isOpen: boolean; }
interface TempStaff  { name: string; specialty: string; emoji: string; }

const DEFAULT_HOURS: HourEntry[] = [
  { openTime: '09:00', closeTime: '19:00', isOpen: true },
  { openTime: '09:00', closeTime: '19:00', isOpen: true },
  { openTime: '09:00', closeTime: '19:00', isOpen: true },
  { openTime: '09:00', closeTime: '20:00', isOpen: true },
  { openTime: '09:00', closeTime: '20:00', isOpen: true },
  { openTime: '10:00', closeTime: '17:00', isOpen: true },
  { openTime: '00:00', closeTime: '00:00', isOpen: false },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function BusinessOnboardingScreen() {
  const { setSalonProfile, setStaff } = useBusinessStore();
  const { setOnboardingComplete } = useAuthStore();
  const router = useRouter();

  const [step, setStep] = useState(0);

  // Step 1 — Identity
  const [salonName,      setSalonName]      = useState('');
  const [logoUri,        setLogoUri]        = useState<string | null>(null);
  const [salonGradient,  setSalonGradient]  = useState(BRAND_GRADIENTS[0]);

  // Step 2 — Description & contact
  const [description,  setDescription]  = useState('');
  const [phone,        setPhone]        = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city,         setCity]         = useState('');

  // Step 4 — Staff
  const [staffList,          setStaffList]          = useState<TempStaff[]>([]);
  const [staffModalVisible,  setStaffModalVisible]  = useState(false);
  const [newStaffName,       setNewStaffName]       = useState('');
  const [newStaffSpecialty,  setNewStaffSpecialty]  = useState('');
  const [newStaffEmoji,      setNewStaffEmoji]      = useState('👩‍🦱');

  // Step 5 — Hours
  const [hours, setHours] = useState<HourEntry[]>(DEFAULT_HOURS);

  // Step 6 — Policy
  const [requiresDeposit,   setRequiresDeposit]   = useState(false);
  const [depositPct,        setDepositPct]        = useState(30);
  const [cancellationHours, setCancellationHours] = useState(24);

  // Step 7 — Notifications
  const [notifNewBooking,     setNotifNewBooking]     = useState(true);
  const [notifCancellation,   setNotifCancellation]   = useState(true);

  const [finishing, setFinishing] = useState(false);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  const canContinueStep1 = salonName.trim().length >= 2;

  const addStaffMember = () => {
    if (!newStaffName.trim()) return;
    setStaffList((prev) => [...prev, { name: newStaffName.trim(), specialty: newStaffSpecialty.trim(), emoji: newStaffEmoji }]);
    setNewStaffName('');
    setNewStaffSpecialty('');
    setNewStaffEmoji('👩‍🦱');
    setStaffModalVisible(false);
  };

  const removeStaff = (idx: number) => setStaffList((prev) => prev.filter((_, i) => i !== idx));

  const toggleHourDay = (idx: number) =>
    setHours((prev) => prev.map((h, i) => i === idx ? { ...h, isOpen: !h.isOpen } : h));

  const finish = async () => {
    setFinishing(true);
    try {
      // 1. Upload logo to Supabase Storage if a local URI was chosen
      let logoUrl: string | null = null;
      if (logoUri && logoUri.startsWith('file')) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Use a temp ID before salon creation; we'll overwrite via the public URL later
          logoUrl = await uploadSalonLogo(user.id, logoUri);
        }
      }

      // 2. Create the salon
      const salon = await api.post('/salons', {
        name: salonName.trim(),
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        addressLine1: addressLine1.trim() || 'Adresă neconfigurată',
        city: city.trim() || 'București',
        logoUrl: logoUrl ?? undefined,
        requiresDeposit,
        depositPercentage: requiresDeposit ? depositPct : undefined,
        cancellationHours,
      }).then((r) => r.data);

      const salonId: string = salon.id;

      // 3. Save opening hours
      await api.post(`/salons/${salonId}/opening-hours`, {
        hours: hours.map((h, i) => ({
          dayOfWeek: DAY_KEYS[i],
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: !h.isOpen,
        })),
      });

      // 4. Create staff members
      const savedStaff: BusinessStaff[] = [];
      for (const s of staffList) {
        const parts = s.name.trim().split(' ');
        const firstName = parts[0] ?? s.name;
        const lastName = parts.slice(1).join(' ') || '-';
        const member = await api.post(`/salons/${salonId}/staff`, {
          firstName,
          lastName,
          bio: s.specialty || undefined,
        }).then((r) => r.data);
        savedStaff.push({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          specialty: s.specialty || 'Specialist',
          avatarEmoji: s.emoji,
          isActive: true,
        });
      }

      // 5. Persist to local store with real salon ID
      setSalonProfile({
        id: salonId,
        name: salon.name,
        description: salon.description ?? null,
        phone: salon.phone ?? null,
        email: salon.email ?? null,
        websiteUrl: salon.websiteUrl ?? null,
        addressLine1: salon.addressLine1,
        city: salon.city,
        logoUrl: salon.logoUrl ?? null,
        requiresDeposit: salon.requiresDeposit,
        depositPercentage: salon.depositPercentage ?? null,
        cancellationHours: salon.cancellationHours,
        openingHours: hours.map((h, i) => ({
          dayOfWeek: DAY_KEYS[i],
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: !h.isOpen,
        })),
      });
      if (savedStaff.length > 0) setStaff(savedStaff);

      setOnboardingComplete();
      router.replace('/(business)');
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      Alert.alert('Eroare', Array.isArray(msg) ? msg.join('\n') : (msg ?? 'Nu s-a putut crea salonul. Încearcă din nou.'));
    } finally {
      setFinishing(false);
    }
  };

  // ── Render step ─────────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (step) {
      case 0: return <StepWelcome onNext={next} />;
      case 1: return (
        <StepIdentity
          name={salonName} onNameChange={setSalonName}
          logoUri={logoUri} onLogoChange={setLogoUri}
          gradient={salonGradient} onGradientChange={setSalonGradient}
          canContinue={canContinueStep1} onNext={next} onBack={back}
        />
      );
      case 2: return (
        <StepDescription
          description={description} onDescriptionChange={setDescription}
          phone={phone} onPhoneChange={setPhone}
          address={addressLine1} onAddressChange={setAddressLine1}
          city={city} onCityChange={setCity}
          onNext={next} onBack={back}
        />
      );
      case 3: return <StepPhotos onNext={next} onBack={back} />;
      case 4: return (
        <StepStaff
          staffList={staffList}
          onAdd={() => setStaffModalVisible(true)}
          onRemove={removeStaff}
          onNext={next} onBack={back}
        />
      );
      case 5: return (
        <StepHours
          hours={hours} onToggleDay={toggleHourDay}
          onTimeChange={(idx, field, val) =>
            setHours((prev) => prev.map((h, i) => i === idx ? { ...h, [field]: val } : h))
          }
          onNext={next} onBack={back}
        />
      );
      case 6: return (
        <StepPolicy
          requiresDeposit={requiresDeposit} onToggleDeposit={() => setRequiresDeposit(!requiresDeposit)}
          depositPct={depositPct} onDepositPctChange={setDepositPct}
          cancellationHours={cancellationHours} onCancellationChange={setCancellationHours}
          onNext={next} onBack={back}
        />
      );
      case 7: return (
        <StepNotifications
          notifNewBooking={notifNewBooking} onToggleNewBooking={() => setNotifNewBooking(!notifNewBooking)}
          notifCancellation={notifCancellation} onToggleCancellation={() => setNotifCancellation(!notifCancellation)}
          onNext={next} onBack={back}
        />
      );
      case 8: return (
        <StepDone
          salonName={salonName} logoUri={logoUri} gradient={salonGradient}
          staffCount={staffList.length}
          finishing={finishing} onFinish={finish}
        />
      );
    }
  };

  const showProgress = step >= 1 && step <= TOTAL_STEPS;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Progress bar (steps 1–7) */}
      {showProgress && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  i < step && styles.progressSegmentFilled,
                  i === step - 1 && styles.progressSegmentActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressLabel}>Pasul {step} din {TOTAL_STEPS}</Text>
        </View>
      )}

      {renderContent()}

      {/* Staff add modal */}
      <Modal visible={staffModalVisible} transparent animationType="slide" onRequestClose={() => setStaffModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setStaffModalVisible(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.staffModal}>
            <View style={styles.handle} />
            <Text style={styles.staffModalTitle}>Adaugă angajat</Text>

            <Text style={styles.staffModalLabel}>Emoji</Text>
            <View style={styles.emojiRow}>
              {STAFF_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, newStaffEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setNewStaffEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.staffModalLabel}>Nume complet *</Text>
            <TextInput
              style={styles.staffModalInput}
              value={newStaffName}
              onChangeText={setNewStaffName}
              placeholder="Elena Ionescu"
              placeholderTextColor={Colors.gray300}
              autoCapitalize="words"
            />

            <Text style={styles.staffModalLabel}>Specializare</Text>
            <TextInput
              style={styles.staffModalInput}
              value={newStaffSpecialty}
              onChangeText={setNewStaffSpecialty}
              placeholder="Hair Stylist Senior"
              placeholderTextColor={Colors.gray300}
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={[styles.staffModalBtn, !newStaffName.trim() && { opacity: 0.5 }]}
              onPress={addStaffMember}
              disabled={!newStaffName.trim()}
            >
              <Text style={styles.staffModalBtnText}>Adaugă</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Step 0 — Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <View style={[styles.stepContainer, { justifyContent: 'center' }]}>
      <View style={styles.welcomeIconWrap}>
        <Text style={styles.welcomeIcon}>🏪</Text>
      </View>
      <Text style={styles.welcomeTitle}>Bun venit pe{'\n'}NAVIRA Business!</Text>
      <Text style={styles.welcomeSubtitle}>
        Hai să îți configurăm salonul{'\n'}în câteva minute.
      </Text>

      <View style={styles.welcomeFeatures}>
        {[
          { icon: '📅', text: 'Calendar de programări inteligent' },
          { icon: '👥', text: 'Gestionare clienți & echipă' },
          { icon: '💳', text: 'Plăți & politici de rezervare' },
        ].map((f) => (
          <View key={f.text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onNext}>
        <Text style={styles.primaryBtnText}>Hai să începem</Text>
        <Ionicons name="arrow-forward" size={18} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

// ── Step 1 — Identity (name + logo + gradient) ───────────────────────────────

function StepIdentity({
  name, onNameChange, logoUri, onLogoChange, gradient, onGradientChange, canContinue, onNext, onBack,
}: {
  name: string; onNameChange: (v: string) => void;
  logoUri: string | null; onLogoChange: (v: string | null) => void;
  gradient: typeof BRAND_GRADIENTS[0]; onGradientChange: (v: typeof BRAND_GRADIENTS[0]) => void;
  canContinue: boolean; onNext: () => void; onBack: () => void;
}) {
  const [pickingLogo, setPickingLogo] = useState(false);

  const initials = name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisiune necesară', 'Activează accesul la galerie din Setări.');
      return;
    }
    setPickingLogo(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled) onLogoChange(result.assets[0].uri);
    } finally {
      setPickingLogo(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <StepHeader icon="🏷️" title="Identitatea salonului" subtitle="Cum se numește salonul tău și cum arată logoul?" />

        {/* Live preview card */}
        <LinearGradient colors={gradient.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoPreview}>
          <View style={styles.logoCircleWrap}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoCircleImg} />
            ) : (
              <View style={styles.logoCircleFallback}>
                <Text style={styles.logoInitialsText}>{initials}</Text>
              </View>
            )}
          </View>
          <Text style={styles.logoNamePreview}>{name || 'Numele salonului'}</Text>
        </LinearGradient>

        {/* Name input */}
        <Text style={styles.fieldLabel}>Numele salonului *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={onNameChange}
          placeholder="Ex: Studio Bella, Salon Elegance..."
          placeholderTextColor={Colors.gray300}
          autoCapitalize="words"
          maxLength={60}
        />

        {/* Logo upload */}
        <Text style={styles.fieldLabel}>Logo salon</Text>
        <TouchableOpacity style={styles.logoUploadBtn} onPress={pickLogo} disabled={pickingLogo}>
          {pickingLogo ? (
            <ActivityIndicator color={Colors.primary} />
          ) : logoUri ? (
            <>
              <Image source={{ uri: logoUri }} style={styles.logoThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logoUploadTitle}>Logo setat</Text>
                <Text style={styles.logoUploadSub}>Apasă pentru a schimba</Text>
              </View>
              <TouchableOpacity onPress={() => onLogoChange(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={22} color={Colors.gray300} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.logoUploadIcon}>
                <Ionicons name="image-outline" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.logoUploadTitle}>Alege din galerie</Text>
                <Text style={styles.logoUploadSub}>Format pătrat recomandat, min 400×400px</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
            </>
          )}
        </TouchableOpacity>

        {/* Gradient picker */}
        <Text style={styles.fieldLabel}>Tematică de culori</Text>
        <View style={styles.gradientHint}>
          <Ionicons name="eye-outline" size={14} color={Colors.primary} />
          <Text style={styles.gradientHintText}>
            Clienții vor vedea această tematică pe profilul public al salonului tău.
          </Text>
        </View>
        <View style={styles.gradientGrid}>
          {BRAND_GRADIENTS.map((g) => (
            <TouchableOpacity key={g.id} style={styles.gradientItem} onPress={() => onGradientChange(g)}>
              <LinearGradient
                colors={g.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradientSwatch, gradient.id === g.id && styles.gradientSwatchActive]}
              />
              {gradient.id === g.id && (
                <View style={styles.gradientCheck}>
                  <Ionicons name="checkmark" size={12} color={Colors.white} />
                </View>
              )}
              <Text style={[styles.gradientLabel, gradient.id === g.id && { color: Colors.black, fontWeight: FontWeight.bold }]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <StepFooter onBack={onBack} onNext={onNext} nextDisabled={!canContinue} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Step 2 — Description & contact ───────────────────────────────────────────

function StepDescription({
  description, onDescriptionChange, phone, onPhoneChange,
  address, onAddressChange, city, onCityChange, onNext, onBack,
}: {
  description: string; onDescriptionChange: (v: string) => void;
  phone: string; onPhoneChange: (v: string) => void;
  address: string; onAddressChange: (v: string) => void;
  city: string; onCityChange: (v: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <StepHeader icon="📝" title="Descrie-ți salonul" subtitle="Clienții văd aceste informații pe profilul tău public." />

        <Text style={styles.fieldLabel}>Descriere</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="Ex: Salonul nr. 1 din București pentru hair & nails. Echipă cu 10+ ani experiență..."
          placeholderTextColor={Colors.gray300}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={400}
        />
        <Text style={styles.charCount}>{description.length}/400</Text>

        <Text style={styles.fieldLabel}>Telefon public</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={onPhoneChange}
          placeholder="+40712 345 678"
          placeholderTextColor={Colors.gray300}
          keyboardType="phone-pad"
        />

        <Text style={styles.fieldLabel}>Adresă</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={onAddressChange}
          placeholder="Strada Florilor 12"
          placeholderTextColor={Colors.gray300}
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>Oraș</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={onCityChange}
          placeholder="București"
          placeholderTextColor={Colors.gray300}
          autoCapitalize="words"
        />

        <StepFooter onBack={onBack} onNext={onNext} skipLabel="Sari peste" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Step 3 — Photos ───────────────────────────────────────────────────────────

function StepPhotos({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <StepHeader icon="📸" title="Poze & Galerie" subtitle="Adaugă imagini cu salonul tău pentru a atrage mai mulți clienți." />

      <View style={styles.photosGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <TouchableOpacity key={i} style={styles.photoSlot} onPress={() => Alert.alert('În curând', 'Uploadul de poze va fi disponibil în curând.')}>
            <Ionicons name="add" size={28} color={Colors.gray300} />
            <Text style={styles.photoSlotText}>{i === 0 ? 'Copertă' : `Poză ${i}`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.photosHint}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.gray400} />
        <Text style={styles.photosHintText}>
          Poți adăuga poze mai târziu din Setări → Profil salon
        </Text>
      </View>

      <StepFooter onBack={onBack} onNext={onNext} skipLabel="Sari peste" />
    </ScrollView>
  );
}

// ── Step 4 — Staff ────────────────────────────────────────────────────────────

function StepStaff({
  staffList, onAdd, onRemove, onNext, onBack,
}: {
  staffList: TempStaff[]; onAdd: () => void;
  onRemove: (idx: number) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <StepHeader icon="👥" title="Echipa ta" subtitle="Adaugă membrii care lucrează la salon. Clienții pot alege pe cine preferă." />

      {staffList.map((s, i) => (
        <View key={i} style={styles.staffCard}>
          <View style={styles.staffAvatar}>
            <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.staffCardName}>{s.name}</Text>
            {s.specialty ? <Text style={styles.staffCardSpec}>{s.specialty}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => onRemove(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={22} color={Colors.gray300} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addStaffBtn} onPress={onAdd}>
        <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
        <Text style={styles.addStaffBtnText}>Adaugă angajat</Text>
      </TouchableOpacity>

      {staffList.length === 0 && (
        <Text style={styles.emptyNote}>Poți adăuga angajați mai târziu din secțiunea Setări.</Text>
      )}

      <StepFooter onBack={onBack} onNext={onNext} skipLabel={staffList.length === 0 ? 'Sari peste' : undefined} />
    </ScrollView>
  );
}

// ── Step 5 — Hours ────────────────────────────────────────────────────────────

function StepHours({
  hours, onToggleDay, onTimeChange, onNext, onBack,
}: {
  hours: HourEntry[];
  onToggleDay: (idx: number) => void;
  onTimeChange: (idx: number, field: 'openTime' | 'closeTime', val: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <StepHeader icon="🕐" title="Program de lucru" subtitle="Setează orele în care salonul este deschis. Le poți modifica oricând." />

      <View style={styles.hoursCard}>
        {hours.map((h, i) => (
          <View key={DAY_KEYS[i]} style={[styles.dayRow, i < hours.length - 1 && styles.dayRowBorder]}>
            <TouchableOpacity
              style={[styles.dayPill, !h.isOpen && styles.dayPillOff]}
              onPress={() => onToggleDay(i)}
            >
              <Text style={[styles.dayPillText, !h.isOpen && styles.dayPillTextOff]}>{DAY_LABELS[i]}</Text>
            </TouchableOpacity>
            {h.isOpen ? (
              <View style={styles.timeRow}>
                <TextInput
                  style={styles.timeInput}
                  value={h.openTime}
                  onChangeText={(v) => onTimeChange(i, 'openTime', v)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <Text style={styles.timeSep}>–</Text>
                <TextInput
                  style={styles.timeInput}
                  value={h.closeTime}
                  onChangeText={(v) => onTimeChange(i, 'closeTime', v)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            ) : (
              <Text style={styles.closedLabel}>Închis</Text>
            )}
          </View>
        ))}
      </View>

      <StepFooter onBack={onBack} onNext={onNext} />
    </ScrollView>
  );
}

// ── Step 6 — Booking policy ───────────────────────────────────────────────────

function StepPolicy({
  requiresDeposit, onToggleDeposit, depositPct, onDepositPctChange,
  cancellationHours, onCancellationChange, onNext, onBack,
}: {
  requiresDeposit: boolean; onToggleDeposit: () => void;
  depositPct: number; onDepositPctChange: (v: number) => void;
  cancellationHours: number; onCancellationChange: (v: number) => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <StepHeader icon="📋" title="Setări rezervare" subtitle="Configurează politica de plată și anulare a programărilor." />

      {/* Deposit */}
      <View style={styles.policyCard}>
        <View style={styles.policyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.policyLabel}>Plată în avans (depozit)</Text>
            <Text style={styles.policyDesc}>Reduce no-show-urile cu ~60%</Text>
          </View>
          <Switch
            value={requiresDeposit}
            onValueChange={onToggleDeposit}
            trackColor={{ true: Colors.primary, false: Colors.gray300 }}
            thumbColor={Colors.white}
          />
        </View>
        {requiresDeposit && (
          <View style={styles.depositRow}>
            <Text style={styles.depositHint}>Procent din prețul serviciului:</Text>
            <View style={styles.pctRow}>
              {[20, 30, 50, 100].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.pctChip, depositPct === pct && styles.pctChipActive]}
                  onPress={() => onDepositPctChange(pct)}
                >
                  <Text style={[styles.pctText, depositPct === pct && { color: Colors.white }]}>{pct}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Cancellation */}
      <View style={styles.policyCard}>
        <View style={styles.policyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.policyLabel}>Anulare gratuită</Text>
            <Text style={styles.policyDesc}>Ore înainte de programare</Text>
          </View>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => onCancellationChange(Math.max(1, cancellationHours - 1))}
            >
              <Ionicons name="remove" size={16} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{cancellationHours}h</Text>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => onCancellationChange(cancellationHours + 1)}
            >
              <Ionicons name="add" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <StepFooter onBack={onBack} onNext={onNext} skipLabel="Sari peste" />
    </ScrollView>
  );
}

// ── Step 7 — Notifications ────────────────────────────────────────────────────

function StepNotifications({
  notifNewBooking, onToggleNewBooking,
  notifCancellation, onToggleCancellation,
  onNext, onBack,
}: {
  notifNewBooking: boolean; onToggleNewBooking: () => void;
  notifCancellation: boolean; onToggleCancellation: () => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <StepHeader icon="🔔" title="Notificări" subtitle="Alege ce notificări vrei să primești pe telefon." />

      <View style={styles.policyCard}>
        <NotifRow
          icon="calendar-outline"
          title="Rezervare nouă"
          subtitle="Primești alertă când un client rezervă"
          value={notifNewBooking}
          onToggle={onToggleNewBooking}
        />
        <View style={styles.policyDivider} />
        <NotifRow
          icon="close-circle-outline"
          title="Anulare rezervare"
          subtitle="Primești alertă când un client anulează"
          value={notifCancellation}
          onToggle={onToggleCancellation}
        />
        <View style={styles.policyDivider} />
        <NotifRow
          icon="warning-outline"
          title="No-show client"
          subtitle="Alertă dacă clientul nu s-a prezentat"
          value={true}
          onToggle={() => {}}
          disabled
        />
      </View>

      <View style={styles.notifHint}>
        <Ionicons name="information-circle-outline" size={15} color={Colors.gray400} />
        <Text style={styles.photosHintText}>
          Vei fi rugat să acorzi permisiunea pentru notificări la prima lansare.
        </Text>
      </View>

      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Finalizează" />
    </ScrollView>
  );
}

// ── Step 8 — Done ─────────────────────────────────────────────────────────────

function StepDone({
  salonName, logoUri, gradient, staffCount, finishing, onFinish,
}: {
  salonName: string; logoUri: string | null; gradient: typeof BRAND_GRADIENTS[0];
  staffCount: number; finishing: boolean; onFinish: () => void;
}) {
  const initials = salonName.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <View style={[styles.stepContainer, { justifyContent: 'center' }]}>
      <View style={styles.doneConfetti}>
        <Text style={{ fontSize: 48 }}>🎉</Text>
      </View>
      <Text style={styles.doneTitle}>Salonul tău este gata!</Text>
      <Text style={styles.doneSubtitle}>Totul este configurat. Poți ajusta orice din Setări oricând.</Text>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <LinearGradient colors={gradient.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryLogo}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.summaryCircleImg} />
          ) : (
            <View style={styles.summaryCircleFallback}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: Colors.white }}>{initials}</Text>
            </View>
          )}
        </LinearGradient>
        <Text style={styles.summaryName}>{salonName || 'Salonul tău'}</Text>
        <View style={styles.summaryStats}>
          <SummaryStat icon="people-outline" label={`${staffCount} angajat${staffCount !== 1 ? 'i' : ''}`} />
          <SummaryStat icon="calendar-outline" label="Calendar activ" />
          <SummaryStat icon="notifications-outline" label="Notificări ON" />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { marginTop: Spacing.lg }, finishing && { opacity: 0.7 }]}
        onPress={onFinish}
        disabled={finishing}
      >
        <Text style={styles.primaryBtnText}>Mergi la Dashboard</Text>
        <Ionicons name="arrow-forward" size={18} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StepHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={styles.stepHeader}>
      <Text style={styles.stepIcon}>{icon}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>
    </View>
  );
}

function StepFooter({
  onBack, onNext, nextDisabled, nextLabel, skipLabel,
}: {
  onBack: () => void; onNext: () => void;
  nextDisabled?: boolean; nextLabel?: string; skipLabel?: string;
}) {
  return (
    <View style={styles.footer}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={16} color={Colors.gray500} />
        <Text style={styles.backBtnText}>Înapoi</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      {skipLabel && (
        <TouchableOpacity style={styles.skipBtn} onPress={onNext}>
          <Text style={styles.skipBtnText}>{skipLabel}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.nextBtn, nextDisabled && styles.nextBtnDisabled]}
        onPress={onNext}
        disabled={nextDisabled}
      >
        <Text style={styles.nextBtnText}>{nextLabel ?? 'Continuă'}</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

function NotifRow({
  icon, title, subtitle, value, onToggle, disabled,
}: {
  icon: any; title: string; subtitle: string;
  value: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <View style={styles.notifRow}>
      <View style={styles.notifIconWrap}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.policyLabel}>{title}</Text>
        <Text style={styles.policyDesc}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: Colors.primary, false: Colors.gray300 }}
        thumbColor={Colors.white}
        disabled={disabled}
      />
    </View>
  );
}

function SummaryStat({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.summaryStat}>
      <Ionicons name={icon} size={14} color={Colors.primary} />
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Progress
  progressWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 4 },
  progressBar: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  progressSegment: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border,
  },
  progressSegmentFilled: { backgroundColor: Colors.primary },
  progressSegmentActive: { backgroundColor: Colors.primary },
  progressLabel: { fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'right' },

  // Step container
  stepContainer: {
    flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },

  // Step header
  stepHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  stepIcon: { fontSize: 48, marginBottom: Spacing.sm },
  stepTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.black, textAlign: 'center' },
  stepSubtitle: { fontSize: FontSize.sm, color: Colors.gray500, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  // Welcome
  welcomeIconWrap: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, alignSelf: 'center',
  },
  welcomeIcon: { fontSize: 48 },
  welcomeTitle: {
    fontSize: FontSize.xxxl, fontWeight: FontWeight.heavy, color: Colors.black,
    textAlign: 'center', lineHeight: 40,
  },
  welcomeSubtitle: {
    fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center',
    marginTop: Spacing.sm, marginBottom: Spacing.xl, lineHeight: 22,
  },
  welcomeFeatures: { width: '100%', marginBottom: Spacing.xl },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  featureIcon: { fontSize: 22 },
  featureText: { fontSize: FontSize.md, color: Colors.black, fontWeight: FontWeight.medium },

  // Logo preview (gradient card in identity step)
  logoPreview: {
    alignItems: 'center', borderRadius: Radius.xl, padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },

  // Form
  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700,
    marginBottom: 6, marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 14,
    fontSize: FontSize.md, color: Colors.black, ...Shadow.sm,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { fontSize: FontSize.xs, color: Colors.gray300, textAlign: 'right', marginTop: 4 },

  // Emoji picker (staff modal only)
  emojiRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  emojiBtn: {
    width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border,
  },
  emojiBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  emojiText: { fontSize: 22 },

  // Logo upload
  logoUploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: Spacing.md, ...Shadow.sm,
  },
  logoUploadIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  logoThumb: { width: 44, height: 44, borderRadius: 22 },
  logoUploadTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  logoUploadSub: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },

  // Logo preview card (identity step)
  logoCircleWrap: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', marginBottom: 10, ...Shadow.md },
  logoCircleImg: { width: 72, height: 72 },
  logoCircleFallback: {
    width: 72, height: 72, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoInitialsText: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.white },
  logoNamePreview: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  // Gradient picker
  gradientHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  gradientHintText: { flex: 1, fontSize: FontSize.xs, color: Colors.primary, lineHeight: 16 },
  gradientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.md },
  gradientItem: { width: '22%', alignItems: 'center', position: 'relative' },
  gradientSwatch: { width: '100%', aspectRatio: 1.4, borderRadius: Radius.lg, marginBottom: 4 },
  gradientSwatchActive: { borderWidth: 3, borderColor: Colors.black, ...Shadow.md },
  gradientCheck: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  gradientLabel: { fontSize: 10, color: Colors.gray400, textAlign: 'center' },

  // Photos
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.md },
  photoSlot: {
    width: '30%', aspectRatio: 1, backgroundColor: Colors.white,
    borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoSlotText: { fontSize: FontSize.xs, color: Colors.gray300 },
  photosHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: Spacing.sm,
  },
  photosHintText: { flex: 1, fontSize: FontSize.xs, color: Colors.gray500, lineHeight: 16 },

  // Staff
  staffCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  staffAvatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  staffCardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  staffCardSpec: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },
  addStaffBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.lg,
    borderStyle: 'dashed', padding: 14, marginBottom: Spacing.sm,
  },
  addStaffBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },
  emptyNote: { fontSize: FontSize.sm, color: Colors.gray400, textAlign: 'center', marginVertical: Spacing.md },

  // Hours
  hoursCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md, ...Shadow.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12 },
  dayRowBorder: { borderBottomWidth: 1, borderColor: Colors.gray50 },
  dayPill: {
    width: 46, paddingVertical: 5, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: 'center', marginRight: Spacing.sm,
  },
  dayPillOff: { backgroundColor: Colors.gray100 },
  dayPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.white },
  dayPillTextOff: { color: Colors.gray300 },
  closedLabel: { flex: 1, textAlign: 'right', fontSize: FontSize.sm, color: Colors.gray300 },
  timeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  timeInput: {
    width: 58, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingVertical: 5, paddingHorizontal: 6, fontSize: FontSize.sm, color: Colors.black, textAlign: 'center',
  },
  timeSep: { fontSize: FontSize.md, color: Colors.gray400 },

  // Policy
  policyCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, overflow: 'hidden',
    marginBottom: Spacing.md, ...Shadow.sm,
  },
  policyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  policyLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  policyDesc: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },
  policyDivider: { height: 1, backgroundColor: Colors.gray50, marginHorizontal: Spacing.md },
  depositRow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  depositHint: { fontSize: FontSize.xs, color: Colors.gray500, marginBottom: Spacing.sm },
  pctRow: { flexDirection: 'row', gap: 8 },
  pctChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  pctChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pctText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  counterValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, minWidth: 36, textAlign: 'center' },

  // Notifications
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  notifIconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
  },
  notifHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm,
  },

  // Done
  doneConfetti: { alignItems: 'center', marginBottom: Spacing.md },
  doneTitle: {
    fontSize: FontSize.xxxl, fontWeight: FontWeight.heavy, color: Colors.black,
    textAlign: 'center', marginBottom: Spacing.sm,
  },
  doneSubtitle: {
    fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center',
    lineHeight: 22, marginBottom: Spacing.xl,
  },
  summaryCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg,
    alignItems: 'center', ...Shadow.md,
  },
  summaryLogo: {
    width: 110, height: 110, borderRadius: 55, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm, ...Shadow.md,
  },
  summaryCircleImg: { width: 110, height: 110 },
  summaryCircleFallback: {
    width: 110, height: 110, alignItems: 'center', justifyContent: 'center',
  },
  summaryName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.md },
  summaryStats: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  summaryStat: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  summaryStatLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Staff modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay },
  staffModal: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.gray300, borderRadius: 2,
    alignSelf: 'center', marginBottom: Spacing.lg,
  },
  staffModalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.md },
  staffModalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700, marginBottom: 6, marginTop: Spacing.sm },
  staffModalInput: {
    backgroundColor: Colors.gray50, borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.md, color: Colors.black,
  },
  staffModalBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 14,
    alignItems: 'center', marginTop: Spacing.lg,
  },
  staffModalBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Footer navigation
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.xl, paddingTop: Spacing.md,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  backBtnText: { fontSize: FontSize.sm, color: Colors.gray500 },
  skipBtn: { padding: 8 },
  skipBtnText: { fontSize: FontSize.sm, color: Colors.gray500, textDecorationLine: 'underline' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
  },
  nextBtnDisabled: { backgroundColor: Colors.gray300 },
  nextBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Primary button (welcome + done)
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 18,
    ...Shadow.lg,
  },
  primaryBtnText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
