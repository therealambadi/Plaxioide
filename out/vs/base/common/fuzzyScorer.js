import { CharCode } from "./charCode.js";
import { compareAnything } from "./comparers.js";
import { createMatches as createFuzzyMatches, fuzzyScore, isUpper, matchesPrefix } from "./filters.js";
import { hash } from "./hash.js";
import { sep } from "./path.js";
import { isLinux, isWindows } from "./platform.js";
import { equalsIgnoreCase, stripWildcards } from "./strings.js";
const NO_MATCH = 0;
const NO_SCORE = [NO_MATCH, []];
function scoreFuzzy(target, query, queryLower, allowNonContiguousMatches) {
  if (!target || !query) {
    return NO_SCORE;
  }
  const targetLength = target.length;
  const queryLength = query.length;
  if (targetLength < queryLength) {
    return NO_SCORE;
  }
  const targetLower = target.toLowerCase();
  const res = doScoreFuzzy(query, queryLower, queryLength, target, targetLower, targetLength, allowNonContiguousMatches);
  return res;
}
function doScoreFuzzy(query, queryLower, queryLength, target, targetLower, targetLength, allowNonContiguousMatches) {
  const scores = [];
  const matches = [];
  for (let queryIndex2 = 0; queryIndex2 < queryLength; queryIndex2++) {
    const queryIndexOffset = queryIndex2 * targetLength;
    const queryIndexPreviousOffset = queryIndexOffset - targetLength;
    const queryIndexGtNull = queryIndex2 > 0;
    const queryCharAtIndex = query[queryIndex2];
    const queryLowerCharAtIndex = queryLower[queryIndex2];
    for (let targetIndex2 = 0; targetIndex2 < targetLength; targetIndex2++) {
      const targetIndexGtNull = targetIndex2 > 0;
      const currentIndex = queryIndexOffset + targetIndex2;
      const leftIndex = currentIndex - 1;
      const diagIndex = queryIndexPreviousOffset + targetIndex2 - 1;
      const leftScore = targetIndexGtNull ? scores[leftIndex] : 0;
      const diagScore = queryIndexGtNull && targetIndexGtNull ? scores[diagIndex] : 0;
      const matchesSequenceLength = queryIndexGtNull && targetIndexGtNull ? matches[diagIndex] : 0;
      let score;
      if (!diagScore && queryIndexGtNull) {
        score = 0;
      } else {
        score = computeCharScore(queryCharAtIndex, queryLowerCharAtIndex, target, targetLower, targetIndex2, matchesSequenceLength);
      }
      const isValidScore = score && diagScore + score >= leftScore;
      if (isValidScore && // We don't need to check if it's contiguous if we allow non-contiguous matches
      (allowNonContiguousMatches || // We must be looking for a contiguous match.
      // Looking at an index higher than 0 in the query means we must have already
      // found out this is contiguous otherwise there wouldn't have been a score
      queryIndexGtNull || // lastly check if the query is completely contiguous at this index in the target
      targetLower.startsWith(queryLower, targetIndex2))) {
        matches[currentIndex] = matchesSequenceLength + 1;
        scores[currentIndex] = diagScore + score;
      } else {
        matches[currentIndex] = NO_MATCH;
        scores[currentIndex] = leftScore;
      }
    }
  }
  const positions = [];
  let queryIndex = queryLength - 1;
  let targetIndex = targetLength - 1;
  while (queryIndex >= 0 && targetIndex >= 0) {
    const currentIndex = queryIndex * targetLength + targetIndex;
    const match = matches[currentIndex];
    if (match === NO_MATCH) {
      targetIndex--;
    } else {
      positions.push(targetIndex);
      queryIndex--;
      targetIndex--;
    }
  }
  return [scores[queryLength * targetLength - 1], positions.reverse()];
}
function computeCharScore(queryCharAtIndex, queryLowerCharAtIndex, target, targetLower, targetIndex, matchesSequenceLength) {
  let score = 0;
  if (!considerAsEqual(queryLowerCharAtIndex, targetLower[targetIndex])) {
    return score;
  }
  score += 1;
  if (matchesSequenceLength > 0) {
    score += matchesSequenceLength * 5;
  }
  if (queryCharAtIndex === target[targetIndex]) {
    score += 1;
  }
  if (targetIndex === 0) {
    score += 8;
  } else {
    const separatorBonus = scoreSeparatorAtPos(target.charCodeAt(targetIndex - 1));
    if (separatorBonus) {
      score += separatorBonus;
    } else if (isUpper(target.charCodeAt(targetIndex)) && matchesSequenceLength === 0) {
      score += 2;
    }
  }
  return score;
}
function considerAsEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === "/" || a === "\\") {
    return b === "/" || b === "\\";
  }
  return false;
}
function scoreSeparatorAtPos(charCode) {
  switch (charCode) {
    case CharCode.Slash:
    case CharCode.Backslash:
      return 5;
    // prefer path separators...
    case CharCode.Underline:
    case CharCode.Dash:
    case CharCode.Period:
    case CharCode.Space:
    case CharCode.SingleQuote:
    case CharCode.DoubleQuote:
    case CharCode.Colon:
      return 4;
    // ...over other separators
    default:
      return 0;
  }
}
const NO_SCORE2 = [void 0, []];
function scoreFuzzy2(target, query, patternStart = 0, wordStart = 0) {
  const preparedQuery = query;
  if (preparedQuery.values && preparedQuery.values.length > 1) {
    return doScoreFuzzy2Multiple(target, preparedQuery.values, patternStart, wordStart);
  }
  return doScoreFuzzy2Single(target, query, patternStart, wordStart);
}
function doScoreFuzzy2Multiple(target, query, patternStart, wordStart) {
  let totalScore = 0;
  const totalMatches = [];
  for (const queryPiece of query) {
    const [score, matches] = doScoreFuzzy2Single(target, queryPiece, patternStart, wordStart);
    if (typeof score !== "number") {
      return NO_SCORE2;
    }
    totalScore += score;
    totalMatches.push(...matches);
  }
  return [totalScore, normalizeMatches(totalMatches)];
}
function doScoreFuzzy2Single(target, query, patternStart, wordStart) {
  const score = fuzzyScore(query.original, query.originalLowercase, patternStart, target, target.toLowerCase(), wordStart, { firstMatchCanBeWeak: true, boostFullMatch: true });
  if (!score) {
    return NO_SCORE2;
  }
  return [score[0], createFuzzyMatches(score)];
}
const NO_ITEM_SCORE = Object.freeze({ score: 0 });
const PATH_IDENTITY_SCORE = 1 << 18;
const LABEL_PREFIX_SCORE_THRESHOLD = 1 << 17;
const LABEL_SCORE_THRESHOLD = 1 << 16;
function getCacheHash(label, description, allowNonContiguousMatches, query) {
  const values = query.values ? query.values : [query];
  const cacheHash = hash({
    [query.normalized]: {
      values: values.map((v) => ({ value: v.normalized, expectContiguousMatch: v.expectContiguousMatch })),
      label,
      description,
      allowNonContiguousMatches
    }
  });
  return cacheHash;
}
function scoreItemFuzzy(item, query, allowNonContiguousMatches, accessor, cache) {
  if (!item || !query.normalized) {
    return NO_ITEM_SCORE;
  }
  const label = accessor.getItemLabel(item);
  if (!label) {
    return NO_ITEM_SCORE;
  }
  const description = accessor.getItemDescription(item);
  const cacheHash = getCacheHash(label, description, allowNonContiguousMatches, query);
  const cached = cache[cacheHash];
  if (cached) {
    return cached;
  }
  const itemScore = doScoreItemFuzzy(label, description, accessor.getItemPath(item), query, allowNonContiguousMatches);
  cache[cacheHash] = itemScore;
  return itemScore;
}
function doScoreItemFuzzy(label, description, path, query, allowNonContiguousMatches) {
  const preferLabelMatches = !path || !query.containsPathSeparator;
  if (path && (isLinux ? query.pathNormalized === path : equalsIgnoreCase(query.pathNormalized, path))) {
    return { score: PATH_IDENTITY_SCORE, labelMatch: [{ start: 0, end: label.length }], descriptionMatch: description ? [{ start: 0, end: description.length }] : void 0 };
  }
  if (query.values && query.values.length > 1) {
    return doScoreItemFuzzyMultiple(label, description, path, query.values, preferLabelMatches, allowNonContiguousMatches);
  }
  return doScoreItemFuzzySingle(label, description, path, query, preferLabelMatches, allowNonContiguousMatches);
}
function doScoreItemFuzzyMultiple(label, description, path, query, preferLabelMatches, allowNonContiguousMatches) {
  let totalScore = 0;
  const totalLabelMatches = [];
  const totalDescriptionMatches = [];
  for (const queryPiece of query) {
    const { score, labelMatch, descriptionMatch } = doScoreItemFuzzySingle(label, description, path, queryPiece, preferLabelMatches, allowNonContiguousMatches);
    if (score === NO_MATCH) {
      return NO_ITEM_SCORE;
    }
    totalScore += score;
    if (labelMatch) {
      totalLabelMatches.push(...labelMatch);
    }
    if (descriptionMatch) {
      totalDescriptionMatches.push(...descriptionMatch);
    }
  }
  return {
    score: totalScore,
    labelMatch: normalizeMatches(totalLabelMatches),
    descriptionMatch: normalizeMatches(totalDescriptionMatches)
  };
}
function doScoreItemFuzzySingle(label, description, path, query, preferLabelMatches, allowNonContiguousMatches) {
  if (preferLabelMatches || !description) {
    const [labelScore, labelPositions] = scoreFuzzy(
      label,
      query.normalized,
      query.normalizedLowercase,
      allowNonContiguousMatches && !query.expectContiguousMatch
    );
    if (labelScore) {
      const labelPrefixMatch = matchesPrefix(query.normalized, label);
      let baseScore;
      if (labelPrefixMatch) {
        baseScore = LABEL_PREFIX_SCORE_THRESHOLD;
        const prefixLengthBoost = Math.round(query.normalized.length / label.length * 100);
        baseScore += prefixLengthBoost;
      } else {
        baseScore = LABEL_SCORE_THRESHOLD;
      }
      return { score: baseScore + labelScore, labelMatch: labelPrefixMatch || createMatches(labelPositions) };
    }
  }
  if (description) {
    let descriptionPrefix = description;
    if (!!path) {
      descriptionPrefix = `${description}${sep}`;
    }
    const descriptionPrefixLength = descriptionPrefix.length;
    const descriptionAndLabel = `${descriptionPrefix}${label}`;
    const [labelDescriptionScore, labelDescriptionPositions] = scoreFuzzy(
      descriptionAndLabel,
      query.normalized,
      query.normalizedLowercase,
      allowNonContiguousMatches && !query.expectContiguousMatch
    );
    if (labelDescriptionScore) {
      const labelDescriptionMatches = createMatches(labelDescriptionPositions);
      const labelMatch = [];
      const descriptionMatch = [];
      labelDescriptionMatches.forEach((h) => {
        if (h.start < descriptionPrefixLength && h.end > descriptionPrefixLength) {
          labelMatch.push({ start: 0, end: h.end - descriptionPrefixLength });
          descriptionMatch.push({ start: h.start, end: descriptionPrefixLength });
        } else if (h.start >= descriptionPrefixLength) {
          labelMatch.push({ start: h.start - descriptionPrefixLength, end: h.end - descriptionPrefixLength });
        } else {
          descriptionMatch.push(h);
        }
      });
      return { score: labelDescriptionScore, labelMatch, descriptionMatch };
    }
  }
  return NO_ITEM_SCORE;
}
function createMatches(offsets) {
  const ret = [];
  if (!offsets) {
    return ret;
  }
  let last;
  for (const pos of offsets) {
    if (last && last.end === pos) {
      last.end += 1;
    } else {
      last = { start: pos, end: pos + 1 };
      ret.push(last);
    }
  }
  return ret;
}
function normalizeMatches(matches) {
  const sortedMatches = matches.sort((matchA, matchB) => {
    return matchA.start - matchB.start;
  });
  const normalizedMatches = [];
  let currentMatch = void 0;
  for (const match of sortedMatches) {
    if (!currentMatch || !matchOverlaps(currentMatch, match)) {
      currentMatch = match;
      normalizedMatches.push(match);
    } else {
      currentMatch.start = Math.min(currentMatch.start, match.start);
      currentMatch.end = Math.max(currentMatch.end, match.end);
    }
  }
  return normalizedMatches;
}
function matchOverlaps(matchA, matchB) {
  if (matchA.end < matchB.start) {
    return false;
  }
  if (matchB.end < matchA.start) {
    return false;
  }
  return true;
}
function compareItemsByFuzzyScore(itemA, itemB, query, allowNonContiguousMatches, accessor, cache) {
  const itemScoreA = scoreItemFuzzy(itemA, query, allowNonContiguousMatches, accessor, cache);
  const itemScoreB = scoreItemFuzzy(itemB, query, allowNonContiguousMatches, accessor, cache);
  const scoreA = itemScoreA.score;
  const scoreB = itemScoreB.score;
  if (scoreA === PATH_IDENTITY_SCORE || scoreB === PATH_IDENTITY_SCORE) {
    if (scoreA !== scoreB) {
      return scoreA === PATH_IDENTITY_SCORE ? -1 : 1;
    }
  }
  if (scoreA > LABEL_SCORE_THRESHOLD || scoreB > LABEL_SCORE_THRESHOLD) {
    if (scoreA !== scoreB) {
      return scoreA > scoreB ? -1 : 1;
    }
    if (scoreA < LABEL_PREFIX_SCORE_THRESHOLD && scoreB < LABEL_PREFIX_SCORE_THRESHOLD) {
      const comparedByMatchLength = compareByMatchLength(itemScoreA.labelMatch, itemScoreB.labelMatch);
      if (comparedByMatchLength !== 0) {
        return comparedByMatchLength;
      }
    }
    const labelA = accessor.getItemLabel(itemA) || "";
    const labelB = accessor.getItemLabel(itemB) || "";
    if (labelA.length !== labelB.length) {
      return labelA.length - labelB.length;
    }
  }
  if (scoreA !== scoreB) {
    return scoreA > scoreB ? -1 : 1;
  }
  const itemAHasLabelMatches = Array.isArray(itemScoreA.labelMatch) && itemScoreA.labelMatch.length > 0;
  const itemBHasLabelMatches = Array.isArray(itemScoreB.labelMatch) && itemScoreB.labelMatch.length > 0;
  if (itemAHasLabelMatches && !itemBHasLabelMatches) {
    return -1;
  } else if (itemBHasLabelMatches && !itemAHasLabelMatches) {
    return 1;
  }
  const itemAMatchDistance = computeLabelAndDescriptionMatchDistance(itemA, itemScoreA, accessor);
  const itemBMatchDistance = computeLabelAndDescriptionMatchDistance(itemB, itemScoreB, accessor);
  if (itemAMatchDistance && itemBMatchDistance && itemAMatchDistance !== itemBMatchDistance) {
    return itemBMatchDistance > itemAMatchDistance ? -1 : 1;
  }
  return fallbackCompare(itemA, itemB, query, accessor);
}
function computeLabelAndDescriptionMatchDistance(item, score, accessor) {
  let matchStart = -1;
  let matchEnd = -1;
  if (score.descriptionMatch && score.descriptionMatch.length) {
    matchStart = score.descriptionMatch[0].start;
  } else if (score.labelMatch && score.labelMatch.length) {
    matchStart = score.labelMatch[0].start;
  }
  if (score.labelMatch && score.labelMatch.length) {
    matchEnd = score.labelMatch[score.labelMatch.length - 1].end;
    if (score.descriptionMatch && score.descriptionMatch.length) {
      const itemDescription = accessor.getItemDescription(item);
      if (itemDescription) {
        matchEnd += itemDescription.length;
      }
    }
  } else if (score.descriptionMatch && score.descriptionMatch.length) {
    matchEnd = score.descriptionMatch[score.descriptionMatch.length - 1].end;
  }
  return matchEnd - matchStart;
}
function compareByMatchLength(matchesA, matchesB) {
  if (!matchesA && !matchesB || (!matchesA || !matchesA.length) && (!matchesB || !matchesB.length)) {
    return 0;
  }
  if (!matchesB || !matchesB.length) {
    return -1;
  }
  if (!matchesA || !matchesA.length) {
    return 1;
  }
  const matchStartA = matchesA[0].start;
  const matchEndA = matchesA[matchesA.length - 1].end;
  const matchLengthA = matchEndA - matchStartA;
  const matchStartB = matchesB[0].start;
  const matchEndB = matchesB[matchesB.length - 1].end;
  const matchLengthB = matchEndB - matchStartB;
  return matchLengthA === matchLengthB ? 0 : matchLengthB < matchLengthA ? 1 : -1;
}
function fallbackCompare(itemA, itemB, query, accessor) {
  const labelA = accessor.getItemLabel(itemA) || "";
  const labelB = accessor.getItemLabel(itemB) || "";
  const descriptionA = accessor.getItemDescription(itemA);
  const descriptionB = accessor.getItemDescription(itemB);
  const labelDescriptionALength = labelA.length + (descriptionA ? descriptionA.length : 0);
  const labelDescriptionBLength = labelB.length + (descriptionB ? descriptionB.length : 0);
  if (labelDescriptionALength !== labelDescriptionBLength) {
    return labelDescriptionALength - labelDescriptionBLength;
  }
  const pathA = accessor.getItemPath(itemA);
  const pathB = accessor.getItemPath(itemB);
  if (pathA && pathB && pathA.length !== pathB.length) {
    return pathA.length - pathB.length;
  }
  if (labelA !== labelB) {
    return compareAnything(labelA, labelB, query.normalized);
  }
  if (descriptionA && descriptionB && descriptionA !== descriptionB) {
    return compareAnything(descriptionA, descriptionB, query.normalized);
  }
  if (pathA && pathB && pathA !== pathB) {
    return compareAnything(pathA, pathB, query.normalized);
  }
  return 0;
}
function queryExpectsExactMatch(query) {
  return query.startsWith('"') && query.endsWith('"');
}
const MULTIPLE_QUERY_VALUES_SEPARATOR = " ";
function prepareQuery(original) {
  if (typeof original !== "string") {
    original = "";
  }
  const originalLowercase = original.toLowerCase();
  const { pathNormalized, normalized, normalizedLowercase } = normalizeQuery(original);
  const containsPathSeparator = pathNormalized.indexOf(sep) >= 0;
  const expectExactMatch = queryExpectsExactMatch(original);
  let values = void 0;
  const originalSplit = original.split(MULTIPLE_QUERY_VALUES_SEPARATOR);
  if (originalSplit.length > 1) {
    for (const originalPiece of originalSplit) {
      const expectExactMatchPiece = queryExpectsExactMatch(originalPiece);
      const {
        pathNormalized: pathNormalizedPiece,
        normalized: normalizedPiece,
        normalizedLowercase: normalizedLowercasePiece
      } = normalizeQuery(originalPiece);
      if (normalizedPiece) {
        if (!values) {
          values = [];
        }
        values.push({
          original: originalPiece,
          originalLowercase: originalPiece.toLowerCase(),
          pathNormalized: pathNormalizedPiece,
          normalized: normalizedPiece,
          normalizedLowercase: normalizedLowercasePiece,
          expectContiguousMatch: expectExactMatchPiece
        });
      }
    }
  }
  return { original, originalLowercase, pathNormalized, normalized, normalizedLowercase, values, containsPathSeparator, expectContiguousMatch: expectExactMatch };
}
function normalizeQuery(original) {
  let pathNormalized;
  if (isWindows) {
    pathNormalized = original.replace(/\//g, sep);
  } else {
    pathNormalized = original.replace(/\\/g, sep);
  }
  const normalized = stripWildcards(pathNormalized).replace(/\s|"/g, "");
  return {
    pathNormalized,
    normalized,
    normalizedLowercase: normalized.toLowerCase()
  };
}
function pieceToQuery(arg1) {
  if (Array.isArray(arg1)) {
    return prepareQuery(arg1.map((piece) => piece.original).join(MULTIPLE_QUERY_VALUES_SEPARATOR));
  }
  return prepareQuery(arg1.original);
}
export {
  compareItemsByFuzzyScore,
  pieceToQuery,
  prepareQuery,
  scoreFuzzy,
  scoreFuzzy2,
  scoreItemFuzzy
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9mdXp6eVNjb3Jlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi9jaGFyQ29kZS5qcyc7XG5pbXBvcnQgeyBjb21wYXJlQW55dGhpbmcgfSBmcm9tICcuL2NvbXBhcmVycy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNYXRjaGVzIGFzIGNyZWF0ZUZ1enp5TWF0Y2hlcywgZnV6enlTY29yZSwgSU1hdGNoLCBpc1VwcGVyLCBtYXRjaGVzUHJlZml4IH0gZnJvbSAnLi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuL2hhc2guanMnO1xuaW1wb3J0IHsgc2VwIH0gZnJvbSAnLi9wYXRoLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzV2luZG93cyB9IGZyb20gJy4vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZXF1YWxzSWdub3JlQ2FzZSwgc3RyaXBXaWxkY2FyZHMgfSBmcm9tICcuL3N0cmluZ3MuanMnO1xuXG4vLyNyZWdpb24gRnV6enkgc2NvcmVyXG5cbmV4cG9ydCB0eXBlIEZ1enp5U2NvcmUgPSBbbnVtYmVyIC8qIHNjb3JlICovLCBudW1iZXJbXSAvKiBtYXRjaCBwb3NpdGlvbnMgKi9dO1xuZXhwb3J0IHR5cGUgRnV6enlTY29yZXJDYWNoZSA9IHsgW2tleTogc3RyaW5nXTogSUl0ZW1TY29yZSB9O1xuXG5jb25zdCBOT19NQVRDSCA9IDA7XG5jb25zdCBOT19TQ09SRTogRnV6enlTY29yZSA9IFtOT19NQVRDSCwgW11dO1xuXG4vLyBjb25zdCBERUJVRyA9IHRydWU7XG4vLyBjb25zdCBERUJVR19NQVRSSVggPSBmYWxzZTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNjb3JlRnV6enkodGFyZ2V0OiBzdHJpbmcsIHF1ZXJ5OiBzdHJpbmcsIHF1ZXJ5TG93ZXI6IHN0cmluZywgYWxsb3dOb25Db250aWd1b3VzTWF0Y2hlczogYm9vbGVhbik6IEZ1enp5U2NvcmUge1xuXHRpZiAoIXRhcmdldCB8fCAhcXVlcnkpIHtcblx0XHRyZXR1cm4gTk9fU0NPUkU7IC8vIHJldHVybiBlYXJseSBpZiB0YXJnZXQgb3IgcXVlcnkgYXJlIHVuZGVmaW5lZFxuXHR9XG5cblx0Y29uc3QgdGFyZ2V0TGVuZ3RoID0gdGFyZ2V0Lmxlbmd0aDtcblx0Y29uc3QgcXVlcnlMZW5ndGggPSBxdWVyeS5sZW5ndGg7XG5cblx0aWYgKHRhcmdldExlbmd0aCA8IHF1ZXJ5TGVuZ3RoKSB7XG5cdFx0cmV0dXJuIE5PX1NDT1JFOyAvLyBpbXBvc3NpYmxlIGZvciBxdWVyeSB0byBiZSBjb250YWluZWQgaW4gdGFyZ2V0XG5cdH1cblxuXHQvLyBpZiAoREVCVUcpIHtcblx0Ly8gXHRjb25zb2xlLmdyb3VwKGBUYXJnZXQ6ICR7dGFyZ2V0fSwgUXVlcnk6ICR7cXVlcnl9YCk7XG5cdC8vIH1cblxuXHRjb25zdCB0YXJnZXRMb3dlciA9IHRhcmdldC50b0xvd2VyQ2FzZSgpO1xuXHRjb25zdCByZXMgPSBkb1Njb3JlRnV6enkocXVlcnksIHF1ZXJ5TG93ZXIsIHF1ZXJ5TGVuZ3RoLCB0YXJnZXQsIHRhcmdldExvd2VyLCB0YXJnZXRMZW5ndGgsIGFsbG93Tm9uQ29udGlndW91c01hdGNoZXMpO1xuXG5cdC8vIGlmIChERUJVRykge1xuXHQvLyBcdGNvbnNvbGUubG9nKGAlY0ZpbmFsIFNjb3JlOiAke3Jlc1swXX1gLCAnZm9udC13ZWlnaHQ6IGJvbGQnKTtcblx0Ly8gXHRjb25zb2xlLmdyb3VwRW5kKCk7XG5cdC8vIH1cblxuXHRyZXR1cm4gcmVzO1xufVxuXG5mdW5jdGlvbiBkb1Njb3JlRnV6enkocXVlcnk6IHN0cmluZywgcXVlcnlMb3dlcjogc3RyaW5nLCBxdWVyeUxlbmd0aDogbnVtYmVyLCB0YXJnZXQ6IHN0cmluZywgdGFyZ2V0TG93ZXI6IHN0cmluZywgdGFyZ2V0TGVuZ3RoOiBudW1iZXIsIGFsbG93Tm9uQ29udGlndW91c01hdGNoZXM6IGJvb2xlYW4pOiBGdXp6eVNjb3JlIHtcblx0Y29uc3Qgc2NvcmVzOiBudW1iZXJbXSA9IFtdO1xuXHRjb25zdCBtYXRjaGVzOiBudW1iZXJbXSA9IFtdO1xuXG5cdC8vXG5cdC8vIEJ1aWxkIFNjb3JlciBNYXRyaXg6XG5cdC8vXG5cdC8vIFRoZSBtYXRyaXggaXMgY29tcG9zZWQgb2YgcXVlcnkgcSBhbmQgdGFyZ2V0IHQuIEZvciBlYWNoIGluZGV4IHdlIHNjb3JlXG5cdC8vIHFbaV0gd2l0aCB0W2ldIGFuZCBjb21wYXJlIHRoYXQgd2l0aCB0aGUgcHJldmlvdXMgc2NvcmUuIElmIHRoZSBzY29yZSBpc1xuXHQvLyBlcXVhbCBvciBsYXJnZXIsIHdlIGtlZXAgdGhlIG1hdGNoLiBJbiBhZGRpdGlvbiB0byB0aGUgc2NvcmUsIHdlIGFsc28ga2VlcFxuXHQvLyB0aGUgbGVuZ3RoIG9mIHRoZSBjb25zZWN1dGl2ZSBtYXRjaGVzIHRvIHVzZSBhcyBib29zdCBmb3IgdGhlIHNjb3JlLlxuXHQvL1xuXHQvLyAgICAgIHQgICBhICAgciAgIGcgICBlICAgdFxuXHQvLyAgcVxuXHQvLyAgdVxuXHQvLyAgZVxuXHQvLyAgclxuXHQvLyAgeVxuXHQvL1xuXHRmb3IgKGxldCBxdWVyeUluZGV4ID0gMDsgcXVlcnlJbmRleCA8IHF1ZXJ5TGVuZ3RoOyBxdWVyeUluZGV4KyspIHtcblx0XHRjb25zdCBxdWVyeUluZGV4T2Zmc2V0ID0gcXVlcnlJbmRleCAqIHRhcmdldExlbmd0aDtcblx0XHRjb25zdCBxdWVyeUluZGV4UHJldmlvdXNPZmZzZXQgPSBxdWVyeUluZGV4T2Zmc2V0IC0gdGFyZ2V0TGVuZ3RoO1xuXG5cdFx0Y29uc3QgcXVlcnlJbmRleEd0TnVsbCA9IHF1ZXJ5SW5kZXggPiAwO1xuXG5cdFx0Y29uc3QgcXVlcnlDaGFyQXRJbmRleCA9IHF1ZXJ5W3F1ZXJ5SW5kZXhdO1xuXHRcdGNvbnN0IHF1ZXJ5TG93ZXJDaGFyQXRJbmRleCA9IHF1ZXJ5TG93ZXJbcXVlcnlJbmRleF07XG5cblx0XHRmb3IgKGxldCB0YXJnZXRJbmRleCA9IDA7IHRhcmdldEluZGV4IDwgdGFyZ2V0TGVuZ3RoOyB0YXJnZXRJbmRleCsrKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRJbmRleEd0TnVsbCA9IHRhcmdldEluZGV4ID4gMDtcblxuXHRcdFx0Y29uc3QgY3VycmVudEluZGV4ID0gcXVlcnlJbmRleE9mZnNldCArIHRhcmdldEluZGV4O1xuXHRcdFx0Y29uc3QgbGVmdEluZGV4ID0gY3VycmVudEluZGV4IC0gMTtcblx0XHRcdGNvbnN0IGRpYWdJbmRleCA9IHF1ZXJ5SW5kZXhQcmV2aW91c09mZnNldCArIHRhcmdldEluZGV4IC0gMTtcblxuXHRcdFx0Y29uc3QgbGVmdFNjb3JlID0gdGFyZ2V0SW5kZXhHdE51bGwgPyBzY29yZXNbbGVmdEluZGV4XSA6IDA7XG5cdFx0XHRjb25zdCBkaWFnU2NvcmUgPSBxdWVyeUluZGV4R3ROdWxsICYmIHRhcmdldEluZGV4R3ROdWxsID8gc2NvcmVzW2RpYWdJbmRleF0gOiAwO1xuXG5cdFx0XHRjb25zdCBtYXRjaGVzU2VxdWVuY2VMZW5ndGggPSBxdWVyeUluZGV4R3ROdWxsICYmIHRhcmdldEluZGV4R3ROdWxsID8gbWF0Y2hlc1tkaWFnSW5kZXhdIDogMDtcblxuXHRcdFx0Ly8gSWYgd2UgYXJlIG5vdCBtYXRjaGluZyBvbiB0aGUgZmlyc3QgcXVlcnkgY2hhcmFjdGVyIGFueSBtb3JlLCB3ZSBvbmx5IHByb2R1Y2UgYVxuXHRcdFx0Ly8gc2NvcmUgaWYgd2UgaGFkIGEgc2NvcmUgcHJldmlvdXNseSBmb3IgdGhlIGxhc3QgcXVlcnkgaW5kZXggKGJ5IGxvb2tpbmcgYXQgdGhlIGRpYWdTY29yZSkuXG5cdFx0XHQvLyBUaGlzIG1ha2VzIHN1cmUgdGhhdCB0aGUgcXVlcnkgYWx3YXlzIG1hdGNoZXMgaW4gc2VxdWVuY2Ugb24gdGhlIHRhcmdldC4gRm9yIGV4YW1wbGVcblx0XHRcdC8vIGdpdmVuIGEgdGFyZ2V0IG9mIFwiZWRlXCIgYW5kIGEgcXVlcnkgb2YgXCJkZVwiLCB3ZSB3b3VsZCBvdGhlcndpc2UgcHJvZHVjZSBhIHdyb25nIGhpZ2ggc2NvcmVcblx0XHRcdC8vIGZvciBxdWVyeVsxXSAoXCJlXCIpIG1hdGNoaW5nIG9uIHRhcmdldFswXSAoXCJlXCIpIGJlY2F1c2Ugb2YgdGhlIFwiYmVnaW5uaW5nIG9mIHdvcmRcIiBib29zdC5cblx0XHRcdGxldCBzY29yZTogbnVtYmVyO1xuXHRcdFx0aWYgKCFkaWFnU2NvcmUgJiYgcXVlcnlJbmRleEd0TnVsbCkge1xuXHRcdFx0XHRzY29yZSA9IDA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzY29yZSA9IGNvbXB1dGVDaGFyU2NvcmUocXVlcnlDaGFyQXRJbmRleCwgcXVlcnlMb3dlckNoYXJBdEluZGV4LCB0YXJnZXQsIHRhcmdldExvd2VyLCB0YXJnZXRJbmRleCwgbWF0Y2hlc1NlcXVlbmNlTGVuZ3RoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gV2UgaGF2ZSBhIHNjb3JlIGFuZCBpdHMgZXF1YWwgb3IgbGFyZ2VyIHRoYW4gdGhlIGxlZnQgc2NvcmVcblx0XHRcdC8vIE1hdGNoOiBzZXF1ZW5jZSBjb250aW51ZXMgZ3Jvd2luZyBmcm9tIHByZXZpb3VzIGRpYWcgdmFsdWVcblx0XHRcdC8vIFNjb3JlOiBpbmNyZWFzZXMgYnkgZGlhZyBzY29yZSB2YWx1ZVxuXHRcdFx0Y29uc3QgaXNWYWxpZFNjb3JlID0gc2NvcmUgJiYgZGlhZ1Njb3JlICsgc2NvcmUgPj0gbGVmdFNjb3JlO1xuXHRcdFx0aWYgKGlzVmFsaWRTY29yZSAmJiAoXG5cdFx0XHRcdC8vIFdlIGRvbid0IG5lZWQgdG8gY2hlY2sgaWYgaXQncyBjb250aWd1b3VzIGlmIHdlIGFsbG93IG5vbi1jb250aWd1b3VzIG1hdGNoZXNcblx0XHRcdFx0YWxsb3dOb25Db250aWd1b3VzTWF0Y2hlcyB8fFxuXHRcdFx0XHQvLyBXZSBtdXN0IGJlIGxvb2tpbmcgZm9yIGEgY29udGlndW91cyBtYXRjaC5cblx0XHRcdFx0Ly8gTG9va2luZyBhdCBhbiBpbmRleCBoaWdoZXIgdGhhbiAwIGluIHRoZSBxdWVyeSBtZWFucyB3ZSBtdXN0IGhhdmUgYWxyZWFkeVxuXHRcdFx0XHQvLyBmb3VuZCBvdXQgdGhpcyBpcyBjb250aWd1b3VzIG90aGVyd2lzZSB0aGVyZSB3b3VsZG4ndCBoYXZlIGJlZW4gYSBzY29yZVxuXHRcdFx0XHRxdWVyeUluZGV4R3ROdWxsIHx8XG5cdFx0XHRcdC8vIGxhc3RseSBjaGVjayBpZiB0aGUgcXVlcnkgaXMgY29tcGxldGVseSBjb250aWd1b3VzIGF0IHRoaXMgaW5kZXggaW4gdGhlIHRhcmdldFxuXHRcdFx0XHR0YXJnZXRMb3dlci5zdGFydHNXaXRoKHF1ZXJ5TG93ZXIsIHRhcmdldEluZGV4KVxuXHRcdFx0KSkge1xuXHRcdFx0XHRtYXRjaGVzW2N1cnJlbnRJbmRleF0gPSBtYXRjaGVzU2VxdWVuY2VMZW5ndGggKyAxO1xuXHRcdFx0XHRzY29yZXNbY3VycmVudEluZGV4XSA9IGRpYWdTY29yZSArIHNjb3JlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBXZSBlaXRoZXIgaGF2ZSBubyBzY29yZSBvciB0aGUgc2NvcmUgaXMgbG93ZXIgdGhhbiB0aGUgbGVmdCBzY29yZVxuXHRcdFx0Ly8gTWF0Y2g6IHJlc2V0IHRvIDBcblx0XHRcdC8vIFNjb3JlOiBwaWNrIHVwIGZyb20gbGVmdCBoYW5kIHNpZGVcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRtYXRjaGVzW2N1cnJlbnRJbmRleF0gPSBOT19NQVRDSDtcblx0XHRcdFx0c2NvcmVzW2N1cnJlbnRJbmRleF0gPSBsZWZ0U2NvcmU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gUmVzdG9yZSBQb3NpdGlvbnMgKHN0YXJ0aW5nIGZyb20gYm90dG9tIHJpZ2h0IG9mIG1hdHJpeClcblx0Y29uc3QgcG9zaXRpb25zOiBudW1iZXJbXSA9IFtdO1xuXHRsZXQgcXVlcnlJbmRleCA9IHF1ZXJ5TGVuZ3RoIC0gMTtcblx0bGV0IHRhcmdldEluZGV4ID0gdGFyZ2V0TGVuZ3RoIC0gMTtcblx0d2hpbGUgKHF1ZXJ5SW5kZXggPj0gMCAmJiB0YXJnZXRJbmRleCA+PSAwKSB7XG5cdFx0Y29uc3QgY3VycmVudEluZGV4ID0gcXVlcnlJbmRleCAqIHRhcmdldExlbmd0aCArIHRhcmdldEluZGV4O1xuXHRcdGNvbnN0IG1hdGNoID0gbWF0Y2hlc1tjdXJyZW50SW5kZXhdO1xuXHRcdGlmIChtYXRjaCA9PT0gTk9fTUFUQ0gpIHtcblx0XHRcdHRhcmdldEluZGV4LS07IC8vIGdvIGxlZnRcblx0XHR9IGVsc2Uge1xuXHRcdFx0cG9zaXRpb25zLnB1c2godGFyZ2V0SW5kZXgpO1xuXG5cdFx0XHQvLyBnbyB1cCBhbmQgbGVmdFxuXHRcdFx0cXVlcnlJbmRleC0tO1xuXHRcdFx0dGFyZ2V0SW5kZXgtLTtcblx0XHR9XG5cdH1cblxuXHQvLyBQcmludCBtYXRyaXhcblx0Ly8gaWYgKERFQlVHX01BVFJJWCkge1xuXHQvLyBcdHByaW50TWF0cml4KHF1ZXJ5LCB0YXJnZXQsIG1hdGNoZXMsIHNjb3Jlcyk7XG5cdC8vIH1cblxuXHRyZXR1cm4gW3Njb3Jlc1txdWVyeUxlbmd0aCAqIHRhcmdldExlbmd0aCAtIDFdLCBwb3NpdGlvbnMucmV2ZXJzZSgpXTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZUNoYXJTY29yZShxdWVyeUNoYXJBdEluZGV4OiBzdHJpbmcsIHF1ZXJ5TG93ZXJDaGFyQXRJbmRleDogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgdGFyZ2V0TG93ZXI6IHN0cmluZywgdGFyZ2V0SW5kZXg6IG51bWJlciwgbWF0Y2hlc1NlcXVlbmNlTGVuZ3RoOiBudW1iZXIpOiBudW1iZXIge1xuXHRsZXQgc2NvcmUgPSAwO1xuXG5cdGlmICghY29uc2lkZXJBc0VxdWFsKHF1ZXJ5TG93ZXJDaGFyQXRJbmRleCwgdGFyZ2V0TG93ZXJbdGFyZ2V0SW5kZXhdKSkge1xuXHRcdHJldHVybiBzY29yZTsgLy8gbm8gbWF0Y2ggb2YgY2hhcmFjdGVyc1xuXHR9XG5cblx0Ly8gaWYgKERFQlVHKSB7XG5cdC8vIFx0Y29uc29sZS5ncm91cENvbGxhcHNlZChgJWNGb3VuZCBhIG1hdGNoIG9mIGNoYXI6ICR7cXVlcnlMb3dlckNoYXJBdEluZGV4fSBhdCBpbmRleCAke3RhcmdldEluZGV4fWAsICdmb250LXdlaWdodDogbm9ybWFsJyk7XG5cdC8vIH1cblxuXHQvLyBDaGFyYWN0ZXIgbWF0Y2ggYm9udXNcblx0c2NvcmUgKz0gMTtcblxuXHQvLyBpZiAoREVCVUcpIHtcblx0Ly8gXHRjb25zb2xlLmxvZyhgJWNDaGFyYWN0ZXIgbWF0Y2ggYm9udXM6ICsxYCwgJ2ZvbnQtd2VpZ2h0OiBub3JtYWwnKTtcblx0Ly8gfVxuXG5cdC8vIENvbnNlY3V0aXZlIG1hdGNoIGJvbnVzXG5cdGlmIChtYXRjaGVzU2VxdWVuY2VMZW5ndGggPiAwKSB7XG5cdFx0c2NvcmUgKz0gKG1hdGNoZXNTZXF1ZW5jZUxlbmd0aCAqIDUpO1xuXG5cdFx0Ly8gaWYgKERFQlVHKSB7XG5cdFx0Ly8gXHRjb25zb2xlLmxvZyhgQ29uc2VjdXRpdmUgbWF0Y2ggYm9udXM6ICske21hdGNoZXNTZXF1ZW5jZUxlbmd0aCAqIDV9YCk7XG5cdFx0Ly8gfVxuXHR9XG5cblx0Ly8gU2FtZSBjYXNlIGJvbnVzXG5cdGlmIChxdWVyeUNoYXJBdEluZGV4ID09PSB0YXJnZXRbdGFyZ2V0SW5kZXhdKSB7XG5cdFx0c2NvcmUgKz0gMTtcblxuXHRcdC8vIGlmIChERUJVRykge1xuXHRcdC8vIFx0Y29uc29sZS5sb2coJ1NhbWUgY2FzZSBib251czogKzEnKTtcblx0XHQvLyB9XG5cdH1cblxuXHQvLyBTdGFydCBvZiB3b3JkIGJvbnVzXG5cdGlmICh0YXJnZXRJbmRleCA9PT0gMCkge1xuXHRcdHNjb3JlICs9IDg7XG5cblx0XHQvLyBpZiAoREVCVUcpIHtcblx0XHQvLyBcdGNvbnNvbGUubG9nKCdTdGFydCBvZiB3b3JkIGJvbnVzOiArOCcpO1xuXHRcdC8vIH1cblx0fVxuXG5cdGVsc2Uge1xuXG5cdFx0Ly8gQWZ0ZXIgc2VwYXJhdG9yIGJvbnVzXG5cdFx0Y29uc3Qgc2VwYXJhdG9yQm9udXMgPSBzY29yZVNlcGFyYXRvckF0UG9zKHRhcmdldC5jaGFyQ29kZUF0KHRhcmdldEluZGV4IC0gMSkpO1xuXHRcdGlmIChzZXBhcmF0b3JCb251cykge1xuXHRcdFx0c2NvcmUgKz0gc2VwYXJhdG9yQm9udXM7XG5cblx0XHRcdC8vIGlmIChERUJVRykge1xuXHRcdFx0Ly8gXHRjb25zb2xlLmxvZyhgQWZ0ZXIgc2VwYXJhdG9yIGJvbnVzOiArJHtzZXBhcmF0b3JCb251c31gKTtcblx0XHRcdC8vIH1cblx0XHR9XG5cblx0XHQvLyBJbnNpZGUgd29yZCB1cHBlciBjYXNlIGJvbnVzIChjYW1lbCBjYXNlKS4gV2Ugb25seSBnaXZlIHRoaXMgYm9udXMgaWYgd2UncmUgbm90IGluIGEgY29udGlndW91cyBzZXF1ZW5jZS5cblx0XHQvLyBGb3IgZXhhbXBsZTpcblx0XHQvLyBOUEUgPT4gTnVsbFBvaW50ZXJFeGNlcHRpb24gPSBib29zdFxuXHRcdC8vIEhUVFAgPT4gSFRUUCA9IG5vdCBib29zdFxuXHRcdGVsc2UgaWYgKGlzVXBwZXIodGFyZ2V0LmNoYXJDb2RlQXQodGFyZ2V0SW5kZXgpKSAmJiBtYXRjaGVzU2VxdWVuY2VMZW5ndGggPT09IDApIHtcblx0XHRcdHNjb3JlICs9IDI7XG5cblx0XHRcdC8vIGlmIChERUJVRykge1xuXHRcdFx0Ly8gXHRjb25zb2xlLmxvZygnSW5zaWRlIHdvcmQgdXBwZXIgY2FzZSBib251czogKzInKTtcblx0XHRcdC8vIH1cblx0XHR9XG5cdH1cblxuXHQvLyBpZiAoREVCVUcpIHtcblx0Ly8gXHRjb25zb2xlLmxvZyhgVG90YWwgc2NvcmU6ICR7c2NvcmV9YCk7XG5cdC8vIFx0Y29uc29sZS5ncm91cEVuZCgpO1xuXHQvLyB9XG5cblx0cmV0dXJuIHNjb3JlO1xufVxuXG5mdW5jdGlvbiBjb25zaWRlckFzRXF1YWwoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBib29sZWFuIHtcblx0aWYgKGEgPT09IGIpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8vIFNwZWNpYWwgY2FzZSBwYXRoIHNlcGFyYXRvcnM6IGlnbm9yZSBwbGF0Zm9ybSBkaWZmZXJlbmNlc1xuXHRpZiAoYSA9PT0gJy8nIHx8IGEgPT09ICdcXFxcJykge1xuXHRcdHJldHVybiBiID09PSAnLycgfHwgYiA9PT0gJ1xcXFwnO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBzY29yZVNlcGFyYXRvckF0UG9zKGNoYXJDb2RlOiBudW1iZXIpOiBudW1iZXIge1xuXHRzd2l0Y2ggKGNoYXJDb2RlKSB7XG5cdFx0Y2FzZSBDaGFyQ29kZS5TbGFzaDpcblx0XHRjYXNlIENoYXJDb2RlLkJhY2tzbGFzaDpcblx0XHRcdHJldHVybiA1OyAvLyBwcmVmZXIgcGF0aCBzZXBhcmF0b3JzLi4uXG5cdFx0Y2FzZSBDaGFyQ29kZS5VbmRlcmxpbmU6XG5cdFx0Y2FzZSBDaGFyQ29kZS5EYXNoOlxuXHRcdGNhc2UgQ2hhckNvZGUuUGVyaW9kOlxuXHRcdGNhc2UgQ2hhckNvZGUuU3BhY2U6XG5cdFx0Y2FzZSBDaGFyQ29kZS5TaW5nbGVRdW90ZTpcblx0XHRjYXNlIENoYXJDb2RlLkRvdWJsZVF1b3RlOlxuXHRcdGNhc2UgQ2hhckNvZGUuQ29sb246XG5cdFx0XHRyZXR1cm4gNDsgLy8gLi4ub3ZlciBvdGhlciBzZXBhcmF0b3JzXG5cdFx0ZGVmYXVsdDpcblx0XHRcdHJldHVybiAwO1xuXHR9XG59XG5cbi8vIGZ1bmN0aW9uIHByaW50TWF0cml4KHF1ZXJ5OiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBtYXRjaGVzOiBudW1iZXJbXSwgc2NvcmVzOiBudW1iZXJbXSk6IHZvaWQge1xuLy8gXHRjb25zb2xlLmxvZygnXFx0JyArIHRhcmdldC5zcGxpdCgnJykuam9pbignXFx0JykpO1xuLy8gXHRmb3IgKGxldCBxdWVyeUluZGV4ID0gMDsgcXVlcnlJbmRleCA8IHF1ZXJ5Lmxlbmd0aDsgcXVlcnlJbmRleCsrKSB7XG4vLyBcdFx0bGV0IGxpbmUgPSBxdWVyeVtxdWVyeUluZGV4XSArICdcXHQnO1xuLy8gXHRcdGZvciAobGV0IHRhcmdldEluZGV4ID0gMDsgdGFyZ2V0SW5kZXggPCB0YXJnZXQubGVuZ3RoOyB0YXJnZXRJbmRleCsrKSB7XG4vLyBcdFx0XHRjb25zdCBjdXJyZW50SW5kZXggPSBxdWVyeUluZGV4ICogdGFyZ2V0Lmxlbmd0aCArIHRhcmdldEluZGV4O1xuLy8gXHRcdFx0bGluZSA9IGxpbmUgKyAnTScgKyBtYXRjaGVzW2N1cnJlbnRJbmRleF0gKyAnLycgKyAnUycgKyBzY29yZXNbY3VycmVudEluZGV4XSArICdcXHQnO1xuLy8gXHRcdH1cblxuLy8gXHRcdGNvbnNvbGUubG9nKGxpbmUpO1xuLy8gXHR9XG4vLyB9XG5cbi8vI2VuZHJlZ2lvblxuXG5cbi8vI3JlZ2lvbiBBbHRlcm5hdGUgZnV6enkgc2NvcmVyIGltcGxlbWVudGF0aW9uIHRoYXQgaXMgZS5nLiB1c2VkIGZvciBzeW1ib2xzXG5cbmV4cG9ydCB0eXBlIEZ1enp5U2NvcmUyID0gW251bWJlciB8IHVuZGVmaW5lZCAvKiBzY29yZSAqLywgSU1hdGNoW11dO1xuXG5jb25zdCBOT19TQ09SRTI6IEZ1enp5U2NvcmUyID0gW3VuZGVmaW5lZCwgW11dO1xuXG5leHBvcnQgZnVuY3Rpb24gc2NvcmVGdXp6eTIodGFyZ2V0OiBzdHJpbmcsIHF1ZXJ5OiBJUHJlcGFyZWRRdWVyeSB8IElQcmVwYXJlZFF1ZXJ5UGllY2UsIHBhdHRlcm5TdGFydCA9IDAsIHdvcmRTdGFydCA9IDApOiBGdXp6eVNjb3JlMiB7XG5cblx0Ly8gU2NvcmU6IG11bHRpcGxlIGlucHV0c1xuXHRjb25zdCBwcmVwYXJlZFF1ZXJ5ID0gcXVlcnkgYXMgSVByZXBhcmVkUXVlcnk7XG5cdGlmIChwcmVwYXJlZFF1ZXJ5LnZhbHVlcyAmJiBwcmVwYXJlZFF1ZXJ5LnZhbHVlcy5sZW5ndGggPiAxKSB7XG5cdFx0cmV0dXJuIGRvU2NvcmVGdXp6eTJNdWx0aXBsZSh0YXJnZXQsIHByZXBhcmVkUXVlcnkudmFsdWVzLCBwYXR0ZXJuU3RhcnQsIHdvcmRTdGFydCk7XG5cdH1cblxuXHQvLyBTY29yZTogc2luZ2xlIGlucHV0XG5cdHJldHVybiBkb1Njb3JlRnV6enkyU2luZ2xlKHRhcmdldCwgcXVlcnksIHBhdHRlcm5TdGFydCwgd29yZFN0YXJ0KTtcbn1cblxuZnVuY3Rpb24gZG9TY29yZUZ1enp5Mk11bHRpcGxlKHRhcmdldDogc3RyaW5nLCBxdWVyeTogSVByZXBhcmVkUXVlcnlQaWVjZVtdLCBwYXR0ZXJuU3RhcnQ6IG51bWJlciwgd29yZFN0YXJ0OiBudW1iZXIpOiBGdXp6eVNjb3JlMiB7XG5cdGxldCB0b3RhbFNjb3JlID0gMDtcblx0Y29uc3QgdG90YWxNYXRjaGVzOiBJTWF0Y2hbXSA9IFtdO1xuXG5cdGZvciAoY29uc3QgcXVlcnlQaWVjZSBvZiBxdWVyeSkge1xuXHRcdGNvbnN0IFtzY29yZSwgbWF0Y2hlc10gPSBkb1Njb3JlRnV6enkyU2luZ2xlKHRhcmdldCwgcXVlcnlQaWVjZSwgcGF0dGVyblN0YXJ0LCB3b3JkU3RhcnQpO1xuXHRcdGlmICh0eXBlb2Ygc2NvcmUgIT09ICdudW1iZXInKSB7XG5cdFx0XHQvLyBpZiBhIHNpbmdsZSBxdWVyeSB2YWx1ZSBkb2VzIG5vdCBtYXRjaCwgcmV0dXJuIHdpdGhcblx0XHRcdC8vIG5vIHNjb3JlIGVudGlyZWx5LCB3ZSByZXF1aXJlIGFsbCBxdWVyaWVzIHRvIG1hdGNoXG5cdFx0XHRyZXR1cm4gTk9fU0NPUkUyO1xuXHRcdH1cblxuXHRcdHRvdGFsU2NvcmUgKz0gc2NvcmU7XG5cdFx0dG90YWxNYXRjaGVzLnB1c2goLi4ubWF0Y2hlcyk7XG5cdH1cblxuXHQvLyBpZiB3ZSBoYXZlIGEgc2NvcmUsIGVuc3VyZSB0aGF0IHRoZSBwb3NpdGlvbnMgYXJlXG5cdC8vIHNvcnRlZCBpbiBhc2NlbmRpbmcgb3JkZXIgYW5kIGRpc3RpbmN0XG5cdHJldHVybiBbdG90YWxTY29yZSwgbm9ybWFsaXplTWF0Y2hlcyh0b3RhbE1hdGNoZXMpXTtcbn1cblxuZnVuY3Rpb24gZG9TY29yZUZ1enp5MlNpbmdsZSh0YXJnZXQ6IHN0cmluZywgcXVlcnk6IElQcmVwYXJlZFF1ZXJ5UGllY2UsIHBhdHRlcm5TdGFydDogbnVtYmVyLCB3b3JkU3RhcnQ6IG51bWJlcik6IEZ1enp5U2NvcmUyIHtcblx0Y29uc3Qgc2NvcmUgPSBmdXp6eVNjb3JlKHF1ZXJ5Lm9yaWdpbmFsLCBxdWVyeS5vcmlnaW5hbExvd2VyY2FzZSwgcGF0dGVyblN0YXJ0LCB0YXJnZXQsIHRhcmdldC50b0xvd2VyQ2FzZSgpLCB3b3JkU3RhcnQsIHsgZmlyc3RNYXRjaENhbkJlV2VhazogdHJ1ZSwgYm9vc3RGdWxsTWF0Y2g6IHRydWUgfSk7XG5cdGlmICghc2NvcmUpIHtcblx0XHRyZXR1cm4gTk9fU0NPUkUyO1xuXHR9XG5cblx0cmV0dXJuIFtzY29yZVswXSwgY3JlYXRlRnV6enlNYXRjaGVzKHNjb3JlKV07XG59XG5cbi8vI2VuZHJlZ2lvblxuXG5cbi8vI3JlZ2lvbiBJdGVtIChsYWJlbCwgZGVzY3JpcHRpb24sIHBhdGgpIHNjb3JlclxuXG4vKipcbiAqIFNjb3Jpbmcgb24gc3RydWN0dXJhbCBpdGVtcyB0aGF0IGhhdmUgYSBsYWJlbCBhbmQgb3B0aW9uYWwgZGVzY3JpcHRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUl0ZW1TY29yZSB7XG5cblx0LyoqXG5cdCAqIE92ZXJhbGwgc2NvcmUuXG5cdCAqL1xuXHRzY29yZTogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBNYXRjaGVzIHdpdGhpbiB0aGUgbGFiZWwuXG5cdCAqL1xuXHRsYWJlbE1hdGNoPzogSU1hdGNoW107XG5cblx0LyoqXG5cdCAqIE1hdGNoZXMgd2l0aGluIHRoZSBkZXNjcmlwdGlvbi5cblx0ICovXG5cdGRlc2NyaXB0aW9uTWF0Y2g/OiBJTWF0Y2hbXTtcbn1cblxuY29uc3QgTk9fSVRFTV9TQ09SRSA9IE9iamVjdC5mcmVlemU8SUl0ZW1TY29yZT4oeyBzY29yZTogMCB9KTtcblxuZXhwb3J0IGludGVyZmFjZSBJSXRlbUFjY2Vzc29yPFQ+IHtcblxuXHQvKipcblx0ICogSnVzdCB0aGUgbGFiZWwgb2YgdGhlIGl0ZW0gdG8gc2NvcmUgb24uXG5cdCAqL1xuXHRnZXRJdGVtTGFiZWwoaXRlbTogVCk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogVGhlIG9wdGlvbmFsIGRlc2NyaXB0aW9uIG9mIHRoZSBpdGVtIHRvIHNjb3JlIG9uLlxuXHQgKi9cblx0Z2V0SXRlbURlc2NyaXB0aW9uKGl0ZW06IFQpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIElmIHRoZSBpdGVtIGlzIGEgZmlsZSwgdGhlIHBhdGggb2YgdGhlIGZpbGUgdG8gc2NvcmUgb24uXG5cdCAqL1xuXHRnZXRJdGVtUGF0aChmaWxlOiBUKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5jb25zdCBQQVRIX0lERU5USVRZX1NDT1JFID0gMSA8PCAxODtcbmNvbnN0IExBQkVMX1BSRUZJWF9TQ09SRV9USFJFU0hPTEQgPSAxIDw8IDE3O1xuY29uc3QgTEFCRUxfU0NPUkVfVEhSRVNIT0xEID0gMSA8PCAxNjtcblxuZnVuY3Rpb24gZ2V0Q2FjaGVIYXNoKGxhYmVsOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsIGFsbG93Tm9uQ29udGlndW91c01hdGNoZXM6IGJvb2xlYW4sIHF1ZXJ5OiBJUHJlcGFyZWRRdWVyeSkge1xuXHRjb25zdCB2YWx1ZXMgPSBxdWVyeS52YWx1ZXMgPyBxdWVyeS52YWx1ZXMgOiBbcXVlcnldO1xuXHRjb25zdCBjYWNoZUhhc2ggPSBoYXNoKHtcblx0XHRbcXVlcnkubm9ybWFsaXplZF06IHtcblx0XHRcdHZhbHVlczogdmFsdWVzLm1hcCh2ID0+ICh7IHZhbHVlOiB2Lm5vcm1hbGl6ZWQsIGV4cGVjdENvbnRpZ3VvdXNNYXRjaDogdi5leHBlY3RDb250aWd1b3VzTWF0Y2ggfSkpLFxuXHRcdFx0bGFiZWwsXG5cdFx0XHRkZXNjcmlwdGlvbixcblx0XHRcdGFsbG93Tm9uQ29udGlndW91c01hdGNoZXNcblx0XHR9XG5cdH0pO1xuXHRyZXR1cm4gY2FjaGVIYXNoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2NvcmVJdGVtRnV6enk8VD4oaXRlbTogVCwgcXVlcnk6IElQcmVwYXJlZFF1ZXJ5LCBhbGxvd05vbkNvbnRpZ3VvdXNNYXRjaGVzOiBib29sZWFuLCBhY2Nlc3NvcjogSUl0ZW1BY2Nlc3NvcjxUPiwgY2FjaGU6IEZ1enp5U2NvcmVyQ2FjaGUpOiBJSXRlbVNjb3JlIHtcblx0aWYgKCFpdGVtIHx8ICFxdWVyeS5ub3JtYWxpemVkKSB7XG5cdFx0cmV0dXJuIE5PX0lURU1fU0NPUkU7IC8vIHdlIG5lZWQgYW4gaXRlbSBhbmQgcXVlcnkgdG8gc2NvcmUgb24gYXQgbGVhc3Rcblx0fVxuXG5cdGNvbnN0IGxhYmVsID0gYWNjZXNzb3IuZ2V0SXRlbUxhYmVsKGl0ZW0pO1xuXHRpZiAoIWxhYmVsKSB7XG5cdFx0cmV0dXJuIE5PX0lURU1fU0NPUkU7IC8vIHdlIG5lZWQgYSBsYWJlbCBhdCBsZWFzdFxuXHR9XG5cblx0Y29uc3QgZGVzY3JpcHRpb24gPSBhY2Nlc3Nvci5nZXRJdGVtRGVzY3JpcHRpb24oaXRlbSk7XG5cblx0Ly8gaW4gb3JkZXIgdG8gc3BlZWQgdXAgc2NvcmluZywgd2UgY2FjaGUgdGhlIHNjb3JlIHdpdGggYSB1bmlxdWUgaGFzaCBiYXNlZCBvbjpcblx0Ly8gLSBsYWJlbFxuXHQvLyAtIGRlc2NyaXB0aW9uIChpZiBwcm92aWRlZClcblx0Ly8gLSB3aGV0aGVyIG5vbi1jb250aWd1b3VzIG1hdGNoaW5nIGlzIGVuYWJsZWQgb3Igbm90XG5cdC8vIC0gaGFzaCBvZiB0aGUgcXVlcnkgKG5vcm1hbGl6ZWQpIHZhbHVlc1xuXHRjb25zdCBjYWNoZUhhc2ggPSBnZXRDYWNoZUhhc2gobGFiZWwsIGRlc2NyaXB0aW9uLCBhbGxvd05vbkNvbnRpZ3VvdXNNYXRjaGVzLCBxdWVyeSk7XG5cdGNvbnN0IGNhY2hlZCA9IGNhY2hlW2NhY2hlSGFzaF07XG5cdGlmIChjYWNoZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkO1xuXHR9XG5cblx0Y29uc3QgaXRlbVNjb3JlID0gZG9TY29yZUl0ZW1GdXp6eShsYWJlbCwgZGVzY3JpcHRpb24sIGFjY2Vzc29yLmdldEl0ZW1QYXRoKGl0ZW0pLCBxdWVyeSwgYWxsb3dOb25Db250aWd1b3VzTWF0Y2hlcyk7XG5cdGNhY2hlW2NhY2hlSGFzaF0gPSBpdGVtU2NvcmU7XG5cblx0cmV0dXJuIGl0ZW1TY29yZTtcbn1cblxuZnVuY3Rpb24gZG9TY29yZUl0ZW1GdXp6eShsYWJlbDogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCBwYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQsIHF1ZXJ5OiBJUHJlcGFyZWRRdWVyeSwgYWxsb3dOb25Db250aWd1b3VzTWF0Y2hlczogYm9vbGVhbik6IElJdGVtU2NvcmUge1xuXHRjb25zdCBwcmVmZXJMYWJlbE1hdGNoZXMgPSAhcGF0aCB8fCAhcXVlcnkuY29udGFpbnNQYXRoU2VwYXJhdG9yO1xuXG5cdC8vIFRyZWF0IGlkZW50aXR5IG1hdGNoZXMgb24gZnVsbCBwYXRoIGhpZ2hlc3Rcblx0aWYgKHBhdGggJiYgKGlzTGludXggPyBxdWVyeS5wYXRoTm9ybWFsaXplZCA9PT0gcGF0aCA6IGVxdWFsc0lnbm9yZUNhc2UocXVlcnkucGF0aE5vcm1hbGl6ZWQsIHBhdGgpKSkge1xuXHRcdHJldHVybiB7IHNjb3JlOiBQQVRIX0lERU5USVRZX1NDT1JFLCBsYWJlbE1hdGNoOiBbeyBzdGFydDogMCwgZW5kOiBsYWJlbC5sZW5ndGggfV0sIGRlc2NyaXB0aW9uTWF0Y2g6IGRlc2NyaXB0aW9uID8gW3sgc3RhcnQ6IDAsIGVuZDogZGVzY3JpcHRpb24ubGVuZ3RoIH1dIDogdW5kZWZpbmVkIH07XG5cdH1cblxuXHQvLyBTY29yZTogbXVsdGlwbGUgaW5wdXRzXG5cdGlmIChxdWVyeS52YWx1ZXMgJiYgcXVlcnkudmFsdWVzLmxlbmd0aCA+IDEpIHtcblx0XHRyZXR1cm4gZG9TY29yZUl0ZW1GdXp6eU11bHRpcGxlKGxhYmVsLCBkZXNjcmlwdGlvbiwgcGF0aCwgcXVlcnkudmFsdWVzLCBwcmVmZXJMYWJlbE1hdGNoZXMsIGFsbG93Tm9uQ29udGlndW91c01hdGNoZXMpO1xuXHR9XG5cblx0Ly8gU2NvcmU6IHNpbmdsZSBpbnB1dFxuXHRyZXR1cm4gZG9TY29yZUl0ZW1GdXp6eVNpbmdsZShsYWJlbCwgZGVzY3JpcHRpb24sIHBhdGgsIHF1ZXJ5LCBwcmVmZXJMYWJlbE1hdGNoZXMsIGFsbG93Tm9uQ29udGlndW91c01hdGNoZXMpO1xufVxuXG5mdW5jdGlvbiBkb1Njb3JlSXRlbUZ1enp5TXVsdGlwbGUobGFiZWw6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCwgcGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkLCBxdWVyeTogSVByZXBhcmVkUXVlcnlQaWVjZVtdLCBwcmVmZXJMYWJlbE1hdGNoZXM6IGJvb2xlYW4sIGFsbG93Tm9uQ29udGlndW91c01hdGNoZXM6IGJvb2xlYW4pOiBJSXRlbVNjb3JlIHtcblx0bGV0IHRvdGFsU2NvcmUgPSAwO1xuXHRjb25zdCB0b3RhbExhYmVsTWF0Y2hlczogSU1hdGNoW10gPSBbXTtcblx0Y29uc3QgdG90YWxEZXNjcmlwdGlvbk1hdGNoZXM6IElNYXRjaFtdID0gW107XG5cblx0Zm9yIChjb25zdCBxdWVyeVBpZWNlIG9mIHF1ZXJ5KSB7XG5cdFx0Y29uc3QgeyBzY29yZSwgbGFiZWxNYXRjaCwgZGVzY3JpcHRpb25NYXRjaCB9ID0gZG9TY29yZUl0ZW1GdXp6eVNpbmdsZShsYWJlbCwgZGVzY3JpcHRpb24sIHBhdGgsIHF1ZXJ5UGllY2UsIHByZWZlckxhYmVsTWF0Y2hlcywgYWxsb3dOb25Db250aWd1b3VzTWF0Y2hlcyk7XG5cdFx0aWYgKHNjb3JlID09PSBOT19NQVRDSCkge1xuXHRcdFx0Ly8gaWYgYSBzaW5nbGUgcXVlcnkgdmFsdWUgZG9lcyBub3QgbWF0Y2gsIHJldHVybiB3aXRoXG5cdFx0XHQvLyBubyBzY29yZSBlbnRpcmVseSwgd2UgcmVxdWlyZSBhbGwgcXVlcmllcyB0byBtYXRjaFxuXHRcdFx0cmV0dXJuIE5PX0lURU1fU0NPUkU7XG5cdFx0fVxuXG5cdFx0dG90YWxTY29yZSArPSBzY29yZTtcblx0XHRpZiAobGFiZWxNYXRjaCkge1xuXHRcdFx0dG90YWxMYWJlbE1hdGNoZXMucHVzaCguLi5sYWJlbE1hdGNoKTtcblx0XHR9XG5cblx0XHRpZiAoZGVzY3JpcHRpb25NYXRjaCkge1xuXHRcdFx0dG90YWxEZXNjcmlwdGlvbk1hdGNoZXMucHVzaCguLi5kZXNjcmlwdGlvbk1hdGNoKTtcblx0XHR9XG5cdH1cblxuXHQvLyBpZiB3ZSBoYXZlIGEgc2NvcmUsIGVuc3VyZSB0aGF0IHRoZSBwb3NpdGlvbnMgYXJlXG5cdC8vIHNvcnRlZCBpbiBhc2NlbmRpbmcgb3JkZXIgYW5kIGRpc3RpbmN0XG5cdHJldHVybiB7XG5cdFx0c2NvcmU6IHRvdGFsU2NvcmUsXG5cdFx0bGFiZWxNYXRjaDogbm9ybWFsaXplTWF0Y2hlcyh0b3RhbExhYmVsTWF0Y2hlcyksXG5cdFx0ZGVzY3JpcHRpb25NYXRjaDogbm9ybWFsaXplTWF0Y2hlcyh0b3RhbERlc2NyaXB0aW9uTWF0Y2hlcylcblx0fTtcbn1cblxuZnVuY3Rpb24gZG9TY29yZUl0ZW1GdXp6eVNpbmdsZShsYWJlbDogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCBwYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQsIHF1ZXJ5OiBJUHJlcGFyZWRRdWVyeVBpZWNlLCBwcmVmZXJMYWJlbE1hdGNoZXM6IGJvb2xlYW4sIGFsbG93Tm9uQ29udGlndW91c01hdGNoZXM6IGJvb2xlYW4pOiBJSXRlbVNjb3JlIHtcblxuXHQvLyBQcmVmZXIgbGFiZWwgbWF0Y2hlcyBpZiB0b2xkIHNvIG9yIHdlIGhhdmUgbm8gZGVzY3JpcHRpb25cblx0aWYgKHByZWZlckxhYmVsTWF0Y2hlcyB8fCAhZGVzY3JpcHRpb24pIHtcblx0XHRjb25zdCBbbGFiZWxTY29yZSwgbGFiZWxQb3NpdGlvbnNdID0gc2NvcmVGdXp6eShcblx0XHRcdGxhYmVsLFxuXHRcdFx0cXVlcnkubm9ybWFsaXplZCxcblx0XHRcdHF1ZXJ5Lm5vcm1hbGl6ZWRMb3dlcmNhc2UsXG5cdFx0XHRhbGxvd05vbkNvbnRpZ3VvdXNNYXRjaGVzICYmICFxdWVyeS5leHBlY3RDb250aWd1b3VzTWF0Y2gpO1xuXHRcdGlmIChsYWJlbFNjb3JlKSB7XG5cblx0XHRcdC8vIElmIHdlIGhhdmUgYSBwcmVmaXggbWF0Y2ggb24gdGhlIGxhYmVsLCB3ZSBnaXZlIGEgbXVjaFxuXHRcdFx0Ly8gaGlnaGVyIGJhc2VTY29yZSB0byBlbGV2YXRlIHRoZXNlIG1hdGNoZXMgb3ZlciBvdGhlcnNcblx0XHRcdC8vIFRoaXMgZW5zdXJlcyB0aGF0IHR5cGluZyBhIGZpbGUgbmFtZSB3aW5zIG92ZXIgcmVzdWx0c1xuXHRcdFx0Ly8gdGhhdCBhcmUgcHJlc2VudCBzb21ld2hlcmUgaW4gdGhlIGxhYmVsLCBidXQgbm90IHRoZVxuXHRcdFx0Ly8gYmVnaW5uaW5nLlxuXHRcdFx0Y29uc3QgbGFiZWxQcmVmaXhNYXRjaCA9IG1hdGNoZXNQcmVmaXgocXVlcnkubm9ybWFsaXplZCwgbGFiZWwpO1xuXHRcdFx0bGV0IGJhc2VTY29yZTogbnVtYmVyO1xuXHRcdFx0aWYgKGxhYmVsUHJlZml4TWF0Y2gpIHtcblx0XHRcdFx0YmFzZVNjb3JlID0gTEFCRUxfUFJFRklYX1NDT1JFX1RIUkVTSE9MRDtcblxuXHRcdFx0XHQvLyBXZSBnaXZlIGFub3RoZXIgYm9vc3QgdG8gbGFiZWxzIHRoYXQgYXJlIHNob3J0LCBlLmcuIGdpdmVuXG5cdFx0XHRcdC8vIGZpbGVzIFwid2luZG93LnRzXCIgYW5kIFwid2luZG93QWN0aW9ucy50c1wiIGFuZCBhIHF1ZXJ5IG9mXG5cdFx0XHRcdC8vIFwid2luZG93XCIsIHdlIHdhbnQgXCJ3aW5kb3cudHNcIiB0byByZWNlaXZlIGEgaGlnaGVyIHNjb3JlLlxuXHRcdFx0XHQvLyBBcyBzdWNoIHdlIGNvbXB1dGUgdGhlIHBlcmNlbnRhZ2UgdGhlIHF1ZXJ5IGhhcyB3aXRoaW4gdGhlXG5cdFx0XHRcdC8vIGxhYmVsIGFuZCBhZGQgdGhhdCB0byB0aGUgYmFzZVNjb3JlLlxuXHRcdFx0XHRjb25zdCBwcmVmaXhMZW5ndGhCb29zdCA9IE1hdGgucm91bmQoKHF1ZXJ5Lm5vcm1hbGl6ZWQubGVuZ3RoIC8gbGFiZWwubGVuZ3RoKSAqIDEwMCk7XG5cdFx0XHRcdGJhc2VTY29yZSArPSBwcmVmaXhMZW5ndGhCb29zdDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGJhc2VTY29yZSA9IExBQkVMX1NDT1JFX1RIUkVTSE9MRDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHsgc2NvcmU6IGJhc2VTY29yZSArIGxhYmVsU2NvcmUsIGxhYmVsTWF0Y2g6IGxhYmVsUHJlZml4TWF0Y2ggfHwgY3JlYXRlTWF0Y2hlcyhsYWJlbFBvc2l0aW9ucykgfTtcblx0XHR9XG5cdH1cblxuXHQvLyBGaW5hbGx5IGNvbXB1dGUgZGVzY3JpcHRpb24gKyBsYWJlbCBzY29yZXMgaWYgd2UgaGF2ZSBhIGRlc2NyaXB0aW9uXG5cdGlmIChkZXNjcmlwdGlvbikge1xuXHRcdGxldCBkZXNjcmlwdGlvblByZWZpeCA9IGRlc2NyaXB0aW9uO1xuXHRcdGlmICghIXBhdGgpIHtcblx0XHRcdGRlc2NyaXB0aW9uUHJlZml4ID0gYCR7ZGVzY3JpcHRpb259JHtzZXB9YDsgLy8gYXNzdW1lIHRoaXMgaXMgYSBmaWxlIHBhdGhcblx0XHR9XG5cblx0XHRjb25zdCBkZXNjcmlwdGlvblByZWZpeExlbmd0aCA9IGRlc2NyaXB0aW9uUHJlZml4Lmxlbmd0aDtcblx0XHRjb25zdCBkZXNjcmlwdGlvbkFuZExhYmVsID0gYCR7ZGVzY3JpcHRpb25QcmVmaXh9JHtsYWJlbH1gO1xuXG5cdFx0Y29uc3QgW2xhYmVsRGVzY3JpcHRpb25TY29yZSwgbGFiZWxEZXNjcmlwdGlvblBvc2l0aW9uc10gPSBzY29yZUZ1enp5KFxuXHRcdFx0ZGVzY3JpcHRpb25BbmRMYWJlbCxcblx0XHRcdHF1ZXJ5Lm5vcm1hbGl6ZWQsXG5cdFx0XHRxdWVyeS5ub3JtYWxpemVkTG93ZXJjYXNlLFxuXHRcdFx0YWxsb3dOb25Db250aWd1b3VzTWF0Y2hlcyAmJiAhcXVlcnkuZXhwZWN0Q29udGlndW91c01hdGNoKTtcblx0XHRpZiAobGFiZWxEZXNjcmlwdGlvblNjb3JlKSB7XG5cdFx0XHRjb25zdCBsYWJlbERlc2NyaXB0aW9uTWF0Y2hlcyA9IGNyZWF0ZU1hdGNoZXMobGFiZWxEZXNjcmlwdGlvblBvc2l0aW9ucyk7XG5cdFx0XHRjb25zdCBsYWJlbE1hdGNoOiBJTWF0Y2hbXSA9IFtdO1xuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb25NYXRjaDogSU1hdGNoW10gPSBbXTtcblxuXHRcdFx0Ly8gV2UgaGF2ZSB0byBzcGxpdCB0aGUgbWF0Y2hlcyBiYWNrIG9udG8gdGhlIGxhYmVsIGFuZCBkZXNjcmlwdGlvbiBwb3J0aW9uc1xuXHRcdFx0bGFiZWxEZXNjcmlwdGlvbk1hdGNoZXMuZm9yRWFjaChoID0+IHtcblxuXHRcdFx0XHQvLyBNYXRjaCBvdmVybGFwcyBsYWJlbCBhbmQgZGVzY3JpcHRpb24gcGFydCwgd2UgbmVlZCB0byBzcGxpdCBpdCB1cFxuXHRcdFx0XHRpZiAoaC5zdGFydCA8IGRlc2NyaXB0aW9uUHJlZml4TGVuZ3RoICYmIGguZW5kID4gZGVzY3JpcHRpb25QcmVmaXhMZW5ndGgpIHtcblx0XHRcdFx0XHRsYWJlbE1hdGNoLnB1c2goeyBzdGFydDogMCwgZW5kOiBoLmVuZCAtIGRlc2NyaXB0aW9uUHJlZml4TGVuZ3RoIH0pO1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uTWF0Y2gucHVzaCh7IHN0YXJ0OiBoLnN0YXJ0LCBlbmQ6IGRlc2NyaXB0aW9uUHJlZml4TGVuZ3RoIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gTWF0Y2ggb24gbGFiZWwgcGFydFxuXHRcdFx0XHRlbHNlIGlmIChoLnN0YXJ0ID49IGRlc2NyaXB0aW9uUHJlZml4TGVuZ3RoKSB7XG5cdFx0XHRcdFx0bGFiZWxNYXRjaC5wdXNoKHsgc3RhcnQ6IGguc3RhcnQgLSBkZXNjcmlwdGlvblByZWZpeExlbmd0aCwgZW5kOiBoLmVuZCAtIGRlc2NyaXB0aW9uUHJlZml4TGVuZ3RoIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gTWF0Y2ggb24gZGVzY3JpcHRpb24gcGFydFxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbk1hdGNoLnB1c2goaCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4geyBzY29yZTogbGFiZWxEZXNjcmlwdGlvblNjb3JlLCBsYWJlbE1hdGNoLCBkZXNjcmlwdGlvbk1hdGNoIH07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIE5PX0lURU1fU0NPUkU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hdGNoZXMob2Zmc2V0czogbnVtYmVyW10gfCB1bmRlZmluZWQpOiBJTWF0Y2hbXSB7XG5cdGNvbnN0IHJldDogSU1hdGNoW10gPSBbXTtcblx0aWYgKCFvZmZzZXRzKSB7XG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdGxldCBsYXN0OiBJTWF0Y2ggfCB1bmRlZmluZWQ7XG5cdGZvciAoY29uc3QgcG9zIG9mIG9mZnNldHMpIHtcblx0XHRpZiAobGFzdCAmJiBsYXN0LmVuZCA9PT0gcG9zKSB7XG5cdFx0XHRsYXN0LmVuZCArPSAxO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsYXN0ID0geyBzdGFydDogcG9zLCBlbmQ6IHBvcyArIDEgfTtcblx0XHRcdHJldC5wdXNoKGxhc3QpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZU1hdGNoZXMobWF0Y2hlczogSU1hdGNoW10pOiBJTWF0Y2hbXSB7XG5cblx0Ly8gc29ydCBtYXRjaGVzIGJ5IHN0YXJ0IHRvIGJlIGFibGUgdG8gbm9ybWFsaXplXG5cdGNvbnN0IHNvcnRlZE1hdGNoZXMgPSBtYXRjaGVzLnNvcnQoKG1hdGNoQSwgbWF0Y2hCKSA9PiB7XG5cdFx0cmV0dXJuIG1hdGNoQS5zdGFydCAtIG1hdGNoQi5zdGFydDtcblx0fSk7XG5cblx0Ly8gbWVyZ2UgbWF0Y2hlcyB0aGF0IG92ZXJsYXBcblx0Y29uc3Qgbm9ybWFsaXplZE1hdGNoZXM6IElNYXRjaFtdID0gW107XG5cdGxldCBjdXJyZW50TWF0Y2g6IElNYXRjaCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Zm9yIChjb25zdCBtYXRjaCBvZiBzb3J0ZWRNYXRjaGVzKSB7XG5cblx0XHQvLyBpZiB3ZSBoYXZlIG5vIGN1cnJlbnQgbWF0Y2ggb3IgdGhlIG1hdGNoZXNcblx0XHQvLyBkbyBub3Qgb3ZlcmxhcCwgd2UgdGFrZSBpdCBhcyBpcyBhbmQgcmVtZW1iZXJcblx0XHQvLyBpdCBmb3IgZnV0dXJlIG1lcmdpbmdcblx0XHRpZiAoIWN1cnJlbnRNYXRjaCB8fCAhbWF0Y2hPdmVybGFwcyhjdXJyZW50TWF0Y2gsIG1hdGNoKSkge1xuXHRcdFx0Y3VycmVudE1hdGNoID0gbWF0Y2g7XG5cdFx0XHRub3JtYWxpemVkTWF0Y2hlcy5wdXNoKG1hdGNoKTtcblx0XHR9XG5cblx0XHQvLyBvdGhlcndpc2Ugd2UgbWVyZ2UgdGhlIG1hdGNoZXNcblx0XHRlbHNlIHtcblx0XHRcdGN1cnJlbnRNYXRjaC5zdGFydCA9IE1hdGgubWluKGN1cnJlbnRNYXRjaC5zdGFydCwgbWF0Y2guc3RhcnQpO1xuXHRcdFx0Y3VycmVudE1hdGNoLmVuZCA9IE1hdGgubWF4KGN1cnJlbnRNYXRjaC5lbmQsIG1hdGNoLmVuZCk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG5vcm1hbGl6ZWRNYXRjaGVzO1xufVxuXG5mdW5jdGlvbiBtYXRjaE92ZXJsYXBzKG1hdGNoQTogSU1hdGNoLCBtYXRjaEI6IElNYXRjaCk6IGJvb2xlYW4ge1xuXHRpZiAobWF0Y2hBLmVuZCA8IG1hdGNoQi5zdGFydCkge1xuXHRcdHJldHVybiBmYWxzZTtcdC8vIEEgZW5kcyBiZWZvcmUgQiBzdGFydHNcblx0fVxuXG5cdGlmIChtYXRjaEIuZW5kIDwgbWF0Y2hBLnN0YXJ0KSB7XG5cdFx0cmV0dXJuIGZhbHNlOyAvLyBCIGVuZHMgYmVmb3JlIEEgc3RhcnRzXG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuLy8jZW5kcmVnaW9uXG5cblxuLy8jcmVnaW9uIENvbXBhcmVyc1xuXG5leHBvcnQgZnVuY3Rpb24gY29tcGFyZUl0ZW1zQnlGdXp6eVNjb3JlPFQ+KGl0ZW1BOiBULCBpdGVtQjogVCwgcXVlcnk6IElQcmVwYXJlZFF1ZXJ5LCBhbGxvd05vbkNvbnRpZ3VvdXNNYXRjaGVzOiBib29sZWFuLCBhY2Nlc3NvcjogSUl0ZW1BY2Nlc3NvcjxUPiwgY2FjaGU6IEZ1enp5U2NvcmVyQ2FjaGUpOiBudW1iZXIge1xuXHRjb25zdCBpdGVtU2NvcmVBID0gc2NvcmVJdGVtRnV6enkoaXRlbUEsIHF1ZXJ5LCBhbGxvd05vbkNvbnRpZ3VvdXNNYXRjaGVzLCBhY2Nlc3NvciwgY2FjaGUpO1xuXHRjb25zdCBpdGVtU2NvcmVCID0gc2NvcmVJdGVtRnV6enkoaXRlbUIsIHF1ZXJ5LCBhbGxvd05vbkNvbnRpZ3VvdXNNYXRjaGVzLCBhY2Nlc3NvciwgY2FjaGUpO1xuXG5cdGNvbnN0IHNjb3JlQSA9IGl0ZW1TY29yZUEuc2NvcmU7XG5cdGNvbnN0IHNjb3JlQiA9IGl0ZW1TY29yZUIuc2NvcmU7XG5cblx0Ly8gMS4pIGlkZW50aXR5IG1hdGNoZXMgaGF2ZSBoaWdoZXN0IHNjb3JlXG5cdGlmIChzY29yZUEgPT09IFBBVEhfSURFTlRJVFlfU0NPUkUgfHwgc2NvcmVCID09PSBQQVRIX0lERU5USVRZX1NDT1JFKSB7XG5cdFx0aWYgKHNjb3JlQSAhPT0gc2NvcmVCKSB7XG5cdFx0XHRyZXR1cm4gc2NvcmVBID09PSBQQVRIX0lERU5USVRZX1NDT1JFID8gLTEgOiAxO1xuXHRcdH1cblx0fVxuXG5cdC8vIDIuKSBtYXRjaGVzIG9uIGxhYmVsIGFyZSBjb25zaWRlcmVkIGhpZ2hlciBjb21wYXJlZCB0byBsYWJlbCtkZXNjcmlwdGlvbiBtYXRjaGVzXG5cdGlmIChzY29yZUEgPiBMQUJFTF9TQ09SRV9USFJFU0hPTEQgfHwgc2NvcmVCID4gTEFCRUxfU0NPUkVfVEhSRVNIT0xEKSB7XG5cdFx0aWYgKHNjb3JlQSAhPT0gc2NvcmVCKSB7XG5cdFx0XHRyZXR1cm4gc2NvcmVBID4gc2NvcmVCID8gLTEgOiAxO1xuXHRcdH1cblxuXHRcdC8vIHByZWZlciBtb3JlIGNvbXBhY3QgbWF0Y2hlcyBvdmVyIGxvbmdlciBpbiBsYWJlbCAodW5sZXNzIHRoaXMgaXMgYSBwcmVmaXggbWF0Y2ggd2hlcmVcblx0XHQvLyBsb25nZXIgcHJlZml4IG1hdGNoZXMgYXJlIGFjdHVhbGx5IHByZWZlcnJlZClcblx0XHRpZiAoc2NvcmVBIDwgTEFCRUxfUFJFRklYX1NDT1JFX1RIUkVTSE9MRCAmJiBzY29yZUIgPCBMQUJFTF9QUkVGSVhfU0NPUkVfVEhSRVNIT0xEKSB7XG5cdFx0XHRjb25zdCBjb21wYXJlZEJ5TWF0Y2hMZW5ndGggPSBjb21wYXJlQnlNYXRjaExlbmd0aChpdGVtU2NvcmVBLmxhYmVsTWF0Y2gsIGl0ZW1TY29yZUIubGFiZWxNYXRjaCk7XG5cdFx0XHRpZiAoY29tcGFyZWRCeU1hdGNoTGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdHJldHVybiBjb21wYXJlZEJ5TWF0Y2hMZW5ndGg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gcHJlZmVyIHNob3J0ZXIgbGFiZWxzIG92ZXIgbG9uZ2VyIGxhYmVsc1xuXHRcdGNvbnN0IGxhYmVsQSA9IGFjY2Vzc29yLmdldEl0ZW1MYWJlbChpdGVtQSkgfHwgJyc7XG5cdFx0Y29uc3QgbGFiZWxCID0gYWNjZXNzb3IuZ2V0SXRlbUxhYmVsKGl0ZW1CKSB8fCAnJztcblx0XHRpZiAobGFiZWxBLmxlbmd0aCAhPT0gbGFiZWxCLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGxhYmVsQS5sZW5ndGggLSBsYWJlbEIubGVuZ3RoO1xuXHRcdH1cblx0fVxuXG5cdC8vIDMuKSBjb21wYXJlIGJ5IHNjb3JlIGluIGxhYmVsK2Rlc2NyaXB0aW9uXG5cdGlmIChzY29yZUEgIT09IHNjb3JlQikge1xuXHRcdHJldHVybiBzY29yZUEgPiBzY29yZUIgPyAtMSA6IDE7XG5cdH1cblxuXHQvLyA0Likgc2NvcmVzIGFyZSBpZGVudGljYWw6IHByZWZlciBtYXRjaGVzIGluIGxhYmVsIG92ZXIgbm9uLWxhYmVsIG1hdGNoZXNcblx0Y29uc3QgaXRlbUFIYXNMYWJlbE1hdGNoZXMgPSBBcnJheS5pc0FycmF5KGl0ZW1TY29yZUEubGFiZWxNYXRjaCkgJiYgaXRlbVNjb3JlQS5sYWJlbE1hdGNoLmxlbmd0aCA+IDA7XG5cdGNvbnN0IGl0ZW1CSGFzTGFiZWxNYXRjaGVzID0gQXJyYXkuaXNBcnJheShpdGVtU2NvcmVCLmxhYmVsTWF0Y2gpICYmIGl0ZW1TY29yZUIubGFiZWxNYXRjaC5sZW5ndGggPiAwO1xuXHRpZiAoaXRlbUFIYXNMYWJlbE1hdGNoZXMgJiYgIWl0ZW1CSGFzTGFiZWxNYXRjaGVzKSB7XG5cdFx0cmV0dXJuIC0xO1xuXHR9IGVsc2UgaWYgKGl0ZW1CSGFzTGFiZWxNYXRjaGVzICYmICFpdGVtQUhhc0xhYmVsTWF0Y2hlcykge1xuXHRcdHJldHVybiAxO1xuXHR9XG5cblx0Ly8gNS4pIHNjb3JlcyBhcmUgaWRlbnRpY2FsOiBwcmVmZXIgbW9yZSBjb21wYWN0IG1hdGNoZXMgKGxhYmVsIGFuZCBkZXNjcmlwdGlvbilcblx0Y29uc3QgaXRlbUFNYXRjaERpc3RhbmNlID0gY29tcHV0ZUxhYmVsQW5kRGVzY3JpcHRpb25NYXRjaERpc3RhbmNlKGl0ZW1BLCBpdGVtU2NvcmVBLCBhY2Nlc3Nvcik7XG5cdGNvbnN0IGl0ZW1CTWF0Y2hEaXN0YW5jZSA9IGNvbXB1dGVMYWJlbEFuZERlc2NyaXB0aW9uTWF0Y2hEaXN0YW5jZShpdGVtQiwgaXRlbVNjb3JlQiwgYWNjZXNzb3IpO1xuXHRpZiAoaXRlbUFNYXRjaERpc3RhbmNlICYmIGl0ZW1CTWF0Y2hEaXN0YW5jZSAmJiBpdGVtQU1hdGNoRGlzdGFuY2UgIT09IGl0ZW1CTWF0Y2hEaXN0YW5jZSkge1xuXHRcdHJldHVybiBpdGVtQk1hdGNoRGlzdGFuY2UgPiBpdGVtQU1hdGNoRGlzdGFuY2UgPyAtMSA6IDE7XG5cdH1cblxuXHQvLyA2Likgc2NvcmVzIGFyZSBpZGVudGljYWw6IHN0YXJ0IHRvIHVzZSB0aGUgZmFsbGJhY2sgY29tcGFyZVxuXHRyZXR1cm4gZmFsbGJhY2tDb21wYXJlKGl0ZW1BLCBpdGVtQiwgcXVlcnksIGFjY2Vzc29yKTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZUxhYmVsQW5kRGVzY3JpcHRpb25NYXRjaERpc3RhbmNlPFQ+KGl0ZW06IFQsIHNjb3JlOiBJSXRlbVNjb3JlLCBhY2Nlc3NvcjogSUl0ZW1BY2Nlc3NvcjxUPik6IG51bWJlciB7XG5cdGxldCBtYXRjaFN0YXJ0OiBudW1iZXIgPSAtMTtcblx0bGV0IG1hdGNoRW5kOiBudW1iZXIgPSAtMTtcblxuXHQvLyBJZiB3ZSBoYXZlIGRlc2NyaXB0aW9uIG1hdGNoZXMsIHRoZSBzdGFydCBpcyBmaXJzdCBvZiBkZXNjcmlwdGlvbiBtYXRjaFxuXHRpZiAoc2NvcmUuZGVzY3JpcHRpb25NYXRjaCAmJiBzY29yZS5kZXNjcmlwdGlvbk1hdGNoLmxlbmd0aCkge1xuXHRcdG1hdGNoU3RhcnQgPSBzY29yZS5kZXNjcmlwdGlvbk1hdGNoWzBdLnN0YXJ0O1xuXHR9XG5cblx0Ly8gT3RoZXJ3aXNlLCB0aGUgc3RhcnQgaXMgdGhlIGZpcnN0IGxhYmVsIG1hdGNoXG5cdGVsc2UgaWYgKHNjb3JlLmxhYmVsTWF0Y2ggJiYgc2NvcmUubGFiZWxNYXRjaC5sZW5ndGgpIHtcblx0XHRtYXRjaFN0YXJ0ID0gc2NvcmUubGFiZWxNYXRjaFswXS5zdGFydDtcblx0fVxuXG5cdC8vIElmIHdlIGhhdmUgbGFiZWwgbWF0Y2gsIHRoZSBlbmQgaXMgdGhlIGxhc3QgbGFiZWwgbWF0Y2hcblx0Ly8gSWYgd2UgaGFkIGEgZGVzY3JpcHRpb24gbWF0Y2gsIHdlIGFkZCB0aGUgbGVuZ3RoIG9mIHRoZSBkZXNjcmlwdGlvblxuXHQvLyBhcyBvZmZzZXQgdG8gdGhlIGVuZCB0byBpbmRpY2F0ZSB0aGlzLlxuXHRpZiAoc2NvcmUubGFiZWxNYXRjaCAmJiBzY29yZS5sYWJlbE1hdGNoLmxlbmd0aCkge1xuXHRcdG1hdGNoRW5kID0gc2NvcmUubGFiZWxNYXRjaFtzY29yZS5sYWJlbE1hdGNoLmxlbmd0aCAtIDFdLmVuZDtcblx0XHRpZiAoc2NvcmUuZGVzY3JpcHRpb25NYXRjaCAmJiBzY29yZS5kZXNjcmlwdGlvbk1hdGNoLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgaXRlbURlc2NyaXB0aW9uID0gYWNjZXNzb3IuZ2V0SXRlbURlc2NyaXB0aW9uKGl0ZW0pO1xuXHRcdFx0aWYgKGl0ZW1EZXNjcmlwdGlvbikge1xuXHRcdFx0XHRtYXRjaEVuZCArPSBpdGVtRGVzY3JpcHRpb24ubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIElmIHdlIGhhdmUganVzdCBhIGRlc2NyaXB0aW9uIG1hdGNoLCB0aGUgZW5kIGlzIHRoZSBsYXN0IGRlc2NyaXB0aW9uIG1hdGNoXG5cdGVsc2UgaWYgKHNjb3JlLmRlc2NyaXB0aW9uTWF0Y2ggJiYgc2NvcmUuZGVzY3JpcHRpb25NYXRjaC5sZW5ndGgpIHtcblx0XHRtYXRjaEVuZCA9IHNjb3JlLmRlc2NyaXB0aW9uTWF0Y2hbc2NvcmUuZGVzY3JpcHRpb25NYXRjaC5sZW5ndGggLSAxXS5lbmQ7XG5cdH1cblxuXHRyZXR1cm4gbWF0Y2hFbmQgLSBtYXRjaFN0YXJ0O1xufVxuXG5mdW5jdGlvbiBjb21wYXJlQnlNYXRjaExlbmd0aChtYXRjaGVzQT86IElNYXRjaFtdLCBtYXRjaGVzQj86IElNYXRjaFtdKTogbnVtYmVyIHtcblx0aWYgKCghbWF0Y2hlc0EgJiYgIW1hdGNoZXNCKSB8fCAoKCFtYXRjaGVzQSB8fCAhbWF0Y2hlc0EubGVuZ3RoKSAmJiAoIW1hdGNoZXNCIHx8ICFtYXRjaGVzQi5sZW5ndGgpKSkge1xuXHRcdHJldHVybiAwOyAvLyBtYWtlIHN1cmUgdG8gbm90IGNhdXNlIGJhZCBjb21wYXJpbmcgd2hlbiBtYXRjaGVzIGFyZSBub3QgcHJvdmlkZWRcblx0fVxuXG5cdGlmICghbWF0Y2hlc0IgfHwgIW1hdGNoZXNCLmxlbmd0aCkge1xuXHRcdHJldHVybiAtMTtcblx0fVxuXG5cdGlmICghbWF0Y2hlc0EgfHwgIW1hdGNoZXNBLmxlbmd0aCkge1xuXHRcdHJldHVybiAxO1xuXHR9XG5cblx0Ly8gQ29tcHV0ZSBtYXRjaCBsZW5ndGggb2YgQSAoZmlyc3QgdG8gbGFzdCBtYXRjaClcblx0Y29uc3QgbWF0Y2hTdGFydEEgPSBtYXRjaGVzQVswXS5zdGFydDtcblx0Y29uc3QgbWF0Y2hFbmRBID0gbWF0Y2hlc0FbbWF0Y2hlc0EubGVuZ3RoIC0gMV0uZW5kO1xuXHRjb25zdCBtYXRjaExlbmd0aEEgPSBtYXRjaEVuZEEgLSBtYXRjaFN0YXJ0QTtcblxuXHQvLyBDb21wdXRlIG1hdGNoIGxlbmd0aCBvZiBCIChmaXJzdCB0byBsYXN0IG1hdGNoKVxuXHRjb25zdCBtYXRjaFN0YXJ0QiA9IG1hdGNoZXNCWzBdLnN0YXJ0O1xuXHRjb25zdCBtYXRjaEVuZEIgPSBtYXRjaGVzQlttYXRjaGVzQi5sZW5ndGggLSAxXS5lbmQ7XG5cdGNvbnN0IG1hdGNoTGVuZ3RoQiA9IG1hdGNoRW5kQiAtIG1hdGNoU3RhcnRCO1xuXG5cdC8vIFByZWZlciBzaG9ydGVyIG1hdGNoIGxlbmd0aFxuXHRyZXR1cm4gbWF0Y2hMZW5ndGhBID09PSBtYXRjaExlbmd0aEIgPyAwIDogbWF0Y2hMZW5ndGhCIDwgbWF0Y2hMZW5ndGhBID8gMSA6IC0xO1xufVxuXG5mdW5jdGlvbiBmYWxsYmFja0NvbXBhcmU8VD4oaXRlbUE6IFQsIGl0ZW1COiBULCBxdWVyeTogSVByZXBhcmVkUXVlcnksIGFjY2Vzc29yOiBJSXRlbUFjY2Vzc29yPFQ+KTogbnVtYmVyIHtcblxuXHQvLyBjaGVjayBmb3IgbGFiZWwgKyBkZXNjcmlwdGlvbiBsZW5ndGggYW5kIHByZWZlciBzaG9ydGVyXG5cdGNvbnN0IGxhYmVsQSA9IGFjY2Vzc29yLmdldEl0ZW1MYWJlbChpdGVtQSkgfHwgJyc7XG5cdGNvbnN0IGxhYmVsQiA9IGFjY2Vzc29yLmdldEl0ZW1MYWJlbChpdGVtQikgfHwgJyc7XG5cblx0Y29uc3QgZGVzY3JpcHRpb25BID0gYWNjZXNzb3IuZ2V0SXRlbURlc2NyaXB0aW9uKGl0ZW1BKTtcblx0Y29uc3QgZGVzY3JpcHRpb25CID0gYWNjZXNzb3IuZ2V0SXRlbURlc2NyaXB0aW9uKGl0ZW1CKTtcblxuXHRjb25zdCBsYWJlbERlc2NyaXB0aW9uQUxlbmd0aCA9IGxhYmVsQS5sZW5ndGggKyAoZGVzY3JpcHRpb25BID8gZGVzY3JpcHRpb25BLmxlbmd0aCA6IDApO1xuXHRjb25zdCBsYWJlbERlc2NyaXB0aW9uQkxlbmd0aCA9IGxhYmVsQi5sZW5ndGggKyAoZGVzY3JpcHRpb25CID8gZGVzY3JpcHRpb25CLmxlbmd0aCA6IDApO1xuXG5cdGlmIChsYWJlbERlc2NyaXB0aW9uQUxlbmd0aCAhPT0gbGFiZWxEZXNjcmlwdGlvbkJMZW5ndGgpIHtcblx0XHRyZXR1cm4gbGFiZWxEZXNjcmlwdGlvbkFMZW5ndGggLSBsYWJlbERlc2NyaXB0aW9uQkxlbmd0aDtcblx0fVxuXG5cdC8vIGNoZWNrIGZvciBwYXRoIGxlbmd0aCBhbmQgcHJlZmVyIHNob3J0ZXJcblx0Y29uc3QgcGF0aEEgPSBhY2Nlc3Nvci5nZXRJdGVtUGF0aChpdGVtQSk7XG5cdGNvbnN0IHBhdGhCID0gYWNjZXNzb3IuZ2V0SXRlbVBhdGgoaXRlbUIpO1xuXG5cdGlmIChwYXRoQSAmJiBwYXRoQiAmJiBwYXRoQS5sZW5ndGggIT09IHBhdGhCLmxlbmd0aCkge1xuXHRcdHJldHVybiBwYXRoQS5sZW5ndGggLSBwYXRoQi5sZW5ndGg7XG5cdH1cblxuXHQvLyA3LikgZmluYWxseSB3ZSBoYXZlIGVxdWFsIHNjb3JlcyBhbmQgZXF1YWwgbGVuZ3RoLCB3ZSBmYWxsYmFjayB0byBjb21wYXJlclxuXG5cdC8vIGNvbXBhcmUgYnkgbGFiZWxcblx0aWYgKGxhYmVsQSAhPT0gbGFiZWxCKSB7XG5cdFx0cmV0dXJuIGNvbXBhcmVBbnl0aGluZyhsYWJlbEEsIGxhYmVsQiwgcXVlcnkubm9ybWFsaXplZCk7XG5cdH1cblxuXHQvLyBjb21wYXJlIGJ5IGRlc2NyaXB0aW9uXG5cdGlmIChkZXNjcmlwdGlvbkEgJiYgZGVzY3JpcHRpb25CICYmIGRlc2NyaXB0aW9uQSAhPT0gZGVzY3JpcHRpb25CKSB7XG5cdFx0cmV0dXJuIGNvbXBhcmVBbnl0aGluZyhkZXNjcmlwdGlvbkEsIGRlc2NyaXB0aW9uQiwgcXVlcnkubm9ybWFsaXplZCk7XG5cdH1cblxuXHQvLyBjb21wYXJlIGJ5IHBhdGhcblx0aWYgKHBhdGhBICYmIHBhdGhCICYmIHBhdGhBICE9PSBwYXRoQikge1xuXHRcdHJldHVybiBjb21wYXJlQW55dGhpbmcocGF0aEEsIHBhdGhCLCBxdWVyeS5ub3JtYWxpemVkKTtcblx0fVxuXG5cdC8vIGVxdWFsXG5cdHJldHVybiAwO1xufVxuXG4vLyNlbmRyZWdpb25cblxuXG4vLyNyZWdpb24gUXVlcnkgTm9ybWFsaXplclxuXG5leHBvcnQgaW50ZXJmYWNlIElQcmVwYXJlZFF1ZXJ5UGllY2Uge1xuXG5cdC8qKlxuXHQgKiBUaGUgb3JpZ2luYWwgcXVlcnkgYXMgcHJvdmlkZWQgYXMgaW5wdXQuXG5cdCAqL1xuXHRvcmlnaW5hbDogc3RyaW5nO1xuXHRvcmlnaW5hbExvd2VyY2FzZTogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBPcmlnaW5hbCBub3JtYWxpemVkIHRvIHBsYXRmb3JtIHNlcGFyYXRvcnM6XG5cdCAqIC0gV2luZG93czogXFxcblx0ICogLSBQb3NpeDogL1xuXHQgKi9cblx0cGF0aE5vcm1hbGl6ZWQ6IHN0cmluZztcblxuXHQvKipcblx0ICogSW4gYWRkaXRpb24gdG8gdGhlIG5vcm1hbGl6ZWQgcGF0aCwgd2lsbCBoYXZlXG5cdCAqIHdoaXRlc3BhY2UgYW5kIHdpbGRjYXJkcyByZW1vdmVkLlxuXHQgKi9cblx0bm9ybWFsaXplZDogc3RyaW5nO1xuXHRub3JtYWxpemVkTG93ZXJjYXNlOiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSBxdWVyeSBpcyB3cmFwcGVkIGluIHF1b3RlcyB3aGljaCBtZWFuc1xuXHQgKiB0aGlzIHF1ZXJ5IG11c3QgYmUgYSBzdWJzdHJpbmcgb2YgdGhlIGlucHV0LlxuXHQgKiBJbiBvdGhlciB3b3Jkcywgbm8gZnV6enkgbWF0Y2hpbmcgaXMgdXNlZC5cblx0ICovXG5cdGV4cGVjdENvbnRpZ3VvdXNNYXRjaDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJlcGFyZWRRdWVyeSBleHRlbmRzIElQcmVwYXJlZFF1ZXJ5UGllY2Uge1xuXG5cdC8qKlxuXHQgKiBRdWVyeSBzcGxpdCBieSBzcGFjZXMgaW50byBwaWVjZXMuXG5cdCAqL1xuXHR2YWx1ZXM6IElQcmVwYXJlZFF1ZXJ5UGllY2VbXSB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgcXVlcnkgY29udGFpbnMgcGF0aCBzZXBhcmF0b3Iocykgb3Igbm90LlxuXHQgKi9cblx0Y29udGFpbnNQYXRoU2VwYXJhdG9yOiBib29sZWFuO1xufVxuXG4vKlxuICogSWYgYSBxdWVyeSBpcyB3cmFwcGVkIGluIHF1b3RlcywgdGhlIHVzZXIgZG9lcyBub3Qgd2FudCB0b1xuICogdXNlIGZ1enp5IHNlYXJjaCBmb3IgdGhpcyBxdWVyeS5cbiAqL1xuZnVuY3Rpb24gcXVlcnlFeHBlY3RzRXhhY3RNYXRjaChxdWVyeTogc3RyaW5nKSB7XG5cdHJldHVybiBxdWVyeS5zdGFydHNXaXRoKCdcIicpICYmIHF1ZXJ5LmVuZHNXaXRoKCdcIicpO1xufVxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBwcmVwYXJlIGEgc2VhcmNoIHZhbHVlIGZvciBzY29yaW5nIGJ5IHJlbW92aW5nIHVud2FudGVkIGNoYXJhY3RlcnNcbiAqIGFuZCBhbGxvd2luZyB0byBzY29yZSBvbiBtdWx0aXBsZSBwaWVjZXMgc2VwYXJhdGVkIGJ5IHdoaXRlc3BhY2UgY2hhcmFjdGVyLlxuICovXG5jb25zdCBNVUxUSVBMRV9RVUVSWV9WQUxVRVNfU0VQQVJBVE9SID0gJyAnO1xuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVRdWVyeShvcmlnaW5hbDogc3RyaW5nKTogSVByZXBhcmVkUXVlcnkge1xuXHRpZiAodHlwZW9mIG9yaWdpbmFsICE9PSAnc3RyaW5nJykge1xuXHRcdG9yaWdpbmFsID0gJyc7XG5cdH1cblxuXHRjb25zdCBvcmlnaW5hbExvd2VyY2FzZSA9IG9yaWdpbmFsLnRvTG93ZXJDYXNlKCk7XG5cdGNvbnN0IHsgcGF0aE5vcm1hbGl6ZWQsIG5vcm1hbGl6ZWQsIG5vcm1hbGl6ZWRMb3dlcmNhc2UgfSA9IG5vcm1hbGl6ZVF1ZXJ5KG9yaWdpbmFsKTtcblx0Y29uc3QgY29udGFpbnNQYXRoU2VwYXJhdG9yID0gcGF0aE5vcm1hbGl6ZWQuaW5kZXhPZihzZXApID49IDA7XG5cdGNvbnN0IGV4cGVjdEV4YWN0TWF0Y2ggPSBxdWVyeUV4cGVjdHNFeGFjdE1hdGNoKG9yaWdpbmFsKTtcblxuXHRsZXQgdmFsdWVzOiBJUHJlcGFyZWRRdWVyeVBpZWNlW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3Qgb3JpZ2luYWxTcGxpdCA9IG9yaWdpbmFsLnNwbGl0KE1VTFRJUExFX1FVRVJZX1ZBTFVFU19TRVBBUkFUT1IpO1xuXHRpZiAob3JpZ2luYWxTcGxpdC5sZW5ndGggPiAxKSB7XG5cdFx0Zm9yIChjb25zdCBvcmlnaW5hbFBpZWNlIG9mIG9yaWdpbmFsU3BsaXQpIHtcblx0XHRcdGNvbnN0IGV4cGVjdEV4YWN0TWF0Y2hQaWVjZSA9IHF1ZXJ5RXhwZWN0c0V4YWN0TWF0Y2gob3JpZ2luYWxQaWVjZSk7XG5cdFx0XHRjb25zdCB7XG5cdFx0XHRcdHBhdGhOb3JtYWxpemVkOiBwYXRoTm9ybWFsaXplZFBpZWNlLFxuXHRcdFx0XHRub3JtYWxpemVkOiBub3JtYWxpemVkUGllY2UsXG5cdFx0XHRcdG5vcm1hbGl6ZWRMb3dlcmNhc2U6IG5vcm1hbGl6ZWRMb3dlcmNhc2VQaWVjZVxuXHRcdFx0fSA9IG5vcm1hbGl6ZVF1ZXJ5KG9yaWdpbmFsUGllY2UpO1xuXG5cdFx0XHRpZiAobm9ybWFsaXplZFBpZWNlKSB7XG5cdFx0XHRcdGlmICghdmFsdWVzKSB7XG5cdFx0XHRcdFx0dmFsdWVzID0gW107XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YWx1ZXMucHVzaCh7XG5cdFx0XHRcdFx0b3JpZ2luYWw6IG9yaWdpbmFsUGllY2UsXG5cdFx0XHRcdFx0b3JpZ2luYWxMb3dlcmNhc2U6IG9yaWdpbmFsUGllY2UudG9Mb3dlckNhc2UoKSxcblx0XHRcdFx0XHRwYXRoTm9ybWFsaXplZDogcGF0aE5vcm1hbGl6ZWRQaWVjZSxcblx0XHRcdFx0XHRub3JtYWxpemVkOiBub3JtYWxpemVkUGllY2UsXG5cdFx0XHRcdFx0bm9ybWFsaXplZExvd2VyY2FzZTogbm9ybWFsaXplZExvd2VyY2FzZVBpZWNlLFxuXHRcdFx0XHRcdGV4cGVjdENvbnRpZ3VvdXNNYXRjaDogZXhwZWN0RXhhY3RNYXRjaFBpZWNlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiB7IG9yaWdpbmFsLCBvcmlnaW5hbExvd2VyY2FzZSwgcGF0aE5vcm1hbGl6ZWQsIG5vcm1hbGl6ZWQsIG5vcm1hbGl6ZWRMb3dlcmNhc2UsIHZhbHVlcywgY29udGFpbnNQYXRoU2VwYXJhdG9yLCBleHBlY3RDb250aWd1b3VzTWF0Y2g6IGV4cGVjdEV4YWN0TWF0Y2ggfTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUXVlcnkob3JpZ2luYWw6IHN0cmluZyk6IHsgcGF0aE5vcm1hbGl6ZWQ6IHN0cmluZzsgbm9ybWFsaXplZDogc3RyaW5nOyBub3JtYWxpemVkTG93ZXJjYXNlOiBzdHJpbmcgfSB7XG5cdGxldCBwYXRoTm9ybWFsaXplZDogc3RyaW5nO1xuXHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0cGF0aE5vcm1hbGl6ZWQgPSBvcmlnaW5hbC5yZXBsYWNlKC9cXC8vZywgc2VwKTsgLy8gSGVscCBXaW5kb3dzIHVzZXJzIHRvIHNlYXJjaCBmb3IgcGF0aHMgd2hlbiB1c2luZyBzbGFzaFxuXHR9IGVsc2Uge1xuXHRcdHBhdGhOb3JtYWxpemVkID0gb3JpZ2luYWwucmVwbGFjZSgvXFxcXC9nLCBzZXApOyAvLyBIZWxwIG1hY09TL0xpbnV4IHVzZXJzIHRvIHNlYXJjaCBmb3IgcGF0aHMgd2hlbiB1c2luZyBiYWNrc2xhc2hcblx0fVxuXG5cdC8vIHdlIHJlbW92ZSBxdW90ZXMgaGVyZSBiZWNhdXNlIHF1b3RlcyBhcmUgdXNlZCBmb3IgZXhhY3QgbWF0Y2ggc2VhcmNoXG5cdGNvbnN0IG5vcm1hbGl6ZWQgPSBzdHJpcFdpbGRjYXJkcyhwYXRoTm9ybWFsaXplZCkucmVwbGFjZSgvXFxzfFwiL2csICcnKTtcblxuXHRyZXR1cm4ge1xuXHRcdHBhdGhOb3JtYWxpemVkLFxuXHRcdG5vcm1hbGl6ZWQsXG5cdFx0bm9ybWFsaXplZExvd2VyY2FzZTogbm9ybWFsaXplZC50b0xvd2VyQ2FzZSgpXG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwaWVjZVRvUXVlcnkocGllY2U6IElQcmVwYXJlZFF1ZXJ5UGllY2UpOiBJUHJlcGFyZWRRdWVyeTtcbmV4cG9ydCBmdW5jdGlvbiBwaWVjZVRvUXVlcnkocGllY2VzOiBJUHJlcGFyZWRRdWVyeVBpZWNlW10pOiBJUHJlcGFyZWRRdWVyeTtcbmV4cG9ydCBmdW5jdGlvbiBwaWVjZVRvUXVlcnkoYXJnMTogSVByZXBhcmVkUXVlcnlQaWVjZSB8IElQcmVwYXJlZFF1ZXJ5UGllY2VbXSk6IElQcmVwYXJlZFF1ZXJ5IHtcblx0aWYgKEFycmF5LmlzQXJyYXkoYXJnMSkpIHtcblx0XHRyZXR1cm4gcHJlcGFyZVF1ZXJ5KGFyZzEubWFwKHBpZWNlID0+IHBpZWNlLm9yaWdpbmFsKS5qb2luKE1VTFRJUExFX1FVRVJZX1ZBTFVFU19TRVBBUkFUT1IpKTtcblx0fVxuXG5cdHJldHVybiBwcmVwYXJlUXVlcnkoYXJnMS5vcmlnaW5hbCk7XG59XG5cbi8vI2VuZHJlZ2lvblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxpQkFBaUIsb0JBQW9CLFlBQW9CLFNBQVMscUJBQXFCO0FBQ2hHLFNBQVMsWUFBWTtBQUNyQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxTQUFTLGlCQUFpQjtBQUNuQyxTQUFTLGtCQUFrQixzQkFBc0I7QUFPakQsTUFBTSxXQUFXO0FBQ2pCLE1BQU0sV0FBdUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUtuQyxTQUFTLFdBQVcsUUFBZ0IsT0FBZSxZQUFvQiwyQkFBZ0Q7QUFDN0gsTUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPO0FBQ3RCLFdBQU87QUFBQSxFQUNSO0FBRUEsUUFBTSxlQUFlLE9BQU87QUFDNUIsUUFBTSxjQUFjLE1BQU07QUFFMUIsTUFBSSxlQUFlLGFBQWE7QUFDL0IsV0FBTztBQUFBLEVBQ1I7QUFNQSxRQUFNLGNBQWMsT0FBTyxZQUFZO0FBQ3ZDLFFBQU0sTUFBTSxhQUFhLE9BQU8sWUFBWSxhQUFhLFFBQVEsYUFBYSxjQUFjLHlCQUF5QjtBQU9ySCxTQUFPO0FBQ1I7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O0FBQ25GLFFBQU0sd0JBQXdCLGVBQWUsUUFBUSxHQUFHLEtBQUs7QUFDN0QsUUFBTSxtQkFBbUIsdUJBQXVCLFFBQVE7QUFFeEQsTUFBSSxTQUE0QztBQUVoRCxRQUFNLGdCQUFnQixTQUFTLE1BQU0sK0JBQStCO0FBQ3BFLE1BQUksY0FBYyxTQUFTLEdBQUc7QUFDN0IsZUFBVyxpQkFBaUIsZUFBZTtBQUMxQyxZQUFNLHdCQUF3Qix1QkFBdUIsYUFBYTtBQUNsRSxZQUFNO0FBQUEsUUFDTCxnQkFBZ0I7QUFBQSxRQUNoQixZQUFZO0FBQUEsUUFDWixxQkFBcUI7QUFBQSxNQUN0QixJQUFJLGVBQWUsYUFBYTtBQUVoQyxVQUFJLGlCQUFpQjtBQUNwQixZQUFJLENBQUMsUUFBUTtBQUNaLG1CQUFTLENBQUM7QUFBQSxRQUNYO0FBRUEsZUFBTyxLQUFLO0FBQUEsVUFDWCxVQUFVO0FBQUEsVUFDVixtQkFBbUIsY0FBYyxZQUFZO0FBQUEsVUFDN0MsZ0JBQWdCO0FBQUEsVUFDaEIsWUFBWTtBQUFBLFVBQ1oscUJBQXFCO0FBQUEsVUFDckIsdUJBQXVCO0FBQUEsUUFDeEIsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLFNBQU8sRUFBRSxVQUFVLG1CQUFtQixnQkFBZ0IsWUFBWSxxQkFBcUIsUUFBUSx1QkFBdUIsdUJBQXVCLGlCQUFpQjtBQUMvSjtBQUVBLFNBQVMsZUFBZSxVQUErRjtBQUN0SCxNQUFJO0FBQ0osTUFBSSxXQUFXO0FBQ2QscUJBQWlCLFNBQVMsUUFBUSxPQUFPLEdBQUc7QUFBQSxFQUM3QyxPQUFPO0FBQ04scUJBQWlCLFNBQVMsUUFBUSxPQUFPLEdBQUc7QUFBQSxFQUM3QztBQUdBLFFBQU0sYUFBYSxlQUFlLGNBQWMsRUFBRSxRQUFRLFNBQVMsRUFBRTtBQUVyRSxTQUFPO0FBQUEsSUFDTjtBQUFBLElBQ0E7QUFBQSxJQUNBLHFCQUFxQixXQUFXLFlBQVk7QUFBQSxFQUM3QztBQUNEO0FBSU8sU0FBUyxhQUFhLE1BQW1FO0FBQy9GLE1BQUksTUFBTSxRQUFRLElBQUksR0FBRztBQUN4QixXQUFPLGFBQWEsS0FBSyxJQUFJLFdBQVMsTUFBTSxRQUFRLEVBQUUsS0FBSywrQkFBK0IsQ0FBQztBQUFBLEVBQzVGO0FBRUEsU0FBTyxhQUFhLEtBQUssUUFBUTtBQUNsQzsiLAogICJuYW1lcyI6IFsicXVlcnlJbmRleCIsICJ0YXJnZXRJbmRleCJdCn0K
