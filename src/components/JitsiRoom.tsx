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
}

/** Web build: the native SDK can't run in a browser, so the room opens in a new tab. */
export function JitsiRoom({ join, displayName }: JitsiRoomProps) {
  useEffect(() => {
    void Linking.openURL(roomUrl(join, displayName));
    if (router.canGoBack()) router.back();
  }, [join, displayName]);
  return null;
}
