import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Database } from "@/types/database";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

const SecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

/**
 * Supabase Storage 이미지를 썸네일로 변환
 * /object/public/bucket/path → /render/image/public/bucket/path?width=W&quality=Q
 */
export function thumbnailUrl(url: string, width = 400, quality = 70): string {
  if (!url || !url.includes('/storage/v1/object/public/')) return url;
  return url.replace('/storage/v1/object/public/', `/storage/v1/render/image/public/`) + `?width=${width}&quality=${quality}`;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS !== "web" ? SecureStoreAdapter : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
