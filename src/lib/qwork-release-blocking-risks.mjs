import { createHash } from 'node:crypto';

export const QWORK_RELEASE_BLOCKING_RISK_SCHEMA = 'qbot-qwork-release-blocking-risk-attestation/v4';
export const QWORK_MR1552_EXECUTION_RUNNER_RISK_ID = 'deepbankv2-mr-1552-execution-runner-isolation/v1';
export const QWORK_MR1552_MERGE_COMMIT_SHA = '0720d31baf1d53bfd61e5428173d39b59472cdb7';
export const QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID = 'deepbankv2-mr-1559-per-turn-utility-process/v1';
export const QWORK_MR1559_MERGE_COMMIT_SHA = '8de62614f6e0c5daa1e33d3357468967b958b006';
export const QWORK_MR1552_LEGACY_PROTECTED_PATHS = Object.freeze([
  'electron/execution-worker.cjs',
  'electron/host-core/agent/execution-worker-entry.cjs',
  'electron/host-core/agent/execution-worker-protocol.cjs',
  'electron/host-core/agent/execution-worker-supervisor.cjs',
  'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
  'server/qbot-core/engine/engine.mjs',
]);
export const QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS = Object.freeze([
  'electron/execution-worker.cjs',
  'electron/host-core/agent/execution-worker-entry.cjs',
  'electron/host-core/agent/execution-worker-manager.cjs',
  'electron/host-core/agent/execution-worker-supervisor.cjs',
  'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
  'electron/host-core/agent/desktop-host-context.cjs',
  'electron/host-core/agent/embed-execution-worker.cjs',
  'electron/host-core/agent/execution-worker-context-usage.cjs',
  'electron/host-core/agent/execution-worker-context-usage-lease.cjs',
]);
export const QWORK_RELEASE_BLOCKING_RISK_PROTECTED_PATHS = Object.freeze([
  ...new Set([...QWORK_MR1552_LEGACY_PROTECTED_PATHS, ...QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS]),
]);

export const QWORK_MR1552_FAILURE_IDS = Object.freeze([
  'execution_runner_clean_exit_terminal_missing',
  'execution_runner_pressure_admission_disconnected',
  'execution_runner_message_isolation_missing',
]);
export const QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY = Object.freeze({
  VERIFIED_APPLICABLE: 'VERIFIED_APPLICABLE',
  VERIFIED_NOT_APPLICABLE: 'VERIFIED_NOT_APPLICABLE',
  UNKNOWN: 'UNKNOWN',
});

const RELEASE_ANCESTRY_UNKNOWN = 'release_ancestry_unknown';
const SUCCESSOR_ANCESTRY_UNKNOWN = 'successor_ancestry_unknown';

const HEX40 = /^[a-f0-9]{40}$/iu;
const HEX64 = /^[a-f0-9]{64}$/iu;

function text(value) {
  return String(value ?? '').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function gitBlobSha1(bytes) {
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}

function strictBase64Decode(value) {
  const normalized = String(value || '').replace(/\s+/gu, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('file_content_base64_invalid');
  }
  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.toString('base64') !== normalized) throw new Error('file_content_base64_noncanonical');
  return bytes;
}

function observeFile(file, expectedPath, releaseHead, failures) {
  const payload = file?.payload && typeof file.payload === 'object' ? file.payload : file;
  const prefix = `release_file:${expectedPath}`;
  const directSource = typeof file?.source === 'string' ? file.source : null;
  const error = text(file?.error);
  let bytes = Buffer.alloc(0);
  if (error) failures.push(`${prefix}:read_failed`);
  if (directSource !== null) {
    bytes = Buffer.from(directSource, 'utf8');
  } else if (!error) {
    if (text(payload?.file_path) !== expectedPath) failures.push(`${prefix}:path_mismatch`);
    if (text(file?.requested_ref) !== releaseHead) failures.push(`${prefix}:requested_ref_mismatch`);
    if (text(payload?.ref) !== releaseHead) failures.push(`${prefix}:ref_mismatch`);
    if (text(payload?.commit_id) !== releaseHead) failures.push(`${prefix}:commit_id_mismatch`);
    if (!HEX40.test(text(payload?.blob_id))) failures.push(`${prefix}:blob_id_invalid`);
    if (!HEX40.test(text(payload?.last_commit_id))) failures.push(`${prefix}:last_commit_id_invalid`);
    if (text(payload?.encoding).toLowerCase() !== 'base64') failures.push(`${prefix}:encoding_mismatch`);
    try {
      bytes = strictBase64Decode(payload?.content);
    } catch (decodeError) {
      failures.push(`${prefix}:${text(decodeError?.message) || 'decode_failed'}`);
    }
    if (!Number.isSafeInteger(Number(payload?.size)) || Number(payload?.size) !== bytes.length) {
      failures.push(`${prefix}:size_mismatch`);
    }
    if (bytes.length && HEX40.test(text(payload?.blob_id)) && text(payload.blob_id).toLowerCase() !== gitBlobSha1(bytes)) {
      failures.push(`${prefix}:blob_id_content_mismatch`);
    }
  }
  if (!bytes.length) failures.push(`${prefix}:content_empty`);
  return {
    source: bytes.toString('utf8'),
    observation: {
      path: expectedPath,
      requested_ref: directSource !== null ? releaseHead : text(file?.requested_ref),
      ref: directSource !== null ? releaseHead : text(payload?.ref),
      commit_id: directSource !== null ? releaseHead : text(payload?.commit_id),
      blob_id: directSource !== null ? gitBlobSha1(bytes) : text(payload?.blob_id),
      last_commit_id: directSource !== null ? releaseHead : text(payload?.last_commit_id),
      encoding: bytes.length ? 'base64' : text(payload?.encoding).toLowerCase(),
      bytes: bytes.length,
      sha256: bytes.length ? sha256(bytes) : '',
      content_base64: bytes.length ? bytes.toString('base64') : '',
      error,
    },
  };
}

function extractBalancedCall(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const brace = source.indexOf('{', start);
  if (brace < 0) return '';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(brace + 1, index);
    }
  }
  return '';
}

const REGEX_PREFIX_IDENTIFIERS = new Set([
  'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of', 'return',
  'throw', 'typeof', 'void', 'yield',
]);
const REGEX_PREFIX_PUNCTUATORS = new Set([
  '(', '[', '{', ',', ';', ':', '=', '=>', '!', '?', '??', '&&', '||', '+', '-',
  '*', '%', '&', '|', '^', '~', '<', '>', '<=', '>=', '==', '===', '!=', '!==',
]);
const NON_METHOD_IDENTIFIERS = new Set([
  'catch', 'for', 'if', 'switch', 'while', 'with',
]);
const MULTI_CHAR_PUNCTUATORS = Object.freeze([
  '===', '!==', '>>>', '**=', '&&=', '||=', '??=', '=>', '?.', '==', '!=', '<=', '>=',
  '++', '--', '&&', '||', '??', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**',
  '<<', '>>', '...',
]);

function regexLiteralCanStart(tokens, tokenFloor = 0) {
  const previous = tokens.length > tokenFloor ? tokens.at(-1) : null;
  if (!previous) return true;
  if (previous.type === 'identifier') return REGEX_PREFIX_IDENTIFIERS.has(previous.value);
  return previous.type === 'punctuator' && REGEX_PREFIX_PUNCTUATORS.has(previous.value);
}

// The successor risk audit needs syntax ownership, not text occurrence. This
// deliberately small lexer retains identifiers, numbers, string values and
// punctuators while discarding comments, template text and regex bodies. Code
// inside template interpolation remains executable and is tokenized recursively.
function tokenizeJavascriptForRiskAudit(source) {
  const input = String(source || '');
  const tokens = [];
  const push = (type, value, start, end) => tokens.push({ type, value, start, end });
  const scanCode = (start, limit, stopAtTemplateBrace = false) => {
    let index = start;
    let braceDepth = 0;
    const tokenFloor = tokens.length;
    while (index < limit) {
      const char = input[index];
      if (stopAtTemplateBrace && char === '}' && braceDepth === 0) return index + 1;
      if (/\s/u.test(char)) {
        index += 1;
        continue;
      }
      if (char === '/' && input[index + 1] === '/') {
        index += 2;
        while (index < limit && input[index] !== '\n' && input[index] !== '\r') index += 1;
        continue;
      }
      if (char === '/' && input[index + 1] === '*') {
        index += 2;
        while (index < limit && !(input[index] === '*' && input[index + 1] === '/')) index += 1;
        index = Math.min(limit, index + 2);
        continue;
      }
      if (char === '"' || char === "'") {
        const stringStart = index;
        const quote = char;
        let value = '';
        index += 1;
        while (index < limit) {
          const current = input[index];
          if (current === '\\') {
            if (index + 1 < limit) value += input[index + 1];
            index += 2;
            continue;
          }
          if (current === quote) {
            index += 1;
            break;
          }
          value += current;
          index += 1;
        }
        push('string', value, stringStart, index);
        continue;
      }
      if (char === '`') {
        index += 1;
        while (index < limit) {
          if (input[index] === '\\') {
            index += 2;
            continue;
          }
          if (input[index] === '`') {
            index += 1;
            break;
          }
          if (input[index] === '$' && input[index + 1] === '{') {
            index = scanCode(index + 2, limit, true);
            continue;
          }
          index += 1;
        }
        continue;
      }
      if (char === '/' && regexLiteralCanStart(tokens, tokenFloor)) {
        index += 1;
        let inCharacterClass = false;
        while (index < limit) {
          if (input[index] === '\\') {
            index += 2;
            continue;
          }
          if (input[index] === '[') inCharacterClass = true;
          else if (input[index] === ']') inCharacterClass = false;
          else if (input[index] === '/' && !inCharacterClass) {
            index += 1;
            while (/[A-Za-z]/u.test(input[index] || '')) index += 1;
            break;
          }
          index += 1;
        }
        continue;
      }
      if (/[A-Za-z_$]/u.test(char)) {
        const tokenStart = index;
        index += 1;
        while (/[A-Za-z0-9_$]/u.test(input[index] || '')) index += 1;
        push('identifier', input.slice(tokenStart, index), tokenStart, index);
        continue;
      }
      if (/[0-9]/u.test(char)) {
        const tokenStart = index;
        index += 1;
        while (/[A-Za-z0-9_.]/u.test(input[index] || '')) index += 1;
        push('number', input.slice(tokenStart, index), tokenStart, index);
        continue;
      }
      const punctuator = MULTI_CHAR_PUNCTUATORS.find((candidate) => input.startsWith(candidate, index)) || char;
      push('punctuator', punctuator, index, index + punctuator.length);
      if (punctuator === '{') braceDepth += 1;
      else if (punctuator === '}') braceDepth -= 1;
      index += punctuator.length;
    }
    return index;
  };
  scanCode(0, input.length);
  return tokens.map((token, tokenIndex) => ({ ...token, index: tokenIndex }));
}

