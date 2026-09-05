import { createHash } from 'node:crypto';

export const QWORK_RELEASE_BLOCKING_RISK_SCHEMA = 'qbot-qwork-release-blocking-risk-attestation/v3';
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

function objectArgumentHasNumericProperty(tokens, call, property, expectedValue) {
  const [first] = splitCallArguments(tokens, call);
  if (!first || tokens[first[0]]?.value !== '{') return false;
  const objectClose = matchingTokenIndex(tokens, first[0], '{', '}', first[1]);
  if (objectClose < 0) return false;
  for (let index = first[0] + 1; index + 2 < objectClose; index += 1) {
    if (tokens[index]?.type === 'identifier'
      && tokens[index].value === property
      && tokens[index + 1]?.value === ':'
      && tokens[index + 2]?.type === 'number'
      && Number(tokens[index + 2].value) === expectedValue) return true;
  }
  return false;
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

function reachableFunctionScopes(root, tokens, scopes) {
  const byName = new Map();
  for (const scope of scopes) {
    if (!byName.has(scope.name)) byName.set(scope.name, []);
    byName.get(scope.name).push(scope);
  }
  const reached = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    const calledNames = new Set(callsInTokens(reachableTokens(tokensOwnedByScope(tokens, current, scopes)))
      .map((call) => call.path.at(-1)));
    for (const calledName of calledNames) {
      for (const candidate of byName.get(calledName) || []) {
        if (reached.has(candidate)) continue;
        reached.add(candidate);
        queue.push(candidate);
      }
    }
  }
  return [...reached];
}

function managerSuccessorContract(source) {
  const tokens = tokenizeJavascriptForRiskAudit(source);
  const scopes = collectFunctionScopes(tokens);
  const acquisitions = scopes.filter((scope) => /acquire/iu.test(scope.name));
  for (const acquisition of acquisitions) {
    const owned = reachableTokens(tokensOwnedByScope(tokens, acquisition, scopes));
    const calls = callsInTokens(owned);
    const supervisorCalls = calls.filter((call) => callPathEndsWith(call, ['supervisorFactory']));
    const onePendingPerTurn = supervisorCalls.some((call) => (
      objectArgumentHasNumericProperty(owned, call, 'maxPendingRequests', 1)
    ));
    const restartDisabled = supervisorCalls.some((call) => (
      objectArgumentHasNumericProperty(owned, call, 'maxRestarts', 0)
    ));
    const supervisorPolicySameCall = supervisorCalls.some((call) => (
      objectArgumentHasNumericProperty(owned, call, 'maxPendingRequests', 1)
      && objectArgumentHasNumericProperty(owned, call, 'maxRestarts', 0)
    ));
    const requestIndexed = calls.some((call) => callPathEndsWith(call, ['executions', 'set'])
      && callHasIdentifierArguments(owned, call, ['requestId', 'record']));
    const releaseScope = scopes.find((scope) => scope.name === 'release'
      && scope.parent === acquisition
      && (() => {
        const releaseTokens = reachableTokens(tokensOwnedByScope(tokens, scope, scopes));
        const releaseCalls = callsInTokens(releaseTokens);
        const deletesRequest = releaseCalls.some((call) => callPathEndsWith(call, ['executions', 'delete'])
          && callHasIdentifierArguments(releaseTokens, call, ['requestId']));
        const stopsSupervisor = releaseCalls.some((call) => callPathEndsWith(call, ['supervisor', 'stop'])
          && releaseTokens[call.start - 1]?.value === 'await');
        return deletesRequest && stopsSupervisor;
      })());
    const reachable = reachableFunctionScopes(acquisition, tokens, scopes);
    const pressureAdmissionClosed = reachable.some((scope) => pressureRejectionInIfBlock(
      reachableTokens(tokensOwnedByScope(tokens, scope, scopes)),
    ));
    if (supervisorCalls.length > 0 && requestIndexed && releaseScope) {
      return {
        pressure_admission_closed: pressureAdmissionClosed,
        supervisor_created_per_acquire: true,
        request_indexed: true,
        request_released: true,
        one_pending_per_turn: onePendingPerTurn,
        restart_disabled: restartDisabled,
        supervisor_policy_same_call: supervisorPolicySameCall,
      };
    }
  }
  return {
    pressure_admission_closed: false,
    supervisor_created_per_acquire: false,
    request_indexed: false,
    request_released: false,
    one_pending_per_turn: false,
    restart_disabled: false,
    supervisor_policy_same_call: false,
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

function topLevelRequireContract(source) {
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
      && tokens[first[0]].value === './host-core/agent/execution-worker-entry.cjs') return true;
  }
  return false;
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

function desktopLeaseContract(source) {
  const tokens = tokenizeJavascriptForRiskAudit(source);
  const scopes = collectFunctionScopes(tokens);
  for (const scope of scopes) {
    const owned = reachableTokens(tokensOwnedByScope(tokens, scope, scopes));
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
      for (const acquireCall of tryCalls.filter((call) => callPathEndsWith(call, ['acquire']))) {
        let assignment = acquireCall.start - 1;
        while (assignment >= 0 && tryTokens[assignment].value !== ';' && tryTokens[assignment].value !== '=') assignment -= 1;
        if (tryTokens[assignment]?.value !== '=' || tryTokens[assignment - 1]?.type !== 'identifier') continue;
        const leaseName = tryTokens[assignment - 1].value;
        if (tryTokens[assignment + 1]?.value !== 'await') continue;
        const releaseCall = callsInTokens(finallyTokens).find((call) => call.path[0] === leaseName
          && callPathEndsWith(call, ['release'])
          && finallyTokens[call.start - 1]?.value === 'await');
        if (releaseCall) return { acquired: true, released: true, same_try_finally_scope: true };
      }
    }
  }
  return { acquired: false, released: false, same_try_finally_scope: false };
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
  const desktopHost = sourceByPath.get('electron/host-core/agent/desktop-host-context.cjs') || '';

  const supervisorContract = supervisorExitContract(supervisor);
  const managerContract = managerSuccessorContract(manager);
  const desktopContract = desktopLeaseContract(desktopHost);
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
