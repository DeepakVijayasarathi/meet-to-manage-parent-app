import type { ApiJitsiJoin } from "@/api/types";

/**
 * Room URL on the self-hosted Jitsi: signed token, the child's name, and a phone-sized
 * call — no pre-join or "get the app" page, and only the controls a child needs (the app's
 * own panel covers chat, raise hand and participants, so Jitsi's copies are hidden).
 */
export interface RoomJoinOptions {
  /** Start with the microphone / camera off, as chosen on the pre-join screen. */
  audioMuted?: boolean;
  videoMuted?: boolean;
}

export function roomUrl(join: Pick<ApiJitsiJoin, "domain" | "room" | "token">, displayName: string, opts: RoomJoinOptions = {}): string {
  const config: Record<string, unknown> = {
    "config.prejoinConfig.enabled": false,
    "config.disableDeepLinking": true,
    // Same media tuning as the web classroom (JitsiLive): a phone on mobile data is the weakest link,
    // and with Jitsi's defaults it stalls instead of just looking softer.
    // Always relay through the JVB: peer-to-peer has no TURN fallback, the classic cause of "I can see
    // their tile but hear and see nothing".
    "config.p2p.enabled": false,
    // Capture a modest camera size (360p ideal, 480p ceiling) instead of the 720p+ default, which
    // needs ~2.5 Mbps upstream; simulcast still steps down from there when the link gets worse.
    "config.constraints.video.height.ideal": 360,
    "config.constraints.video.height.max": 480,
    "config.constraints.video.height.min": 180,
    // Consistent voice level and echo/noise cleanup on every phone, instead of each device's own default.
    "config.constraints.audio.autoGainControl": true,
    "config.constraints.audio.echoCancellation": true,
    "config.constraints.audio.noiseSuppression": true,
    // Audio that survives a bad link: RED sends each frame twice so a lost packet isn't a dropout, DTX
    // stops sending during silence, and a 32 kbps cap leaves room for the rest of a weak connection.
    "config.audioQuality.stereo": false,
    "config.audioQuality.opusMaxAverageBitrate": 32000,
    "config.audioQuality.enableOpusDtx": true,
    "config.audioQuality.enableOpusRed": true,
    "config.doNotStoreRoom": true,
    "config.startWithAudioMuted": !!opts.audioMuted,
    "config.startWithVideoMuted": !!opts.videoMuted,
    "config.toolbarButtons": ["microphone", "camera", "tileview", "hangup"],
    "config.hideConferenceSubject": true,
    "config.hideConferenceTimer": true,
    "config.disableReactions": true,
    "config.disableInviteFunctions": true,
    "config.notifications": [],
    "config.disableSelfViewSettings": true,
    "config.filmstrip.disableResizable": true,
    "config.toolbarConfig.alwaysVisible": true,
    "config.toolbarConfig.autoHideWhileChatIsOpen": false,
    "interfaceConfig.MOBILE_APP_PROMOTION": false,
    "interfaceConfig.SHOW_JITSI_WATERMARK": false,
    "interfaceConfig.SHOW_WATERMARK_FOR_GUESTS": false,
    "interfaceConfig.SHOW_BRAND_WATERMARK": false,
    "interfaceConfig.SHOW_POWERED_BY": false,
    "interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS": true,
    "userInfo.displayName": displayName,
  };
  const hash = Object.entries(config).map(([k, v]) => `${k}=${encodeURIComponent(JSON.stringify(v))}`).join("&");
  const query = join.token ? `?jwt=${encodeURIComponent(join.token)}` : "";
  return `https://${join.domain}/${encodeURIComponent(join.room)}${query}#${hash}`;
}