function matchingTokenIndex(tokens, startIndex, open = '(', close = ')', limit = tokens.length) {
  if (tokens[startIndex]?.value !== open) return -1;
  let depth = 0;
  for (let index = startIndex; index < limit; index += 1) {
    if (tokens[index].value === open) depth += 1;
    else if (tokens[index].value === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function matchingOpenTokenIndex(tokens, closeIndex, open = '(', close = ')') {
  if (tokens[closeIndex]?.value !== close) return -1;
  let depth = 0;
  for (let index = closeIndex; index >= 0; index -= 1) {
    if (tokens[index].value === close) depth += 1;
    else if (tokens[index].value === open) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function definitelyFalseCondition(tokens, openIndex, closeIndex) {
  const condition = tokens.slice(openIndex + 1, closeIndex);
  return condition.length === 1 && (
    (condition[0]?.type === 'identifier' && condition[0].value === 'false')
    || (condition[0]?.type === 'number' && Number(condition[0].value) === 0)
  );
}

function conditionallyGuardedTerminator(tokens, index) {
  if (tokens[index - 1]?.value === 'else') return true;
  if (tokens[index - 1]?.value !== ')') return false;
  const conditionOpen = matchingOpenTokenIndex(tokens, index - 1);
  return conditionOpen > 0 && ['if', 'for', 'while', 'with'].includes(tokens[conditionOpen - 1]?.value);
}

function statementTerminatorIndex(tokens, startIndex, limit) {
  let roundDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = startIndex + 1; index < limit; index += 1) {
    const value = tokens[index].value;
    if (value === '(') roundDepth += 1;
    else if (value === ')') roundDepth -= 1;
    else if (value === '{') braceDepth += 1;
    else if (value === '}') braceDepth -= 1;
    else if (value === '[') bracketDepth += 1;
    else if (value === ']') bracketDepth -= 1;
    else if (value === ';' && roundDepth === 0 && braceDepth === 0 && bracketDepth === 0) return index;
  }
  return -1;
}

function reachableTokens(tokens) {
  const reachable = tokens.map(() => true);
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== 'if' || tokens[index + 1]?.value !== '(') continue;
    const conditionClose = matchingTokenIndex(tokens, index + 1);
    const bodyOpen = conditionClose + 1;
    if (conditionClose < 0 || tokens[bodyOpen]?.value !== '{'
      || !definitelyFalseCondition(tokens, index + 1, conditionClose)) continue;
    const bodyClose = matchingTokenIndex(tokens, bodyOpen, '{', '}');
    if (bodyClose < 0) continue;
    for (let cursor = bodyOpen + 1; cursor < bodyClose; cursor += 1) reachable[cursor] = false;
  }

  const blockStack = [-1];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value === '{') {
      blockStack.push(index);
      continue;
    }
    if (tokens[index]?.value === '}') {
      blockStack.pop();
      continue;
    }
    if (!reachable[index] || !['return', 'throw'].includes(tokens[index]?.value)
      || blockStack.length === 0 || conditionallyGuardedTerminator(tokens, index)) continue;
    const blockOpen = blockStack.at(-1);
    const blockClose = blockOpen === -1
      ? tokens.length
      : matchingTokenIndex(tokens, blockOpen, '{', '}');
    const statementEnd = statementTerminatorIndex(tokens, index, blockClose);
    if (blockClose < 0 || statementEnd < 0) continue;
    for (let cursor = statementEnd + 1; cursor < blockClose; cursor += 1) reachable[cursor] = false;
  }
  return tokens.filter((_, index) => reachable[index]);
}

function arrowFunctionName(tokens, arrowIndex) {
  let beforeParameters = arrowIndex - 1;
  if (tokens[beforeParameters]?.value === ')') {
    beforeParameters = matchingOpenTokenIndex(tokens, beforeParameters) - 1;
  } else if (tokens[beforeParameters]?.type === 'identifier') {
    beforeParameters -= 1;
  }
  if (tokens[beforeParameters]?.value === 'async') beforeParameters -= 1;
  if (tokens[beforeParameters]?.value === '=' || tokens[beforeParameters]?.value === ':') {
    return tokens[beforeParameters - 1]?.type === 'identifier' ? tokens[beforeParameters - 1].value : '';
  }
  return '';
}

function collectFunctionScopes(tokens) {
  const scopes = [];
  const seenBodies = new Set();
  const addScope = (name, bodyOpen, bodyClose, kind) => {
    if (!name || bodyOpen < 0 || bodyClose < 0 || seenBodies.has(bodyOpen)) return;
    seenBodies.add(bodyOpen);
    scopes.push({ name, body_open: bodyOpen, body_close: bodyClose, kind, parent: null });
  };
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === 'function') {
      let cursor = index + 1;
      if (tokens[cursor]?.value === '*') cursor += 1;
      const name = tokens[cursor]?.type === 'identifier' ? tokens[cursor].value : '';
      if (!name) continue;
      cursor += 1;
      if (tokens[cursor]?.value !== '(') continue;
      const parametersClose = matchingTokenIndex(tokens, cursor);
      const bodyOpen = parametersClose + 1;
      const bodyClose = matchingTokenIndex(tokens, bodyOpen, '{', '}');
      addScope(name, bodyOpen, bodyClose, 'function');
      continue;
    }
    if (tokens[index].value === '=>' && tokens[index + 1]?.value === '{') {
      const bodyOpen = index + 1;
      addScope(
        arrowFunctionName(tokens, index),
        bodyOpen,
        matchingTokenIndex(tokens, bodyOpen, '{', '}'),
        'arrow',
      );
      continue;
    }
    if (tokens[index].type === 'identifier'
      && !NON_METHOD_IDENTIFIERS.has(tokens[index].value)
      && tokens[index + 1]?.value === '(') {
      const parametersClose = matchingTokenIndex(tokens, index + 1);
      const bodyOpen = parametersClose + 1;
      const previous = tokens[index - 1]?.value;
      if (tokens[bodyOpen]?.value === '{' && previous !== '.' && previous !== '?.' && previous !== 'function') {
        addScope(tokens[index].value, bodyOpen, matchingTokenIndex(tokens, bodyOpen, '{', '}'), 'method');
      }
    }
  }
  for (const scope of scopes) {
    scope.parent = scopes
      .filter((candidate) => candidate !== scope
        && candidate.body_open < scope.body_open
        && candidate.body_close > scope.body_close)
      .sort((left, right) => (left.body_close - left.body_open) - (right.body_close - right.body_open))[0] || null;
  }
  return scopes;
}

function tokensOwnedByScope(tokens, scope, scopes) {
  const nested = scopes.filter((candidate) => candidate !== scope
    && candidate.body_open > scope.body_open
    && candidate.body_close < scope.body_close);
  const owned = [];
  let skipped = false;
  for (let index = scope.body_open + 1; index < scope.body_close; index += 1) {
    if (nested.some((candidate) => index >= candidate.body_open && index <= candidate.body_close)) {
      if (!skipped) owned.push({ type: 'boundary', value: '<function>', index: -1 });
      skipped = true;
      continue;
    }
    skipped = false;
    owned.push(tokens[index]);
  }
  return owned;
}

function callAt(tokens, startIndex) {
  if (tokens[startIndex]?.type !== 'identifier') return null;
  const path = [tokens[startIndex].value];
  let cursor = startIndex + 1;
  while ((tokens[cursor]?.value === '.' || tokens[cursor]?.value === '?.')
    && tokens[cursor + 1]?.type === 'identifier') {
    path.push(tokens[cursor + 1].value);
    cursor += 2;
  }
  if (tokens[cursor]?.value === '?.') cursor += 1;
  if (tokens[cursor]?.value !== '(') return null;
  const close = matchingTokenIndex(tokens, cursor);
  return close < 0 ? null : { start: startIndex, open: cursor, close, path };
}

function callsInTokens(tokens) {
  const calls = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const call = callAt(tokens, index);
    if (call) calls.push(call);
  }
  return calls;
}

function callPathEndsWith(call, suffix) {
  return suffix.length <= call.path.length
    && suffix.every((part, index) => call.path[call.path.length - suffix.length + index] === part);
}

function splitCallArguments(tokens, call) {
  const ranges = [];
  let start = call.open + 1;
  let roundDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = start; index < call.close; index += 1) {
    const value = tokens[index].value;
    if (value === '(') roundDepth += 1;
    else if (value === ')') roundDepth -= 1;
    else if (value === '{') braceDepth += 1;
    else if (value === '}') braceDepth -= 1;
    else if (value === '[') bracketDepth += 1;
    else if (value === ']') bracketDepth -= 1;
    else if (value === ',' && roundDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      ranges.push([start, index]);
      start = index + 1;
    }
  }
  if (start < call.close) ranges.push([start, call.close]);
  return ranges;
}

function callHasIdentifierArguments(tokens, call, expected) {
  const arguments_ = splitCallArguments(tokens, call);
  if (arguments_.length < expected.length) return false;
  return expected.every((name, index) => {
    const [start, end] = arguments_[index];
    return end - start === 1 && tokens[start]?.type === 'identifier' && tokens[start].value === name;
  });
}

function identifierArguments(tokens, call) {
  const ranges = splitCallArguments(tokens, call);
  const values = [];
  for (const [start, end] of ranges) {
    if (end - start !== 1 || tokens[start]?.type !== 'identifier') return null;
    values.push(tokens[start].value);
  }
  return values;
}

function assignedIdentifierForCall(tokens, call) {
  let cursor = call.start - 1;
  if (tokens[cursor]?.value === 'await' || tokens[cursor]?.value === 'void') cursor -= 1;
  if (tokens[cursor]?.value !== '=' || tokens[cursor - 1]?.type !== 'identifier') return '';
  return tokens[cursor - 1].value;
}

function callIsAwaited(tokens, call) {
  return tokens[call.start - 1]?.value === 'await';
}

function callIsDirectlyReturned(tokens, call) {
  return tokens[call.start - 1]?.value === 'return';
}

function identifierArgument(tokens, call, index) {
  const range = splitCallArguments(tokens, call)[index];
  return range && range[1] - range[0] === 1 && tokens[range[0]]?.type === 'identifier'
    ? tokens[range[0]].value
    : '';
}

function topLevelRanges(tokens, start, end) {
  const ranges = [];
  let rangeStart = start;
  let roundDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = start; index < end; index += 1) {
    const value = tokens[index]?.value;
    if (value === '(') roundDepth += 1;
    else if (value === ')') roundDepth -= 1;
    else if (value === '{') braceDepth += 1;
    else if (value === '}') braceDepth -= 1;
    else if (value === '[') bracketDepth += 1;
    else if (value === ']') bracketDepth -= 1;
    else if (value === ',' && roundDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      if (rangeStart < index) ranges.push([rangeStart, index]);
      rangeStart = index + 1;
    }
  }
  if (rangeStart < end) ranges.push([rangeStart, end]);
  return ranges;
}

function objectProperties(tokens, objectOpen, objectClose) {
  if (tokens[objectOpen]?.value !== '{' || tokens[objectClose]?.value !== '}') return null;
  const properties = [];
  for (const [start, end] of topLevelRanges(tokens, objectOpen + 1, objectClose)) {
    if (tokens[start]?.value === '...') {
      properties.push({ spread: true, start, end, key: '', value_start: start + 1, value_end: end });
      continue;
    }
    let colon = -1;
    let roundDepth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    for (let index = start; index < end; index += 1) {
      const value = tokens[index]?.value;
      if (value === '(') roundDepth += 1;
      else if (value === ')') roundDepth -= 1;
      else if (value === '{') braceDepth += 1;
      else if (value === '}') braceDepth -= 1;
      else if (value === '[') bracketDepth += 1;
      else if (value === ']') bracketDepth -= 1;
      else if (value === ':' && roundDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
        colon = index;
        break;
      }
    }
    const keyToken = tokens[start];
    if (!keyToken || !['identifier', 'string'].includes(keyToken.type)) {
      properties.push({ spread: false, start, end, key: '', value_start: end, value_end: end });
      continue;
    }
    if (colon < 0) {
      properties.push({ spread: false, start, end, key: keyToken.value, value_start: start, value_end: end });
      continue;
    }
    properties.push({
      spread: false,
      start,
      end,
      key: keyToken.value,
      value_start: colon + 1,
      value_end: end,
    });
  }
  return properties;
}

function uniqueEffectiveProperty(properties, key) {
  const matches = properties.filter((property) => !property.spread && property.key === key);
  if (matches.length !== 1) return null;
  const [match] = matches;
  if (properties.some((property) => property.spread && property.start > match.start)) return null;
  return match;
}

function strictNumericPolicy(tokens, call) {
  const [first] = splitCallArguments(tokens, call);
  if (!first || tokens[first[0]]?.value !== '{') return { one_pending: false, no_restarts: false, same_call: false };
  const objectClose = matchingTokenIndex(tokens, first[0], '{', '}', first[1]);
  if (objectClose !== first[1] - 1) return { one_pending: false, no_restarts: false, same_call: false };
  const properties = objectProperties(tokens, first[0], objectClose) || [];
  const pending = uniqueEffectiveProperty(properties, 'maxPendingRequests');
  const restarts = uniqueEffectiveProperty(properties, 'maxRestarts');
  const hasTrailingComputedProperty = (property) => Boolean(property && properties.some((candidate) => (
    candidate.start > property.start
    && tokens[candidate.start]?.value === '['
  )));
  const onePending = Boolean(pending
    && !hasTrailingComputedProperty(pending)
    && pending.value_end - pending.value_start === 1
    && tokens[pending.value_start]?.type === 'number'
    && Number(tokens[pending.value_start].value) === 1);
  const noRestarts = Boolean(restarts
    && !hasTrailingComputedProperty(restarts)
    && restarts.value_end - restarts.value_start === 1
    && tokens[restarts.value_start]?.type === 'number'
    && Number(tokens[restarts.value_start].value) === 0);
  return { one_pending: onePending, no_restarts: noRestarts, same_call: onePending && noRestarts };
}

