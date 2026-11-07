import type { Comparison } from "./api.js";
import { percentOfOneIn } from "./rate.js";

/**
 * How this trip compares with others of its length.
 *
 * "Goes wrong 1 trip in 214" is an analyst's number until there is something to
 * measure it against — Q-C's complaint about our whole unit vocabulary. The
 * ranking makes it a judgement, and the reference figure beside it keeps the
 * judgement checkable rather than asking the rider to take our word.
 *
 * Which side the comparison takes is decided on the server, where the bar lives
 * next to the data it is applied to. This file only chooses the words.
 *
 * The words are fifths, not percentages. A reference of a few hundred sampled
 * trips does not support "safer than 87% of trips this long", and a number that
 * precise invites a trust it has not earned (PR-08).
 */
const WORDS = {
  "safer-4in5": "Safer than 4 in 5 trips this long",
  "safer-most": "Safer than most trips this long",
  typical: "About typical for a trip this long",
  "riskier-most": "Riskier than most trips this long",
  "riskier-4in5": "Riskier than 4 in 5 trips this long",
} as const;

/* Colour means risk on this screen (D-23). "About typical" earns none — an
   ordinary trip is not news, and colouring it would spend the reader's
   attention on the one verdict that asks nothing of them. */
const TONE = {
  "safer-4in5": "good",
  "safer-most": "good",
  typical: "even",
  "riskier-most": "bad",
  "riskier-4in5": "bad",
} as const;

export function Benchmark({ comparison }: { comparison: Comparison | null }): JSX.Element | null {
  if (comparison === null) return null;
  return (
    <p className={`benchmark benchmark-${TONE[comparison.verdict]}`}>
      <strong>{WORDS[comparison.verdict]}</strong>
      {comparison.typicalOneInTrips !== null && (
        <>
          {" "}— typically {percentOfOneIn(comparison.typicalOneInTrips)}{" "}
          <span className="rate-side">1 in {comparison.typicalOneInTrips}</span>.
        </>
      )}
    </p>
  );
}
