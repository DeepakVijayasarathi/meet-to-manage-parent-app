import { useCallback, useEffect, useRef, useState } from "react";

import {
  getLeaderboard, getSessionActivities, getSessionQuiz, postAward, postEngagement, type ApiQuizQuestion, type ApiWhiteboardActivity,
} from "@/api/classroom";
import { applyOp, applySlideOp, emptyBoard, isSlideMarkOp, parseOp, type BoardOp, type BoardState, type SlideMarks } from "@/lib/board";
import { ClassroomHubClient, type ClassroomHubState, type HubLeaderboardEntry, type HubParticipant } from "@/lib/classroomHub";

/** Ops arriving this soon after joining are the late-join replay, not something the teacher just did. */
const REPLAY_GRACE_MS = 3000;

export interface ChatMessage { id: string; author: string; text: string; mine: boolean; at: number }

/**
 * Everything the child sees around the video, kept in step with the teacher's web classroom
 * over the classroom hub: the board, board access, chat, quizzes, the live leaderboard and
 * celebrations. Hub outages degrade to "view what you have"; the call itself continues.
 */
export function useClassroom(sessionId: string, token: string, displayName: string) {
  const hubRef = useRef<ClassroomHubClient | null>(null);
  const [hubState, setHubState] = useState<ClassroomHubState>("disconnected");
  const [hubError, setHubError] = useState<string | undefined>();
  const [board, setBoard] = useState<BoardState>(emptyBoard);
  const [canDraw, setCanDraw] = useState(false);
  const [roster, setRoster] = useState<HubParticipant[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [questions, setQuestions] = useState<ApiQuizQuestion[]>([]);
  const [activities, setActivities] = useState<ApiWhiteboardActivity[]>([]);
  const [quizIndex, setQuizIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState<Record<number, number>>({});
  const [leaderboard, setLeaderboard] = useState<HubLeaderboardEntry[]>([]);
  const [celebration, setCelebration] = useState<{ message: string | null; at: number } | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [muteRequestAt, setMuteRequestAt] = useState(0);
  // undefined until the teacher pins or unpins someone (null = unpinned).
  const [pinnedId, setPinnedId] = useState<string | null | undefined>(undefined);
  const [slidePage, setSlidePage] = useState(0);
  const [slideMarks, setSlideMarks] = useState<SlideMarks>({});
  const [deckVersion, setDeckVersion] = useState(0);
  // The child's panel follows whatever the teacher just did (web: InteractivePanel.followTeacher).
  const [teacherActivity, setTeacherActivity] = useState<{ what: "board" | "slides" | "quiz"; at: number } | null>(null);
  const follow = (what: "board" | "slides" | "quiz") => setTeacherActivity({ what, at: Date.now() });
  // Joining replays the whole board history; those replayed ops shouldn't yank the child's view.
  const joinedAt = useRef(Number.MAX_SAFE_INTEGER);

  // Quiz questions and the persisted leaderboard load over REST; the hub then keeps them live.
  useEffect(() => {
    getSessionQuiz(token, sessionId).then(setQuestions).catch(() => undefined);
    getSessionActivities(token, sessionId).then(setActivities).catch(() => undefined);
    getLeaderboard(token, sessionId)
      .then((rows) => setLeaderboard(rows.map((r) => ({ name: r.participantName, stars: r.stars }))))
      .catch(() => undefined);
  }, [token, sessionId]);

  useEffect(() => {
    const hub = new ClassroomHubClient(sessionId, token);
    hubRef.current = hub;
    void hub.connect(
      displayName,
      {
        roster: setRoster,
        board: (json) => {
          const op = parseOp(json);
          if (!op) return;
          // Slide marks share the Board channel (and its late-join replay) with the whiteboard.
          if (isSlideMarkOp(op)) {
            setSlideMarks((m) => applySlideOp(m, op));
            // A new deck (or presenting stopped): fetch the file again.
            if (op.kind === "slideClearAll") setDeckVersion((v) => v + 1);
            return;
          }
          setBoard((b) => applyOp(b, op));
          if (op.kind !== "reset" && Date.now() - joinedAt.current > REPLAY_GRACE_MS) follow("board");
        },
        boardAccess: (allowed) => { setCanDraw(allowed); if (allowed) follow("board"); },
        slide: (page) => { setSlidePage(page); follow("slides"); },
        chat: (author, text) => {
          setChat((c) => [...c.slice(-199), { id: `${Date.now()}-${c.length}`, author, text, mine: author === displayName, at: Date.now() }]);
          if (author !== displayName) setUnreadChat((n) => n + 1);
        },
        quizStarted: (i) => { setQuizIndex(i); follow("quiz"); },
        quizEnded: () => setQuizIndex(null),
        leaderboard: setLeaderboard,
        celebrate: (message) => setCelebration({ message, at: Date.now() }),
        muteAll: () => setMuteRequestAt(Date.now()),
        pinned: setPinnedId,
        // Rebuilt from the Board history replay; the server also revokes per-connection board grants.
        resync: () => { setBoard(emptyBoard()); setSlideMarks({}); setCanDraw(false); joinedAt.current = Date.now(); },
      },
      (state, detail) => { setHubState(state); setHubError(detail); },
    ).then(() => { joinedAt.current = Date.now(); });
    return () => { void hub.disconnect(); hubRef.current = null; };
  }, [sessionId, token, displayName]);

  /** Local board change: applied here at once, broadcast only while the teacher allows drawing. */
  const boardOp = useCallback((op: BoardOp) => {
    setBoard((b) => applyOp(b, op));
    if (canDraw) hubRef.current?.sendBoard(JSON.stringify(op));
  }, [canDraw]);

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed) hubRef.current?.sendChat(trimmed);
  }, []);

  const answerQuiz = useCallback((questionIndex: number, optionIndex: number) => {
    const q = questions[questionIndex];
    if (!q || answered[questionIndex] !== undefined) return;
    // The API's own option order, exactly as the web classroom indexes the teacher's live tally.
    const correct = !!q.options[optionIndex]?.isCorrect;
    setAnswered((a) => ({ ...a, [questionIndex]: optionIndex }));
    hubRef.current?.answerQuiz(questionIndex, optionIndex, correct);
    postEngagement(token, sessionId, displayName, "QuizAttempt");
    if (correct) {
      postEngagement(token, sessionId, displayName, "QuizCorrect");
      postAward(token, sessionId, displayName, "Star");
    }
    return correct;
  }, [questions, answered, token, sessionId, displayName]);

  const toggleHand = useCallback(() => {
    setHandRaised((raised) => {
      hubRef.current?.raiseHand(!raised);
      if (!raised) postEngagement(token, sessionId, displayName, "HandRaise");
      return !raised;
    });
  }, [token, sessionId, displayName]);

  /** A whiteboard activity finished correctly (web: InteractivePanel.onActivityComplete). */
  const completeActivity = useCallback(() => {
    setCelebration({ message: "Activity complete — great job! ⭐", at: Date.now() });
    postEngagement(token, sessionId, displayName, "ActivityCompleted");
    // Durable award first, then bump everyone's live leaderboard.
    postAward(token, sessionId, displayName, "Star");
    hubRef.current?.awardStar();
  }, [token, sessionId, displayName]);

  // Stable identities: the celebration's auto-dismiss timer depends on this, and any new function
  // per render restarted it on every chat message or board stroke, so it never went away.
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const clearUnreadChat = useCallback(() => setUnreadChat(0), []);

  const boardInteraction = useCallback(() => postEngagement(token, sessionId, displayName, "WhiteboardInteraction"), [token, sessionId, displayName]);

  return {
    hubState, hubError, board, canDraw, roster, chat, unreadChat, clearUnreadChat,
    questions, quizIndex, answered, leaderboard, celebration, dismissCelebration,
    handRaised, muteRequestAt, boardOp, sendChat, answerQuiz, toggleHand, boardInteraction,
    slidePage, slideMarks, deckVersion, teacherActivity, sessionId, token, pinnedId, activities, completeActivity,
  };
}

export type Classroom = ReturnType<typeof useClassroom>;