function simpleParameterNames(tokens, scope) {
  let open = -1;
  let close = -1;
  if (scope.kind === 'arrow') {
    const arrow = scope.body_open - 1;
    if (tokens[arrow]?.value !== '=>') return [];
    if (tokens[arrow - 1]?.value === ')') {
      close = arrow - 1;
      open = matchingOpenTokenIndex(tokens, close);
    } else if (tokens[arrow - 1]?.type === 'identifier') {
      return [tokens[arrow - 1].value];
    }
  } else if (tokens[scope.body_open - 1]?.value === ')') {
    close = scope.body_open - 1;
    open = matchingOpenTokenIndex(tokens, close);
  }
  if (open < 0 || close < 0) return [];
  return topLevelRanges(tokens, open + 1, close).map(([start, end]) => (
    tokens[start]?.type === 'identifier'
      && (end - start === 1 || tokens[start + 1]?.value === '=')
      ? tokens[start].value
      : ''
  ));
}

function expressionEnd(tokens, start, limit = tokens.length) {
  let roundDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = start; index < limit; index += 1) {
    const value = tokens[index]?.value;
    if (value === '(') roundDepth += 1;
    else if (value === ')') {
      if (roundDepth === 0) return index;
      roundDepth -= 1;
    } else if (value === '{') braceDepth += 1;
    else if (value === '}') {
      if (braceDepth === 0) return index;
      braceDepth -= 1;
    } else if (value === '[') bracketDepth += 1;
    else if (value === ']') bracketDepth -= 1;
    else if ((value === ';' || value === ',')
      && roundDepth === 0 && braceDepth === 0 && bracketDepth === 0) return index;
  }
  return limit;
}

function returnExpressionEnd(tokens, start, limit = tokens.length) {
  let roundDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = start; index < limit; index += 1) {
    const value = tokens[index]?.value;
    if (value === '(') roundDepth += 1;
    else if (value === ')') {
      if (roundDepth === 0) return index;
      roundDepth -= 1;
    } else if (value === '{') braceDepth += 1;
    else if (value === '}') {
      if (braceDepth === 0) return index;
      braceDepth -= 1;
    } else if (value === '[') bracketDepth += 1;
    else if (value === ']') bracketDepth -= 1;
    else if (value === ';' && roundDepth === 0 && braceDepth === 0 && bracketDepth === 0) return index;
  }
  return limit;
}

function assignmentExpression(tokens, variableName) {
  const matches = [];
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (tokens[index]?.type !== 'identifier' || tokens[index].value !== variableName
      || tokens[index + 1]?.value !== '=') continue;
    const end = expressionEnd(tokens, index + 2);
    matches.push({
      assignment_start: index,
      declaration_kind: ['const', 'let', 'var'].includes(tokens[index - 1]?.value)
        ? tokens[index - 1].value : '',
      expression_start: index + 2,
      expression_end: end,
    });
  }
  return matches.length === 1 ? matches[0] : null;
}

function rangeIsOnUnconditionalPath(tokens, start, end) {
  return !conditionalBranchRanges(tokens).some(([branchStart, branchEnd]) => (
    start >= branchStart && end <= branchEnd
  ));
}

function rangeContainsMember(tokens, start, end, baseName, propertyName) {
  for (let index = start; index + 2 < end; index += 1) {
    if (tokens[index]?.type === 'identifier' && tokens[index].value === baseName
      && ['.', '?.'].includes(tokens[index + 1]?.value)
      && tokens[index + 2]?.type === 'identifier'
      && tokens[index + 2].value === propertyName) return true;
  }
  return false;
}

function withoutWholeExpressionParentheses(tokens) {
  let expression = tokens;
  while (expression[0]?.value === '(') {
    const close = matchingTokenIndex(expression, 0);
    if (close !== expression.length - 1) break;
    expression = expression.slice(1, -1);
  }
  return expression;
}

function expressionIsIdentityRequestId(tokens, identityName) {
  const expression = withoutWholeExpressionParentheses(tokens);
  const memberLength = expression[0]?.value === identityName
    && ['.', '?.'].includes(expression[1]?.value)
    && expression[2]?.value === 'requestId'
    ? 3
    : 0;
  if (memberLength && expression.length === memberLength) return true;
  if (memberLength
    && expression.length === memberLength + 2
    && ['||', '??'].includes(expression[memberLength]?.value)
    && expression[memberLength + 1]?.type === 'string'
    && expression[memberLength + 1].value === '') return true;

  const stringCall = callAt(expression, 0);
  if (!stringCall
    || stringCall.path.length !== 1
    || stringCall.path[0] !== 'String'
    || expression[stringCall.close + 1]?.value !== '.'
    || expression[stringCall.close + 2]?.value !== 'trim'
    || expression[stringCall.close + 3]?.value !== '('
    || expression[stringCall.close + 4]?.value !== ')'
    || stringCall.close + 5 !== expression.length) return false;
  const arguments_ = splitCallArguments(expression, stringCall);
  return arguments_.length === 1
    && expressionIsIdentityRequestId(
      expression.slice(arguments_[0][0], arguments_[0][1]), identityName,
    );
}

function uniqueScope(scopes, name, parent = undefined) {
  const matches = scopes.filter((scope) => scope.name === name
    && (parent === undefined || scope.parent === parent));
  return matches.length === 1 ? matches[0] : null;
}

function scopeReachableTokens(tokens, scope, scopes) {
  return reachableTokens(tokensOwnedByScope(tokens, scope, scopes));
}

function helperReturnsIdentityRequestId(tokens, scopes, helper, identityParameter) {
  const owned = scopeReachableTokens(tokens, helper, scopes);
  const returns = [];
  for (let index = 0; index < owned.length; index += 1) {
    if (owned[index]?.value !== 'return') continue;
    const end = returnExpressionEnd(owned, index + 1);
    returns.push([index, index + 1, end]);
  }
  if (!returns.length) return false;
  return returns.every(([returnIndex, start, end]) => {
    if (end <= start) return false;
    if (expressionIsIdentityRequestId(owned.slice(start, end), identityParameter)) return true;
    if (end - start !== 1 || owned[start]?.type !== 'identifier') return false;
    const assignment = assignmentExpression(owned, owned[start].value);
    return Boolean(assignment
      && assignment.declaration_kind
      && assignment.expression_end <= returnIndex
      && rangeIsOnUnconditionalPath(
        owned, assignment.assignment_start, assignment.expression_end,
      )
      && expressionIsIdentityRequestId(
        owned.slice(assignment.expression_start, assignment.expression_end), identityParameter,
      ));
  });
}

function variableDerivesFromIdentityRequestId(
  tokens, scopes, owned, variableName, identityName, beforeIndex = owned.length,
) {
  const assignment = assignmentExpression(owned, variableName);
  if (!assignment
    || !assignment.declaration_kind
    || assignment.expression_end > beforeIndex
    || !rangeIsOnUnconditionalPath(
      owned, assignment.assignment_start, assignment.expression_end,
    )) return false;
  const expression = withoutWholeExpressionParentheses(
    owned.slice(assignment.expression_start, assignment.expression_end),
  );
  if (expressionIsIdentityRequestId(expression, identityName)) return true;
  const helperCalls = callsInTokens(expression).filter((call) => call.path.length === 1
    && uniqueScope(scopes, call.path[0]));
  if (helperCalls.length !== 1) return false;
  const [call] = helperCalls;
  if (call.start !== 0 || call.close !== expression.length - 1) return false;
  const helper = uniqueScope(scopes, call.path[0]);
  const helperParameters = simpleParameterNames(tokens, helper);
  const identityIndex = splitCallArguments(expression, call)
    .findIndex(([start, end]) => end - start === 1 && expression[start]?.value === identityName);
  return identityIndex >= 0
    && Boolean(helperParameters[identityIndex])
    && helperReturnsIdentityRequestId(tokens, scopes, helper, helperParameters[identityIndex]);
}

function returnedObjectProperties(tokens, scope, scopes) {
  const owned = scopeReachableTokens(tokens, scope, scopes);
  const candidates = [];
  for (let index = 0; index < owned.length; index += 1) {
    if (owned[index]?.value !== 'return') continue;
    let objectOpen = index + 1;
    if (owned[objectOpen]?.value !== '{') {
      const wrapperCall = callAt(owned, objectOpen);
      if (!wrapperCall || !callPathEndsWith(wrapperCall, ['Object', 'freeze'])) continue;
      const [first] = splitCallArguments(owned, wrapperCall);
      if (!first || owned[first[0]]?.value !== '{') continue;
      objectOpen = first[0];
    }
    const objectClose = matchingTokenIndex(owned, objectOpen, '{', '}');
    if (objectClose < 0) continue;
    candidates.push({
      owned,
      return_index: index,
      object_open: objectOpen,
      object_close: objectClose,
      properties: objectProperties(owned, objectOpen, objectClose) || [],
    });
  }
  return candidates;
}

function arrowDelegate(tokens, property, scopes) {
  const value = tokens.slice(property.value_start, property.value_end);
  const arrow = value.findIndex((token) => token.value === '=>');
  if (arrow < 0) return null;
  let publicParameters = [];
  if (value[arrow - 1]?.value === ')') {
    const open = matchingOpenTokenIndex(value, arrow - 1);
    if (open < 0) return null;
    publicParameters = topLevelRanges(value, open + 1, arrow - 1).map(([start, end]) => (
      end - start === 1 && value[start]?.type === 'identifier' ? value[start].value : ''
    ));
  } else if (value[arrow - 1]?.type === 'identifier') {
    publicParameters = [value[arrow - 1].value];
  }
  let expression = value.slice(arrow + 1);
  if (expression[0]?.value === '{') {
    const close = matchingTokenIndex(expression, 0, '{', '}');
    if (close !== expression.length - 1) return null;
    expression = expression.slice(1, close);
    if (expression.at(-1)?.value === ';') expression = expression.slice(0, -1);
    if (expression[0]?.value !== 'return') return null;
    expression = expression.slice(1);
  }
  expression = withoutWholeExpressionParentheses(expression);
  if (expression[0]?.value === 'await') expression = expression.slice(1);
  const call = callAt(expression, 0);
  if (!call
    || call.close !== expression.length - 1
    || call.path.length !== 1
    || !uniqueScope(scopes, call.path[0])) return null;
  return {
    helper: uniqueScope(scopes, call.path[0]),
    helper_name: call.path[0],
    arguments: splitCallArguments(expression, call).map(([start, end]) => (
      end - start === 1 && expression[start]?.type === 'identifier'
        ? expression[start].value : ''
    )),
    public_parameters: publicParameters,
  };
}

function creatorOwnsManagerBinding(tokens, creator, scopes, managerName, returnedObject) {
  const assignmentOperators = new Set([
    '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '&&=', '||=', '??=', '++', '--',
  ]);
  const parameters = simpleParameterNames(tokens, creator);
  const owned = scopeReachableTokens(tokens, creator, scopes);
  const parameterBindings = parameters.filter((name) => name === managerName).length;
  const localBindings = owned.flatMap((token, index) => (
    token?.type === 'identifier'
    && token.value === managerName
    && owned[index + 1]?.value === '='
    && ['const', 'let', 'var'].includes(owned[index - 1]?.value)
      ? [{ index, kind: owned[index - 1].value }]
      : []
  ));
  const writes = owned.flatMap((token, index) => {
    if (token?.type !== 'identifier' || token.value !== managerName) return [];
    if (assignmentOperators.has(owned[index + 1]?.value)
      || ['++', '--'].includes(owned[index - 1]?.value)) return [index];
    return [];
  });
  if (parameterBindings === 1 && localBindings.length === 0) return writes.length === 0;
  if (parameterBindings !== 0 || localBindings.length !== 1) return false;
  const [binding] = localBindings;
  return binding.kind === 'const'
    && binding.index < returnedObject.return_index
    && rangeIsOnUnconditionalPath(owned, binding.index, binding.index + 2)
    && writes.length === 1
    && writes[0] === binding.index;
}

