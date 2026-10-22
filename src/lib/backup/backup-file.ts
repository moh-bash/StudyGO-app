/**
 * File glue for the local backup: writes the JSON to a cache file and opens the
 * system share sheet, or lets the student pick a JSON file to import.
 *
 * The file never leaves the device unless the student explicitly shares it.
 * No network request is made here.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Stable, human-readable file name, e.g. `studygo-backup-2026-10-19.json`. */
export function backupFileName(date: Date = new Date()): string {
  return `studygo-backup-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * Writes `json` to the app cache and opens the share sheet. Throws a localized
 * error when sharing is unavailable (e.g. some web/desktop targets).
 */
export async function shareBackupFile(
  json: string,
  fileName: string = backupFileName(),
): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: true });
  file.write(json);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('مشاركة الملفات غير متاحة على هذا الجهاز. يمكنك نسخ المحتوى يدويًا.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'نسخة احتياطية من StudyGO',
    UTI: 'public.json',
  });
}

/**
 * Opens the document picker and returns the selected file's text, or `null`
 * when the student cancels. The caller validates the content before writing.
 */
export async function pickBackupFileText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) {
    return null;
  }
  const asset = result.assets[0];
  if (!asset) {
    return null;
  }
  return new File(asset.uri).text();
}
