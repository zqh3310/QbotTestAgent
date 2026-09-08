import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import {
  auditQworkSuccessorAstContracts,
  auditQworkSuccessorContextHelperAstContract,
} from './qwork-release-blocking-risk-ast.mjs';

export const QWORK_RELEASE_BLOCKING_RISK_SCHEMA = 'qbot-qwork-release-blocking-risk-attestation/v5';
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
  'electron/host-core/agent/execution-worker-controller.cjs',
  'electron/host-core/agent/execution-worker-cancellation.cjs',
  'electron/host-core/agent/execution-worker-deadline.cjs',
  'electron/host-core/agent/execution-worker-callback-settlement.cjs',
  'electron/host-core/agent/execution-worker-event-flow.cjs',
  'electron/host-core/agent/execution-worker-entry.cjs',
  'electron/host-core/agent/execution-worker-manager.cjs',
  'electron/host-core/agent/execution-worker-supervisor.cjs',
  'electron/host-core/agent/execution-worker-supervisor-message.cjs',
  'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
  'electron/host-core/agent/execution-worker-termination.cjs',
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

function scopeHasParameterBinding(tokens, scope, identifier) {
  let open = -1;
  let close = -1;
  if (scope.kind === 'arrow') {
    const arrow = scope.body_open - 1;
    if (tokens[arrow]?.value !== '=>') return false;
    if (tokens[arrow - 1]?.value === ')') {
      close = arrow - 1;
      open = matchingOpenTokenIndex(tokens, close);
    } else {
      return tokens[arrow - 1]?.type === 'identifier'
        && tokens[arrow - 1].value === identifier;
    }
  } else if (tokens[scope.body_open - 1]?.value === ')') {
    close = scope.body_open - 1;
    open = matchingOpenTokenIndex(tokens, close);
  }
  if (open < 0 || close < 0) return false;
  return topLevelRanges(tokens, open + 1, close).some(([start, end]) => {
    if (tokens[start]?.type === 'identifier') return tokens[start].value === identifier;
    if (tokens[start]?.value !== '{') return false;
    const objectClose = matchingTokenIndex(tokens, start, '{', '}', end);
    if (objectClose < 0) return false;
    const property = uniqueEffectiveProperty(
      objectProperties(tokens, start, objectClose) || [], identifier,
    );
    return Boolean(property
      && tokens[property.value_start]?.type === 'identifier'
      && tokens[property.value_start].value === identifier
      && (property.value_end - property.value_start === 1
        || tokens[property.value_start + 1]?.value === '='));
  });
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

function exactMemberExpression(tokens, start, end, baseName, propertyName) {
  [start, end] = trimWholeExpressionParentheses(tokens, start, end);
  return end - start === 3
    && tokens[start]?.type === 'identifier'
    && tokens[start].value === baseName
    && ['.', '?.'].includes(tokens[start + 1]?.value)
    && tokens[start + 2]?.type === 'identifier'
    && tokens[start + 2].value === propertyName;
}

function memberAssignmentExpression(tokens, baseName, propertyName) {
  const matches = [];
  for (let index = 0; index + 4 < tokens.length; index += 1) {
    if (tokens[index]?.type !== 'identifier'
      || tokens[index].value !== baseName
      || !['.', '?.'].includes(tokens[index + 1]?.value)
      || tokens[index + 2]?.type !== 'identifier'
      || tokens[index + 2].value !== propertyName
      || tokens[index + 3]?.value !== '=') continue;
    matches.push({
      assignment_start: index,
      expression_start: index + 4,
      expression_end: expressionEnd(tokens, index + 4),
    });
  }
  return matches.length === 1 ? matches[0] : null;
}

function assignmentPromiseChainObservesCall(tokens, assignment, call) {
  if (!assignment
    || call.start < assignment.expression_start
    || call.close >= assignment.expression_end
    || !rangeIsOnUnconditionalPath(
      tokens, assignment.assignment_start, assignment.expression_end,
    )) return false;
  const expression = tokens.slice(assignment.expression_start, assignment.expression_end);
  const relativeCall = {
    ...call,
    start: call.start - assignment.expression_start,
    open: call.open - assignment.expression_start,
    close: call.close - assignment.expression_start,
  };
  const promiseResolve = callAt(expression, 0);
  if (!promiseResolve
    || promiseResolve.path.join('.') !== 'Promise.resolve'
    || splitCallArguments(expression, promiseResolve).length !== 0) return false;
  for (let index = promiseResolve.close + 1; index < expression.length; index += 1) {
    if (expression[index]?.value !== '.' || expression[index + 1]?.value !== 'then') continue;
    const continuation = callAt(expression, index + 1);
    if (!continuation || continuation.path.length !== 1 || continuation.path[0] !== 'then') continue;
    const arguments_ = splitCallArguments(expression, continuation);
    if (arguments_.length !== 1) continue;
    const [argument] = arguments_;
    if (relativeCall.start < argument[0] || relativeCall.close >= argument[1]) continue;
    if (expressionArrowReturnsExactCall(
      expression, argument[0], argument[1], relativeCall,
    )) return true;
  }
  return false;
}

function assignedMemberIsReturnedAfter(tokens, assignment, recordParameter, propertyName) {
  if (!assignment) return false;
  const returns = returnExpressionRanges(tokens).filter(([start, end]) => (
    start > assignment.expression_end
    && rangeIsOnUnconditionalPath(tokens, start, end)
    && exactMemberExpression(tokens, start, end, recordParameter, propertyName)
  ));
  return returns.length >= 1;
}

function releaseScopeObservesStopCall(tokens, call, recordParameter) {
  const finalization = memberAssignmentExpression(tokens, recordParameter, 'finalizationPromise');
  if (finalization
    && call.start >= finalization.expression_start
    && call.close < finalization.expression_end) {
    return callResultIsObserved(tokens, call)
      && assignedMemberIsReturnedAfter(
        tokens, finalization, recordParameter, 'finalizationPromise',
      );
  }
  return callResultIsObserved(tokens, call);
}

function stopHelperOwnsSupervisor(tokens, scopes, stopHelper, recordParameter) {
  const stopTokens = scopeReachableTokens(tokens, stopHelper, scopes);
  const stopCalls = callsInTokens(stopTokens).filter((call) => (
    call.path.length === 3
    && call.path[0] === recordParameter
    && call.path[1] === 'supervisor'
    && call.path[2] === 'stop'
    && callIsOnUnconditionalPath(stopTokens, call)
  ));
  if (stopCalls.length !== 1) return false;
  if (callResultIsObserved(stopTokens, stopCalls[0])) return true;
  const assignment = memberAssignmentExpression(stopTokens, recordParameter, 'stopPromise');
  return assignmentPromiseChainObservesCall(stopTokens, assignment, stopCalls[0])
    && assignedMemberIsReturnedAfter(
      stopTokens, assignment, recordParameter, 'stopPromise',
    );
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
    && releaseScopeObservesStopCall(owned, call, recordParameter)
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
  if (!drainDelegate
    || ![1, 2].includes(drainDelegate.public_parameters.length)
    || drainDelegate.public_parameters.some((parameter) => !parameter)
    || drainDelegate.arguments.length !== drainDelegate.public_parameters.length + 3
    || drainDelegate.arguments.slice(0, 3).join('\0') !== leaseParameters.slice(0, 3).join('\0')
    || drainDelegate.arguments.slice(3).join('\0') !== drainDelegate.public_parameters.join('\0')) {
    return false;
  }
  return recordReleaseScopeContract(tokens, scopes, drainDelegate.helper);
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

function exactStringArgument(tokens, call, index, value) {
  const range = splitCallArguments(tokens, call)[index];
  return Boolean(range
    && range[1] - range[0] === 1
    && tokens[range[0]]?.type === 'string'
    && tokens[range[0]].value === value);
}

function exactIdentifierObjectArgument(
  tokens,
  call,
  index,
  expectedBindings,
  optionalBindings = {},
) {
  const range = splitCallArguments(tokens, call)[index];
  if (!range || tokens[range[0]]?.value !== '{') return false;
  const close = matchingTokenIndex(tokens, range[0], '{', '}', range[1]);
  if (close !== range[1] - 1) return false;
  const properties = objectProperties(tokens, range[0], close) || [];
  const requiredEntries = Object.entries(expectedBindings);
  const allowedEntries = [...requiredEntries, ...Object.entries(optionalBindings)];
  const allowedBindings = new Map(allowedEntries);
  if (allowedBindings.size !== allowedEntries.length
    || properties.length < requiredEntries.length
    || properties.length > allowedBindings.size
    || properties.some((property) => property.spread)) return false;
  const everyPropertyIsAllowedAndExact = properties.every((property) => {
    const identifier = allowedBindings.get(property.key);
    return Boolean(identifier
      && property.value_end - property.value_start === 1
      && tokens[property.value_start]?.type === 'identifier'
      && tokens[property.value_start].value === identifier);
  });
  return everyPropertyIsAllowedAndExact && requiredEntries.every(([key, identifier]) => {
    const property = uniqueEffectiveProperty(properties, key);
    return Boolean(property
      && property.value_end - property.value_start === 1
      && tokens[property.value_start]?.type === 'identifier'
      && tokens[property.value_start].value === identifier);
  });
}

function statementRange(tokens, start) {
  if (tokens[start]?.value === '{') {
    const close = matchingTokenIndex(tokens, start, '{', '}');
    return close < 0 ? null : { start: start + 1, end: close, next: close + 1, braced: true };
  }
  const end = expressionEnd(tokens, start);
  return end <= start ? null : { start, end, next: Math.min(tokens.length, end + 1), braced: false };
}

function ifStatements(tokens) {
  const statements = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== 'if' || tokens[index + 1]?.value !== '(') continue;
    const conditionClose = matchingTokenIndex(tokens, index + 1);
    if (conditionClose < 0) continue;
    const then = statementRange(tokens, conditionClose + 1);
    if (!then) continue;
    let otherwise = null;
    if (tokens[then.next]?.value === 'else') otherwise = statementRange(tokens, then.next + 1);
    statements.push({
      index,
      condition_start: index + 2,
      condition_end: conditionClose,
      then,
      else_index: tokens[then.next]?.value === 'else' ? then.next : -1,
      otherwise,
      end: otherwise?.next ?? then.next,
    });
  }
  return statements;
}

