import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Colors, Radius, Shadow } from '../../theme';

/** Imperative handle exposed by DraggableSheet. */
export interface DraggableSheetRef {
  /** Opens (presents) the sheet. */
  present: () => void;
  /** Closes (dismisses) the sheet. */
  dismiss: () => void;
}

export interface DraggableSheetProps {
  children: React.ReactNode;
  /** Snap points, e.g. ['50%', '90%'] or pixel numbers. Defaults to ['80%']. */
  snapPoints?: (string | number)[];
  /** Size the sheet to its content instead of fixed snap points. */
  enableDynamicSizing?: boolean;
  /** Called after the sheet has been fully dismissed. */
  onDismiss?: () => void;
  /** Render children inside a BottomSheetScrollView (for long content / forms). */
  scrollable?: boolean;
  /** Frosted-glass background instead of the default solid card surface. */
  glass?: boolean;
}

const DEFAULT_SNAP_POINTS: (string | number)[] = ['80%'];
// Dimmed backdrop strength — matches the Colors.overlay feel.
const BACKDROP_OPACITY = 0.45;
// GlassView-matching frost: iOS keeps the real blur visible with a light tint,
// Android's blur is weaker so a more opaque fill preserves contrast.
const GLASS_OVERLAY_OPACITY = Platform.OS === 'android' ? 0.8 : 0.14;
const GLASS_BLUR_INTENSITY = 60;

/** Frosted (GlassView-like) sheet background: blur layer + translucent white fill. */
function GlassSheetBackground({ style }: BottomSheetBackgroundProps) {
  return (
    <View style={[style, styles.glassShadow]}>
      <BlurView
        intensity={GLASS_BLUR_INTENSITY}
        tint="light"
        style={[StyleSheet.absoluteFill, styles.glassClip]}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassOverlay]} />
    </View>
  );
}

/**
 * Reusable draggable bottom sheet (modal-style) built on BottomSheetModal.
 * Matches the physics and look of the client search sheet: rounded top,
 * gray pill drag handle, soft shadow, pan-down-to-close, dimmed backdrop.
 *
 * Requires BottomSheetModalProvider at the app root (see src/app/_layout.tsx).
 *
 * @example
 * const sheetRef = useRef<DraggableSheetRef>(null);
 *
 * <Button title="New appointment" onPress={() => sheetRef.current?.present()} />
 * <DraggableSheet
 *   ref={sheetRef}
 *   snapPoints={['60%', '90%']}
 *   scrollable
 *   onDismiss={() => setDraft(null)}
 * >
 *   <AppointmentForm onDone={() => sheetRef.current?.dismiss()} />
 * </DraggableSheet>
 */
const DraggableSheet = forwardRef<DraggableSheetRef, DraggableSheetProps>(function DraggableSheet(
  {
    children,
    snapPoints,
    enableDynamicSizing = false,
    onDismiss,
    scrollable = false,
    glass = false,
  },
  ref,
) {
  const modalRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => modalRef.current?.present(),
      dismiss: () => modalRef.current?.dismiss(),
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={BACKDROP_OPACITY}
      />
    ),
    [],
  );

  // With dynamic sizing the content height drives the sheet, so only fall back
  // to the default snap points when sizing is fixed.
  const resolvedSnapPoints = enableDynamicSizing ? snapPoints : (snapPoints ?? DEFAULT_SNAP_POINTS);
  // A flexed wrapper breaks content measurement when dynamic sizing is on.
  const contentStyle = enableDynamicSizing ? undefined : styles.fill;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={resolvedSnapPoints}
      enableDynamicSizing={enableDynamicSizing}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundComponent={glass ? GlassSheetBackground : undefined}
      backgroundStyle={glass ? undefined : styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      {scrollable ? (
        <BottomSheetScrollView
          style={contentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={contentStyle}>{children}</BottomSheetView>
      )}
    </BottomSheetModal>
  );
});

export default DraggableSheet;

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    ...Shadow.md,
  },
  handle: {
    backgroundColor: Colors.gray300,
    width: 40,
  },
  fill: {
    flex: 1,
  },

  // Glass variant
  glassShadow: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    ...Shadow.md,
  },
  glassClip: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  glassOverlay: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: `rgba(255,255,255,${GLASS_OVERLAY_OPACITY})`,
  },
});
