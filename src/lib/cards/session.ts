import type { GradeName } from "./types";

export type LaterKind = "again" | "step";

export type LaterItem = {
  id: string;
  notBefore: number;
  kind: LaterKind;
};

type ReturnCount = { again: number; step: number };

export type Session = {
  startedAt: number;
  limitMs: number;
  due: string[];
  fresh: string[];
  later: LaterItem[];
  returns: Record<string, ReturnCount>;
  current: string | null;
  phase: "card" | "hold" | "done";
  holdUntil: number;
  graded: number;
  endReason: "time" | "clear" | null;
};

export function createSession(args: {
  now: number;
  limitMs: number;
  dueIds: string[];
  freshIds: string[];
}): Session {
  return advance(
    {
      startedAt: args.now,
      limitMs: args.limitMs,
      due: args.dueIds,
      fresh: args.freshIds,
      later: [],
      returns: {},
      current: null,
      phase: "card",
      holdUntil: 0,
      graded: 0,
      endReason: null,
    },
    args.now,
  );
}

export function advance(session: Session, now: number): Session {
  if (session.phase === "done") return session;
  if (session.current) return session;
  if (session.phase === "hold" && now < session.holdUntil) return session;

  const timeUp = now >= session.startedAt + session.limitMs;

  if (!timeUp && session.due.length > 0) {
    const id = session.due[0];
    if (!id) return finish(session, now);
    return { ...session, due: session.due.slice(1), current: id, phase: "card" };
  }

  if (!timeUp && session.fresh.length > 0) {
    const id = session.fresh[0];
    if (!id) return finish(session, now);
    return { ...session, fresh: session.fresh.slice(1), current: id, phase: "card" };
  }

  const readyIndex = session.later.findIndex((item) => item.notBefore <= now);
  if (readyIndex >= 0) {
    const item = session.later[readyIndex];
    if (!item) return finish(session, now);
    return {
      ...session,
      later: session.later.filter((_, index) => index !== readyIndex),
      current: item.id,
      phase: "card",
    };
  }

  if (session.later.length > 0) {
    const next = session.later.reduce((soonest, item) =>
      item.notBefore < soonest.notBefore ? item : soonest,
    );
    const wait = next.notBefore - now;
    const keep = next.kind === "again" || (wait <= 20_000 && !timeUp);
    if (keep) {
      return { ...session, phase: "hold", holdUntil: next.notBefore, current: null };
    }
    const agains = session.later.filter((item) => item.kind === "again");
    if (agains.length === 0) return finish(session, now);
    return advance({ ...session, later: agains, phase: "card" }, now);
  }

  return finish(session, now);
}

function finish(session: Session, now: number): Session {
  const timeUp = now >= session.startedAt + session.limitMs;
  return {
    ...session,
    current: null,
    phase: "done",
    endReason: timeUp ? "time" : "clear",
  };
}

export function gradeSession(
  session: Session,
  now: number,
  result: { id: string; rating: GradeName; nextDue: number; shortTerm: boolean },
): Session {
  if (session.phase !== "card" || session.current !== result.id) return session;

  const returns = { ...session.returns };
  const later = session.later.slice();
  const prior = returns[result.id] ?? { again: 0, step: 0 };
  const others = session.due.length + session.fresh.length + later.length > 0;

  if (result.rating === "again" && prior.again < 1) {
    returns[result.id] = { again: 1, step: prior.step };
    later.push(againItem(result, now, others));
  } else if (result.rating !== "again" && result.shortTerm && prior.step < 1) {
    const step = stepItem(result, now, session, others);
    if (step) {
      returns[result.id] = { again: prior.again, step: 1 };
      later.push(step);
    }
  }

  return advance(
    {
      ...session,
      current: null,
      later,
      returns,
      graded: session.graded + 1,
      phase: "card",
    },
    now,
  );
}

function againItem(
  result: { id: string; nextDue: number },
  now: number,
  others: boolean,
): LaterItem {
  if (others) return { id: result.id, notBefore: now, kind: "again" };
  const wait = Math.min(60_000, Math.max(8_000, result.nextDue - now));
  return { id: result.id, notBefore: now + wait, kind: "again" };
}

function stepItem(
  result: { id: string; nextDue: number },
  now: number,
  session: Session,
  others: boolean,
): LaterItem | null {
  const wait = result.nextDue - now;
  const remaining = session.startedAt + session.limitMs - now;
  if (wait > 15 * 60_000) return null;
  if (!others && wait > 20_000) return null;
  if (wait > remaining && !others) return null;
  return { id: result.id, notBefore: Math.max(now, result.nextDue), kind: "step" };
}

export function queueAhead(session: Session): number {
  return session.due.length + session.fresh.length + session.later.length + (session.current ? 1 : 0);
}