function exportedAcquireImplementation(tokens, scopes) {
  const creator = uniqueScope(scopes, 'createExecutionWorkerManager');
  if (!creator) return null;
  const objects = returnedObjectProperties(tokens, creator, scopes).filter(({ properties }) => (
    properties.some((property) => property.key === 'acquire')
  ));
  if (objects.length !== 1) return null;
  const returnedObject = objects[0];
  const { owned, properties } = returnedObject;
  if (!rangeIsOnUnconditionalPath(
    owned, returnedObject.return_index, returnedObject.object_close,
  )) return null;
  const acquire = uniqueEffectiveProperty(properties, 'acquire');
  if (!acquire) return null;
  const delegate = arrowDelegate(owned, acquire, scopes);
  if (!delegate || !delegate.helper || delegate.public_parameters.length < 2) return null;
  const helperParameters = simpleParameterNames(tokens, delegate.helper);
  if (!helperParameters.length || helperParameters.length < delegate.arguments.length) return null;
  if (delegate.arguments.length !== delegate.public_parameters.length + 1
    || delegate.arguments.slice(1).join('\0') !== delegate.public_parameters.join('\0')) return null;
  const managerArgument = delegate.arguments[0];
  if (!managerArgument
    || helperParameters[0] !== managerArgument
    || !creatorOwnsManagerBinding(
      tokens, creator, scopes, managerArgument, returnedObject,
    )) return null;
  const identityArgument = delegate.public_parameters[1];
  const identityIndex = delegate.arguments.indexOf(identityArgument);
  if (identityIndex < 0 || !helperParameters[0] || !helperParameters[identityIndex]) return null;
  return {
    acquisition: delegate.helper,
    identity_name: helperParameters[identityIndex],
    manager_name: helperParameters[0],
  };
}

function pressureRejectionInIfBlock(tokens) {
  tokens = reachableTokens(tokens);
  const calls = callsInTokens(tokens);
  const pressureCode = 'execution_worker_pressure_admission_closed';
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== 'if' || tokens[index + 1]?.value !== '(') continue;
    const conditionClose = matchingTokenIndex(tokens, index + 1);
    const bodyOpen = conditionClose + 1;
    if (tokens[bodyOpen]?.value !== '{') continue;
    const bodyClose = matchingTokenIndex(tokens, bodyOpen, '{', '}');
    if (bodyClose < 0) continue;
    const branchCalls = calls.filter((call) => call.start > bodyOpen && call.close < bodyClose);
    const pressureCalls = branchCalls.filter((call) => {
      const [first] = splitCallArguments(tokens, call);
      return first && first[1] - first[0] === 1
        && tokens[first[0]]?.type === 'string'
        && tokens[first[0]].value === pressureCode;
    });
    if (pressureCalls.some((pressureCall) => (
      tokens[pressureCall.start - 1]?.value === 'throw'
      || branchCalls.some((outer) => callPathEndsWith(outer, ['reject'])
        && outer.open < pressureCall.start && outer.close > pressureCall.close)
    ))) return true;
    for (let cursor = bodyOpen + 1; cursor + 4 < bodyClose; cursor += 1) {
      const variable = tokens[cursor]?.type === 'identifier' ? tokens[cursor].value : '';
      if (!variable
        || tokens[cursor + 1]?.value !== '.'
        || tokens[cursor + 2]?.value !== 'code'
        || tokens[cursor + 3]?.value !== '='
        || tokens[cursor + 4]?.type !== 'string'
        || tokens[cursor + 4].value !== pressureCode) continue;
      for (let throwIndex = cursor + 5; throwIndex + 1 < bodyClose; throwIndex += 1) {
        if (tokens[throwIndex]?.value === 'throw' && tokens[throwIndex + 1]?.value === variable) return true;
      }
    }
  }
  return false;
}

function conditionalBranchRanges(tokens) {
  const ranges = [];
  const statementRange = (start) => {
    if (tokens[start]?.value === '{') {
      const close = matchingTokenIndex(tokens, start, '{', '}');
      return close < 0 ? null : [start + 1, close, close + 1];
    }
    const end = expressionEnd(tokens, start);
    return end <= start ? null : [start, end, Math.min(tokens.length, end + 1)];
  };
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== 'if' || tokens[index + 1]?.value !== '(') continue;
    const conditionClose = matchingTokenIndex(tokens, index + 1);
    if (conditionClose < 0) continue;
    const thenRange = statementRange(conditionClose + 1);
    if (!thenRange) continue;
    ranges.push([thenRange[0], thenRange[1]]);
    if (tokens[thenRange[2]]?.value !== 'else') continue;
    const elseRange = statementRange(thenRange[2] + 1);
    if (elseRange) ranges.push([elseRange[0], elseRange[1]]);
  }
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value === 'switch' && tokens[index + 1]?.value === '(') {
      const conditionClose = matchingTokenIndex(tokens, index + 1);
      const bodyOpen = conditionClose + 1;
      const bodyClose = matchingTokenIndex(tokens, bodyOpen, '{', '}');
      if (conditionClose >= 0 && bodyClose >= 0) ranges.push([bodyOpen + 1, bodyClose]);
    }
    if (tokens[index]?.value === '?') {
      let roundDepth = 0;
      let braceDepth = 0;
      let bracketDepth = 0;
      let nestedTernaries = 0;
      let colon = -1;
      for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
        const value = tokens[cursor]?.value;
        if (value === '(') roundDepth += 1;
        else if (value === ')') {
          if (roundDepth === 0) break;
          roundDepth -= 1;
        } else if (value === '{') braceDepth += 1;
        else if (value === '}') {
          if (braceDepth === 0) break;
          braceDepth -= 1;
        } else if (value === '[') bracketDepth += 1;
        else if (value === ']') {
          if (bracketDepth === 0) break;
          bracketDepth -= 1;
        } else if (roundDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
          if (value === '?') nestedTernaries += 1;
          else if (value === ':' && nestedTernaries === 0) {
            colon = cursor;
            break;
          } else if (value === ':') nestedTernaries -= 1;
          else if (value === ';') break;
        }
      }
      if (colon >= 0) {
        ranges.push([index + 1, colon]);
        ranges.push([colon + 1, expressionEnd(tokens, colon + 1)]);
      }
    }
    if (['&&', '||', '??'].includes(tokens[index]?.value)) {
      ranges.push([index + 1, expressionEnd(tokens, index + 1)]);
    }
  }
  return ranges;
}

function callIsOnUnconditionalPath(tokens, call) {
  return !conditionalBranchRanges(tokens).some(([start, end]) => call.start >= start && call.close <= end);
}

function trimWholeExpressionParentheses(tokens, start, end) {
  let expressionStart = start;
  let expressionEnd_ = end;
  while (tokens[expressionStart]?.value === '(') {
    const close = matchingTokenIndex(tokens, expressionStart);
    if (close !== expressionEnd_ - 1) break;
    expressionStart += 1;
    expressionEnd_ -= 1;
  }
  return [expressionStart, expressionEnd_];
}

function returnExpressionRanges(tokens) {
  const ranges = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== 'return') continue;
    ranges.push([index + 1, returnExpressionEnd(tokens, index + 1)]);
  }
  return ranges;
}

function expressionIsExactCall(tokens, start, end, call, { allowAwait = false } = {}) {
  [start, end] = trimWholeExpressionParentheses(tokens, start, end);
  if (allowAwait && tokens[start]?.value === 'await') {
    start += 1;
    [start, end] = trimWholeExpressionParentheses(tokens, start, end);
  }
  return call.start === start && call.close === end - 1;
}

function expressionArrowReturnsExactCall(tokens, start, end, call) {
  let arrow = -1;
  for (let index = start; index < end; index += 1) {
    if (tokens[index]?.value !== '=>') continue;
    if (arrow >= 0) return false;
    arrow = index;
  }
  if (arrow < 0 || call.start <= arrow) return false;
  let expressionStart = arrow + 1;
  if (tokens[expressionStart]?.value === '{') return false;
  [expressionStart, end] = trimWholeExpressionParentheses(tokens, expressionStart, end);
  if (tokens[expressionStart]?.value === 'await') {
    expressionStart += 1;
    [expressionStart, end] = trimWholeExpressionParentheses(tokens, expressionStart, end);
  }
  return expressionIsExactCall(tokens, expressionStart, end, call);
}

function returnedPromiseThenObservesCall(tokens, call) {
  for (const [rawStart, rawEnd] of returnExpressionRanges(tokens)) {
    let [start, end] = trimWholeExpressionParentheses(tokens, rawStart, rawEnd);
    const promiseResolve = callAt(tokens, start);
    if (!promiseResolve
      || promiseResolve.path.join('.') !== 'Promise.resolve'
      || promiseResolve.close + 2 >= end
      || tokens[promiseResolve.close + 1]?.value !== '.') continue;
    const continuation = callAt(tokens, promiseResolve.close + 2);
    if (!continuation
      || !['then', 'finally'].includes(continuation.path.at(-1))
      || continuation.close !== end - 1) continue;
    const arguments_ = splitCallArguments(tokens, continuation);
    if (arguments_.length !== 1) continue;
    const [argument] = arguments_;
    if (call.start < argument[0] || call.close >= argument[1]) continue;
    if (expressionArrowReturnsExactCall(tokens, argument[0], argument[1], call)) return true;
  }
  return false;
}

function callIsInsideExpressionArrow(tokens, call) {
  for (let index = 0; index < call.start; index += 1) {
    if (tokens[index]?.value !== '=>' || tokens[index + 1]?.value === '{') continue;
    const end = returnExpressionEnd(tokens, index + 1);
    if (call.start > index && call.close < end) return true;
  }
  return false;
}

function callResultIsObserved(tokens, call) {
  if (returnedPromiseThenObservesCall(tokens, call)) return true;
  if (callIsInsideExpressionArrow(tokens, call)) return false;
  if (callIsAwaited(tokens, call)) return true;
  return returnExpressionRanges(tokens).some(([rawStart, rawEnd]) => {
    const [start, end] = trimWholeExpressionParentheses(tokens, rawStart, rawEnd);
    return expressionIsExactCall(tokens, start, end, call);
  });
}

function directObjectAssignmentProperties(tokens, variableName) {
  const matches = [];
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (tokens[index]?.value !== variableName || tokens[index + 1]?.value !== '='
      || tokens[index + 2]?.value !== '{') continue;
    const close = matchingTokenIndex(tokens, index + 2, '{', '}');
    if (close < 0) continue;
    matches.push(objectProperties(tokens, index + 2, close) || []);
  }
  return matches.length === 1 ? matches[0] : null;
}

function propertyReferencesIdentifier(properties, key, identifier) {
  const property = uniqueEffectiveProperty(properties || [], key);
  return Boolean(property
    && property.value_end - property.value_start === 1
    && properties
    && identifier
    && property.value_start >= 0
    && property.value_end >= 0
    && property.tokens?.[property.value_start]?.value === identifier);
}

function returnedPropertyReferencesIdentifier(tokens, scope, scopes, key, identifier) {
  const objects = returnedObjectProperties(tokens, scope, scopes).filter(({ properties }) => (
    properties.some((property) => property.key === key)
  ));
  if (objects.length !== 1) return false;
  const { owned, properties } = objects[0];
  const property = uniqueEffectiveProperty(properties, key);
  return Boolean(property
    && property.value_end - property.value_start === 1
    && owned[property.value_start]?.type === 'identifier'
    && owned[property.value_start].value === identifier);
}

function recordBindsSupervisor(tokens, scopes, owned, calls, recordName, supervisorName) {
  const direct = directObjectAssignmentProperties(owned, recordName);
  if (direct) {
    const property = uniqueEffectiveProperty(direct, 'supervisor');
    if (property
      && property.value_end - property.value_start === 1
      && owned[property.value_start]?.value === supervisorName) return true;
  }
  const helperCalls = calls.filter((call) => call.path.length === 1
    && assignedIdentifierForCall(owned, call) === recordName
    && identifierArgument(owned, call, 0) === supervisorName);
  if (helperCalls.length !== 1) return false;
  const helper = uniqueScope(scopes, helperCalls[0].path[0]);
  if (!helper) return false;
  const helperParameters = simpleParameterNames(tokens, helper);
  return Boolean(helperParameters[0]
    && returnedPropertyReferencesIdentifier(tokens, helper, scopes, 'supervisor', helperParameters[0]));
}

