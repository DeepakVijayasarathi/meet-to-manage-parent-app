import { router } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";

import type { ApiJitsiJoin } from "@/api/types";
import { roomUrl } from "@/lib/jitsi";

export interface JitsiRoomProps {
  join: ApiJitsiJoin;
  displayName: string;
  subject: string;
  onReady: () => void;
  muteRequestAt?: number;
  pinnedId?: string | null;
  audioMuted?: boolean;
  videoMuted?: boolean;
}

/** Web build: the native SDK can't run in a browser, so the room opens in a new tab. */
export function JitsiRoom({ join, displayName, audioMuted, videoMuted }: JitsiRoomProps) {
  useEffect(() => {
    void Linking.openURL(roomUrl(join, displayName, { audioMuted, videoMuted }));
    if (router.canGoBack()) router.back();
  }, [join, displayName, audioMuted, videoMuted]);
  return null;
}
