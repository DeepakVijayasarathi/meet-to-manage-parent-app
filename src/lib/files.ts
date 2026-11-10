import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { API_BASE_URL, CLIENT_HEADERS, ApiError } from "@/api/client";

/**
 * Downloads a signed-in API file into the app's cache and opens it in the phone's own viewer, so the family never
 * leaves the app for the website. Falls back to the share sheet ("Open with…") when there is no built-in preview.
 */
export async function openApiFile(token: string, path: string, fileName: string): Promise<void> {
  const safeName = fileName.replace(/[^\w.\- ]+/g, "_") || "file";
  const folder = new Directory(Paths.cache, "downloads");
  if (!folder.exists) folder.create({ intermediates: true });
  const target = new File(folder, safeName);
  let file: File;
  try {
    file = await File.downloadFileAsync(`${API_BASE_URL}${path}`, target, {
      idempotent: true,
      headers: { ...CLIENT_HEADERS, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(0, "Couldn't download the file. Check your connection and try again.");
  }
  if (await File.canPreview(file).catch(() => false)) {
    await File.preview(file);
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { dialogTitle: safeName });
    return;
  }
  throw new ApiError(0, "No app on this phone can open this file.");
}
