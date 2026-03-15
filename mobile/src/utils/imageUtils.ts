import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export async function compressImage(uri: string): Promise<string> {
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.75, format: SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    // Fall back to original if compression fails
    return uri;
  }
}
