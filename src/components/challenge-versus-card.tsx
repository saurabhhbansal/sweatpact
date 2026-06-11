import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/avatar";
import { statusToken, TONE_TEXT } from "@/lib/challenge-view";
import { formatCents } from "@/lib/money";

export type VersusPerson = {
  url?: string | null;
  name: string;
  username?: string | null;
  status?: string | null;
};

type Standing = { text: string; tone: "positive" | "negative" | "neutral" };

const STANDING_CLASSES: Record<Standing["tone"], string> = {
  positive: "text-emerald-400",
  negative: "text-red-400",
  neutral: "text-white/55",
};

// Head-to-head challenge card: you vs them (1-on-1) or you + a stack (3+).
// Presentational only — wraps a Link to the challenge detail page.
export function ChallengeVersusCard({
  challengeId,
  stakeCents,
  me,
  others,
  isOneOnOne,
  standing,
}: {
  challengeId: string;
  stakeCents: number;
  me: VersusPerson;
  others: VersusPerson[];
  isOneOnOne: boolean;
  standing?: Standing;
}) {
  const other = others[0];
  // 1-on-1: the other person's name is the card identity. 3+: "You + N others".
  const title = isOneOnOne
    ? other?.name ?? "Challenge"
    : `You + ${others.length} other${others.length === 1 ? "" : "s"}`;

  const myToken = statusToken(me.status);
  const otherToken = isOneOnOne ? statusToken(other?.status) : null;

  return (
    <Link
      href={`/groups/${challengeId}`}
      className="group block rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl transition duration-200 hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.99]"
    >
      {/* Two sides with a VS / with divider */}
      <div className="flex items-stretch justify-between gap-2">
        {/* Me */}
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <Avatar url={me.url} name={me.name} username={me.username} size="md" />
          <div>
            <p className="text-sm font-semibold text-white">You</p>
            <p className={`mt-0.5 text-xs ${TONE_TEXT[myToken.tone]}`}>
              {myToken.icon} {myToken.label}
            </p>
          </div>
        </div>

        {/* Center divider */}
        <div className="flex shrink-0 flex-col items-center justify-center px-1">
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
            {isOneOnOne ? "VS" : "with"}
          </span>
        </div>

        {/* Them */}
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          {isOneOnOne ? (
            <Avatar
              url={other?.url}
              name={other?.name}
              username={other?.username}
              size="md"
            />
          ) : (
            <AvatarStack members={others} size="md" max={3} />
          )}
          <div className="min-w-0">
            <p className="max-w-[8rem] truncate text-sm font-semibold text-white">
              {title}
            </p>
            {otherToken ? (
              <p className={`mt-0.5 text-xs ${TONE_TEXT[otherToken.tone]}`}>
                {otherToken.icon} {otherToken.label}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-white/40">in this challenge</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer: stake pill + standing + open affordance */}
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
          {formatCents(stakeCents)}/day
        </span>
        <div className="flex items-center gap-2">
          {standing ? (
            <span className={`text-xs font-medium ${STANDING_CLASSES[standing.tone]}`}>
              {standing.text}
            </span>
          ) : null}
          <ChevronRight className="h-3.5 w-3.5 text-white/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/70" />
        </div>
      </div>
    </Link>
  );
}