function branchHasUnconditionalReturn(tokens, branch, expectedValue = undefined) {
  if (!branch) return false;
  const branchTokens = tokens.slice(branch.start, branch.end);
  for (let index = 0; index < branchTokens.length; index += 1) {
    if (branchTokens[index]?.value !== 'return') continue;
    const end = returnExpressionEnd(branchTokens, index + 1);
    if (!rangeIsOnUnconditionalPath(branchTokens, index, end)) continue;
    const expression = branchTokens.slice(index + 1, end);
    if (expectedValue === undefined) return true;
    if (expression.length === 1 && expression[0]?.value === expectedValue) return true;
  }
  return false;
}

function conditionHasExactCall(tokens, statement, path, arguments_, { negated = false } = {}) {
  const condition = tokens.slice(statement.condition_start, statement.condition_end);
  return callsInTokens(condition).some((call) => (
    call.path.join('.') === path
    && arguments_.every((expected, index) => argumentHasExactTokens(condition, call, index, expected))
    && (negated ? condition[call.start - 1]?.value === '!' : condition[call.start - 1]?.value !== '!')
  ));
}

function conditionHasSequence(tokens, statement, sequence) {
  return tokensContainSequence(
    tokens.slice(statement.condition_start, statement.condition_end),
    sequence,
  );
}

function conditionHasBareNegatedIdentifier(tokens, statement, identifier) {
  const condition = tokens.slice(statement.condition_start, statement.condition_end);
  return condition.some((token, index) => (
    token?.value === '!'
    && condition[index + 1]?.type === 'identifier'
    && condition[index + 1].value === identifier
    && !['.', '?.'].includes(condition[index + 2]?.value)
  ));
}

function conditionIsExactCall(tokens, statement, path, arguments_) {
  const condition = tokens.slice(statement.condition_start, statement.condition_end);
  const [start, end] = trimWholeExpressionParentheses(condition, 0, condition.length);
  const calls = callsInTokens(condition).filter((call) => (
    call.path.join('.') === path
    && arguments_.every((expected, index) => argumentHasExactTokens(condition, call, index, expected))
  ));
  return calls.length === 1 && expressionIsExactCall(condition, start, end, calls[0]);
}

function callbackBodyTokens(tokens, argumentRange) {
  if (!argumentRange) return [];
  let arrow = -1;
  for (let index = argumentRange[0]; index < argumentRange[1]; index += 1) {
    if (tokens[index]?.value !== '=>') continue;
    if (arrow >= 0) return [];
    arrow = index;
  }
  if (arrow < 0) return [];
  const bodyStart = arrow + 1;
  if (tokens[bodyStart]?.value !== '{') {
    return reachableTokens(tokens.slice(bodyStart, argumentRange[1]));
  }
  const bodyClose = matchingTokenIndex(tokens, bodyStart, '{', '}', argumentRange[1]);
  if (bodyClose !== argumentRange[1] - 1) return [];
  return reachableTokens(tokens.slice(bodyStart + 1, bodyClose));
}

function callCallbackBody(tokens, call, argumentIndex = 0) {
  return callbackBodyTokens(tokens, splitCallArguments(tokens, call)[argumentIndex]);
}

function directReturnExpressions(tokens) {
  return returnExpressionRanges(tokens).filter(([start, end]) => (
    rangeIsOnUnconditionalPath(tokens, start - 1, end)
  ));
}

function exactAwaitedIdentifierReturn(tokens, identifier) {
  return directReturnExpressions(tokens).some(([rawStart, rawEnd]) => {
    const [start, end] = trimWholeExpressionParentheses(tokens, rawStart, rawEnd);
    return end - start === 2
      && tokens[start]?.value === 'await'
      && tokens[start + 1]?.type === 'identifier'
      && tokens[start + 1].value === identifier;
  });
}

function tryFinallyStatements(tokens) {
  const statements = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== 'try' || tokens[index + 1]?.value !== '{') continue;
    const tryClose = matchingTokenIndex(tokens, index + 1, '{', '}');
    if (tryClose < 0) continue;
    let cursor = tryClose + 1;
    let catchRange = null;
    if (tokens[cursor]?.value === 'catch') {
      cursor += 1;
      if (tokens[cursor]?.value === '(') cursor = matchingTokenIndex(tokens, cursor) + 1;
      if (tokens[cursor]?.value !== '{') continue;
      const catchClose = matchingTokenIndex(tokens, cursor, '{', '}');
      if (catchClose < 0) continue;
      catchRange = { start: cursor + 1, end: catchClose };
      cursor = catchClose + 1;
    }
    if (tokens[cursor]?.value !== 'finally' || tokens[cursor + 1]?.value !== '{') continue;
    const finallyClose = matchingTokenIndex(tokens, cursor + 1, '{', '}');
    if (finallyClose < 0) continue;
    statements.push({
      index,
      try: { start: index + 2, end: tryClose },
      catch: catchRange,
      finally: { start: cursor + 2, end: finallyClose },
      end: finallyClose + 1,
    });
  }
  return statements;
}

function immutableConstBindingBefore(tokens, identifier, beforeIndex) {
  const assignment = assignmentExpression(tokens, identifier);
  if (!assignment
    || assignment.declaration_kind !== 'const'
    || assignment.expression_end > beforeIndex
    || !rangeIsOnUnconditionalPath(tokens, assignment.assignment_start, assignment.expression_end)) return null;
  const writes = tokens.filter((token, index) => (
    token?.type === 'identifier'
    && token.value === identifier
    && tokens[index + 1]?.value === '='
  ));
  return writes.length === 1 ? assignment : null;
}