function supervisorCandidates(tokens, scopes, owned, calls, managerName) {
  const candidates = [];
  for (const call of calls) {
    const supervisorName = assignedIdentifierForCall(owned, call);
    if (!supervisorName) continue;
    if (call.path.length === 2 && call.path[0] === managerName && call.path[1] === 'supervisorFactory') {
      candidates.push({ supervisor_name: supervisorName, policy: strictNumericPolicy(owned, call) });
      continue;
    }
    if (call.path.length !== 1 || identifierArgument(owned, call, 0) !== managerName) continue;
    const helper = uniqueScope(scopes, call.path[0]);
    if (!helper) continue;
    const helperParameters = simpleParameterNames(tokens, helper);
    if (!helperParameters[0]) continue;
    const helperTokens = scopeReachableTokens(tokens, helper, scopes);
    const factoryCalls = callsInTokens(helperTokens).filter((factoryCall) => (
      factoryCall.path.length === 2
      && factoryCall.path[0] === helperParameters[0]
      && factoryCall.path[1] === 'supervisorFactory'
      && callIsDirectlyReturned(helperTokens, factoryCall)
    ));
    if (factoryCalls.length !== 1) continue;
    candidates.push({
      supervisor_name: supervisorName,
      policy: strictNumericPolicy(helperTokens, factoryCalls[0]),
    });
  }
  return candidates;
}

function stopHelperOwnsSupervisor(tokens, scopes, stopHelper, recordParameter) {
  const stopTokens = scopeReachableTokens(tokens, stopHelper, scopes);
  const stopCalls = callsInTokens(stopTokens).filter((call) => (
    call.path.length === 3
    && call.path[0] === recordParameter
    && call.path[1] === 'supervisor'
    && call.path[2] === 'stop'
    && callResultIsObserved(stopTokens, call)
    && callIsOnUnconditionalPath(stopTokens, call)
  ));
  return stopCalls.length === 1;
}

function recordReleaseScopeContract(tokens, scopes, scope) {
  const parameters = simpleParameterNames(tokens, scope);
  const [managerParameter, requestIdParameter, recordParameter] = parameters;
  if (!managerParameter || !requestIdParameter || !recordParameter) return false;
  const owned = scopeReachableTokens(tokens, scope, scopes);
  const calls = callsInTokens(owned);
  const deletes = calls.filter((call) => (
    call.path.length === 3
    && call.path[0] === managerParameter
    && call.path[1] === 'executions'
    && call.path[2] === 'delete'
    && callHasIdentifierArguments(owned, call, [requestIdParameter])
    && callIsOnUnconditionalPath(owned, call)
  ));
  const stops = calls.filter((call) => (
    call.path.length === 1
    && callHasIdentifierArguments(owned, call, [managerParameter, requestIdParameter, recordParameter])
    && callResultIsObserved(owned, call)
    && callIsOnUnconditionalPath(owned, call)
    && uniqueScope(scopes, call.path[0])
  ));
  if (deletes.length !== 1 || stops.length !== 1 || deletes[0].start >= stops[0].start) return false;
  const stopHelper = uniqueScope(scopes, stops[0].path[0]);
  const stopParameters = simpleParameterNames(tokens, stopHelper);
  return Boolean(stopParameters[2]
    && stopHelperOwnsSupervisor(tokens, scopes, stopHelper, stopParameters[2]));
}

function delegatedLeaseReleaseContract(tokens, scopes, acquisitionTokens, managerName, requestIdName, recordName) {
  const leaseCalls = callsInTokens(acquisitionTokens).filter((call) => (
    call.path.length === 1
    && call.path[0] === 'executionWorkerLease'
    && callIsDirectlyReturned(acquisitionTokens, call)
    && callHasIdentifierArguments(acquisitionTokens, call, [managerName, requestIdName, recordName])
  ));
  if (leaseCalls.length !== 1) return false;
  const leaseScope = uniqueScope(scopes, 'executionWorkerLease');
  if (!leaseScope) return false;
  const leaseParameters = simpleParameterNames(tokens, leaseScope);
  if (!leaseParameters[0] || !leaseParameters[1] || !leaseParameters[2]) return false;
  const objects = returnedObjectProperties(tokens, leaseScope, scopes).filter(({ properties }) => (
    properties.some((property) => property.key === 'release')
  ));
  if (objects.length !== 1) return false;
  const { owned, properties } = objects[0];
  const releaseProperty = uniqueEffectiveProperty(properties, 'release');
  const releaseDelegate = releaseProperty ? arrowDelegate(owned, releaseProperty, scopes) : null;
  if (!releaseDelegate
    || releaseDelegate.public_parameters.length !== 0
    || releaseDelegate.arguments.length !== 3
    || releaseDelegate.arguments.join('\0') !== leaseParameters.slice(0, 3).join('\0')
    || !recordReleaseScopeContract(tokens, scopes, releaseDelegate.helper)) return false;
  const drainProperties = properties.filter((property) => property.key === 'drain');
  if (!drainProperties.length) return true;
  const drainProperty = uniqueEffectiveProperty(properties, 'drain');
  const drainDelegate = drainProperty ? arrowDelegate(owned, drainProperty, scopes) : null;
  return Boolean(drainDelegate
    && drainDelegate.public_parameters.length === 1
    && drainDelegate.public_parameters[0]
    && drainDelegate.arguments.length === 4
    && drainDelegate.arguments.slice(0, 3).join('\0') === leaseParameters.slice(0, 3).join('\0')
    && drainDelegate.arguments[3] === drainDelegate.public_parameters[0]
    && recordReleaseScopeContract(tokens, scopes, drainDelegate.helper));
}

function inlineLeaseReleaseContract(tokens, scopes, acquisition, acquisitionTokens, managerName, requestIdName, supervisorName) {
  const objects = returnedObjectProperties(tokens, acquisition, scopes).filter(({ properties }) => (
    properties.some((property) => property.key === 'release')
  ));
  if (objects.length !== 1) return false;
  const releaseProperty = uniqueEffectiveProperty(objects[0].properties, 'release');
  if (!releaseProperty
    || releaseProperty.value_end - releaseProperty.value_start !== 1
    || objects[0].owned[releaseProperty.value_start]?.value !== 'release') return false;
  const releaseScope = uniqueScope(scopes, 'release', acquisition);
  if (!releaseScope) return false;
  const releaseTokens = scopeReachableTokens(tokens, releaseScope, scopes);
  const calls = callsInTokens(releaseTokens);
  const deletes = calls.filter((call) => (
    call.path.length === 3
    && call.path[0] === managerName
    && call.path[1] === 'executions'
    && call.path[2] === 'delete'
    && callHasIdentifierArguments(releaseTokens, call, [requestIdName])
    && callIsOnUnconditionalPath(releaseTokens, call)
  ));
  const stops = calls.filter((call) => (
    call.path.length === 2
    && call.path[0] === supervisorName
    && call.path[1] === 'stop'
    && callResultIsObserved(releaseTokens, call)
    && callIsOnUnconditionalPath(releaseTokens, call)
  ));
  return deletes.length === 1 && stops.length === 1 && deletes[0].start < stops[0].start;
}

function managerSuccessorContract(source) {
  const tokens = tokenizeJavascriptForRiskAudit(source);
  const scopes = collectFunctionScopes(tokens);
  const empty = {
    pressure_admission_closed: false,
    supervisor_created_per_acquire: false,
    request_indexed: false,
    request_released: false,
    one_pending_per_turn: false,
    restart_disabled: false,
    supervisor_policy_same_call: false,
  };
  const exported = exportedAcquireImplementation(tokens, scopes);
  if (!exported) return empty;
  const { acquisition, identity_name: identityName, manager_name: managerName } = exported;
  const owned = scopeReachableTokens(tokens, acquisition, scopes);
  const calls = callsInTokens(owned);
  const indexedCalls = calls.filter((call) => (
    call.path.length === 3
    && call.path[0] === managerName
    && call.path[1] === 'executions'
    && call.path[2] === 'set'
    && identifierArgument(owned, call, 0)
    && identifierArgument(owned, call, 1)
  ));
  if (indexedCalls.length !== 1) return empty;
  const indexedCall = indexedCalls[0];
  const requestIdName = identifierArgument(owned, indexedCall, 0);
  const recordName = identifierArgument(owned, indexedCall, 1);
  const requestIdDerived = variableDerivesFromIdentityRequestId(
    tokens, scopes, owned, requestIdName, identityName, indexedCall.start,
  );

  const waits = calls.filter((call) => (
    call.path.length === 1
    && callHasIdentifierArguments(owned, call, [managerName, requestIdName])
    && callIsAwaited(owned, call)
    && uniqueScope(scopes, call.path[0])
  ));
  const pressureWaits = waits.filter((call) => {
    const helper = uniqueScope(scopes, call.path[0]);
    return pressureRejectionInIfBlock(scopeReachableTokens(tokens, helper, scopes));
  });
  const pressureAdmissionClosed = pressureRejectionInIfBlock(owned) || pressureWaits.length === 1;

  const candidates = supervisorCandidates(tokens, scopes, owned, calls, managerName)
    .filter((candidate) => recordBindsSupervisor(
      tokens, scopes, owned, calls, recordName, candidate.supervisor_name,
    ));
  if (candidates.length !== 1) {
    return { ...empty, pressure_admission_closed: pressureAdmissionClosed };
  }
  const [candidate] = candidates;
  const recordBound = true;
  const requestIndexed = requestIdDerived && recordBound;
  const requestReleased = requestIndexed && (
    inlineLeaseReleaseContract(
      tokens, scopes, acquisition, owned, managerName, requestIdName, candidate.supervisor_name,
    )
    || delegatedLeaseReleaseContract(tokens, scopes, owned, managerName, requestIdName, recordName)
  );
  return {
    pressure_admission_closed: pressureAdmissionClosed,
    supervisor_created_per_acquire: true,
    request_indexed: requestIndexed,
    request_released: requestReleased,
    one_pending_per_turn: candidate.policy.one_pending,
    restart_disabled: candidate.policy.no_restarts,
    supervisor_policy_same_call: candidate.policy.same_call,
  };
}

function supervisorExitContract(source) {
  const tokens = tokenizeJavascriptForRiskAudit(source);
  const scopes = collectFunctionScopes(tokens);
  const exits = scopes.filter((scope) => scope.name === 'onExit');
  let rejectsPending = false;
  let typedFailure = false;
  for (const exit of exits) {
    const owned = reachableTokens(tokensOwnedByScope(tokens, exit, scopes));
    const calls = callsInTokens(owned);
    for (const rejectCall of calls.filter((call) => callPathEndsWith(call, ['rejectPending']))) {
      rejectsPending = true;
      if (calls.some((call) => callPathEndsWith(call, ['executionWorkerExitFailure'])
        && call.start > rejectCall.open && call.close < rejectCall.close)) typedFailure = true;
    }
  }
  return { rejects_pending: rejectsPending, typed_failure: typedFailure };
}

function topLevelRequirePathContract(source, requiredPath) {
  const tokens = reachableTokens(tokenizeJavascriptForRiskAudit(source));
  let braceDepth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === '{') braceDepth += 1;
    else if (tokens[index].value === '}') braceDepth -= 1;
    if (braceDepth !== 0) continue;
    const call = callAt(tokens, index);
    if (!call || !callPathEndsWith(call, ['require'])) continue;
    const [first] = splitCallArguments(tokens, call);
    if (first && first[1] - first[0] === 1
      && tokens[first[0]]?.type === 'string'
      && tokens[first[0]].value === requiredPath) return true;
  }
  return false;
}

function topLevelRequireContract(source) {
  return topLevelRequirePathContract(source, './host-core/agent/execution-worker-entry.cjs');
}

function sharedWorkerRegistryIsAbsent(source) {
  const tokens = tokenizeJavascriptForRiskAudit(source);
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === 'new'
      && tokens[index + 1]?.value === 'Worker'
      && tokens[index + 2]?.value === '(') return false;
    if (tokens[index].value === 'runners'
      && tokens[index + 1]?.value === '='
      && tokens[index + 2]?.value === 'new'
      && tokens[index + 3]?.value === 'Map'
      && tokens[index + 4]?.value === '(') return false;
  }
  return true;
}

function tokenBraceDepths(tokens) {
  const depths = [];
  let depth = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value === '}') depth = Math.max(0, depth - 1);
    depths[index] = depth;
    if (tokens[index]?.value === '{') depth += 1;
  }
  return depths;
}

