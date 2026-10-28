import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, View } from 'react-native';
import { api } from '../lib/api';
import { colors, radius } from '../lib/theme';
import { Button, ErrorText, H2, Muted } from './ui';

export interface Photo {
  id: string;
  url: string;
}

const MAX_PHOTOS = 6;
const MAX_SIDE = 1200;

/** Resizes on the device so uploads stay small (~150–300 KB), then returns base64 JPEG. */
async function prepare(asset: ImagePicker.ImagePickerAsset) {
  const resize =
    asset.width && asset.height && Math.max(asset.width, asset.height) > MAX_SIDE
      ? [{ resize: asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE } }]
      : [];
  const out = await manipulateAsync(asset.uri, resize, { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Could not read the photo');
  return { data: out.base64, width: out.width, height: out.height };
}

export function PhotoManager({ toyId, photos }: { toyId: string; photos: Photo[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => qc.invalidateQueries();
  const room = MAX_PHOTOS - photos.length;

  async function add(source: 'camera' | 'library') {
    setError(null);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) throw new Error('Camera permission is needed to take photos');
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsMultipleSelection: source === 'library', selectionLimit: room };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled) return;
      setBusy(true);
      for (const asset of result.assets.slice(0, room)) {
        await api.post(`/admin/toys/${toyId}/photos`, await prepare(asset));
      }
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const remove = useMutation({ mutationFn: (id: string) => api.del(`/admin/toys/${toyId}/photos/${id}`), onSuccess: refresh, onError: setError });
  const makeCover = useMutation({
    mutationFn: (id: string) => api.put(`/admin/toys/${toyId}/photos/order`, { photoIds: [id, ...photos.filter((p) => p.id !== id).map((p) => p.id)] }),
    onSuccess: refresh,
    onError: setError,
  });

  return (
    <View>
      <H2>Photos ({photos.length}/{MAX_PHOTOS})</H2>
      {photos.length === 0 ? <Muted style={{ marginBottom: 8 }}>No photos yet — customers see a “photo coming soon” tile.</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {photos.map((p, i) => (
          <View key={p.id} style={{ width: 120 }}>
            <Image source={{ uri: p.url }} style={{ width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.line }} />
            {i === 0 ? (
              <Text style={{ color: colors.success, fontWeight: '700', fontSize: 12, marginTop: 4 }}>★ Cover</Text>
            ) : (
              <Pressable onPress={() => makeCover.mutate(p.id)}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12, marginTop: 4 }}>Make cover</Text>
              </Pressable>
            )}
            <Pressable onPress={() => remove.mutate(p.id)}>
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 2 }}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </View>
      {busy ? <ActivityIndicator style={{ marginVertical: 10 }} color={colors.primary} /> : null}
      <ErrorText error={error} />
      {room > 0 ? (
        <View>
          {Platform.OS !== 'web' ? <Button title="Take photo" onPress={() => add('camera')} disabled={busy} /> : null}
          <Button title={Platform.OS === 'web' ? 'Upload photos' : 'Choose from gallery'} variant="outline" onPress={() => add('library')} disabled={busy} />
        </View>
      ) : (
        <Muted>Maximum {MAX_PHOTOS} photos. Delete one to add another.</Muted>
      )}
    </View>
  );
}