function cancellationTerminationContract(source) {
  if (!topLevelFunctionBinding(source, 'requestExecutionWorkerTurn')
    || !topLevelFunctionBinding(source, 'createExecutionWorkerRequestSettlement')
    || !exactModuleExportsIdentifierSet(source, [
      'createExecutionWorkerRequestSettlement',
      'requestExecutionWorkerTurn',
    ])) return false;
  const tokens = reachableTokens(tokenizeJavascriptForRiskAudit(source));
  const scopes = collectFunctionScopes(tokens);
  const request = uniqueScope(scopes, 'requestExecutionWorkerTurn');
  const settlement = uniqueScope(scopes, 'createExecutionWorkerRequestSettlement');
  if (!request || !settlement
    || !['supervisor', 'operation', 'identity', 'payload', 'options', 'signal']
      .every((name) => scopeHasParameterBinding(tokens, request, name))
    || !['child', 'operation', 'deadlineMs', 'cancellationTimeoutMs', 'terminateChild', 'onDeadline', 'resolve', 'reject']
      .every((name) => scopeHasParameterBinding(tokens, settlement, name))) return false;

  const requestTokens = scopeReachableTokens(tokens, request, scopes);
  const requestCalls = callsInTokens(requestTokens);
  const pendingRequests = requestCalls.filter((call) => (
    call.path.join('.') === 'supervisor.request'
    && assignedIdentifierForCall(requestTokens, call) === 'pending'
    && ['operation', 'identity', 'payload', 'options'].every((name, index) => (
      argumentHasExactTokens(requestTokens, call, index, [name])
    ))
  ));
  if (pendingRequests.length !== 1) return false;
  const [pendingRequest] = pendingRequests;
  const pendingBinding = immutableConstBindingBefore(
    requestTokens, 'pending', pendingRequest.close + 1,
  );
  const cancelIdentity = immutableConstBindingBefore(
    requestTokens, 'cancelIdentity', requestTokens.length,
  );
  const onAbort = uniqueScope(scopes, 'onAbort', request);
  if (!pendingBinding || !cancelIdentity || !onAbort
    || pendingBinding.assignment_start !== pendingRequest.start - 2
    || cancelIdentity.assignment_start <= pendingBinding.assignment_start) return false;
  const onAbortTokens = scopeReachableTokens(tokens, onAbort, scopes);
  const cancelCalls = callsInTokens(onAbortTokens).filter((call) => (
    call.path.join('.') === 'supervisor.cancel'
    && argumentHasExactTokens(onAbortTokens, call, 0, ['cancelIdentity'])
    && exactStringArgument(onAbortTokens, call, 1, 'user-requested')
    && callIsOnUnconditionalPath(onAbortTokens, call)
  ));
  const listenerAdds = requestCalls.filter((call) => (
    call.path.join('.') === 'signal.addEventListener'
    && exactStringArgument(requestTokens, call, 0, 'abort')
    && argumentHasExactTokens(requestTokens, call, 1, ['onAbort'])
    && argumentHasExactTokens(requestTokens, call, 2, ['{', 'once', ':', 'true', '}'])
  ));
  const abortBranches = ifStatements(requestTokens).filter((statement) => (
    conditionHasSequence(requestTokens, statement, ['signal', '.', 'aborted'])
    && callsInTokens(requestTokens.slice(statement.then.start, statement.then.end)).some((call) => (
      call.path.length === 1
      && call.path[0] === 'onAbort'
      && splitCallArguments(requestTokens.slice(statement.then.start, statement.then.end), call).length === 0
      && callIsOnUnconditionalPath(
        requestTokens.slice(statement.then.start, statement.then.end), call,
      )
    ))
  ));
  const requestTryFinally = tryFinallyStatements(requestTokens).filter((statement) => {
    const tryTokens = requestTokens.slice(statement.try.start, statement.try.end);
    const finallyTokens = requestTokens.slice(statement.finally.start, statement.finally.end);
    const removes = callsInTokens(finallyTokens).filter((call) => (
      call.path.join('.') === 'signal.removeEventListener'
      && exactStringArgument(finallyTokens, call, 0, 'abort')
      && argumentHasExactTokens(finallyTokens, call, 1, ['onAbort'])
      && callIsOnUnconditionalPath(finallyTokens, call)
    ));
    return exactAwaitedIdentifierReturn(tryTokens, 'pending') && removes.length === 1;
  });
  const pendingReturns = returnExpressionRanges(requestTokens).filter(([start, end]) => (
    requestTokens.slice(start, end).some((token) => token?.value === 'pending')
  ));
  const allPendingReturnsAwaited = pendingReturns.length > 0 && pendingReturns.every(([rawStart, rawEnd]) => {
    const [start, end] = trimWholeExpressionParentheses(requestTokens, rawStart, rawEnd);
    return end - start === 2
      && requestTokens[start]?.value === 'await'
      && requestTokens[start + 1]?.value === 'pending';
  });
  const requestContract = cancelCalls.length === 1
    && listenerAdds.length === 1
    && abortBranches.length === 1
    && requestTryFinally.length === 1
    && allPendingReturnsAwaited
    && pendingRequest.start < cancelIdentity.assignment_start
    && cancelIdentity.expression_end < requestTokens.findIndex((token) => token?.type === 'boundary');

  const settlementTokens = reachableTokens(tokens.slice(
    settlement.body_open + 1, settlement.body_close,
  ));
  const settlementCalls = callsInTokens(settlementTokens);
  const deadlineTimers = settlementCalls.filter((call) => (
    call.path.length === 1
    && call.path[0] === 'setTimeout'
    && assignedIdentifierForCall(settlementTokens, call) === 'deadline'
    && argumentHasExactTokens(settlementTokens, call, 1, ['deadlineMs', '+', '1'])
  ));
  const armCancellation = uniqueScope(scopes, 'armCancellation', settlement);
  const clear = uniqueScope(scopes, 'clear', settlement);
  const resolveSettlement = uniqueScope(scopes, 'resolve', settlement);
  const rejectSettlement = uniqueScope(scopes, 'reject', settlement);
  if (deadlineTimers.length !== 1 || !armCancellation || !clear
    || !resolveSettlement || !rejectSettlement) return false;

  const deadlineBody = callCallbackBody(settlementTokens, deadlineTimers[0]);
  const deadlineCalls = callsInTokens(deadlineBody);
  const deadlineClear = deadlineCalls.find((call) => (
    call.path.length === 1 && call.path[0] === 'clear'
    && splitCallArguments(deadlineBody, call).length === 0
  ));
  const deadlineHook = deadlineCalls.find((call) => (
    call.path.length === 1 && call.path[0] === 'onDeadline'
    && splitCallArguments(deadlineBody, call).length === 0
  ));
  const deadlineReject = deadlineCalls.find((call) => (
    call.path.length === 1 && call.path[0] === 'reject'
    && splitCallArguments(deadlineBody, call).length === 1
  ));
  const deadlineBranches = ifStatements(deadlineBody).filter((statement) => (
    conditionHasSequence(deadlineBody, statement, ['operation', '===', 'execution.start'])
    && callsInTokens(deadlineBody.slice(statement.then.start, statement.then.end)).some((call) => {
      const branch = deadlineBody.slice(statement.then.start, statement.then.end);
      return call.path.length === 1
        && call.path[0] === 'terminateChild'
        && argumentHasExactTokens(branch, call, 0, ['child'])
        && exactStringArgument(branch, call, 1, 'execution-deadline')
        && branch[call.start - 1]?.value === 'void';
    })
  ));

  const armTokens = scopeReachableTokens(tokens, armCancellation, scopes);
  const cancellationTimers = callsInTokens(armTokens).filter((call) => (
    call.path.length === 1
    && call.path[0] === 'setTimeout'
    && assignedIdentifierForCall(armTokens, call) === 'cancellationTimer'
  ));
  const cancellationBody = cancellationTimers.length === 1
    ? callCallbackBody(armTokens, cancellationTimers[0]) : [];
  const cancellationTerminations = callsInTokens(cancellationBody).filter((call) => (
    call.path.length === 1
    && call.path[0] === 'terminateChild'
    && argumentHasExactTokens(cancellationBody, call, 0, ['child'])
    && exactStringArgument(cancellationBody, call, 1, 'cancel-timeout')
    && cancellationBody[call.start - 1]?.value === 'void'
    && callIsOnUnconditionalPath(cancellationBody, call)
  ));

  const clearTokens = scopeReachableTokens(tokens, clear, scopes);
  const clearCalls = callsInTokens(clearTokens).filter((call) => (
    call.path.length === 1 && call.path[0] === 'clearTimeout'
    && callIsOnUnconditionalPath(clearTokens, call)
  ));
  const clearContract = clearCalls.length === 2
    && clearCalls.some((call) => argumentHasExactTokens(clearTokens, call, 0, ['deadline']))
    && clearCalls.some((call) => argumentHasExactTokens(clearTokens, call, 0, ['cancellationTimer']));
  const settlementCallbackContract = (scope, callbackName, argumentName) => {
    const owned = scopeReachableTokens(tokens, scope, scopes);
    const calls = callsInTokens(owned);
    const clearCall = calls.find((call) => (
      call.path.length === 1 && call.path[0] === 'clear'
      && splitCallArguments(owned, call).length === 0
      && callIsOnUnconditionalPath(owned, call)
    ));
    const callback = calls.find((call) => (
      call.path.length === 1 && call.path[0] === callbackName
      && argumentHasExactTokens(owned, call, 0, [argumentName])
      && callIsOnUnconditionalPath(owned, call)
    ));
    return Boolean(clearCall && callback && clearCall.start < callback.start);
  };
  const settlementContract = Boolean(deadlineClear && deadlineHook && deadlineReject
    && deadlineClear.start < deadlineHook.start
    && deadlineHook.start < deadlineReject.start
    && deadlineBranches.length === 1
    && cancellationTerminations.length === 1
    && clearContract
    && settlementCallbackContract(resolveSettlement, 'resolve', 'value')
    && settlementCallbackContract(rejectSettlement, 'reject', 'error'));
  return requestContract && settlementContract;
}

