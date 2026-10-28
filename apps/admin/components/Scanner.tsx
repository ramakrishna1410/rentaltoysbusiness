import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { Button, Field, Muted } from './ui';

/**
 * Camera QR scanner with a typed fallback (for web, damaged labels, or a USB/Bluetooth scanner that types the payload).
 * The same code is ignored for 2 seconds so one label isn't read many times.
 */
export function Scanner({ onScan, prompt, compact }: { onScan(payload: string): void; prompt?: string; compact?: boolean }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [cameraOn, setCameraOn] = useState(Platform.OS !== 'web');
  const last = useRef<{ data: string; at: number } | null>(null);

  const handle = (data: string) => {
    const now = Date.now();
    if (last.current && last.current.data === data && now - last.current.at < 2000) return;
    last.current = { data, at: now };
    onScan(data.trim());
  };

  return (
    <View>
      {prompt ? <Muted style={{ marginBottom: 8 }}>{prompt}</Muted> : null}
      {cameraOn && permission?.granted ? (
        <View style={[styles.camera, compact && { height: 180 }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handle(data)}
          />
        </View>
      ) : cameraOn ? (
        <Button title="Allow camera to scan" variant="outline" onPress={requestPermission} />
      ) : (
        <Button title="Use camera" variant="outline" onPress={() => setCameraOn(true)} />
      )}
      <Field
        label="Or type / paste the code"
        autoCapitalize="characters"
        placeholder="RT:U:…"
        value={manual}
        onChangeText={setManual}
        onSubmitEditing={() => {
          if (manual.trim()) handle(manual);
          setManual('');
        }}
      />
      <Button
        title="Submit code"
        variant="ghost"
        disabled={!manual.trim()}
        onPress={() => {
          handle(manual);
          setManual('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  camera: { height: 260, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: colors.primary, marginBottom: 8 },
});