function topLevelDestructuredRequireBindings(source) {
  const tokens = reachableTokens(tokenizeJavascriptForRiskAudit(source));
  const depths = tokenBraceDepths(tokens);
  const bindings = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (depths[index] !== 0
      || tokens[index]?.value !== 'const'
      || tokens[index + 1]?.value !== '{') continue;
    const objectClose = matchingTokenIndex(tokens, index + 1, '{', '}');
    if (objectClose < 0 || tokens[objectClose + 1]?.value !== '=') continue;
    const requireCall = callAt(tokens, objectClose + 2);
    if (!requireCall
      || requireCall.path.length !== 1
      || requireCall.path[0] !== 'require'
      || ![';', undefined].includes(tokens[requireCall.close + 1]?.value)) continue;
    const arguments_ = splitCallArguments(tokens, requireCall);
    if (arguments_.length !== 1) continue;
    const [argument] = arguments_;
    if (argument[1] - argument[0] !== 1 || tokens[argument[0]]?.type !== 'string') continue;
    for (const property of objectProperties(tokens, index + 1, objectClose) || []) {
      if (property.spread
        || property.value_end - property.value_start !== 1
        || tokens[property.value_start]?.type !== 'identifier') continue;
      bindings.push({
        imported: property.key,
        local: tokens[property.value_start].value,
        required_path: tokens[argument[0]].value,
      });
    }
  }
  return { tokens, depths, bindings };
}

function topLevelRequiredIdentifierBinding(source, requiredPath, identifier) {
  const { tokens, depths, bindings } = topLevelDestructuredRequireBindings(source);
  const localBindings = bindings.filter((binding) => binding.local === identifier);
  if (localBindings.length !== 1
    || localBindings[0].imported !== identifier
    || localBindings[0].required_path !== requiredPath) return false;
  for (let index = 0; index < tokens.length; index += 1) {
    if (depths[index] !== 0
      || tokens[index]?.type !== 'identifier'
      || tokens[index].value !== identifier) continue;
    if (['const', 'let', 'var', 'function', 'class'].includes(tokens[index - 1]?.value)
      || ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '&&=', '||=', '??=', '++', '--']
        .includes(tokens[index + 1]?.value)
      || ['++', '--'].includes(tokens[index - 1]?.value)) return false;
  }
  return true;
}

function moduleExportsOnlyIdentifier(source, identifier) {
  const tokens = reachableTokens(tokenizeJavascriptForRiskAudit(source));
  const depths = tokenBraceDepths(tokens);
  const exportsAssignments = [];
  for (let index = 0; index + 4 < tokens.length; index += 1) {
    if (depths[index] !== 0
      || tokens[index]?.value !== 'module'
      || tokens[index + 1]?.value !== '.'
      || tokens[index + 2]?.value !== 'exports') continue;
    exportsAssignments.push(index);
  }
  if (exportsAssignments.length !== 1) return false;
  const [index] = exportsAssignments;
  if (tokens[index + 3]?.value !== '=' || tokens[index + 4]?.value !== '{') return false;
    const close = matchingTokenIndex(tokens, index + 4, '{', '}');
  if (close < 0 || ![';', undefined].includes(tokens[close + 1]?.value)) return false;
    const properties = objectProperties(tokens, index + 4, close) || [];
  if (properties.length !== 1) return false;
    const property = uniqueEffectiveProperty(properties, identifier);
  return Boolean(property
    && property.value_end - property.value_start === 1
    && tokens[property.value_start]?.type === 'identifier'
    && tokens[property.value_start].value === identifier);
}

function topLevelFunctionBinding(source, identifier) {
  const tokens = reachableTokens(tokenizeJavascriptForRiskAudit(source));
  const depths = tokenBraceDepths(tokens);
  const declarations = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (depths[index] !== 0 || tokens[index]?.value !== 'function') continue;
    let nameIndex = index + 1;
    if (tokens[nameIndex]?.value === '*') nameIndex += 1;
    if (tokens[nameIndex]?.type === 'identifier' && tokens[nameIndex].value === identifier) {
      declarations.push(nameIndex);
    }
  }
  if (declarations.length !== 1) return false;
  for (let index = 0; index < tokens.length; index += 1) {
    if (depths[index] !== 0
      || tokens[index]?.type !== 'identifier'
      || tokens[index].value !== identifier
      || index === declarations[0]) continue;
    if (['const', 'let', 'var', 'class'].includes(tokens[index - 1]?.value)
      || ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '&&=', '||=', '??=', '++', '--']
        .includes(tokens[index + 1]?.value)
      || ['++', '--'].includes(tokens[index - 1]?.value)) return false;
  }
  return true;
}

function contextUsageLeaseHelperContract(sourceByPath) {
  const wrapper = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage.cjs') || '';
  const implementation = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage-lease.cjs') || '';
  const helperName = 'createExecutionWorkerContextUsageLease';
  if (!topLevelRequiredIdentifierBinding(
    wrapper, './execution-worker-context-usage-lease.cjs', helperName,
  )
    || !moduleExportsOnlyIdentifier(wrapper, helperName)
    || !topLevelFunctionBinding(implementation, helperName)
    || !moduleExportsOnlyIdentifier(implementation, helperName)) return false;
  const tokens = tokenizeJavascriptForRiskAudit(implementation);
  const scopes = collectFunctionScopes(tokens);
  const creator = uniqueScope(scopes, helperName);
  if (!creator) return false;
  const objects = returnedObjectProperties(tokens, creator, scopes).filter(({ properties }) => (
    properties.some((property) => property.key === 'release')
  ));
  if (objects.length !== 1) return false;
  const releaseProperty = uniqueEffectiveProperty(objects[0].properties, 'release');
  if (!releaseProperty
    || releaseProperty.value_end - releaseProperty.value_start !== 1
    || objects[0].owned[releaseProperty.value_start]?.type !== 'identifier'
    || objects[0].owned[releaseProperty.value_start].value !== 'release') return false;
  const releaseScope = uniqueScope(scopes, 'release', creator);
  if (!releaseScope) return false;
  const [leaseParameter] = simpleParameterNames(tokens, releaseScope);
  if (!leaseParameter) return false;
  const releaseTokens = scopeReachableTokens(tokens, releaseScope, scopes);
  const calls = callsInTokens(releaseTokens);
  const drainsCompletedLease = calls.some((call) => (
    call.path.length === 2
    && call.path[0] === leaseParameter
    && call.path[1] === 'drain'
  ));
  const releasesIncompleteLease = calls.some((call) => (
    call.path.length === 2
    && call.path[0] === leaseParameter
    && call.path[1] === 'release'
    && callIsAwaited(releaseTokens, call)
  ));
  return drainsCompletedLease && releasesIncompleteLease;
}

function desktopLeaseContract(sourceByPath) {
  const source = sourceByPath.get('electron/host-core/agent/desktop-host-context.cjs') || '';
  const tokens = tokenizeJavascriptForRiskAudit(source);
  const scopes = collectFunctionScopes(tokens);
  let acquired = false;
  for (const scope of scopes) {
    const owned = reachableTokens(tokensOwnedByScope(tokens, scope, scopes));
    const scopeParameters = simpleParameterNames(tokens, scope);
    const scopeCalls = callsInTokens(owned);
    for (let index = 0; index < owned.length; index += 1) {
      if (owned[index].value !== 'try' || owned[index + 1]?.value !== '{') continue;
      const tryClose = matchingTokenIndex(owned, index + 1, '{', '}');
      if (tryClose < 0) continue;
      let cursor = tryClose + 1;
      if (owned[cursor]?.value === 'catch') {
        cursor += 1;
        if (owned[cursor]?.value === '(') cursor = matchingTokenIndex(owned, cursor) + 1;
        if (owned[cursor]?.value !== '{') continue;
        cursor = matchingTokenIndex(owned, cursor, '{', '}') + 1;
      }
      if (owned[cursor]?.value !== 'finally' || owned[cursor + 1]?.value !== '{') continue;
      const finallyClose = matchingTokenIndex(owned, cursor + 1, '{', '}');
      if (finallyClose < 0) continue;
      const tryTokens = owned.slice(index + 2, tryClose);
      const finallyTokens = owned.slice(cursor + 2, finallyClose);
      const tryCalls = callsInTokens(tryTokens);
      for (const acquireCall of tryCalls.filter((call) => (
        call.path.length === 2
        && call.path[1] === 'acquire'
        && (call.path[0] === 'executionWorkerManager'
          || (call.path[0] === 'supervisor' && scopeParameters.includes('supervisor')))
        && callIsAwaited(tryTokens, call)
      ))) {
        const leaseName = assignedIdentifierForCall(tryTokens, acquireCall);
        if (!leaseName) continue;
        acquired = true;
        const directRelease = callsInTokens(finallyTokens).find((call) => (
          call.path.length === 2
          && call.path[0] === leaseName
          && call.path[1] === 'release'
          && callIsAwaited(finallyTokens, call)
          && callIsOnUnconditionalPath(finallyTokens, call)
        ));
        if (directRelease) return { acquired: true, released: true, same_try_finally_scope: true };

        const delegatedReleases = callsInTokens(finallyTokens).filter((call) => (
          call.path.length === 2
          && call.path[1] === 'release'
          && identifierArgument(finallyTokens, call, 0) === leaseName
          && callIsAwaited(finallyTokens, call)
          && callIsOnUnconditionalPath(finallyTokens, call)
        ));
        if (delegatedReleases.length !== 1) continue;
        const contextLeaseName = delegatedReleases[0].path[0];
        const setupCalls = scopeCalls.filter((call) => (
          call.start < index
          && call.path.length === 1
          && call.path[0] === 'createExecutionWorkerContextUsageLease'
          && assignedIdentifierForCall(owned, call) === contextLeaseName
        ));
        const wrapperBound = topLevelRequiredIdentifierBinding(
          source, './execution-worker-context-usage.cjs',
          'createExecutionWorkerContextUsageLease',
        );
        if (setupCalls.length === 1 && wrapperBound && contextUsageLeaseHelperContract(sourceByPath)) {
          return { acquired: true, released: true, same_try_finally_scope: true };
        }
      }
    }
  }
  return { acquired, released: false, same_try_finally_scope: false };
}

function verifiedFirstParentCompare(ancestry, compareFrom, compareTo) {
  return text(ancestry?.source) === 'gitlab-api-compare-first-parent'
    && ancestry?.verified === true
    && ancestry?.first_parent_complete === true
    && text(ancestry?.compare_from) === compareFrom
    && text(ancestry?.compare_to) === compareTo
    && Number.isSafeInteger(Number(ancestry?.compare_commit_count))
    && Number(ancestry.compare_commit_count) > 0
    && !text(ancestry?.reason);
}

function mergeRelationship({ releaseHead, mergeCommitSha, descendantAncestry, predecessorAncestry }) {
  if (!HEX40.test(releaseHead)) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN, source: 'release-head-invalid' };
  }
  if (releaseHead === mergeCommitSha) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE, source: 'release-head-is-origin-merge' };
  }
  const descendantVerified = verifiedFirstParentCompare(descendantAncestry, mergeCommitSha, releaseHead);
  const predecessorVerified = verifiedFirstParentCompare(predecessorAncestry, releaseHead, mergeCommitSha);
  if (descendantVerified && predecessorVerified) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN, source: 'conflicting-first-parent-ancestry' };
  }
  if (descendantVerified) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE, source: 'gitlab-api-first-parent-ancestry' };
  }
  if (predecessorVerified) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE, source: 'gitlab-api-reverse-first-parent-ancestry' };
  }
  return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN, source: 'first-parent-relationship-not-proven' };
}

function riskApplicability(releaseHead, originAncestry, releaseBeforeOriginAncestry) {
  const relationship = mergeRelationship({
    releaseHead,
    mergeCommitSha: QWORK_MR1552_MERGE_COMMIT_SHA,
    descendantAncestry: originAncestry,
    predecessorAncestry: releaseBeforeOriginAncestry,
  });
  if (releaseHead === QWORK_MR1552_MERGE_COMMIT_SHA
    && relationship.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE) {
    return { ...relationship, source: 'release-head-is-mr-1552-merge' };
  }
  return relationship;
}

