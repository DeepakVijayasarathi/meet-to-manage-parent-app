// Live-classroom sync, ported from the web portal (meettomanage/src/lib/classroomHub.ts):
// the same SignalR hub, methods and events, so the app's whiteboard, quiz, stars and chat
// stay in step with the teacher's web classroom. All sends are safe no-ops while
// disconnected, so a hub outage never breaks the class (Jitsi carries the call).
import { HttpTransportType, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";

import { API_BASE_URL, CLIENT_HEADERS } from "@/api/client";

export interface HubParticipant {
  connectionId: string;
  name: string;
  role: "teacher" | "student";
  handRaised: boolean;
}

export interface HubLeaderboardEntry {
  name: string;
  stars: number;
}

export interface ClassroomHubEvents {
  roster: (participants: HubParticipant[]) => void;
  board: (opJson: string) => void;
  annotation: (opJson: string) => void;
  slide: (pageIndex: number) => void;
  chat: (author: string, text: string) => void;
  quizStarted: (questionIndex: number) => void;
  quizEnded: () => void;
  quizAnswer: (name: string, questionIndex: number, selectedIndex: number, correct: boolean) => void;
  leaderboard: (entries: HubLeaderboardEntry[]) => void;
  celebrate: (message: string | null) => void;
  boardAccess: (allowed: boolean) => void;
  pinned: (participantId: string | null) => void;
  muteAll: () => void;
  /** After an automatic reconnect: JoinSession replays the whole board history, and not every
   *  board op is idempotent, so the board must be wiped and rebuilt from that replay. */
  resync: () => void;
}

export type ClassroomHubState = "connected" | "reconnecting" | "disconnected";

const EVENT_NAMES: Record<Exclude<keyof ClassroomHubEvents, "resync">, string> = {
  roster: "Roster",
  board: "Board",
  annotation: "Annotation",
  slide: "Slide",
  chat: "Chat",
  quizStarted: "QuizStarted",
  quizEnded: "QuizEnded",
  quizAnswer: "QuizAnswer",
  leaderboard: "Leaderboard",
  celebrate: "Celebrate",
  boardAccess: "BoardAccess",
  pinned: "Pinned",
  muteAll: "MuteAll",
};

/** Short, parent-facing reason for a failed connection (same buckets as the web). */
function describeHubError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("You do not have access to this session")) return "You don't have access to this session.";
  if (message.includes("Unauthorized") || message.includes("Status code '401'")) return "Your sign-in expired. Please sign in again.";
  if (message.includes("No Connection with that ID") || message.includes("Status code '404'")) return "Couldn't reach the live-sync server.";
  if (message.includes("Failed to fetch") || message.includes("Failed to complete negotiation") || message.includes("Network request failed")) {
    return "Couldn't reach the live-sync server.";
  }
  return message;
}

/** EXPO_PUBLIC_HUB_TRANSPORT=longpolling mirrors the web's VITE_HUB_TRANSPORT escape hatch. */
function transport(): HttpTransportType | undefined {
  const forced = (process.env.EXPO_PUBLIC_HUB_TRANSPORT ?? "").toLowerCase();
  if (forced === "longpolling") return HttpTransportType.LongPolling;
  if (forced === "serversentevents") return HttpTransportType.ServerSentEvents;
  return undefined;
}

export class ClassroomHubClient {
  private connection: HubConnection | null = null;
  private disposed = false;

  constructor(private readonly sessionId: string, private readonly accessToken: string) {}

  async connect(
    displayName: string,
    handlers: Partial<ClassroomHubEvents>,
    onStateChange?: (state: ClassroomHubState, detail?: string) => void,
  ): Promise<boolean> {
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/classroom`, {
        accessTokenFactory: () => this.accessToken,
        headers: { ...CLIENT_HEADERS },
        transport: transport(),
      })
      // Never give up: a child won't press Retry, and Jitsi carries the call meanwhile.
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: ({ previousRetryCount }) => [0, 2000, 5000, 10000][previousRetryCount] ?? 15000 })
      // Connection trouble is reported through onStateChange; SignalR's own console errors
      // (e.g. "stopped before start finished" when a child leaves quickly) only alarm the dev overlay.
      .configureLogging(LogLevel.Critical)
      .build();

    for (const [key, event] of Object.entries(EVENT_NAMES) as [keyof typeof EVENT_NAMES, string][]) {
      const handler = handlers[key];
      if (handler) connection.on(event, handler as (...args: unknown[]) => void);
    }

    connection.onreconnecting(() => onStateChange?.("reconnecting"));
    connection.onclose((err) => onStateChange?.("disconnected", err ? describeHubError(err) : undefined));
    connection.onreconnected(() => {
      handlers.resync?.();
      connection.invoke("JoinSession", this.sessionId, displayName).catch(() => undefined);
      onStateChange?.("connected");
    });

    // Set before start(): a disconnect() racing this connect() must find it to stop.
    this.connection = connection;
    try {
      await connection.start();
      if (this.disposed) { await connection.stop().catch(() => undefined); return false; }
      await connection.invoke("JoinSession", this.sessionId, displayName);
      if (this.disposed) {
        await connection.invoke("LeaveSession", this.sessionId).catch(() => undefined);
        await connection.stop().catch(() => undefined);
        return false;
      }
      onStateChange?.("connected");
      return true;
    } catch (err) {
      onStateChange?.("disconnected", describeHubError(err));
      return false;
    }
  }

  get connected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  private send(method: string, ...args: unknown[]): void {
    if (!this.connected) return;
    this.connection!.invoke(method, this.sessionId, ...args).catch(() => undefined);
  }

  sendBoard(opJson: string): void { this.send("SendBoard", opJson); }
  sendChat(text: string): void { this.send("SendChat", text); }
  answerQuiz(questionIndex: number, selectedIndex: number, correct: boolean): void { this.send("AnswerQuiz", questionIndex, selectedIndex, correct); }
  /** Live-leaderboard bump for a whiteboard mini-game completion. */
  awardStar(): void { this.send("AwardStar"); }
  raiseHand(raised: boolean): void { this.send("RaiseHand", raised); }

  async disconnect(): Promise<void> {
    this.disposed = true;
    const connection = this.connection;
    this.connection = null;
    if (!connection) return;
    await connection.invoke("LeaveSession", this.sessionId).catch(() => undefined);
    await connection.stop().catch(() => undefined);
  }
}