function returnedArrowBlock(tokens, scope) {
  const owned = reachableTokens(tokens.slice(scope.body_open + 1, scope.body_close));
  const depths = tokenBraceDepths(owned);
  const candidates = [];
  for (let index = 0; index < owned.length; index += 1) {
    if (depths[index] !== 0 || owned[index]?.value !== 'return') continue;
    const end = returnExpressionEnd(owned, index + 1);
    let arrow = -1;
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      if (owned[cursor]?.value !== '=>') continue;
      arrow = cursor;
      break;
    }
    if (arrow < 0 || owned[arrow + 1]?.value !== '{') continue;
    const bodyClose = matchingTokenIndex(owned, arrow + 1, '{', '}', end);
    if (bodyClose < 0 || bodyClose !== end - 1) continue;
    let parameters = [];
    if (owned[arrow - 1]?.value === ')') {
      const open = matchingOpenTokenIndex(owned, arrow - 1);
      if (open <= index) continue;
      parameters = topLevelRanges(owned, open + 1, arrow - 1).map(([start, finish]) => (
        owned[start]?.type === 'identifier'
          && (finish - start === 1 || owned[start + 1]?.value === '=')
          ? owned[start].value
          : ''
      ));
    } else if (owned[arrow - 1]?.type === 'identifier') {
      parameters = [owned[arrow - 1].value];
    }
    candidates.push({
      owned,
      return_index: index,
      arrow_index: arrow,
      parameters,
      body: reachableTokens(owned.slice(arrow + 2, bodyClose)),
    });
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function executionWorkerTerminatorContract(source) {
  const helperName = 'createExecutionWorkerTerminator';
  if (!topLevelFunctionBinding(source, helperName)
    || !exactModuleExportsIdentifierSet(source, [helperName])) return false;
  const tokens = reachableTokens(tokenizeJavascriptForRiskAudit(source));
  const scopes = collectFunctionScopes(tokens);
  const creator = uniqueScope(scopes, helperName);
  if (!creator
    || !['processId', 'processTreeKiller', 'cleanupGraceMs']
      .every((name) => scopeHasParameterBinding(tokens, creator, name))) return false;
  const returned = returnedArrowBlock(tokens, creator);
  if (!returned || returned.parameters.length !== 2
    || returned.parameters[0] !== 'target'
    || returned.parameters[1] !== 'reason') return false;
  const creatorTokens = returned.owned.slice(0, returned.return_index);
  const flightsBinding = immutableConstBindingBefore(
    creatorTokens, 'flights', creatorTokens.length,
  );
  if (!flightsBinding) return false;
  const flightsExpression = creatorTokens.slice(
    flightsBinding.expression_start, flightsBinding.expression_end,
  );
  const weakMapCall = callsInTokens(flightsExpression).filter((call) => (
    call.path.length === 1
    && call.path[0] === 'WeakMap'
    && flightsExpression[call.start - 1]?.value === 'new'
    && splitCallArguments(flightsExpression, call).length === 0
  ));
  if (weakMapCall.length !== 1) return false;

  const owned = returned.body;
  const calls = callsInTokens(owned);
  const existingGets = calls.filter((call) => (
    call.path.join('.') === 'flights.get'
    && assignedIdentifierForCall(owned, call) === 'existing'
    && argumentHasExactTokens(owned, call, 0, ['target'])
  ));
  const existingBinding = immutableConstBindingBefore(owned, 'existing', owned.length);
  const existingGuards = ifStatements(owned).filter((statement) => (
    conditionHasSequence(owned, statement, ['existing'])
    && branchHasUnconditionalReturn(owned, statement.then, 'existing')
  ));
  const pidCalls = calls.filter((call) => (
    call.path.length === 1
    && call.path[0] === 'processId'
    && assignedIdentifierForCall(owned, call) === 'pid'
    && argumentHasExactTokens(owned, call, 0, ['target', '.', 'pid'])
  ));
  const pidBinding = immutableConstBindingBefore(owned, 'pid', owned.length);
  const cleanupBinding = immutableConstBindingBefore(owned, 'cleanup', owned.length);
  const flightBinding = immutableConstBindingBefore(owned, 'flight', owned.length);
  if (existingGets.length !== 1 || !existingBinding || existingGuards.length !== 1
    || pidCalls.length !== 1 || !pidBinding || !cleanupBinding || !flightBinding) return false;
  const cleanupCalls = callsInTokens(owned.slice(
    cleanupBinding.expression_start, cleanupBinding.expression_end,
  ));
  const treeKills = cleanupCalls.filter((call) => {
    const expression = owned.slice(cleanupBinding.expression_start, cleanupBinding.expression_end);
    return call.path.length === 1
      && call.path[0] === 'processTreeKiller'
      && argumentHasExactTokens(expression, call, 0, ['pid'])
      && exactIdentifierObjectArgument(expression, call, 1, { reason: 'reason' });
  });
  const flightExpression = owned.slice(flightBinding.expression_start, flightBinding.expression_end);
  const killCalls = callsInTokens(flightExpression).filter((call) => (
    call.path.join('.') === 'target.kill'
    && splitCallArguments(flightExpression, call).length === 0
  ));
  const sets = calls.filter((call) => (
    call.path.join('.') === 'flights.set'
    && argumentHasExactTokens(owned, call, 0, ['target'])
    && argumentHasExactTokens(owned, call, 1, ['flight'])
  ));
  const finalizers = calls.filter((call) => (
    call.path.join('.') === 'flight.finally'
    && owned[call.start - 1]?.value === 'void'
  ));
  const finalizerBody = finalizers.length === 1 ? callCallbackBody(owned, finalizers[0]) : [];
  const deletes = callsInTokens(finalizerBody).filter((call) => (
    call.path.join('.') === 'flights.delete'
    && argumentHasExactTokens(finalizerBody, call, 0, ['target'])
    && callIsOnUnconditionalPath(finalizerBody, call)
  ));
  const finalReturns = directReturnExpressions(owned).filter(([rawStart, rawEnd]) => {
    const [start, end] = trimWholeExpressionParentheses(owned, rawStart, rawEnd);
    return end - start === 1 && owned[start]?.value === 'flight';
  });
  return treeKills.length === 1
    && killCalls.length === 1
    && sets.length === 1
    && finalizers.length === 1
    && deletes.length === 1
    && finalReturns.length === 1
    && existingGets[0].start < existingGuards[0].index
    && existingGuards[0].end < pidCalls[0].start
    && pidBinding.expression_end < cleanupBinding.assignment_start
    && cleanupBinding.expression_end < flightBinding.assignment_start
    && flightBinding.expression_end < sets[0].start
    && sets[0].start < finalizers[0].start
    && finalizers[0].close < finalReturns[0][0]
    && treeKills.length === 1
    && flightExpression.some((token) => token?.value === 'cleanup');
}

function executionWorkerSupervisorMessageContract(source) {
  const exportNames = ['handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage'];
  if (!exportNames.every((name) => topLevelFunctionBinding(source, name))
    || !exactModuleExportsIdentifierSet(source, exportNames)) return false;
  const tokens = tokenizeJavascriptForRiskAudit(source);
  const scopes = collectFunctionScopes(tokens);
  const event = uniqueScope(scopes, 'handleExecutionWorkerEventMessage');
  const observer = uniqueScope(scopes, 'handleExecutionWorkerObserverMessage');
  if (!event || !observer) return false;
  const eventTokens = scopeReachableTokens(tokens, event, scopes);
  const observerTokens = scopeReachableTokens(tokens, observer, scopes);
  if (!['pending', 'postBrokerResult', 'terminateChild', 'child']
    .every((name) => scopeHasParameterBinding(tokens, event, name))) return false;
  const eventCalls = callsInTokens(eventTokens);
  const eventGets = eventCalls.filter((call) => (
    call.path.join('.') === 'pending.get'
    && assignedIdentifierForCall(eventTokens, call) === 'item'
    && argumentHasExactTokens(eventTokens, call, 0, ['message', '.', 'requestId'])
  ));
  const itemBinding = immutableConstBindingBefore(eventTokens, 'item', eventTokens.length);
  const eventGuards = ifStatements(eventTokens).filter((statement) => (
    conditionHasBareNegatedIdentifier(eventTokens, statement, 'item')
    && conditionHasExactCall(
      eventTokens, statement, 'item.matches', [['message']], { negated: true },
    )
    && branchHasUnconditionalReturn(eventTokens, statement.then)
  ));
  const sequenceBranches = ifStatements(eventTokens).filter((statement) => (
    conditionHasSequence(eventTokens, statement, [
      'message', '.', 'sequence', '<=', 'item', '.', 'lastSequence',
    ])
  ));
  if (eventGets.length !== 1 || !itemBinding || eventGuards.length !== 1
    || sequenceBranches.length !== 1) return false;
  const sequence = sequenceBranches[0];
  const sequenceTokens = eventTokens.slice(sequence.then.start, sequence.then.end);
  const sequenceCalls = callsInTokens(sequenceTokens);
  const deleteCalls = sequenceCalls.filter((call) => (
    call.path.join('.') === 'pending.delete'
    && argumentHasExactTokens(sequenceTokens, call, 0, ['message', '.', 'requestId'])
    && callIsOnUnconditionalPath(sequenceTokens, call)
  ));
  const rejectCalls = sequenceCalls.filter((call) => (
    call.path.join('.') === 'item.reject'
    && argumentHasExactTokens(sequenceTokens, call, 0, ['error'])
    && callIsOnUnconditionalPath(sequenceTokens, call)
  ));
  const terminateCalls = sequenceCalls.filter((call) => (
    call.path.length === 1
    && call.path[0] === 'terminateChild'
    && argumentHasExactTokens(sequenceTokens, call, 0, ['child'])
    && exactStringArgument(sequenceTokens, call, 1, 'sequence-violation')
    && callIsOnUnconditionalPath(sequenceTokens, call)
  ));
  const errorBinding = immutableConstBindingBefore(sequenceTokens, 'error', sequenceTokens.length);
  const eventDispatches = eventCalls.filter((call) => (
    call.path.length === 1
    && call.path[0] === 'dispatchExecutionEvent'
    && argumentHasExactTokens(eventTokens, call, 0, ['item'])
    && argumentHasExactTokens(eventTokens, call, 1, ['message'])
    && argumentHasExactTokens(eventTokens, call, 2, ['postBrokerResult'])
    && callIsOnUnconditionalPath(eventTokens, call)
  ));
  const eventSafe = Boolean(errorBinding
    && deleteCalls.length === 1
    && rejectCalls.length === 1
    && terminateCalls.length === 1
    && eventDispatches.length === 1
    && branchHasUnconditionalReturn(sequenceTokens, {
      start: 0, end: sequenceTokens.length,
    })
    && eventGets[0].start < eventGuards[0].index
    && eventGuards[0].end <= sequence.index
    && errorBinding.assignment_start < deleteCalls[0].start
    && deleteCalls[0].start < rejectCalls[0].start
    && rejectCalls[0].start < terminateCalls[0].start
    && sequence.end <= eventDispatches[0].start);

  if (!scopeHasParameterBinding(tokens, observer, 'pending')) return false;
  const observerCalls = callsInTokens(observerTokens);
  const observerGets = observerCalls.filter((call) => (
    call.path.join('.') === 'pending.get'
    && assignedIdentifierForCall(observerTokens, call) === 'item'
    && argumentHasExactTokens(observerTokens, call, 0, ['message', '.', 'requestId'])
  ));
  const observerItemBinding = immutableConstBindingBefore(observerTokens, 'item', observerTokens.length);
  const observerGuards = ifStatements(observerTokens).filter((statement) => (
    conditionHasBareNegatedIdentifier(observerTokens, statement, 'item')
    && conditionHasExactCall(
      observerTokens, statement, 'item.matches', [['message']], { negated: true },
    )
    && conditionHasExactCall(
      observerTokens,
      statement,
      'isReservedExecutionWorkerObserverCallback',
      [['message', '.', 'payload', '?.', 'callback']],
      { negated: true },
    )
    && branchHasUnconditionalReturn(observerTokens, statement.then)
  ));
  const observerEvents = observerCalls.filter((call) => (
      call.path.join('.') === 'item.onEvent'
      && argumentHasExactTokens(observerTokens, call, 0, ['message'])
      && callIsOnUnconditionalPath(observerTokens, call)
  ));
  const observerSafe = observerGets.length === 1
    && Boolean(observerItemBinding)
    && observerGuards.length === 1
    && observerEvents.length === 1
    && observerGets[0].start < observerGuards[0].index
    && observerGuards[0].end <= observerEvents[0].start;
  return Boolean(eventSafe && observerSafe);
}

function supervisorLifecycleIsolationContract(sourceByPath, {
  cancellationAstContractPassed = null,
} = {}) {
  const supervisor = sourceByPath.get('electron/host-core/agent/execution-worker-supervisor.cjs') || '';
  const cancellation = sourceByPath.get('electron/host-core/agent/execution-worker-cancellation.cjs') || '';
  const supervisorMessage = sourceByPath.get('electron/host-core/agent/execution-worker-supervisor-message.cjs') || '';
  const termination = sourceByPath.get('electron/host-core/agent/execution-worker-termination.cjs') || '';
  const importsBound = topLevelRequiredIdentifierBinding(
    supervisor, './execution-worker-cancellation.cjs', 'createExecutionWorkerRequestSettlement',
  ) && topLevelRequiredIdentifierBinding(
    supervisor, './execution-worker-termination.cjs', 'createExecutionWorkerTerminator',
  ) && topLevelRequiredIdentifierBinding(
    supervisor, './execution-worker-supervisor-message.cjs', 'handleExecutionWorkerEventMessage',
  ) && topLevelRequiredIdentifierBinding(
    supervisor, './execution-worker-supervisor-message.cjs', 'handleExecutionWorkerObserverMessage',
  );
  const cancellationTerminates = typeof cancellationAstContractPassed === 'boolean'
    ? cancellationAstContractPassed
    : cancellationTerminationContract(cancellation);
  const terminatorOwnsKill = executionWorkerTerminatorContract(termination);
  const supervisorMessageIsolated = executionWorkerSupervisorMessageContract(supervisorMessage);

  const tokens = tokenizeJavascriptForRiskAudit(supervisor);
  const scopes = collectFunctionScopes(tokens);
  const creator = uniqueScope(scopes, 'createExecutionWorkerSupervisor');
  if (!creator) return {
    passed: false,
    imports_bound: importsBound,
    cancellation_terminates_child: cancellationTerminates,
    terminator_owns_kill: terminatorOwnsKill,
    supervisor_message_isolated: supervisorMessageIsolated,
    terminator_bound: false,
    settlement_bound: false,
    message_handlers_bound: false,
    stop_awaits_termination: false,
    terminal_settles_matching_request: false,
  };
  const creatorTokens = reachableTokens(tokens.slice(creator.body_open + 1, creator.body_close));
  const calls = callsInTokens(creatorTokens);
  const terminators = calls.filter((call) => (
    call.path.length === 1
    && call.path[0] === 'createExecutionWorkerTerminator'
    && assignedIdentifierForCall(creatorTokens, call) === 'terminateOwnedChild'
  ));
  const settlements = calls.filter((call) => (
    call.path.length === 1
    && call.path[0] === 'createExecutionWorkerRequestSettlement'
    && exactIdentifierObjectPropertyArgument(creatorTokens, call, 0, 'terminateChild', 'terminateChild')
  ));
  const wrapper = uniqueScope(scopes, 'terminateChild', creator);
  const stop = uniqueScope(scopes, 'stop', creator);
  const onMessage = uniqueScope(scopes, 'onMessage', creator);
  const wrapperTokens = wrapper ? scopeReachableTokens(tokens, wrapper, scopes) : [];
  const wrapperCalls = callsInTokens(wrapperTokens).filter((call) => (
    call.path.length === 1
    && call.path[0] === 'terminateOwnedChild'
    && argumentHasExactTokens(wrapperTokens, call, 0, ['target'])
    && argumentHasExactTokens(wrapperTokens, call, 1, ['reason'])
    && callResultIsObserved(wrapperTokens, call)
  ));
  const stopTokens = stop ? scopeReachableTokens(tokens, stop, scopes) : [];
  const stopCalls = callsInTokens(stopTokens).filter((call) => (
    call.path.length === 1
    && call.path[0] === 'terminateChild'
    && argumentHasExactTokens(stopTokens, call, 0, ['stoppedChild'])
    && exactStringArgument(stopTokens, call, 1, 'stop')
    && callIsAwaited(stopTokens, call)
    && callIsOnUnconditionalPath(stopTokens, call)
  ));
  const onMessageTokens = onMessage ? scopeReachableTokens(tokens, onMessage, scopes) : [];
  const onMessageCalls = callsInTokens(onMessageTokens);
  const handlerCalls = onMessageCalls.filter((call) => (
    call.path.length === 1
    && ['handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage']
      .includes(call.path[0])
  ));
  const handlerBranchContract = (operation, handler, bindings, optionalBindings = {}) => {
    const candidates = ifStatements(onMessageTokens).filter((statement) => (
      conditionHasSequence(onMessageTokens, statement, [
        'message', '.', 'operation', '===', operation,
      ])
    ));
    if (candidates.length !== 1) return false;
    const [statement] = candidates;
    const branch = onMessageTokens.slice(statement.then.start, statement.then.end);
    const callsInBranch = callsInTokens(branch).filter((call) => (
      call.path.length === 1
      && call.path[0] === handler
      && argumentHasExactTokens(branch, call, 0, ['message'])
      && exactIdentifierObjectArgument(branch, call, 1, bindings, optionalBindings)
      && callIsOnUnconditionalPath(branch, call)
    ));
    return callsInBranch.length === 1 && branchHasUnconditionalReturn(
      branch, { start: 0, end: branch.length },
    );
  };
  const handlersBound = handlerCalls.length === 2
    && handlerBranchContract('execution.event', 'handleExecutionWorkerEventMessage', {
      pending: 'pending',
      postBrokerResult: 'postBrokerResult',
      terminateChild: 'terminateChild',
      child: 'child',
    }, { now: 'now' })
    && handlerBranchContract('execution.observer', 'handleExecutionWorkerObserverMessage', {
      pending: 'pending',
    }, { now: 'now' });

  const terminalBranches = ifStatements(onMessageTokens).filter((statement) => (
    conditionIsExactCall(
      onMessageTokens,
      statement,
      'isExecutionWorkerTerminalOperation',
      [['message', '.', 'operation']],
    )
  ));
  let terminalSettled = false;
  if (terminalBranches.length === 1) {
    const terminal = onMessageTokens.slice(
      terminalBranches[0].then.start, terminalBranches[0].then.end,
    );
    const terminalCalls = callsInTokens(terminal);
    const gets = terminalCalls.filter((call) => (
      call.path.join('.') === 'pending.get'
      && assignedIdentifierForCall(terminal, call) === 'item'
      && argumentHasExactTokens(terminal, call, 0, ['message', '.', 'requestId'])
    ));
    const itemBinding = immutableConstBindingBefore(terminal, 'item', terminal.length);
    const guards = ifStatements(terminal).filter((statement) => (
      conditionHasBareNegatedIdentifier(terminal, statement, 'item')
      && conditionHasExactCall(
        terminal, statement, 'item.matches', [['message']], { negated: true },
      )
      && branchHasUnconditionalReturn(terminal, statement.then)
    ));
    const deletes = terminalCalls.filter((call) => (
      call.path.join('.') === 'pending.delete'
      && argumentHasExactTokens(terminal, call, 0, ['message', '.', 'requestId'])
      && callIsOnUnconditionalPath(terminal, call)
    ));
    const resolves = terminalCalls.filter((call) => (
      call.path.join('.') === 'item.resolve'
      && argumentHasExactTokens(terminal, call, 0, ['message'])
      && callIsOnUnconditionalPath(terminal, call)
    ));
    terminalSettled = Boolean(itemBinding
      && gets.length === 1
      && guards.length === 1
      && deletes.length === 1
      && resolves.length === 1
      && gets[0].start < guards[0].index
      && guards[0].end <= deletes[0].start
      && deletes[0].start < resolves[0].start
      && branchHasUnconditionalReturn(terminal, { start: 0, end: terminal.length }));
  }
  const result = {
    imports_bound: importsBound,
    cancellation_terminates_child: cancellationTerminates,
    terminator_owns_kill: terminatorOwnsKill,
    supervisor_message_isolated: supervisorMessageIsolated,
    terminator_bound: terminators.length === 1 && wrapperCalls.length === 1,
    settlement_bound: settlements.length === 1,
    message_handlers_bound: handlersBound,
    stop_awaits_termination: stopCalls.length === 1,
    terminal_settles_matching_request: terminalSettled,
  };
  return { ...result, passed: Object.values(result).every(Boolean) };
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

function topLevelRequireMemberInvocationContract(source, requiredPath, memberName) {
  let program;
  try {
    program = parse(String(source ?? ''), {
      ecmaVersion: 'latest',
      sourceType: 'script',
    });
  } catch {
    return false;
  }

  if (program.body.length !== 1 || program.body[0]?.type !== 'ExpressionStatement') {
    return false;
  }
  const invocation = program.body[0].expression;
  if (invocation?.type !== 'CallExpression'
    || invocation.optional === true
    || invocation.arguments.length !== 0) return false;

  const member = invocation.callee;
  if (member?.type !== 'MemberExpression'
    || member.computed
    || member.optional === true
    || member.property?.type !== 'Identifier'
    || member.property.name !== memberName) return false;

  const requireCall = member.object;
  return requireCall?.type === 'CallExpression'
    && requireCall.optional !== true
    && requireCall.callee?.type === 'Identifier'
    && requireCall.callee.name === 'require'
    && requireCall.arguments.length === 1
    && requireCall.arguments[0]?.type === 'Literal'
    && typeof requireCall.arguments[0].value === 'string'
    && requireCall.arguments[0].value === requiredPath;
}

function argumentHasExactTokens(tokens, call, index, expectedValues) {
  const range = splitCallArguments(tokens, call)[index];
  if (!range) return false;
  const [start, end] = trimWholeExpressionParentheses(tokens, range[0], range[1]);
  return end - start === expectedValues.length
    && expectedValues.every((value, offset) => tokens[start + offset]?.value === value);
}

function tokensContainSequence(tokens, values) {
  if (!values.length) return false;
  for (let index = 0; index + values.length <= tokens.length; index += 1) {
    if (values.every((value, offset) => tokens[index + offset]?.value === value)) return true;
  }
  return false;
}

function tokenSequenceStarts(tokens, values) {
  const starts = [];
  if (!values.length) return starts;
  for (let index = 0; index + values.length <= tokens.length; index += 1) {
    if (values.every((value, offset) => tokens[index + offset]?.value === value)) starts.push(index);
  }
  return starts;
}

function callbackForwardsSingleArgumentToMember(tokens, range, memberPath) {
  if (!range) return false;
  const expression = tokens.slice(range[0], range[1]);
  const arrow = expression.findIndex((token) => token?.value === '=>');
  if (arrow < 0 || expression.slice(arrow + 1).some((token) => token?.value === '=>')) return false;
  let parameter = '';
  if (expression[arrow - 1]?.value === ')') {
    const open = matchingOpenTokenIndex(expression, arrow - 1);
    const ranges = open >= 0 ? topLevelRanges(expression, open + 1, arrow - 1) : [];
    if (ranges.length === 1 && ranges[0][1] - ranges[0][0] === 1) {
      parameter = expression[ranges[0][0]]?.value || '';
    }
  } else if (expression[arrow - 1]?.type === 'identifier') {
    parameter = expression[arrow - 1].value;
  }
  if (!parameter) return false;
  const body = callbackBodyTokens(expression, [0, expression.length]);
  const calls = callsInTokens(body).filter((call) => (
    call.path.join('.') === memberPath
    && argumentHasExactTokens(body, call, 0, [parameter])
    && callIsOnUnconditionalPath(body, call)
  ));
  return calls.length === 1;
}

function constructorDefaultRunnerFactoryContract(tokens, constructor) {
  if (tokens[constructor.body_open - 1]?.value !== ')') return false;
  const parameterOpen = matchingOpenTokenIndex(tokens, constructor.body_open - 1);
  if (parameterOpen < 0) return false;
  const createRunnerBindings = [];
  for (let index = parameterOpen + 1; index < constructor.body_open - 1; index += 1) {
    if (tokens[index]?.type === 'identifier'
      && tokens[index].value === 'createRunner'
      && tokens[index + 1]?.value === '=') createRunnerBindings.push(index);
  }
  if (createRunnerBindings.length !== 1) return false;
  const [binding] = createRunnerBindings;
  const parameterTokens = tokens.slice(binding, constructor.body_open - 1);
  const arrow = parameterTokens.findIndex((token) => token?.value === '=>');
  if (arrow < 0) return false;
  const workerCalls = callsInTokens(parameterTokens).filter((call) => (
    call.path.length === 1
    && call.path[0] === 'Worker'
    && parameterTokens[call.start - 1]?.value === 'new'
  ));
  if (workerCalls.length !== 1 || workerCalls[0].start <= arrow) return false;
  const workerArguments = splitCallArguments(parameterTokens, workerCalls[0]);
  if (workerArguments.length !== 1) return false;
  const entryCalls = callsInTokens(parameterTokens).filter((call) => (
    call.path.join('.') === 'require.resolve'
    && exactStringArgument(parameterTokens, call, 0, './execution-worker-entry.cjs')
  ));
  return entryCalls.length === 1
    && expressionIsExactCall(
      parameterTokens, workerArguments[0][0], workerArguments[0][1], entryCalls[0],
    );
}

function controllerDecodeContract(tokens, scopes, scope, direction) {
  const owned = scopeReachableTokens(tokens, scope, scopes);
  const calls = callsInTokens(owned);
  const direct = calls.filter((call) => (
    call.path.length === 1
    && call.path[0] === 'validateEnvelope'
    && argumentHasExactTokens(owned, call, 0, ['raw'])
    && argumentHasExactTokens(owned, call, 1, ['{', 'direction', ':', direction, '}'])
  ));
  const delegated = calls.filter((call) => (
    call.path.join('.') === 'this.decode'
    && argumentHasExactTokens(owned, call, 0, ['raw'])
    && exactStringArgument(owned, call, 1, direction)
  ));
  if (direct.length === 1) return true;
  if (delegated.length !== 1) return false;
  const decode = uniqueScope(scopes, 'decode');
  if (!decode
    || !scopeHasParameterBinding(tokens, decode, 'raw')
    || !scopeHasParameterBinding(tokens, decode, 'direction')) return false;
  const decodeTokens = scopeReachableTokens(tokens, decode, scopes);
  const validators = callsInTokens(decodeTokens).filter((call) => (
    call.path.length === 1
    && call.path[0] === 'validateEnvelope'
    && argumentHasExactTokens(decodeTokens, call, 0, ['raw'])
    && exactIdentifierObjectArgument(decodeTokens, call, 1, { direction: 'direction' })
    && callResultIsObserved(decodeTokens, call)
  ));
  return validators.length === 1;
}

function earlyReturnGuard(tokens, predicate, beforeIndex, expectedValue = undefined) {
  return ifStatements(tokens).filter((statement) => (
    statement.index < beforeIndex
    && statement.end <= beforeIndex
    && rangeIsOnUnconditionalPath(tokens, statement.index, statement.end)
    && predicate(statement)
    && branchHasUnconditionalReturn(tokens, statement.then, expectedValue)
  ));
}

function controllerSingleTurnIdentityContract(tokens, scopes) {
  const constructor = uniqueScope(scopes, 'constructor');
  const initialize = uniqueScope(scopes, 'initialize');
  const acceptMessage = uniqueScope(scopes, 'acceptMessage');
  const onHostMessage = uniqueScope(scopes, 'onHostMessage');
  const onRunnerMessage = uniqueScope(scopes, 'onRunnerMessage');
  if (!constructor || !initialize || !acceptMessage || !onHostMessage || !onRunnerMessage) return false;
  const constructorTokens = scopeReachableTokens(tokens, constructor, scopes);
  const initializeTokens = scopeReachableTokens(tokens, initialize, scopes);
  const acceptTokens = scopeReachableTokens(tokens, acceptMessage, scopes);
  const hostTokens = scopeReachableTokens(tokens, onHostMessage, scopes);
  const runnerTokens = scopeReachableTokens(tokens, onRunnerMessage, scopes);

  const initializedState = tokensContainSequence(constructorTokens, [
    'runner', ':', 'null', ',', 'authority', ':', 'null', ',', 'turn', ':', 'null',
  ]);
  const initializeRunnerAssignments = tokenSequenceStarts(initializeTokens, [
    'this', '.', 'runner', '=', 'this', '.', 'createRunner', '(', ')',
  ]);
  const initializeAuthorityAssignments = tokenSequenceStarts(initializeTokens, [
    'this', '.', 'authority', '=', 'message',
  ]);
  const initializeGuards = earlyReturnGuard(
    initializeTokens,
    (statement) => conditionHasSequence(initializeTokens, statement, ['this', '.', 'authority']),
    initializeAuthorityAssignments[0] ?? initializeTokens.length,
    'false',
  );
  const initializeCalls = callsInTokens(initializeTokens);
  const listenerContracts = [
    ['message', 'this.onRunnerMessage'],
    ['error', 'this.onRunnerError'],
    ['exit', 'this.onRunnerExit'],
  ].map(([eventName, callbackPath]) => initializeCalls.filter((call) => {
    if (call.path.join('.') !== 'this.runner.on'
      || !exactStringArgument(initializeTokens, call, 0, eventName)
      || !callIsOnUnconditionalPath(initializeTokens, call)) return false;
    return callbackForwardsSingleArgumentToMember(
      initializeTokens, splitCallArguments(initializeTokens, call)[1], callbackPath,
    );
  }));
  const initializedSingleton = initializedState
    && constructorDefaultRunnerFactoryContract(tokens, constructor)
    && initializeGuards.length === 1
    && initializeAuthorityAssignments.length === 1
    && initializeRunnerAssignments.length === 1
    && initializeAuthorityAssignments[0] < initializeRunnerAssignments[0]
    && listenerContracts.every((matches) => matches.length === 1)
    && listenerContracts.every((matches) => matches[0].start > initializeRunnerAssignments[0]);

  const startBranches = ifStatements(acceptTokens).filter((statement) => (
    conditionHasSequence(acceptTokens, statement, [
      'message', '.', 'operation', '===', 'execution.start',
    ])
    && rangeIsOnUnconditionalPath(acceptTokens, statement.index, statement.end)
  ));
  if (startBranches.length !== 1) return false;
  const startBranch = acceptTokens.slice(
    startBranches[0].then.start, startBranches[0].then.end,
  );
  const turnGuards = ifStatements(startBranch).filter((statement) => (
    conditionHasSequence(startBranch, statement, ['this', '.', 'turn'])
    && branchHasUnconditionalReturn(startBranch, statement.then, 'false')
  ));
  const turnAssignments = tokenSequenceStarts(startBranch, ['this', '.', 'turn', '=', 'message']);
  const startReturns = directReturnExpressions(startBranch).filter(([rawStart, rawEnd]) => {
    const [start, end] = trimWholeExpressionParentheses(startBranch, rawStart, rawEnd);
    return end - start === 1 && startBranch[start]?.value === 'true';
  });
  const allTurnAssignments = tokenSequenceStarts(acceptTokens, ['this', '.', 'turn', '=']);
  const oneTurn = turnGuards.length === 1
    && turnAssignments.length === 1
    && startReturns.length === 1
    && allTurnAssignments.length === 1
    && turnGuards[0].end <= turnAssignments[0]
    && turnAssignments[0] < startReturns[0][0];

  const authorityGuards = earlyReturnGuard(
    acceptTokens,
    (statement) => conditionHasExactCall(
      acceptTokens,
      statement,
      'sameIdentity',
      [['message'], ['this', '.', 'authority'], ['AUTHORITY_FIELDS']],
      { negated: true },
    ),
    startBranches[0].index,
    'false',
  );
  const turnIdentityGuards = ifStatements(acceptTokens).filter((statement) => (
    statement.index >= startBranches[0].end
    && rangeIsOnUnconditionalPath(acceptTokens, statement.index, statement.end)
    && conditionHasExactCall(
      acceptTokens,
      statement,
      'sameIdentity',
      [['message'], ['this', '.', 'turn'], ['TURN_FIELDS']],
      { negated: true },
    )
    && branchHasUnconditionalReturn(acceptTokens, statement.then, 'false')
  ));
  const exactRequestIds = tokensContainSequence(acceptTokens, [
    'message', '.', 'payload', '.', 'executionRequestId', '===', 'this', '.', 'turn', '.', 'requestId',
  ]) && tokensContainSequence(acceptTokens, [
    'message', '.', 'requestId', '===', 'this', '.', 'turn', '.', 'requestId',
  ]);
  const acceptReturnRanges = directReturnExpressions(acceptTokens);
  const exactRequestReturn = acceptReturnRanges.some(([start, end]) => {
    const expression = acceptTokens.slice(start, end);
    return tokensContainSequence(expression, [
      'message', '.', 'payload', '.', 'executionRequestId', '===', 'this', '.', 'turn', '.', 'requestId',
    ]) && tokensContainSequence(expression, [
      'message', '.', 'requestId', '===', 'this', '.', 'turn', '.', 'requestId',
    ]);
  });

  const runnerCalls = callsInTokens(runnerTokens);
  const runnerForwards = runnerCalls.filter((call) => (
    call.path.join('.') === 'this.parentPort.postMessage'
    && argumentHasExactTokens(runnerTokens, call, 0, ['message'])
    && callIsOnUnconditionalPath(runnerTokens, call)
  ));
  if (runnerForwards.length !== 1) return false;
  const runnerAuthorityGuards = earlyReturnGuard(
    runnerTokens,
    (statement) => conditionHasExactCall(
      runnerTokens,
      statement,
      'sameIdentity',
      [['message'], ['this', '.', 'authority'], ['AUTHORITY_FIELDS']],
      { negated: true },
    ),
    runnerForwards[0].start,
  );
  const readyBranches = ifStatements(runnerTokens).filter((statement) => (
    conditionHasSequence(runnerTokens, statement, [
      'message', '.', 'operation', '===', 'worker.ready',
    ])
  ));
  const heartbeatBranches = ifStatements(runnerTokens).filter((statement) => (
    conditionHasSequence(runnerTokens, statement, [
      'message', '.', 'operation', '===', 'worker.heartbeat',
    ])
    && branchHasUnconditionalReturn(runnerTokens, statement.then)
    && statement.end < runnerForwards[0].start
  ));
  const runnerTurnGuards = ifStatements(runnerTokens).filter((statement) => (
    statement.index < runnerForwards[0].start
    && runnerTokens[statement.index - 1]?.value === 'else'
    && conditionHasSequence(runnerTokens, statement, [
      'message', '.', 'operation', '!==', 'worker.pressure',
    ])
    && conditionHasExactCall(
      runnerTokens,
      statement,
      'sameIdentity',
      [['message'], ['this', '.', 'turn'], ['TURN_FIELDS']],
      { negated: true },
    )
    && branchHasUnconditionalReturn(runnerTokens, statement.then)
  ));
  const runnerIdentity = runnerAuthorityGuards.length === 1
    && readyBranches.length === 1
    && heartbeatBranches.length === 1
    && runnerTurnGuards.length === 1
    && readyBranches[0].index < runnerTurnGuards[0].index
    && runnerTurnGuards[0].end <= runnerForwards[0].start;

  const hostCalls = callsInTokens(hostTokens);
  const hostForwards = hostCalls.filter((call) => (
    call.path.join('.') === 'this.runner.postMessage'
    && argumentHasExactTokens(hostTokens, call, 0, ['message'])
    && callIsOnUnconditionalPath(hostTokens, call)
  ));
  if (hostForwards.length !== 1) return false;
  const hostAcceptGuards = earlyReturnGuard(
    hostTokens,
    (statement) => conditionHasExactCall(
      hostTokens, statement, 'this.acceptMessage', [['message']], { negated: true },
    ),
    hostForwards[0].start,
  );
  const hostAcceptsBeforeForward = hostAcceptGuards.length === 1
    && hostAcceptGuards[0].end <= hostForwards[0].start;
  const directionsBound = controllerDecodeContract(
    tokens, scopes, onHostMessage, 'host-to-worker',
  ) && controllerDecodeContract(tokens, scopes, onRunnerMessage, 'worker-to-host');

  return initializedSingleton
    && oneTurn
    && authorityGuards.length === 1
    && turnIdentityGuards.length === 1
    && exactRequestIds
    && exactRequestReturn
    && runnerIdentity
    && hostAcceptsBeforeForward
    && directionsBound;
}

function topLevelRequireContract(sourceByPath) {
  const bootstrap = sourceByPath.get('electron/execution-worker.cjs') || '';
  return topLevelRequireMemberInvocationContract(
    bootstrap,
    './host-core/agent/execution-worker-controller.cjs',
    'startExecutionWorkerController',
  );
}

function controllerStartExportContract(sourceByPath) {
  const controller = sourceByPath.get(
    'electron/host-core/agent/execution-worker-controller.cjs',
  ) || '';
  return exactModuleExportsIdentifierSet(controller, ['startExecutionWorkerController']);
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

function moduleExportsIdentifierBinding(source, identifier) {
  const tokens = reachableTokens(tokenizeJavascriptForRiskAudit(source));
  const depths = tokenBraceDepths(tokens);
  if (!commonJsModuleBindingsStable(tokens, depths)) return false;
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
  const property = uniqueEffectiveProperty(properties, identifier);
  return Boolean(property
    && property.value_end - property.value_start === 1
    && tokens[property.value_start]?.type === 'identifier'
    && tokens[property.value_start].value === identifier);
}

function exactModuleExportsIdentifierSet(source, identifiers) {
  const expected = [...new Set(identifiers)].sort();
  if (expected.length !== identifiers.length) return false;
  const tokens = reachableTokens(tokenizeJavascriptForRiskAudit(source));
  const depths = tokenBraceDepths(tokens);
  if (!commonJsModuleBindingsStable(tokens, depths)) return false;
  const moduleExportReferences = [];
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (depths[index] === 0
      && tokens[index]?.value === 'module'
      && tokens[index + 1]?.value === '.'
      && tokens[index + 2]?.value === 'exports') moduleExportReferences.push(index);
    if (depths[index] === 0
      && tokens[index]?.value === 'exports'
      && !(tokens[index - 1]?.value === '.' && tokens[index - 2]?.value === 'module')
      && ['.', '?.', '[', '='].includes(tokens[index + 1]?.value)) return false;
  }
  if (moduleExportReferences.length !== 1) return false;
  const [index] = moduleExportReferences;
  if (tokens[index + 3]?.value !== '=' || tokens[index + 4]?.value !== '{') return false;
  const close = matchingTokenIndex(tokens, index + 4, '{', '}');
  if (close < 0 || ![';', undefined].includes(tokens[close + 1]?.value)) return false;
  const properties = objectProperties(tokens, index + 4, close) || [];
  if (properties.length !== expected.length || properties.some((property) => property.spread)) return false;
  const actual = properties.map((property) => property.key).sort();
  if (actual.join('\0') !== expected.join('\0')) return false;
  return expected.every((identifier) => {
    const property = uniqueEffectiveProperty(properties, identifier);
    return Boolean(property
      && property.value_end - property.value_start === 1
      && tokens[property.value_start]?.type === 'identifier'
      && tokens[property.value_start].value === identifier);
  });
}

function commonJsModuleBindingsStable(tokens, depths) {
  const assignmentOperators = new Set([
    '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '&&=', '||=', '??=', '++', '--',
  ]);
  for (let index = 0; index < tokens.length; index += 1) {
    if (depths[index] !== 0 || !['module', 'exports'].includes(tokens[index]?.value)) continue;
    const previous = tokens[index - 1]?.value;
    const next = tokens[index + 1]?.value;
    const isModuleExportsReference = tokens[index].value === 'module'
      ? next === '.' && tokens[index + 2]?.value === 'exports'
      : previous === '.' && tokens[index - 2]?.value === 'module';
    if (isModuleExportsReference) continue;
    if (['const', 'let', 'var', 'function', 'class'].includes(previous)
      || assignmentOperators.has(next)
      || ['++', '--'].includes(previous)) return false;
  }
  return true;
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

function returnedPropertyFunctionScope(tokens, creator, scopes, returnedObject, property, name) {
  const scope = uniqueScope(scopes, name, creator);
  if (!scope || !property) return null;
  if (property.value_end - property.value_start === 1
    && returnedObject.owned[property.value_start]?.type === 'identifier'
    && returnedObject.owned[property.value_start].value === name) return scope;
  const value = returnedObject.owned.slice(property.value_start, property.value_end);
  return value.some((token) => token.value === '=>') ? scope : null;
}

function returnedPromiseResolveObservesCall(tokens, call) {
  for (const [rawStart, rawEnd] of returnExpressionRanges(tokens)) {
    const [start, end] = trimWholeExpressionParentheses(tokens, rawStart, rawEnd);
    const promiseResolve = callAt(tokens, start);
    if (!promiseResolve
      || promiseResolve.path.join('.') !== 'Promise.resolve'
      || promiseResolve.close + 2 >= end
      || tokens[promiseResolve.close + 1]?.value !== '.') continue;
    const [resolved] = splitCallArguments(tokens, promiseResolve);
    if (!resolved || !expressionIsExactCall(tokens, resolved[0], resolved[1], call)) continue;
    const continuation = callAt(tokens, promiseResolve.close + 2);
    if (!continuation
      || !['then', 'finally'].includes(continuation.path.at(-1))
      || continuation.close !== end - 1) continue;
    return true;
  }
  return false;
}

function exactIdentifierArgument(tokens, call, index, identifier) {
  const range = splitCallArguments(tokens, call)[index];
  return Boolean(range
    && range[1] - range[0] === 1
    && tokens[range[0]]?.type === 'identifier'
    && tokens[range[0]].value === identifier);
}

function exactIdentifierObjectPropertyArgument(tokens, call, index, key, identifier) {
  const range = splitCallArguments(tokens, call)[index];
  if (!range || tokens[range[0]]?.value !== '{') return false;
  const close = matchingTokenIndex(tokens, range[0], '{', '}', range[1]);
  if (close !== range[1] - 1) return false;
  const properties = objectProperties(tokens, range[0], close) || [];
  const property = uniqueEffectiveProperty(properties, key);
  return Boolean(property
    && property.value_end - property.value_start === 1
    && tokens[property.value_start]?.type === 'identifier'
    && tokens[property.value_start].value === identifier);
}

function callInsideExactBooleanIfBranch(tokens, call, conditionName) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== 'if' || tokens[index + 1]?.value !== '(') continue;
    const conditionClose = matchingTokenIndex(tokens, index + 1);
    if (conditionClose !== index + 3
      || tokens[index + 2]?.type !== 'identifier'
      || tokens[index + 2].value !== conditionName
      || tokens[conditionClose + 1]?.value !== '{') continue;
    const bodyOpen = conditionClose + 1;
    const bodyClose = matchingTokenIndex(tokens, bodyOpen, '{', '}');
    if (bodyClose < 0 || call.start <= bodyOpen || call.close >= bodyClose) continue;
    for (let cursor = call.close + 1; cursor < bodyClose; cursor += 1) {
      if (tokens[cursor]?.value === 'return'
        && tokens[cursor + 1]?.type === 'identifier'
        && tokens[cursor + 1].value === 'true') return true;
    }
  }
  return false;
}