function successorArchitecture(releaseHead, successorAncestry, releaseBeforeSuccessorAncestry) {
  const relationship = mergeRelationship({
    releaseHead,
    mergeCommitSha: QWORK_MR1559_MERGE_COMMIT_SHA,
    descendantAncestry: successorAncestry,
    predecessorAncestry: releaseBeforeSuccessorAncestry,
  });
  if (relationship.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE) {
    return {
      relationship,
      architecture: 'per-turn-utility-process/v1',
      activation_source: releaseHead === QWORK_MR1559_MERGE_COMMIT_SHA
        ? 'release-head-is-mr-1559-merge'
        : 'gitlab-api-first-parent-successor-ancestry',
      assertion_owner: {
        contract_id: QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
        mr_iid: '1559',
        merge_commit_sha: QWORK_MR1559_MERGE_COMMIT_SHA,
      },
      protected_paths: QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS,
    };
  }
  if (relationship.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE) {
    return {
      relationship,
      architecture: 'shared-worker-registry/v1',
      activation_source: 'verified-release-precedes-mr-1559-use-mr-1552-assertions',
      assertion_owner: {
        contract_id: QWORK_MR1552_EXECUTION_RUNNER_RISK_ID,
        mr_iid: '1552',
        merge_commit_sha: QWORK_MR1552_MERGE_COMMIT_SHA,
      },
      protected_paths: QWORK_MR1552_LEGACY_PROTECTED_PATHS,
    };
  }
  return {
    relationship,
    architecture: 'unknown',
    activation_source: 'mr-1559-first-parent-relationship-not-proven',
    assertion_owner: null,
    protected_paths: QWORK_RELEASE_BLOCKING_RISK_PROTECTED_PATHS,
  };
}

function ancestryProjection(ancestry = {}) {
  return {
    source: text(ancestry.source),
    compare_from: text(ancestry.compare_from),
    compare_to: text(ancestry.compare_to),
    compare_commit_count: Number.isSafeInteger(Number(ancestry.compare_commit_count))
      ? Number(ancestry.compare_commit_count) : 0,
    first_parent_complete: ancestry.first_parent_complete === true,
    verified: ancestry.verified === true,
    reason: text(ancestry.reason),
  };
}

function originAncestryProjection(ancestry, mergeCommitSha, releaseHead) {
  if (releaseHead !== mergeCommitSha) return ancestryProjection(ancestry);
  return {
    source: 'release-head-is-origin-merge',
    compare_from: mergeCommitSha,
    compare_to: releaseHead,
    compare_commit_count: 0,
    first_parent_complete: true,
    verified: true,
    reason: '',
  };
}

export function qworkReleaseBlockingRiskProtectedPaths({
  releaseHead,
  successorAncestry = {},
  releaseBeforeSuccessorAncestry = {},
} = {}) {
  return [...successorArchitecture(
    text(releaseHead),
    successorAncestry,
    releaseBeforeSuccessorAncestry,
  ).protected_paths];
}

