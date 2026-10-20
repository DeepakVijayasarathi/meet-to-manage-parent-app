import type { ApiJitsiJoin } from "@/api/types";

/**
 * Room URL on the self-hosted Jitsi: signed token, the child's name, and a phone-sized
 * call — no pre-join or "get the app" page, and only the controls a child needs (the app's
 * own panel covers chat, raise hand and participants, so Jitsi's copies are hidden).
 */
export function roomUrl(join: Pick<ApiJitsiJoin, "domain" | "room" | "token">, displayName: string): string {
  const config: Record<string, unknown> = {
    "config.prejoinConfig.enabled": false,
    "config.disableDeepLinking": true,
    "config.startWithAudioMuted": false,
    "config.startWithVideoMuted": false,
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