function contextUsageDrainHelperContract(tokens, scopes, helperName) {
  const helper = uniqueScope(scopes, helperName);
  if (!helper) return false;
  const parameters = simpleParameterNames(tokens, helper);
  const [leaseParameter, settlementParameter] = parameters;
  if (!leaseParameter || !settlementParameter || parameters.length < 3) return false;
  const owned = scopeReachableTokens(tokens, helper, scopes);
  const drains = callsInTokens(owned).filter((call) => (
    call.path.length === 2
    && call.path[0] === leaseParameter
    && call.path[1] === 'drain'
  ));
  if (drains.length !== 1) return false;
  const [drain] = drains;
  const arguments_ = splitCallArguments(owned, drain);
  return arguments_.length === 2
    && exactIdentifierArgument(owned, drain, 0, settlementParameter)
    && exactIdentifierObjectPropertyArgument(owned, drain, 1, 'timeoutMs', 'boundedTimeout')
    && returnedPromiseResolveObservesCall(owned, drain);
}

function contextUsageLeaseHelperContract(sourceByPath) {
  const wrapper = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage.cjs') || '';
  const implementation = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage-lease.cjs') || '';
  const helperName = 'createExecutionWorkerContextUsageLease';
  const drainHelperName = 'releaseExecutionWorkerLeaseAfterContextUsage';
  if (!topLevelRequiredIdentifierBinding(
    wrapper, './execution-worker-context-usage-lease.cjs', helperName,
  )
    || !topLevelRequiredIdentifierBinding(
      wrapper, './execution-worker-context-usage-lease.cjs', drainHelperName,
    )
    || !moduleExportsIdentifierBinding(wrapper, helperName)
    || !moduleExportsIdentifierBinding(wrapper, drainHelperName)
    || !topLevelFunctionBinding(implementation, helperName)
    || !topLevelFunctionBinding(implementation, drainHelperName)
    || !moduleExportsIdentifierBinding(implementation, helperName)
    || !moduleExportsIdentifierBinding(implementation, drainHelperName)) return false;
  const tokens = tokenizeJavascriptForRiskAudit(implementation);
  const scopes = collectFunctionScopes(tokens);
  const creator = uniqueScope(scopes, helperName);
  if (!creator || !contextUsageDrainHelperContract(tokens, scopes, drainHelperName)) return false;
  const objects = returnedObjectProperties(tokens, creator, scopes).filter(({ properties }) => (
    properties.some((property) => property.key === 'release')
  ));
  if (objects.length !== 1) return false;
  const releaseProperty = uniqueEffectiveProperty(objects[0].properties, 'release');
  const releaseScope = returnedPropertyFunctionScope(
    tokens, creator, scopes, objects[0], releaseProperty, 'release',
  );
  if (!releaseScope) return false;
  const [leaseParameter] = simpleParameterNames(tokens, releaseScope);
  if (!leaseParameter) return false;
  const releaseTokens = scopeReachableTokens(tokens, releaseScope, scopes);
  const calls = callsInTokens(releaseTokens);
  const completedDrainCalls = calls.filter((call) => (
    call.path.length === 1
    && call.path[0] === drainHelperName
    && splitCallArguments(releaseTokens, call).length === 3
    && exactIdentifierArgument(releaseTokens, call, 0, leaseParameter)
    && exactIdentifierArgument(releaseTokens, call, 1, 'settlement')
    && exactIdentifierObjectPropertyArgument(releaseTokens, call, 2, 'timeoutMs', 'timeoutMs')
    && callInsideExactBooleanIfBranch(releaseTokens, call, 'completed')
  ));
  const incompleteReleases = calls.filter((call) => (
    call.path.length === 2
    && call.path[0] === leaseParameter
    && call.path[1] === 'release'
    && callIsAwaited(releaseTokens, call)
    && splitCallArguments(releaseTokens, call).length === 0
    && callIsOnUnconditionalPath(releaseTokens, call)
  ));
  return completedDrainCalls.length === 1 && incompleteReleases.length === 1;
}