function auditLegacySharedWorkerChecks(sourceByPath) {
  const controller = sourceByPath.get('electron/execution-worker.cjs') || '';
  const supervisor = sourceByPath.get('electron/host-core/agent/execution-worker-supervisor.cjs') || '';
  const terminalHelper = extractBalancedCall(controller, 'function terminalFor(');
  const exitHandler = extractBalancedCall(controller, "runner.on('exit'");
  const messageHandler = extractBalancedCall(controller, "runner.on('message'");
  const pressureBranch = extractBalancedCall(messageHandler, "operation === 'worker.pressure'");
  const supervisorMessageHandler = extractBalancedCall(supervisor, 'const onMessage = (raw) =>');
  const supervisorReject = extractBalancedCall(supervisorMessageHandler, 'catch (error)');

  const boundedTypedTerminal = /operation\s*:\s*['"]execution\.terminal['"]/u.test(terminalHelper)
    && /deadlineAt\s*:\s*Date\.now\(\)\s*\+/u.test(terminalHelper);
  const conditionalExitTerminal = /if\s*\(\s*exitCode[^)]*\)\s*process\.parentPort\.postMessage\s*\(\s*terminalFor\s*\(\s*startMessage/u.test(exitHandler);
  const exitTerminal = /postMessage\s*\(\s*terminalFor\s*\(\s*startMessage/u.test(exitHandler)
    && !conditionalExitTerminal;
  const cleanExitPassed = Boolean(boundedTypedTerminal && exitTerminal);

  const pressureForwarded = /postMessage\s*\(/u.test(pressureBranch)
    && /operation\s*:\s*['"]worker\.pressure['"]/u.test(pressureBranch);
  const supervisorConsumesPressure = /executionWorkerPressureFromMessage\s*\(\s*message/u.test(supervisorMessageHandler)
    && /message\.operation\s*!==\s*['"]worker\.pressure['"]/u.test(supervisor);
  const pressurePassed = Boolean(pressureForwarded && supervisorConsumesPressure);

  const validatesRunnerEnvelope = /validateEnvelope\s*\(\s*runnerMessage\s*,\s*\{\s*direction\s*:\s*['"]worker-to-host['"]/u.test(messageHandler);
  const targetedTermination = /runner\.terminate\s*\(/u.test(messageHandler)
    && /terminalFor\s*\(\s*startMessage/u.test(messageHandler);
  const sharedKillOnProtocolReject = /(?:child\?*\.kill|terminateChild)\s*\(/u.test(supervisorReject);
  const isolationPassed = Boolean(validatesRunnerEnvelope && targetedTermination && !sharedKillOnProtocolReject);

  return [
    {
      id: QWORK_MR1552_FAILURE_IDS[0],
      passed: cleanExitPassed,
      observations: { bounded_typed_terminal: boundedTypedTerminal, unsettled_exit_always_emits_terminal: exitTerminal },
    },
    {
      id: QWORK_MR1552_FAILURE_IDS[1],
      passed: pressurePassed,
      observations: { controller_forwards_top_level_pressure: pressureForwarded, supervisor_consumes_top_level_pressure: supervisorConsumesPressure },
    },
    {
      id: QWORK_MR1552_FAILURE_IDS[2],
      passed: isolationPassed,
      observations: { controller_validates_runner_envelope: validatesRunnerEnvelope, invalid_runner_is_terminated_with_terminal: targetedTermination, supervisor_protocol_reject_kills_shared_process: sharedKillOnProtocolReject },
    },
  ];
}

function auditPerTurnUtilityProcessChecks(sourceByPath) {
  const entry = sourceByPath.get('electron/execution-worker.cjs') || '';
  const manager = sourceByPath.get('electron/host-core/agent/execution-worker-manager.cjs') || '';
  const supervisor = sourceByPath.get('electron/host-core/agent/execution-worker-supervisor.cjs') || '';

  const supervisorContract = supervisorExitContract(supervisor);
  const managerContract = managerSuccessorContract(manager);
  const desktopContract = desktopLeaseContract(sourceByPath);
  const unsettledExitUsesTypedFailure = supervisorContract.typed_failure;
  const pressureAdmissionClosed = managerContract.pressure_admission_closed;
  const onePendingPerTurn = managerContract.one_pending_per_turn;
  const restartDisabled = managerContract.restart_disabled;
  const pressurePassed = pressureAdmissionClosed
    && onePendingPerTurn
    && restartDisabled
    && managerContract.supervisor_policy_same_call;

  const supervisorCreatedPerAcquire = managerContract.supervisor_created_per_acquire;
  const requestIndexed = managerContract.request_indexed;
  const requestReleased = managerContract.request_released;
  const leaseAcquired = desktopContract.acquired;
  const leaseReleased = desktopContract.released && desktopContract.same_try_finally_scope;
  const stableSingleTurnEntry = topLevelRequireContract(entry);
  const sharedWorkerRegistryAbsent = sharedWorkerRegistryIsAbsent(entry);
  const isolationPassed = supervisorCreatedPerAcquire
    && requestIndexed
    && requestReleased
    && leaseAcquired
    && leaseReleased
    && stableSingleTurnEntry
    && sharedWorkerRegistryAbsent;

  return [
    {
      id: QWORK_MR1552_FAILURE_IDS[0],
      passed: unsettledExitUsesTypedFailure,
      observations: {
        supervisor_unsettled_exit_uses_typed_failure: unsettledExitUsesTypedFailure,
        supervisor_rejects_pending_on_exit: supervisorContract.rejects_pending,
      },
    },
    {
      id: QWORK_MR1552_FAILURE_IDS[1],
      passed: pressurePassed,
      observations: {
        manager_pressure_admission_closed: pressureAdmissionClosed,
        per_turn_max_pending_requests_one: onePendingPerTurn,
        per_turn_restarts_disabled: restartDisabled,
        per_turn_supervisor_policy_same_call: managerContract.supervisor_policy_same_call,
      },
    },
    {
      id: QWORK_MR1552_FAILURE_IDS[2],
      passed: isolationPassed,
      observations: {
        manager_creates_supervisor_per_acquire: supervisorCreatedPerAcquire,
        manager_indexes_execution_by_request_id: requestIndexed,
        release_deletes_request_and_stops_supervisor: requestReleased,
        desktop_host_acquires_execution_lease: leaseAcquired,
        desktop_host_releases_execution_lease: leaseReleased,
        desktop_host_lease_same_try_finally_scope: desktopContract.same_try_finally_scope,
        stable_single_turn_entry: stableSingleTurnEntry,
        shared_worker_registry_absent: sharedWorkerRegistryAbsent,
      },
    },
  ];
}

export function auditQworkReleaseBlockingRisk({
  releaseHead,
  originAncestry = {},
  releaseBeforeOriginAncestry = {},
  successorAncestry = {},
  releaseBeforeSuccessorAncestry = {},
  files = [],
} = {}) {
  const normalizedHead = text(releaseHead);
  const activation = riskApplicability(normalizedHead, originAncestry, releaseBeforeOriginAncestry);
  const architecture = successorArchitecture(
    normalizedHead,
    successorAncestry,
    releaseBeforeSuccessorAncestry,
  );
  const applicable = activation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE
    ? true
    : activation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE
      ? false
      : null;
  const fileFailures = [];
  const sourceFiles = [];
  const sourceByPath = new Map();
  if (applicable === true) {
    for (const protectedPath of architecture.protected_paths) {
      const matches = files.filter((file) => text(file?.path || file?.payload?.file_path) === protectedPath);
      if (matches.length !== 1) fileFailures.push(`release_file:${protectedPath}:count:${matches.length}`);
      const observed = observeFile(matches[0] || { path: protectedPath, error: 'missing' }, protectedPath, normalizedHead, fileFailures);
      sourceFiles.push(observed.observation);
      sourceByPath.set(protectedPath, observed.source);
    }
  }
  const architectureKnown = architecture.relationship.state !== QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN;
  const checks = applicable === true && architectureKnown
    ? architecture.architecture === 'per-turn-utility-process/v1'
      ? auditPerTurnUtilityProcessChecks(sourceByPath)
      : auditLegacySharedWorkerChecks(sourceByPath)
    : QWORK_MR1552_FAILURE_IDS.map((id) => ({ id, passed: null, observations: {} }));
  const failureIds = applicable === true && architectureKnown
    ? checks.filter((check) => check.passed !== true).map((check) => check.id)
    : [];
  const evidenceFailures = [
    ...(activation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN
      ? [RELEASE_ANCESTRY_UNKNOWN] : []),
    ...(applicable === true && !architectureKnown ? [SUCCESSOR_ANCESTRY_UNKNOWN] : []),
    ...(applicable === true ? fileFailures : []),
  ];
  const uniqueEvidenceFailures = [...new Set(evidenceFailures)];
  const verified = applicable === true
    && architectureKnown
    && failureIds.length === 0
    && uniqueEvidenceFailures.length === 0;
  const status = activation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE
    ? 'NOT_APPLICABLE'
    : verified
      ? 'VERIFIED'
      : 'BLOCKED';
  const value = {
    schema_version: QWORK_RELEASE_BLOCKING_RISK_SCHEMA,
    risk_id: QWORK_MR1552_EXECUTION_RUNNER_RISK_ID,
    mr_iid: '1552',
    merge_commit_sha: QWORK_MR1552_MERGE_COMMIT_SHA,
    release_head: normalizedHead,
    applicability: activation.state,
    applicable,
    activation_source: activation.source,
    architecture: architecture.architecture,
    successor_applicability: architecture.relationship.state,
    architecture_activation_source: architecture.activation_source,
    assertion_owner: architecture.assertion_owner,
    origin_ancestry: originAncestryProjection(
      originAncestry,
      QWORK_MR1552_MERGE_COMMIT_SHA,
      normalizedHead,
    ),
    release_before_origin_ancestry: ancestryProjection(releaseBeforeOriginAncestry),
    successor_ancestry: originAncestryProjection(
      successorAncestry,
      QWORK_MR1559_MERGE_COMMIT_SHA,
      normalizedHead,
    ),
    release_before_successor_ancestry: ancestryProjection(releaseBeforeSuccessorAncestry),
    successor: {
      contract_id: QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
      mr_iid: '1559',
      merge_commit_sha: QWORK_MR1559_MERGE_COMMIT_SHA,
    },
    test_execution_attested: false,
    status,
    verified,
    protected_paths: [...architecture.protected_paths],
    source_files: sourceFiles,
    checks,
    failure_ids: failureIds,
    evidence_failures: uniqueEvidenceFailures,
  };
  return { ...value, attestation_sha256: sha256(stableJson(value)) };
}

function expectedUnresolved(risks) {
  return risks.flatMap((risk) => [
    ...(Array.isArray(risk?.failure_ids) ? risk.failure_ids : [])
      .map((failureId) => `${risk.risk_id}:${failureId}`),
    ...(Array.isArray(risk?.evidence_failures) ? risk.evidence_failures : [])
      .map((failure) => `${risk.risk_id}:${failure}`),
  ]);
}

const SOURCE_FILE_FIELDS = Object.freeze([
  'blob_id',
  'bytes',
  'commit_id',
  'content_base64',
  'encoding',
  'error',
  'last_commit_id',
  'path',
  'ref',
  'requested_ref',
  'sha256',
]);

function blockingRiskAuditFilesFromEvidence(sourceFiles) {
  return (Array.isArray(sourceFiles) ? sourceFiles : []).map((file) => {
    if (text(file?.error)) {
      return {
        path: text(file?.path),
        requested_ref: text(file?.requested_ref),
        error: text(file?.error),
      };
    }
    return {
      path: text(file?.path),
      requested_ref: text(file?.requested_ref),
      payload: {
        file_path: text(file?.path),
        ref: text(file?.ref),
        commit_id: text(file?.commit_id),
        blob_id: text(file?.blob_id),
        last_commit_id: text(file?.last_commit_id),
        encoding: text(file?.encoding),
        size: file?.bytes,
        content: typeof file?.content_base64 === 'string' ? file.content_base64 : '',
      },
    };
  });
}

function validateSourceFileEvidence(sourceFiles, expectedPaths, releaseHead) {
  const failures = [];
  if (!Array.isArray(sourceFiles)) return ['blocking_risk_source_files_missing'];
  if (sourceFiles.length !== expectedPaths.length) {
    failures.push(`blocking_risk_source_file_count:${sourceFiles.length}`);
  }
  for (const [index, file] of sourceFiles.entries()) {
    const label = text(file?.path) || `index-${index}`;
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
      failures.push(`blocking_risk_source_file_invalid:${label}`);
      continue;
    }
    if (stableJson(Object.keys(file).sort()) !== stableJson([...SOURCE_FILE_FIELDS].sort())) {
      failures.push(`blocking_risk_source_file_fields_mismatch:${label}`);
    }
    if (text(file.path) !== expectedPaths[index]) failures.push(`blocking_risk_source_file_path_mismatch:${label}`);
    if (text(file.requested_ref) !== releaseHead) failures.push(`blocking_risk_source_file_requested_ref_mismatch:${label}`);
    const error = text(file.error);
    if (error) {
      if (text(file.ref) || text(file.commit_id) || text(file.blob_id) || text(file.last_commit_id)
        || text(file.encoding) || Number(file.bytes) !== 0 || text(file.sha256) || text(file.content_base64)) {
        failures.push(`blocking_risk_source_file_error_projection_mismatch:${label}`);
      }
      continue;
    }
    if (text(file.ref) !== releaseHead) failures.push(`blocking_risk_source_file_ref_mismatch:${label}`);
    if (text(file.commit_id) !== releaseHead) failures.push(`blocking_risk_source_file_commit_id_mismatch:${label}`);
    if (!HEX40.test(text(file.blob_id))) failures.push(`blocking_risk_source_file_blob_id_invalid:${label}`);
    if (!HEX40.test(text(file.last_commit_id))) failures.push(`blocking_risk_source_file_last_commit_id_invalid:${label}`);
    if (text(file.encoding).toLowerCase() !== 'base64') failures.push(`blocking_risk_source_file_encoding_mismatch:${label}`);
    let bytes = Buffer.alloc(0);
    try {
      bytes = strictBase64Decode(file.content_base64);
    } catch (error_) {
      failures.push(`blocking_risk_source_file_${text(error_?.message) || 'decode_failed'}:${label}`);
    }
    if (bytes.length && HEX40.test(text(file.blob_id))
      && text(file.blob_id).toLowerCase() !== gitBlobSha1(bytes)) {
      failures.push(`blocking_risk_source_file_blob_id_content_mismatch:${label}`);
    }
    if (!Number.isSafeInteger(Number(file.bytes)) || Number(file.bytes) <= 0 || Number(file.bytes) !== bytes.length) {
      failures.push(`blocking_risk_source_file_bytes_mismatch:${label}`);
    }
    if (!HEX64.test(text(file.sha256)) || text(file.sha256) !== sha256(bytes)) {
      failures.push(`blocking_risk_source_file_sha256_mismatch:${label}`);
    }
  }
  return failures;
}

export function validateQworkReleaseBlockingRisksForReport(report) {
  const failures = [];
  const risks = Array.isArray(report?.blocking_risks) ? report.blocking_risks : [];
  if (!Array.isArray(report?.blocking_risks)) failures.push('blocking_risks_missing');
  if (risks.length !== 1) failures.push(`blocking_risk_count:${risks.length}`);
  const risk = risks.find((item) => item?.risk_id === QWORK_MR1552_EXECUTION_RUNNER_RISK_ID);
  let replayedRisk = null;
  if (!risk) failures.push('blocking_risk_mr1552_missing');
  if (risk) {
    if (risk.schema_version !== QWORK_RELEASE_BLOCKING_RISK_SCHEMA) failures.push('blocking_risk_schema_mismatch');
    if (risk.merge_commit_sha !== QWORK_MR1552_MERGE_COMMIT_SHA) failures.push('blocking_risk_merge_sha_mismatch');
    if (risk.release_head !== report?.release?.head) failures.push('blocking_risk_release_head_mismatch');
    if (risk.test_execution_attested !== false) failures.push('blocking_risk_test_execution_attestation_mismatch');
    if (risk?.successor?.contract_id !== QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID
      || text(risk?.successor?.mr_iid) !== '1559'
      || risk?.successor?.merge_commit_sha !== QWORK_MR1559_MERGE_COMMIT_SHA) {
      failures.push('blocking_risk_successor_identity_mismatch');
    }
    const expectedActivation = riskApplicability(
      text(report?.release?.head),
      risk.origin_ancestry,
      risk.release_before_origin_ancestry,
    );
    const expectedApplicable = expectedActivation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE
      ? true
      : expectedActivation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE
        ? false
        : null;
    if (risk.applicability !== expectedActivation.state) failures.push('blocking_risk_applicability_mismatch');
    if (risk.applicable !== expectedApplicable) failures.push('blocking_risk_applicable_mismatch');
    if (risk.activation_source !== expectedActivation.source) failures.push('blocking_risk_activation_source_mismatch');
    const expectedArchitecture = successorArchitecture(
      text(report?.release?.head),
      risk.successor_ancestry,
      risk.release_before_successor_ancestry,
    );
    if (risk.architecture !== expectedArchitecture.architecture) failures.push('blocking_risk_architecture_mismatch');
    if (risk.successor_applicability !== expectedArchitecture.relationship.state) {
      failures.push('blocking_risk_successor_applicability_mismatch');
    }
    if (risk.architecture_activation_source !== expectedArchitecture.activation_source) {
      failures.push('blocking_risk_architecture_activation_source_mismatch');
    }
    if (stableJson(risk.assertion_owner) !== stableJson(expectedArchitecture.assertion_owner)) {
      failures.push('blocking_risk_assertion_owner_mismatch');
    }
    if (stableJson(risk.protected_paths) !== stableJson([...expectedArchitecture.protected_paths])) {
      failures.push('blocking_risk_protected_paths_mismatch');
    }
    const sourceFilePaths = Array.isArray(risk.source_files)
      ? risk.source_files.map((file) => text(file?.path)) : [];
    const expectedSourceFilePaths = expectedApplicable === true ? [...expectedArchitecture.protected_paths] : [];
    if (stableJson(sourceFilePaths) !== stableJson(expectedSourceFilePaths)) {
      failures.push('blocking_risk_source_file_paths_mismatch');
    }
    failures.push(...validateSourceFileEvidence(
      risk.source_files,
      expectedSourceFilePaths,
      text(report?.release?.head),
    ));
    replayedRisk = auditQworkReleaseBlockingRisk({
      releaseHead: text(report?.release?.head),
      originAncestry: risk.origin_ancestry,
      releaseBeforeOriginAncestry: risk.release_before_origin_ancestry,
      successorAncestry: risk.successor_ancestry,
      releaseBeforeSuccessorAncestry: risk.release_before_successor_ancestry,
      files: blockingRiskAuditFilesFromEvidence(risk.source_files),
    });
    if (stableJson(risk) !== stableJson(replayedRisk)) failures.push('blocking_risk_replay_mismatch');
    const copy = structuredClone(risk);
    delete copy.attestation_sha256;
    if (!HEX64.test(text(risk.attestation_sha256)) || sha256(stableJson(copy)) !== risk.attestation_sha256) {
      failures.push('blocking_risk_attestation_sha256_mismatch');
    }
    const checks = Array.isArray(risk.checks) ? risk.checks : [];
    const ids = checks.map((check) => check?.id);
    if (stableJson(ids) !== stableJson(QWORK_MR1552_FAILURE_IDS)) failures.push('blocking_risk_check_ids_mismatch');
    const architectureKnown = expectedArchitecture.relationship.state
      !== QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN;
    const derivedFailureIds = expectedApplicable === true && architectureKnown
      ? checks.filter((check) => check?.passed !== true).map((check) => check.id)
      : [];
    if (!Array.isArray(risk.failure_ids)
      || stableJson(risk.failure_ids) !== stableJson(derivedFailureIds)) failures.push('blocking_risk_failure_ids_mismatch');
    const evidenceFailures = Array.isArray(risk.evidence_failures) ? risk.evidence_failures : [];
    const derivedVerified = expectedApplicable === true
      && architectureKnown
      && derivedFailureIds.length === 0
      && evidenceFailures.length === 0;
    const expectedStatus = expectedActivation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE
      ? 'NOT_APPLICABLE'
      : derivedVerified
        ? 'VERIFIED'
        : 'BLOCKED';
    if (risk.verified !== derivedVerified) failures.push('blocking_risk_verified_mismatch');
    if (risk.status !== expectedStatus) failures.push('blocking_risk_status_mismatch');
  }
  const canonicalRisks = replayedRisk ? [replayedRisk] : risks;
  const unresolved = expectedUnresolved(canonicalRisks);
  const actualUnresolved = report?.unresolved?.blocking_risk_failures;
  if (!Array.isArray(actualUnresolved)) failures.push('blocking_risk_unresolved_missing');
  else if (stableJson(actualUnresolved) !== stableJson(unresolved)) failures.push('blocking_risk_unresolved_mismatch');
  const applicableCount = canonicalRisks.filter((item) => item?.applicable === true).length;
  const verifiedCount = canonicalRisks.filter((item) => item?.verified === true && item?.status === 'VERIFIED').length;
  if (Number(report?.summary?.blocking_risk_count) !== risks.length) failures.push('blocking_risk_summary_count_mismatch');
  if (Number(report?.summary?.blocking_risk_applicable_count) !== applicableCount) failures.push('blocking_risk_summary_applicable_count_mismatch');
  if (Number(report?.summary?.blocking_risk_verified_count) !== verifiedCount) failures.push('blocking_risk_summary_verified_count_mismatch');
  if (Number(report?.summary?.blocking_risk_failure_count) !== unresolved.length) failures.push('blocking_risk_summary_failure_count_mismatch');
  if (report?.policy?.api_freshness && report.policy.api_freshness.blocking_risks_verified !== (unresolved.length === 0)) {
    failures.push('blocking_risk_freshness_verified_mismatch');
  }
  if (unresolved.length && report?.decision !== 'BLOCKED') failures.push('blocking_risk_failure_without_blocked_decision');
  return { ok: failures.length === 0, failures, unresolved_failures: unresolved };
}
