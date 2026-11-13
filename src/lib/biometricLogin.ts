// Fingerprint / Face sign-in: after the family turns it on, their sign-in details are kept in the phone's
// secure store (Android Keystore / iOS Keychain) and released only after a successful biometric check.
import * as LocalAuthentication from "expo-local-authentication";
import { Alert, Platform } from "react-native";

import { BIOMETRIC_LOCK_KEY, readFlag, writeFlag } from "@/lib/preferences";
import { readItem, writeItem } from "@/lib/storage";

const CREDENTIALS_KEY = "mtm.biometric-credentials";
const IDENTIFIER_KEY = "mtm.last-identifier";
const OFFERED_KEY = "mtm.biometric-offered";

export interface SavedCredentials { identifier: string; pin: string }

const supported = () => Platform.OS !== "web";

export async function biometricsAvailable(): Promise<boolean> {
  return supported() && await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
}

// When the fingerprint was last confirmed this run. The app lock skips its own prompt right after a fingerprint
// sign-in, so a family is asked once, not once on the sign-in screen and again on the dashboard.
let lastVerifiedAt = 0;
export const verifiedJustNow = () => Date.now() - lastVerifiedAt < 60_000;
/** A successful PIN sign-in is already proof of identity, so the app lock must not ask for the fingerprint right after it. */
export const markVerified = () => { lastVerifiedAt = Date.now(); };

export async function authenticate(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: "Use PIN instead" });
  if (result.success) lastVerifiedAt = Date.now();
  return result.success;
}

// Set when the family taps "Sign in with PIN" on the lock screen, so the sign-in screen they land on after
// signing out opens the PIN form instead of prompting for the fingerprint again.
let pinPreferred = false;
export const preferPinSignIn = () => { pinPreferred = true; };
export const takePinPreference = () => { const value = pinPreferred; pinPreferred = false; return value; };

/** The email / mobile last used to sign in, so the PIN alone is enough to turn fingerprint sign-in on later. */
export const rememberIdentifier = (identifier: string) => supported() ? writeItem(IDENTIFIER_KEY, identifier.trim()) : Promise.resolve();
export const readIdentifier = () => supported() ? readItem(IDENTIFIER_KEY) : Promise.resolve(null);

export async function saveBiometricCredentials(identifier: string, pin: string): Promise<void> {
  await writeItem(CREDENTIALS_KEY, JSON.stringify({ identifier: identifier.trim(), pin } satisfies SavedCredentials));
}

export async function readBiometricCredentials(): Promise<SavedCredentials | null> {
  if (!supported()) return null;
  try {
    const raw = await readItem(CREDENTIALS_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<SavedCredentials>) : null;
    return value?.identifier && value.pin ? { identifier: value.identifier, pin: value.pin } : null;
  } catch { return null; }
}

export async function clearBiometricCredentials(): Promise<void> {
  if (supported()) await writeItem(CREDENTIALS_KEY, null);
}

/** Turned on and ready: the sign-in screen can show the fingerprint button. */
export async function biometricLoginReady(): Promise<boolean> {
  return supported() && await readFlag(BIOMETRIC_LOCK_KEY) && !!(await readBiometricCredentials()) && await biometricsAvailable();
}

export async function enableBiometricLogin(identifier: string, pin: string): Promise<void> {
  await saveBiometricCredentials(identifier, pin);
  await writeFlag(BIOMETRIC_LOCK_KEY, true);
}

export async function disableBiometricLogin(): Promise<void> {
  await clearBiometricCredentials();
  await writeFlag(BIOMETRIC_LOCK_KEY, false);
}

/**
 * Right after a successful PIN sign-in: refresh the saved details if fingerprint sign-in is already on,
 * otherwise offer it once (declining is remembered, and it can still be switched on under More).
 */
export async function offerBiometricLogin(identifier: string, pin: string): Promise<void> {
  if (!supported()) return;
  if (await readFlag(BIOMETRIC_LOCK_KEY)) { await saveBiometricCredentials(identifier, pin); return; }
  if (await readItem(OFFERED_KEY) || !(await biometricsAvailable())) return;
  await writeItem(OFFERED_KEY, "1");
  const accepted = await new Promise<boolean>((resolve) => Alert.alert(
    "Sign in with your fingerprint?",
    "Next time, unlock with your fingerprint or face instead of typing your email and PIN.",
    [
      { text: "Not now", style: "cancel", onPress: () => resolve(false) },
      { text: "Turn on", onPress: () => resolve(true) },
    ],
    { cancelable: true, onDismiss: () => resolve(false) },
  ));
  if (accepted && await authenticate("Confirm to turn on fingerprint sign-in")) await enableBiometricLogin(identifier, pin);
}
