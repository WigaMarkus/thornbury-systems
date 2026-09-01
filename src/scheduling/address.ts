// Addresses are typed in by whoever takes the call, so the same house reaches us
// spelled several ways: different case, a stray comma, a doubled space. The
// dispatcher compares addresses to decide whether it is already sending a van,
// and a plain string comparison treats those as different houses.
//
// This is deliberately conservative. It only removes differences that are not
// information: case, separator punctuation, and repeated whitespace. It does not
// expand abbreviations, guess at postcodes or match fuzzily. Two addresses that
// are wrongly treated as the same house mean a real visit is silently dropped,
// which is worse than the duplicate we are fixing, so the check errs towards
// letting a visit through.
export function normaliseAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
