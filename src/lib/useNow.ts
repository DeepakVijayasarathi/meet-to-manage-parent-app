import { useEffect, useState } from "react";

/** Current time, re-rendered every `everyMs` so countdowns and the Join window update without a refresh. */
export function useNow(everyMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