function desktopLeaseContract(sourceByPath) {
  const source = sourceByPath.get('electron/host-core/agent/desktop-host-context.cjs') || '';
  const tokens = tokenizeJavascriptForRiskAudit(source);
  const scopes = collectFunctionScopes(tokens);
  let acquired = false;
  for (const scope of scopes) {
    const owned = reachableTokens(tokensOwnedByScope(tokens, scope, scopes));
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
          || (call.path[0] === 'supervisor'
            && scopeHasParameterBinding(tokens, scope, 'supervisor')))
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
        if (directRelease) return {
          acquired: true,
          released: true,
          same_try_finally_scope: true,
          delegated_context_release: false,
        };

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
        if (setupCalls.length === 1 && wrapperBound) {
          return {
            acquired: true,
            released: true,
            same_try_finally_scope: true,
            delegated_context_release: true,
          };
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
  const astContracts = auditQworkSuccessorAstContracts(sourceByPath);
  const contextHelperContract = desktopContract.delegated_context_release !== true
    || (contextUsageLeaseHelperContract(sourceByPath)
      && auditQworkSuccessorContextHelperAstContract(sourceByPath));
  const lifecycleIsolation = supervisorLifecycleIsolationContract(sourceByPath, {
    cancellationAstContractPassed: astContracts.cancellation,
  });
  const unsettledExitUsesTypedFailure = supervisorContract.typed_failure
    && astContracts.supervisor_exit;
  const pressureAdmissionClosed = managerContract.pressure_admission_closed;
  const onePendingPerTurn = managerContract.one_pending_per_turn;
  const restartDisabled = managerContract.restart_disabled;
  const pressurePassed = pressureAdmissionClosed
    && onePendingPerTurn
    && restartDisabled
    && managerContract.supervisor_policy_same_call
    && astContracts.manager_pressure;

  const supervisorCreatedPerAcquire = managerContract.supervisor_created_per_acquire
    && astContracts.manager;
  const requestIndexed = managerContract.request_indexed && astContracts.manager;
  const requestReleased = managerContract.request_released && astContracts.manager;
  const leaseAcquired = desktopContract.acquired;
  const leaseReleased = desktopContract.released
    && desktopContract.same_try_finally_scope;
  const desktopLeaseContractPassed = leaseReleased
    && contextHelperContract
    && astContracts.desktop;
  const stableSingleTurnEntry = topLevelRequireContract(sourceByPath)
    && controllerStartExportContract(sourceByPath)
    && astContracts.controller;
  const sharedWorkerRegistryAbsent = sharedWorkerRegistryIsAbsent(entry);
  const isolationPassed = supervisorCreatedPerAcquire
    && requestIndexed
    && requestReleased
    && leaseAcquired
    && desktopLeaseContractPassed
    && stableSingleTurnEntry
    && lifecycleIsolation.passed
    && astContracts.cancellation
    && astContracts.deadline
    && astContracts.callback_settlement
    && astContracts.event_flow
    && astContracts.supervisor
    && astContracts.supervisor_message
    && astContracts.termination
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
        desktop_context_helper_contract: contextHelperContract,
        stable_single_turn_entry: stableSingleTurnEntry,
        execution_worker_lifecycle_isolation: lifecycleIsolation.passed,
        execution_worker_lifecycle_checks: lifecycleIsolation,
        successor_ast_contracts: astContracts,
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
