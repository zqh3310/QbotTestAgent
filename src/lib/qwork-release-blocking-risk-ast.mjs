import { parse } from 'acorn';

function unwrap(node) {
  let current = node || null;
  while (current && ['ChainExpression', 'ParenthesizedExpression'].includes(current.type)) {
    current = current.expression;
  }
  return current;
}

function parseProgram(source) {
  try {
    return parse(String(source || ''), {
      allowHashBang: true,
      ecmaVersion: 'latest',
      sourceType: 'script',
    });
  } catch {
    return null;
  }
}

function childNodes(node) {
  const children = [];
  if (!node || typeof node !== 'object') return children;
  for (const [key, value] of Object.entries(node)) {
    if (['end', 'loc', 'range', 'start', 'type'].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.type === 'string') children.push(item);
      }
    } else if (value && typeof value.type === 'string') {
      children.push(value);
    }
  }
  return children;
}

function visit(node, callback, parent = null) {
  if (!node) return;
  callback(node, parent);
  for (const child of childNodes(node)) visit(child, callback, node);
}

function identifier(node, name) {
  node = unwrap(node);
  return node?.type === 'Identifier' && node.name === name;
}

function literal(node, value) {
  node = unwrap(node);
  return node?.type === 'Literal' && node.value === value;
}

function memberPath(node) {
  node = unwrap(node);
  if (node?.type === 'Identifier') return [node.name];
  if (node?.type === 'ThisExpression') return ['this'];
  if (node?.type !== 'MemberExpression' || node.computed) return [];
  const left = memberPath(node.object);
  if (!left.length || node.property?.type !== 'Identifier') return [];
  return [...left, node.property.name];
}

function member(node, expected) {
  return memberPath(node).join('.') === expected.join('.');
}

function call(node, expectedPath, argumentMatchers = null) {
  node = unwrap(node);
  if (node?.type !== 'CallExpression' || !member(node.callee, expectedPath)) return false;
  if (argumentMatchers === null) return true;
  return node.arguments.length === argumentMatchers.length
    && argumentMatchers.every((matcher, index) => matcher(node.arguments[index]));
}

function methodCall(node, methodName, receiverMatcher, argumentMatchers = null) {
  node = unwrap(node);
  const callee = unwrap(node?.callee);
  if (node?.type !== 'CallExpression'
    || callee?.type !== 'MemberExpression'
    || callee.computed
    || !identifier(callee.property, methodName)
    || !receiverMatcher(unwrap(callee.object))) return false;
  if (argumentMatchers === null) return true;
  return node.arguments.length === argumentMatchers.length
    && argumentMatchers.every((matcher, index) => matcher(node.arguments[index]));
}

function construct(node, name, argumentMatchers = null) {
  node = unwrap(node);
  if (node?.type !== 'NewExpression' || !identifier(node.callee, name)) return false;
  if (argumentMatchers === null) return true;
  return node.arguments.length === argumentMatchers.length
    && argumentMatchers.every((matcher, index) => matcher(node.arguments[index]));
}

function unary(node, operator, matcher) {
  node = unwrap(node);
  return node?.type === 'UnaryExpression' && node.operator === operator && matcher(node.argument);
}

function binary(node, operator, left, right) {
  node = unwrap(node);
  return node?.type === 'BinaryExpression'
    && node.operator === operator
    && left(node.left)
    && right(node.right);
}

function logical(node, operator, left, right) {
  node = unwrap(node);
  return node?.type === 'LogicalExpression'
    && node.operator === operator
    && left(node.left)
    && right(node.right);
}

function directCallStatement(statement, path, argumentMatchers, { await_: awaited = false, void_ = false } = {}) {
  if (statement?.type !== 'ExpressionStatement') return false;
  let expression = unwrap(statement.expression);
  if (awaited) {
    if (expression?.type !== 'AwaitExpression') return false;
    expression = unwrap(expression.argument);
  }
  if (void_) {
    if (expression?.type !== 'UnaryExpression' || expression.operator !== 'void') return false;
    expression = unwrap(expression.argument);
  }
  return call(expression, path, argumentMatchers);
}

function exactReturn(statement, matcher, { await_: awaited = false } = {}) {
  if (statement?.type !== 'ReturnStatement') return false;
  if (!statement.argument) return !awaited && matcher(null);
  let argument = unwrap(statement.argument);
  if (awaited) {
    if (argument?.type !== 'AwaitExpression') return false;
    argument = unwrap(argument.argument);
  }
  return matcher(argument);
}

function bareReturn(statement) {
  return statement?.type === 'ReturnStatement' && statement.argument === null;
}

function directDeclarators(block, name, kind = null) {
  const matches = [];
  for (const statement of block?.body || []) {
    if (statement.type !== 'VariableDeclaration' || (kind && statement.kind !== kind)) continue;
    for (const declaration of statement.declarations) {
      if (identifier(declaration.id, name)) matches.push({ declaration, statement });
    }
  }
  return matches;
}

function directDeclarator(block, name, kind = null) {
  const matches = directDeclarators(block, name, kind);
  return matches.length === 1 ? matches[0] : null;
}

function directAssignmentStatements(block, expectedPath) {
  return (block?.body || []).filter((statement) => {
    const expression = unwrap(statement?.expression);
    return statement?.type === 'ExpressionStatement'
      && expression?.type === 'AssignmentExpression'
      && expression.operator === '='
      && member(expression.left, expectedPath);
  });
}

function topFunction(program, name) {
  const matches = (program?.body || []).filter((node) => (
    node.type === 'FunctionDeclaration' && identifier(node.id, name)
  ));
  return matches.length === 1 ? matches[0] : null;
}

function topClass(program, name) {
  const matches = (program?.body || []).filter((node) => (
    node.type === 'ClassDeclaration' && identifier(node.id, name)
  ));
  return matches.length === 1 ? matches[0] : null;
}

function classMethod(classNode, name) {
  const matches = (classNode?.body?.body || []).filter((node) => (
    node.type === 'MethodDefinition'
    && !node.computed
    && identifier(node.key, name)
  ));
  return matches.length === 1 ? matches[0].value : null;
}

function propertyName(property) {
  if (!property || property.computed) return '';
  if (property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'Literal') return String(property.key.value);
  return '';
}

function uniqueObjectProperty(node, name) {
  node = unwrap(node);
  if (node?.type !== 'ObjectExpression') return null;
  const matches = node.properties.filter((property) => (
    property.type === 'Property'
    && property.kind === 'init'
    && !property.computed
    && propertyName(property) === name
  ));
  return matches.length === 1 ? matches[0] : null;
}

function objectIncludesExactProperties(node, expected, { allowedSpreads = [] } = {}) {
  node = unwrap(node);
  if (node?.type !== 'ObjectExpression') return false;
  const spreads = node.properties.filter((property) => property.type === 'SpreadElement');
  if (spreads.length !== allowedSpreads.length
    || !spreads.every((spread, index) => allowedSpreads[index](spread.argument))) return false;
  if (node.properties.some((property) => (
    property.type !== 'SpreadElement'
    && (property.type !== 'Property' || property.kind !== 'init' || property.computed)
  ))) return false;
  return Object.entries(expected).every(([name, matcher]) => {
    const property = uniqueObjectProperty(node, name);
    return Boolean(property && matcher(property.value, property));
  });
}

function exactObject(node, expected) {
  node = unwrap(node);
  if (node?.type !== 'ObjectExpression' || node.properties.some((item) => item.type !== 'Property')) return false;
  const entries = Object.entries(expected);
  if (node.properties.length !== entries.length) return false;
  return entries.every(([name, matcher]) => {
    const properties = node.properties.filter((property) => propertyName(property) === name);
    return properties.length === 1
      && properties[0].kind === 'init'
      && !properties[0].computed
      && matcher(properties[0].value, properties[0]);
  });
}

function returnedObject(functionNode) {
  const returns = (functionNode?.body?.body || []).filter((statement) => statement.type === 'ReturnStatement');
  if (returns.length !== 1) return null;
  let value = unwrap(returns[0].argument);
  if (call(value, ['Object', 'freeze']) && value.arguments.length === 1) value = unwrap(value.arguments[0]);
  return value?.type === 'ObjectExpression' ? value : null;
}

function patternNames(pattern, names = []) {
  pattern = unwrap(pattern);
  if (!pattern) return names;
  if (pattern.type === 'Identifier') names.push(pattern.name);
  else if (pattern.type === 'AssignmentPattern') patternNames(pattern.left, names);
  else if (pattern.type === 'RestElement') patternNames(pattern.argument, names);
  else if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) patternNames(property.value || property.argument, names);
  } else if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) patternNames(element, names);
  }
  return names;
}

function exactParameterList(functionNode, matchers) {
  return Boolean(functionNode
    && Array.isArray(functionNode.params)
    && functionNode.params.length === matchers.length
    && matchers.every((matcher, index) => matcher(functionNode.params[index])));
}

function exactIdentifierParameters(functionNode, names) {
  return exactParameterList(
    functionNode,
    names.map((name) => (parameter) => identifier(parameter, name)),
  );
}

function defaultedIdentifierParameter(parameter, name, defaultMatcher) {
  parameter = unwrap(parameter);
  return parameter?.type === 'AssignmentPattern'
    && identifier(parameter.left, name)
    && defaultMatcher(unwrap(parameter.right));
}

function objectPatternBindsExactly(parameter, expectedNames, {
  topLevelDefault = false,
  propertyDefaults = {},
  requiredPropertyDefaults = [],
} = {}) {
  parameter = unwrap(parameter);
  if (topLevelDefault) {
    if (parameter?.type !== 'AssignmentPattern'
      || !exactObject(parameter.right, {})) return false;
    parameter = unwrap(parameter.left);
  } else if (parameter?.type === 'AssignmentPattern') {
    return false;
  }
  if (parameter?.type !== 'ObjectPattern'
    || parameter.properties.length !== expectedNames.length
    || parameter.properties.some((property) => property.type !== 'Property'
      || property.computed || property.kind !== 'init')) return false;
  return expectedNames.every((name) => {
    const properties = parameter.properties.filter((property) => propertyName(property) === name);
    if (properties.length !== 1) return false;
    const value = unwrap(properties[0].value);
    if (identifier(value, name)) return !requiredPropertyDefaults.includes(name);
    return value?.type === 'AssignmentPattern'
      && identifier(value.left, name)
      && Object.hasOwn(propertyDefaults, name)
      && propertyDefaults[name](unwrap(value.right));
  });
}

function objectPatternIncludesExactBindings(parameter, expected, {
  topLevelDefault = false,
} = {}) {
  parameter = unwrap(parameter);
  if (topLevelDefault) {
    if (parameter?.type !== 'AssignmentPattern' || !exactObject(parameter.right, {})) return false;
    parameter = unwrap(parameter.left);
  } else if (parameter?.type === 'AssignmentPattern') {
    return false;
  }
  if (parameter?.type !== 'ObjectPattern'
    || parameter.properties.some((property) => (
      property.type !== 'Property' || property.computed || property.kind !== 'init'
    ))) return false;
  const names = parameter.properties.map((property) => propertyName(property));
  if (names.some((name) => !name) || new Set(names).size !== names.length) return false;
  if (parameter.properties.some((property) => {
    const name = propertyName(property);
    const value = unwrap(property.value);
    return !(identifier(value, name)
      || (value?.type === 'AssignmentPattern' && identifier(value.left, name)));
  })) return false;
  return Object.entries(expected).every(([name, matcher]) => {
    const matches = parameter.properties.filter((property) => propertyName(property) === name);
    return matches.length === 1 && matcher(unwrap(matches[0].value), matches[0]);
  });
}

function functionHasNestedBinding(functionNode, protectedNames, { allowedDirectBindings = [] } = {}) {
  const protectedSet = new Set(protectedNames);
  const allowedDirectSet = new Set(allowedDirectBindings);
  const directStatements = new Set(functionNode?.body?.body || []);
  let found = false;
  visit(functionNode.body, (node, parent) => {
    if (found) return;
    if (node.type === 'VariableDeclarator') {
      const protectedBindings = patternNames(node.id).filter((name) => protectedSet.has(name));
      const allowedDirect = parent?.type === 'VariableDeclaration'
        && directStatements.has(parent)
        && protectedBindings.every((name) => allowedDirectSet.has(name));
      if (protectedBindings.length && !allowedDirect) found = true;
    }
    if (node.type === 'CatchClause'
      && patternNames(node.param).some((name) => protectedSet.has(name))) found = true;
    if (['FunctionDeclaration', 'FunctionExpression', 'ClassDeclaration', 'ClassExpression'].includes(node.type)
      && node.id && protectedSet.has(node.id.name)) found = true;
    if (node !== functionNode
      && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      if (node.params.flatMap((parameter) => patternNames(parameter)).some((name) => protectedSet.has(name))) {
        found = true;
      }
    }
  });
  return found;
}

function countAssignments(functionNode, matcher) {
  let count = 0;
  visit(functionNode?.body, (node) => {
    if (node.type === 'AssignmentExpression' && matcher(node.left)) count += 1;
    if (node.type === 'UpdateExpression' && matcher(node.argument)) count += 1;
    if (['ForInStatement', 'ForOfStatement'].includes(node.type) && matcher(node.left)) count += 1;
  });
  return count;
}

function functionHasIdentifierWrite(functionNode, protectedNames) {
  const protectedSet = new Set(protectedNames);
  return countAssignments(
    functionNode,
    (target) => patternNames(target).some((name) => protectedSet.has(name)),
  ) > 0;
}

function identifierReferenceNodes(root, name) {
  const bindings = new Set();
  visit(root, (node) => {
    if (node.type === 'VariableDeclarator') {
      visit(node.id, (binding) => {
        if (identifier(binding, name)) bindings.add(binding);
      });
    }
    if (node.type === 'CatchClause') {
      visit(node.param, (binding) => {
        if (identifier(binding, name)) bindings.add(binding);
      });
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      if (identifier(node.id, name)) bindings.add(node.id);
      for (const parameter of node.params || []) {
        visit(parameter, (binding) => {
          if (identifier(binding, name)) bindings.add(binding);
        });
      }
    }
    if (['ClassDeclaration', 'ClassExpression'].includes(node.type) && identifier(node.id, name)) {
      bindings.add(node.id);
    }
  });
  const references = [];
  visit(root, (node, parent) => {
    if (!identifier(node, name) || bindings.has(node)) return;
    if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
    if (parent?.type === 'Property' && parent.key === node && parent.value !== node
      && !parent.computed) return;
    if (parent?.type === 'MethodDefinition' && parent.key === node && !parent.computed) return;
    if (parent?.type === 'LabeledStatement' || parent?.type === 'BreakStatement'
      || parent?.type === 'ContinueStatement') return;
    references.push(node);
  });
  return references;
}

function topLevelBindingCount(program, name) {
  let count = 0;
  for (const statement of program?.body || []) {
    if (statement.type === 'VariableDeclaration') {
      for (const declaration of statement.declarations) {
        if (patternNames(declaration.id).includes(name)) count += 1;
      }
    } else if (['FunctionDeclaration', 'ClassDeclaration'].includes(statement.type)
      && identifier(statement.id, name)) {
      count += 1;
    }
  }
  return count;
}

function programHasNestedBinding(program, names) {
  const protectedSet = new Set(names);
  const topLevelStatements = new Set(program?.body || []);
  let found = false;
  visit(program, (node, parent) => {
    if (found) return;
    if (node.type === 'VariableDeclarator') {
      const isTopLevel = parent?.type === 'VariableDeclaration'
        && topLevelStatements.has(parent);
      if (!isTopLevel
        && patternNames(node.id).some((name) => protectedSet.has(name))) found = true;
      return;
    }
    if (node.type === 'CatchClause'
      && patternNames(node.param).some((name) => protectedSet.has(name))) {
      found = true;
      return;
    }
    if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.type)
      && node.id
      && protectedSet.has(node.id.name)
      && !topLevelStatements.has(node)) {
      found = true;
      return;
    }
    if (['FunctionExpression', 'ClassExpression'].includes(node.type)
      && node.id
      && protectedSet.has(node.id.name)) {
      found = true;
      return;
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)
      && (node.params || []).flatMap((parameter) => patternNames(parameter))
        .some((name) => protectedSet.has(name))) found = true;
  });
  return found;
}

function stableProgramIdentifiers(program, names, { globals = [] } = {}) {
  if (!program
    || functionHasIdentifierWrite(program, names)
    || programHasNestedBinding(program, names)
    || programHasTrustedGlobalMutation(program, globals)) return false;
  const globalSet = new Set(globals);
  return names.every((name) => {
    const count = topLevelBindingCount(program, name);
    return globalSet.has(name) ? count === 0 : count <= 1;
  });
}

function staticMemberPath(node) {
  node = unwrap(node);
  if (node?.type === 'Identifier') return [node.name];
  if (node?.type === 'ThisExpression') return ['this'];
  if (node?.type !== 'MemberExpression') return [];
  const left = staticMemberPath(node.object);
  if (!left.length) return [];
  if (!node.computed && node.property?.type === 'Identifier') return [...left, node.property.name];
  if (node.computed && node.property?.type === 'Literal'
    && ['string', 'number'].includes(typeof node.property.value)) {
    return [...left, String(node.property.value)];
  }
  return [];
}

function staticMemberPathWithAliases(node, aliases = new Map()) {
  node = unwrap(node);
  if (node?.type === 'Identifier') return aliases.get(node.name) || [node.name];
  if (node?.type === 'ThisExpression') return ['this'];
  if (node?.type !== 'MemberExpression') return [];
  const left = staticMemberPathWithAliases(node.object, aliases);
  if (!left.length) return [];
  if (!node.computed && node.property?.type === 'Identifier') return [...left, node.property.name];
  if (node.computed && node.property?.type === 'Literal'
    && ['string', 'number'].includes(typeof node.property.value)) {
    return [...left, String(node.property.value)];
  }
  return [];
}

function assignmentMemberPaths(target, paths = [], aliases = new Map()) {
  target = unwrap(target);
  if (!target) return paths;
  if (target.type === 'MemberExpression') {
    const member = staticMemberPathWithAliases(target, aliases);
    if (member.length) paths.push(member);
  } else if (target.type === 'AssignmentPattern') {
    assignmentMemberPaths(target.left, paths, aliases);
  } else if (target.type === 'RestElement') {
    assignmentMemberPaths(target.argument, paths, aliases);
  } else if (target.type === 'ObjectPattern') {
    for (const property of target.properties) {
      assignmentMemberPaths(property.value || property.argument, paths, aliases);
    }
  } else if (target.type === 'ArrayPattern') {
    for (const element of target.elements) assignmentMemberPaths(element, paths, aliases);
  }
  return paths;
}

function dynamicMemberMayTouchProtectedPath(target, protectedPaths, aliases = new Map()) {
  target = unwrap(target);
  if (!target) return false;
  if (target.type === 'MemberExpression') {
    if (target.computed && !['Literal'].includes(unwrap(target.property)?.type)) {
      const receiver = staticMemberPathWithAliases(target.object, aliases);
      if (receiver.length && pathOverlapsProtectedPath(receiver, protectedPaths)) return true;
    }
    return dynamicMemberMayTouchProtectedPath(target.object, protectedPaths, aliases);
  }
  if (target.type === 'AssignmentPattern') {
    return dynamicMemberMayTouchProtectedPath(target.left, protectedPaths, aliases);
  }
  if (target.type === 'RestElement') {
    return dynamicMemberMayTouchProtectedPath(target.argument, protectedPaths, aliases);
  }
  if (target.type === 'ObjectPattern') {
    return target.properties.some((property) => dynamicMemberMayTouchProtectedPath(
      property.value || property.argument,
      protectedPaths,
      aliases,
    ));
  }
  if (target.type === 'ArrayPattern') {
    return target.elements.some((element) => dynamicMemberMayTouchProtectedPath(
      element,
      protectedPaths,
      aliases,
    ));
  }
  return false;
}

function pathOverlapsProtectedPath(actual, protectedPaths) {
  return actual.length > 0 && protectedPaths.some((expected) => {
    const commonLength = Math.min(actual.length, expected.length);
    return actual.slice(0, commonLength).every((part, index) => part === expected[index]);
  });
}

function bindProtectedAliasPattern(
  pattern,
  sourcePath,
  protectedPaths,
  state,
  { dynamic = false, readonly = true } = {},
) {
  pattern = unwrap(pattern);
  if (!pattern || !sourcePath.length) return false;
  if (pattern.type === 'Identifier') {
    if (!pathOverlapsProtectedPath(sourcePath, protectedPaths)) return false;
    if (!readonly || dynamic) state.unsafe = true;
    else state.aliases.set(pattern.name, sourcePath);
    return true;
  }
  if (pattern.type === 'AssignmentPattern') {
    return bindProtectedAliasPattern(
      pattern.left, sourcePath, protectedPaths, state, { dynamic, readonly },
    );
  }
  if (pattern.type === 'RestElement') {
    if (pathOverlapsProtectedPath(sourcePath, protectedPaths)) state.unsafe = true;
    return state.unsafe;
  }
  if (pattern.type === 'ArrayPattern') {
    let touched = false;
    pattern.elements.forEach((element, index) => {
      if (element && bindProtectedAliasPattern(
        element,
        dynamic ? sourcePath : [...sourcePath, String(index)],
        protectedPaths,
        state,
        { dynamic, readonly },
      )) touched = true;
    });
    return touched;
  }
  if (pattern.type !== 'ObjectPattern') return false;
  let touched = false;
  for (const property of pattern.properties) {
    if (property.type === 'RestElement') {
      if (pathOverlapsProtectedPath(sourcePath, protectedPaths)) {
        state.unsafe = true;
        touched = true;
      }
      continue;
    }
    if (property.type !== 'Property' || property.computed) {
      if (pathOverlapsProtectedPath(sourcePath, protectedPaths)) {
        state.unsafe = true;
        touched = true;
      }
      continue;
    }
    const name = propertyName(property);
    if (name && bindProtectedAliasPattern(
      property.value,
      dynamic ? sourcePath : [...sourcePath, name],
      protectedPaths,
      state,
      { dynamic, readonly },
    )) touched = true;
  }
  return touched;
}

function protectedAliasSource(node, aliases = new Map()) {
  node = unwrap(node);
  const path = staticMemberPathWithAliases(node, aliases);
  if (path.length) return { dynamic: false, path };
  let current = node;
  while (current?.type === 'MemberExpression') {
    if (current.computed) {
      const receiver = staticMemberPathWithAliases(current.object, aliases);
      if (receiver.length) return { dynamic: true, path: receiver };
    }
    current = unwrap(current.object);
  }
  return null;
}

function protectedReceiverAliasState(functionNode, protectedPaths, {
  allowDefaultAliases = false,
  allowedReadonlyDynamicAliases = [],
} = {}) {
  const state = { aliases: new Map(), unsafe: false };
  const allowedReadonlyDynamicSet = new Set(allowedReadonlyDynamicAliases);
  const declarations = [];
  visit(functionNode?.body, (node, parent) => {
    if (node.type === 'VariableDeclarator' && node.init) declarations.push({ node, parent });
  });
  for (let pass = 0; pass <= declarations.length; pass += 1) {
    const before = state.aliases.size;
    for (const { node, parent } of declarations) {
      const source = protectedAliasSource(node.init, state.aliases);
      if (!source) continue;
      const readonly = parent?.type === 'VariableDeclaration' && parent.kind === 'const';
      const allowedReadonlyDynamic = source.dynamic && readonly
        && node.id?.type === 'Identifier'
        && allowedReadonlyDynamicSet.has(node.id.name);
      bindProtectedAliasPattern(node.id, source.path, protectedPaths, state, {
        dynamic: source.dynamic && !allowedReadonlyDynamic,
        readonly,
      });
    }
    if (state.aliases.size === before) break;
  }
  visit(functionNode?.body, (node, parent) => {
    if (node.type === 'AssignmentExpression') {
      const source = protectedAliasSource(node.right, state.aliases);
      if (source) bindProtectedAliasPattern(
        node.left,
        source.path,
        protectedPaths,
        state,
        { dynamic: source.dynamic, readonly: false },
      );
    }
    if (node.type === 'AssignmentPattern' && parent?.type !== 'VariableDeclarator') {
      const source = protectedAliasSource(node.right, state.aliases);
      if (source) bindProtectedAliasPattern(
        node.left,
        source.path,
        protectedPaths,
        state,
        { dynamic: source.dynamic, readonly: allowDefaultAliases && !source.dynamic },
      );
    }
  });
  return state;
}

function targetUsesProtectedAlias(target, aliases) {
  const aliasNames = new Set(aliases.keys());
  return patternNames(target).some((name) => aliasNames.has(name))
    || assignmentMemberPaths(target).some((path) => aliasNames.has(path[0]));
}

function functionHasProtectedAliasMutation(functionNode, protectedPaths) {
  const state = protectedReceiverAliasState(functionNode, protectedPaths);
  if (state.unsafe) return true;
  const aliasNames = new Set(state.aliases.keys());
  let found = false;
  visit(functionNode?.body, (node) => {
    if (found) return;
    const writeTarget = node.type === 'AssignmentExpression' ? node.left
      : node.type === 'UpdateExpression' ? node.argument
        : ['ForInStatement', 'ForOfStatement'].includes(node.type) ? node.left
          : node.type === 'UnaryExpression' && node.operator === 'delete' ? node.argument
            : null;
    if (writeTarget && targetUsesProtectedAlias(writeTarget, state.aliases)) {
      found = true;
      return;
    }
    if (node.type !== 'CallExpression' || ![
      'Object.assign', 'Object.defineProperties', 'Object.defineProperty',
      'Reflect.deleteProperty', 'Reflect.set',
    ].includes(staticMemberPath(node.callee).join('.'))) return;
    const receiver = staticMemberPath(node.arguments[0]);
    if (receiver.length && aliasNames.has(receiver[0])) found = true;
  });
  return found;
}

function functionHasMemberWrite(functionNode, protectedPaths, options = {}) {
  const aliasState = protectedReceiverAliasState(functionNode, protectedPaths, options);
  if (aliasState.unsafe) return true;
  const { aliases } = aliasState;
  const reflectiveWriterPaths = [
    ['Object', 'assign'],
    ['Object', 'defineProperties'],
    ['Object', 'defineProperty'],
    ['Reflect', 'apply'],
    ['Reflect', 'defineProperty'],
    ['Reflect', 'deleteProperty'],
    ['Reflect', 'set'],
  ];
  const reflectiveWriterState = protectedReceiverAliasState(
    functionNode,
    reflectiveWriterPaths,
  );
  if (reflectiveWriterState.unsafe) return true;
  const reflectiveWriterAliases = reflectiveWriterState.aliases;
  const directWriterNames = new Set([
    'Object.assign',
    'Object.defineProperties',
    'Object.defineProperty',
    'Reflect.defineProperty',
    'Reflect.deleteProperty',
    'Reflect.set',
  ]);
  const matchesPath = (actual) => (
    protectedPaths.some((expected) => actual.length >= expected.length
      && expected.every((part, index) => actual[index] === part))
  );
  const matches = (target) => assignmentMemberPaths(target, [], aliases).some(matchesPath)
    || dynamicMemberMayTouchProtectedPath(target, protectedPaths, aliases);
  const literalPropertyName = (node) => {
    node = unwrap(node);
    return node?.type === 'Literal'
      && ['string', 'number'].includes(typeof node.value)
      ? String(node.value)
      : '';
  };
  const reflectiveWriteMatches = (node) => {
    if (node.type !== 'CallExpression') return false;
    const directCalleePath = staticMemberPathWithAliases(
      node.callee,
      reflectiveWriterAliases,
    );
    let callee = directCalleePath.join('.');
    let forwardedArguments = node.arguments;
    if (callee === 'Reflect.apply') {
      const writer = staticMemberPathWithAliases(
        node.arguments[0],
        reflectiveWriterAliases,
      ).join('.');
      if (!directWriterNames.has(writer)) return false;
      callee = writer;
      const list = unwrap(node.arguments[2]);
      if (list?.type !== 'ArrayExpression'
        || list.elements.some((entry) => !entry || entry.type === 'SpreadElement')) return true;
      forwardedArguments = list.elements;
    } else if (['call', 'apply'].includes(directCalleePath.at(-1))) {
      const writer = directCalleePath.slice(0, -1).join('.');
      if (!directWriterNames.has(writer)) return false;
      callee = writer;
      if (directCalleePath.at(-1) === 'call') {
        forwardedArguments = node.arguments.slice(1);
      } else {
        const list = unwrap(node.arguments[1]);
        if (list?.type !== 'ArrayExpression'
          || list.elements.some((entry) => !entry || entry.type === 'SpreadElement')) return true;
        forwardedArguments = list.elements;
      }
    } else if (!directWriterNames.has(callee)) {
      return false;
    }
    if (forwardedArguments.some((entry) => entry?.type === 'SpreadElement')) return true;
    const receiver = staticMemberPathWithAliases(forwardedArguments[0], aliases);
    if (!receiver.length) return false;
    if ([
      'Object.defineProperty', 'Reflect.defineProperty', 'Reflect.set',
      'Reflect.deleteProperty',
    ].includes(callee)) {
      const property = literalPropertyName(forwardedArguments[1]);
      return property ? matchesPath([...receiver, property]) : protectedPaths.some((expected) => (
        receiver.length <= expected.length
        && receiver.every((part, index) => expected[index] === part)
      ));
    }
    if (callee === 'Object.defineProperties') {
      const descriptors = unwrap(forwardedArguments[1]);
      if (descriptors?.type !== 'ObjectExpression') {
        return protectedPaths.some((expected) => receiver.every(
          (part, index) => expected[index] === part,
        ));
      }
      return descriptors.properties.some((property) => {
        if (property.type === 'SpreadElement' || property.computed) {
          return protectedPaths.some((expected) => receiver.every(
            (part, index) => expected[index] === part,
          ));
        }
        const name = propertyName(property);
        return name ? matchesPath([...receiver, name]) : false;
      });
    }
    if (callee === 'Object.assign') {
      return forwardedArguments.slice(1).some((source) => {
        source = unwrap(source);
        if (source?.type !== 'ObjectExpression') {
          return protectedPaths.some((expected) => receiver.every(
            (part, index) => expected[index] === part,
          ));
        }
        return source.properties.some((property) => {
          if (property.type === 'SpreadElement' || property.computed) {
            return protectedPaths.some((expected) => receiver.every(
              (part, index) => expected[index] === part,
            ));
          }
          const name = propertyName(property);
          return name ? matchesPath([...receiver, name]) : false;
        });
      });
    }
    return false;
  };
  let found = false;
  visit(functionNode?.body, (node) => {
    if (found) return;
    const writeTarget = node.type === 'AssignmentExpression' ? node.left
      : node.type === 'UpdateExpression' ? node.argument
        : ['ForInStatement', 'ForOfStatement'].includes(node.type) ? node.left
          : node.type === 'UnaryExpression' && node.operator === 'delete' ? node.argument
            : null;
    if (writeTarget && targetUsesProtectedAlias(writeTarget, aliases)) found = true;
    if (node.type === 'AssignmentExpression' && matches(node.left)) found = true;
    if (node.type === 'UpdateExpression' && matches(node.argument)) found = true;
    if (['ForInStatement', 'ForOfStatement'].includes(node.type) && matches(node.left)) found = true;
    if (node.type === 'UnaryExpression' && node.operator === 'delete'
      && matches(node.argument)) found = true;
    if (reflectiveWriteMatches(node)) found = true;
  });
  return found;
}

// Resolve trusted globals through the small amount of value flow that can turn a
// direct builtin write into an indirect write.  This is deliberately local to the
// blocking-risk audit: unknown values are only tainted when they originated from a
// protected global or a builtin writer, so unrelated dynamic calls remain valid.
function trustedGlobalMutationValueFlow(program, protectedPaths, protectedGlobals) {
  const wrapperNames = new Set(['globalThis', 'global', 'self', 'window']);
  const builtinWriters = new Set([
    'Object.assign',
    'Object.defineProperties',
    'Object.defineProperty',
    'Object.setPrototypeOf',
    'Reflect.defineProperty',
    'Reflect.deleteProperty',
    'Reflect.set',
    'Reflect.setPrototypeOf',
  ]);
  const unprotectedObjectResults = new Set([
    'Object.getOwnPropertyDescriptor',
    'Object.getOwnPropertyDescriptors',
  ]);
  const writerFamilies = new Set(['Object', 'Reflect']);
  const parentByNode = new WeakMap();
  visit(program, (node, parent) => {
    if (parent) parentByNode.set(node, parent);
  });
  const lexicalScopeTypes = new Set([
    'Program',
    'BlockStatement',
    'CatchClause',
    'ClassBody',
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ForInStatement',
    'ForOfStatement',
    'ForStatement',
    'SwitchStatement',
    'StaticBlock',
  ]);
  const lexicalScopeFor = (node) => {
    let current = parentByNode.get(node) || program;
    while (current && !lexicalScopeTypes.has(current.type)) current = parentByNode.get(current);
    return current || program;
  };
  const functionScopeFor = (node) => {
    let current = parentByNode.get(node) || program;
    while (current && ![
      'Program',
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
    ].includes(current.type)) current = parentByNode.get(current);
    return current || program;
  };
  const visibleScopedEntries = (entries, useNode) => {
    if (!entries?.length || !Number.isInteger(useNode?.start) || !Number.isInteger(useNode?.end)) {
      return entries || [];
    }
    const visible = entries.filter(({ scope }) => !scope
      || (!Number.isInteger(scope.start) || !Number.isInteger(scope.end))
      || (scope.start <= useNode.start && useNode.end <= scope.end));
    if (!visible.length) return [];
    const span = Math.min(...visible.map(({ scope }) => (
      Number.isInteger(scope?.start) && Number.isInteger(scope?.end)
        ? scope.end - scope.start
        : Number.MAX_SAFE_INTEGER
    )));
    return visible.filter(({ scope }) => (
      Number.isInteger(scope?.start) && Number.isInteger(scope?.end)
        ? scope.end - scope.start
        : Number.MAX_SAFE_INTEGER
    ) === span);
  };
  const bindings = new Map();
  const memberBindings = new Map();
  const functionBindings = new Map();
  const visibleNameEntries = (name, useNode) => visibleScopedEntries([
    ...(bindings.get(name) || []).map((entry) => ({ ...entry, kind: 'binding' })),
    ...(functionBindings.get(name) || []).map((entry) => ({ ...entry, kind: 'function' })),
  ], useNode);
  const activeParameterValues = [];
  const addBinding = (
    name,
    source,
    selectors = [],
    scope = program,
    declaration = false,
  ) => {
    if (!name) return;
    const list = bindings.get(name) || [];
    list.push({ source, selectors, scope, declaration });
    bindings.set(name, list);
  };
  const addMemberBinding = (path, source, scope = program) => {
    if (!path?.length) return;
    const key = path.join('.');
    const list = memberBindings.get(key) || [];
    list.push({ source, scope });
    memberBindings.set(key, list);
  };
  const patternBindings = (
    pattern,
    source,
    selectors = [],
    seen = new Set(),
    scope = program,
    declaration = false,
  ) => {
    pattern = unwrap(pattern);
    if (!pattern) return;
    if (pattern.type === 'Identifier') {
      addBinding(
        pattern.name,
        source,
        selectors,
        typeof scope === 'function' ? scope(pattern.name) : scope,
        declaration,
      );
      return;
    }
    if (pattern.type === 'AssignmentPattern') {
      patternBindings(pattern.left, source, selectors, seen, scope, declaration);
      patternBindings(pattern.left, pattern.right, selectors, seen, scope, declaration);
      return;
    }
    if (pattern.type === 'RestElement') {
      const name = patternNames(pattern.argument)[0];
      addBinding(
        name,
        source,
        [...selectors, '@rest'],
        typeof scope === 'function' ? scope(name) : scope,
        declaration,
      );
      return;
    }
    if (pattern.type === 'ObjectPattern') {
      for (const property of pattern.properties || []) {
        if (property.type === 'RestElement') {
          patternBindings(
            property.argument,
            source,
            [...selectors, '@rest'],
            seen,
            scope,
            declaration,
          );
          continue;
        }
        if (property.type !== 'Property' || property.computed) {
          patternBindings(
            property.value,
            source,
            [...selectors, '@computed'],
            seen,
            scope,
            declaration,
          );
          continue;
        }
        const name = propertyName(property);
        patternBindings(
          property.value,
          source,
          [...selectors, name],
          seen,
          scope,
          declaration,
        );
      }
      return;
    }
    if (pattern.type === 'ArrayPattern') {
      pattern.elements?.forEach((element, index) => {
        if (element) patternBindings(
          element,
          source,
          [...selectors, String(index)],
          seen,
          scope,
          declaration,
        );
      });
    }
  };
  const variableDeclarationScope = (node) => (
    parentByNode.get(node)?.type === 'VariableDeclaration'
      && parentByNode.get(node).kind === 'var'
      ? functionScopeFor(node)
      : lexicalScopeFor(node)
  );
  visit(program, (node) => {
    if (node.type === 'VariableDeclarator') {
      patternBindings(
        node.id,
        node.init || null,
        [],
        new Set(),
        variableDeclarationScope(node),
        true,
      );
    }
    if (node.type === 'FunctionDeclaration' && node.id?.type === 'Identifier') {
      const list = functionBindings.get(node.id.name) || [];
      list.push({ node, scope: lexicalScopeFor(node) });
      functionBindings.set(node.id.name, list);
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      for (const parameter of node.params || []) {
        patternBindings(parameter, null, [], new Set(), node, true);
      }
      if (node.type === 'FunctionExpression' && node.id?.type === 'Identifier') {
        const list = functionBindings.get(node.id.name) || [];
        list.push({ node, scope: node });
        functionBindings.set(node.id.name, list);
      }
    }
    if (node.type === 'CatchClause' && node.param) {
      patternBindings(node.param, null, [], new Set(), node, true);
    }
  });
  const assignmentScopeFor = (name, node) => {
    const declarations = visibleScopedEntries([
      ...(bindings.get(name) || []).filter((entry) => entry.declaration),
      ...(functionBindings.get(name) || []),
    ], node);
    return declarations[0]?.scope || lexicalScopeFor(node);
  };
  visit(program, (node) => {
    const scope = lexicalScopeFor(node);
    if (node.type === 'AssignmentExpression' && ['=', '&&=', '||=', '??='].includes(node.operator)) {
      patternBindings(
        node.left,
        node.right,
        [],
        new Set(),
        (name) => assignmentScopeFor(name, node),
      );
      const path = staticMemberPath(node.left);
      if (path.length) addMemberBinding(
        path,
        node.right,
        path[0] === 'this' ? scope : assignmentScopeFor(path[0], node),
      );
    }
    if (node.type === 'ForOfStatement') {
      const target = node.left?.type === 'VariableDeclaration'
        ? node.left.declarations?.[0]?.id : node.left;
      const declaration = node.left?.type === 'VariableDeclaration';
      const targetScope = declaration
        ? node.left.kind === 'var' ? functionScopeFor(node) : node
        : (name) => assignmentScopeFor(name, node);
      patternBindings(target, node.right, [], new Set(), targetScope, declaration);
    }
  });

  const emptyValue = () => ({ paths: [], containers: [], bounds: [], functions: [], unknown: false });
  const unionValues = (values) => {
    const result = emptyValue();
    for (const value of values || []) {
      if (!value) continue;
      result.paths.push(...(value.paths || []));
      result.containers.push(...(value.containers || []));
      result.bounds.push(...(value.bounds || []));
      result.functions.push(...(value.functions || []));
      result.unknown ||= Boolean(value.unknown);
    }
    const pathKeys = new Set();
    result.paths = result.paths.filter((path) => {
      const key = path.join('.');
      if (pathKeys.has(key)) return false;
      pathKeys.add(key);
      return true;
    });
    return result;
  };
  const pathValue = (path) => ({ paths: [path], containers: [], bounds: [], functions: [], unknown: false });
  const unknownValue = () => ({ paths: [], containers: [], bounds: [], functions: [], unknown: true });
  const unknownWriterValue = () => ({
    paths: [['Object', '*'], ['Reflect', '*']],
    containers: [], bounds: [], functions: [], unknown: true,
  });
  const canonicalPath = (path) => {
    if (!Array.isArray(path) || !path.length) return [];
    if (wrapperNames.has(path[0])) {
      if (path.length === 1) return ['@global'];
      return path.slice(1);
    }
    if (path[0] === '@global' && path.length > 1) return path.slice(1);
    return path;
  };
  const normalizeValue = (value) => {
    if (!value) return emptyValue();
    return {
      ...value,
      paths: (value.paths || []).map(canonicalPath).filter((path) => path.length),
    };
  };
  const staticPropertyNames = (node, resolving = new Set()) => {
    node = unwrap(node);
    if (!node) return { names: [], unknown: true };
    if (node.type === 'Literal' && ['string', 'number'].includes(typeof node.value)) {
      return { names: [String(node.value)], unknown: false };
    }
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
      return { names: [node.quasis[0]?.value?.cooked || ''], unknown: false };
    }
    if (node.type === 'Identifier') {
      if (resolving.has(node.name)) return { names: [], unknown: true };
      const visible = visibleNameEntries(node.name, node);
      const entries = visible.filter((entry) => entry.kind === 'binding');
      if (!entries.length || visible.some((entry) => entry.kind === 'function')) {
        return { names: [], unknown: true };
      }
      const results = entries.map((entry) => staticPropertyNames(
        entry.source,
        new Set([...resolving, node.name]),
      ));
      return {
        names: [...new Set(results.flatMap((result) => result.names))],
        unknown: results.some((result) => result.unknown),
      };
    }
    if (node.type === 'ConditionalExpression' || node.type === 'LogicalExpression') {
      const results = [
        staticPropertyNames(node.consequent || node.left, resolving),
        staticPropertyNames(node.alternate || node.right, resolving),
      ];
      return {
        names: [...new Set(results.flatMap((result) => result.names))],
        unknown: results.some((result) => result.unknown),
      };
    }
    if (node.type === 'SequenceExpression') {
      return staticPropertyNames(node.expressions.at(-1), resolving);
    }
    if (node.type === 'AssignmentExpression') return staticPropertyNames(node.right, resolving);
    return { names: [], unknown: true };
  };
  const valueKey = (value) => {
    if (!value) return '';
    const paths = (value.paths || []).map((path) => path.join('.')).sort().join('|');
    return `${paths};${value.unknown ? 'u' : ''}`;
  };
  const projectValue = (value, selectors, depth, resolving) => {
    if (!selectors.length) return value;
    let current = value;
    for (const selector of selectors) {
      if (!current) return emptyValue();
      if (selector === '@rest') return current;
      if (selector === '@computed') {
        const entries = (current.containers || []).flatMap((container) => [...container.values()]);
        const dynamicPaths = (current.paths || []).map((path) => canonicalPath([...path, '*']));
        return normalizeValue(unionValues([
          ...entries,
          dynamicPaths.length
            ? { paths: dynamicPaths, containers: [], bounds: [], functions: [], unknown: true }
            : emptyValue(),
          current.unknown ? unknownValue() : emptyValue(),
        ]));
      }
      const projected = [];
      for (const container of current.containers || []) {
        const entry = container.get(selector);
        if (entry) projected.push(entry);
      }
      const pathProjected = current.paths.map((path) => canonicalPath([...path, selector]));
      current = unionValues([
        projected.length ? unionValues(projected) : emptyValue(),
        pathProjected.length ? { paths: pathProjected, containers: [], bounds: [], unknown: false } : emptyValue(),
      ]);
      if (current.paths.length === 0 && current.containers.length === 0 && current.bounds.length === 0) {
        if (value.unknown) return unknownValue();
      }
    }
    return current;
  };
  const resolving = new Set();
  const resolve = (node, depth = 0) => {
    node = unwrap(node);
    if (!node || depth > 32) return emptyValue();
    if (node.type === 'Identifier') {
      for (let index = activeParameterValues.length - 1; index >= 0; index -= 1) {
        if (activeParameterValues[index].has(node.name)) {
          return normalizeValue(activeParameterValues[index].get(node.name));
        }
      }
      if (resolving.has(node.name)) return pathValue([node.name]);
      const visible = visibleNameEntries(node.name, node);
      const entries = visible.filter((entry) => entry.kind === 'binding');
      const functions = visible
        .filter((entry) => entry.kind === 'function')
        .map((entry) => entry.node);
      if (entries.length || functions.length) {
        resolving.add(node.name);
        const values = [
          ...(entries || []).map((entry) => projectValue(
            resolve(entry.source, depth + 1), entry.selectors, depth + 1, resolving,
          )),
          functions.length
            ? { paths: [], containers: [], bounds: [], functions, unknown: false }
            : emptyValue(),
        ];
        resolving.delete(node.name);
        return normalizeValue(unionValues(values));
      }
      return normalizeValue(pathValue([node.name]));
    }
    if (node.type === 'ThisExpression') return pathValue(['this']);
    if (node.type === 'MemberExpression') {
      const directPath = staticMemberPath(node);
      const directKey = directPath.join('.');
      const directMembers = (memberBindings.get(directKey) || [])
        .map((entry) => ({ ...entry, kind: 'member' }));
      const rootShadows = directPath[0]
        ? [
            ...(bindings.get(directPath[0]) || []),
            ...(functionBindings.get(directPath[0]) || []),
          ].map((entry) => ({ ...entry, kind: 'root' }))
        : [];
      const boundMembers = visibleScopedEntries(
        [...directMembers, ...rootShadows],
        node,
      ).filter((entry) => entry.kind === 'member');
      if (boundMembers?.length) {
        return normalizeValue(unionValues(boundMembers.map(
          (entry) => resolve(entry.source, depth + 1),
        )));
      }
      const object = resolve(node.object, depth + 1);
      const properties = node.computed
        ? staticPropertyNames(node.property)
        : { names: [node.property?.name].filter(Boolean), unknown: false };
      if (!properties.names.length || properties.unknown) {
        const relevantBase = object.paths.some((path) => (
          path.length && (path[0] === '@global' || writerFamilies.has(path[0])
            || protectedPaths.some((expected) => pathOverlapsProtectedPath(path, [expected])))
        )) || object.unknown;
        return relevantBase ? { ...unknownValue(), paths: object.paths } : emptyValue();
      }
      const values = [];
      for (const property of properties.names) {
        const projected = [];
        for (const container of object.containers || []) {
          const entry = container.get(property);
          if (entry) projected.push(entry);
        }
        values.push(unionValues([
          projected.length ? unionValues(projected) : emptyValue(),
          {
            paths: object.paths.map((path) => canonicalPath([...path, property])),
            containers: [], bounds: [], functions: [], unknown: object.unknown,
          },
        ]));
      }
      return normalizeValue(unionValues(values));
    }
    if (node.type === 'ConditionalExpression' || node.type === 'LogicalExpression') {
      return unionValues([
        resolve(node.consequent || node.left, depth + 1),
        resolve(node.alternate || node.right, depth + 1),
      ]);
    }
    if (node.type === 'SequenceExpression') return resolve(node.expressions.at(-1), depth + 1);
    if (node.type === 'AssignmentExpression') return resolve(node.right, depth + 1);
    if (node.type === 'AwaitExpression' || node.type === 'YieldExpression') {
      return resolve(node.argument, depth + 1);
    }
    if (node.type === 'ObjectExpression') {
      const container = new Map();
      let unknown = false;
      for (const property of node.properties || []) {
        if (property.type === 'SpreadElement') {
          const spread = resolve(property.argument, depth + 1);
          for (const source of spread.containers || []) {
            for (const [key, value] of source.entries()) container.set(key, value);
          }
          unknown ||= spread.unknown || spread.paths.length > 0;
          continue;
        }
        if (property.type !== 'Property') {
          unknown = true;
          continue;
        }
        const names = property.computed ? staticPropertyNames(property.key).names : [propertyName(property)];
        if (!names.length || names.includes('')) {
          unknown = true;
          continue;
        }
        for (const name of names) container.set(name, resolve(property.value, depth + 1));
      }
      return { paths: [], containers: [container], bounds: [], unknown };
    }
    if (node.type === 'ArrayExpression') {
      const container = new Map();
      node.elements?.forEach((element, index) => {
        if (element?.type === 'SpreadElement') container.set(String(index), unknownValue());
        else if (element) container.set(String(index), resolve(element, depth + 1));
      });
      return { paths: [], containers: [container], bounds: [], unknown: false };
    }
    if (node.type === 'CallExpression') {
      const callee = unwrap(node.callee);
      const calleeProperties = callee?.type === 'MemberExpression'
        ? (callee.computed
          ? staticPropertyNames(callee.property)
          : { names: [callee.property?.name].filter(Boolean), unknown: false })
        : { names: [], unknown: false };
      if (callee?.type === 'MemberExpression'
        && calleeProperties.names.includes('bind')) {
        return {
          paths: [], containers: [],
          bounds: [{ callee: resolve(callee.object, depth + 1), boundArgs: node.arguments.slice(1) }],
          functions: [],
          unknown: calleeProperties.unknown,
        };
      }
      if (callee?.type === 'Identifier' && callee.name === 'Object' && node.arguments.length === 1) {
        return resolve(node.arguments[0], depth + 1);
      }
      const calleeValue = resolve(callee, depth + 1);
      const argumentValues = node.arguments.map((argument) => resolve(argument, depth + 1));
      if (calleeValue.functions?.length) {
        const returned = [];
        for (const functionNode of calleeValue.functions) {
          const params = functionNode.params || [];
          const parameterValues = new Map(params.flatMap((parameter, index) => (
            patternNames(parameter).map((name) => [name, node.arguments[index]])
          )));
          visit(functionNode.body, (entry) => {
            if (entry.type !== 'ReturnStatement' || !entry.argument) return;
            const argument = unwrap(entry.argument);
            if (argument?.type === 'Identifier' && parameterValues.has(argument.name)) {
              returned.push(resolve(parameterValues.get(argument.name), depth + 1));
            } else {
              returned.push(resolve(argument, depth + 1));
            }
          });
        }
        if (returned.length) return normalizeValue(unionValues(returned));
      }
      const calleeNames = (calleeValue.paths || []).map((path) => canonicalPath(path).join('.'));
      if (!calleeValue.unknown && calleeNames.length
        && calleeNames.every((name) => unprotectedObjectResults.has(name))) {
        return emptyValue();
      }
      const carriesProtectedValue = calleeValue.unknown
        || argumentValues.some((value) => value.unknown
          || value.paths.some((path) => protectedPaths.some((expected) => (
            pathOverlapsProtectedPath(canonicalPath(path), [expected])
          ))));
      return carriesProtectedValue ? unknownValue() : emptyValue();
    }
    if (node.type === 'NewExpression') return emptyValue();
    return emptyValue();
  };
  const pathMatches = (path, expected) => {
    const actual = canonicalPath(path);
    if (!actual.length) return false;
    if (actual[0] === '@global') return expected[0] === '@global';
    const common = Math.min(actual.length, expected.length);
    return actual.slice(0, common).every((part, index) => (
      part === '*' || expected[index] === '*' || part === expected[index]
    ));
  };
  const pathsMatchProtected = (paths, property = null) => {
    for (const original of paths || []) {
      const path = canonicalPath(original);
      if (path[0] === '@global') {
        if (property === null) return true;
        if (protectedGlobals.includes(property)) return true;
      }
      if (protectedPaths.some((expected) => pathMatches(path, expected))) return true;
      if (path.includes('*') && (path[0] === '@global' || writerFamilies.has(path[0]))) return true;
    }
    return false;
  };
  const valueMayBeProtected = (value, property = null) => (
    Boolean(value?.unknown)
      || pathsMatchProtected(value?.paths, property)
  );
  const receiverIsProtectedRoot = (value) => (value?.paths || []).some((path) => {
    const canonical = canonicalPath(path);
    return protectedPaths.some((expected) => (
      canonical.length === expected.length
        && canonical.every((part, index) => part === expected[index])
    ));
  });
  const writerNamesFor = (value) => {
    const names = new Set();
    for (const path of value?.paths || []) {
      const canonical = canonicalPath(path);
      const key = canonical.join('.');
      if (builtinWriters.has(key)) names.add(key);
      if (canonical.length === 2 && writerFamilies.has(canonical[0]) && canonical[1] === '*') {
        for (const writer of builtinWriters) if (writer.startsWith(`${canonical[0]}.`)) names.add(writer);
        names.add(`${canonical[0]}.*`);
      }
    }
    return names;
  };
  const invocationForms = (node, callable = resolve(node.callee), callDepth = 0) => {
    const forms = [];
    const add = (value, args, indeterminate = false, depth = 0) => {
      if (depth > 12) {
        forms.push({ writers: new Set(), args, indeterminate: true });
        return;
      }
      const writers = writerNamesFor(value);
      for (const bound of value?.bounds || []) {
        add(bound.callee, [...(bound.boundArgs || []), ...args], indeterminate, depth + 1);
      }
      for (const path of value?.paths || []) {
        const canonical = canonicalPath(path);
        const suffix = canonical.at(-1);
        if (suffix === 'call' || suffix === 'apply') {
          const base = resolve({
            type: 'MemberExpression', object: { type: 'Identifier', name: canonical.slice(0, -1).join('.') },
            property: { type: 'Identifier', name: suffix }, computed: false,
          });
          // The synthetic lookup above is only a fallback for aliases; exact
          // member expressions are decoded below using the original AST.
          void base;
        }
      }
      forms.push({ writers, args, indeterminate: indeterminate || Boolean(value?.unknown) });
    };
    const calleeNode = unwrap(node.callee);
    const directCalleeName = canonicalPath(staticMemberPath(calleeNode)).join('.');
    if (calleeNode?.type === 'MemberExpression'
      && directCalleeName !== 'Reflect.apply'
      && ['call', 'apply'].includes(calleeNode.computed
        ? (calleeNode.property?.type === 'Literal' ? String(calleeNode.property.value) : '')
        : calleeNode.property?.name)) {
      const base = resolve(calleeNode.object);
      const methodName = calleeNode.computed ? String(calleeNode.property.value) : calleeNode.property.name;
      const forwarded = methodName === 'call'
        ? node.arguments.slice(1) : null;
      const baseNames = new Set((base.paths || []).map((path) => canonicalPath(path).join('.')));
      const metaApply = baseNames.has('Reflect.apply');
      const metaConstruct = baseNames.has('Reflect.construct');
      if (metaApply || metaConstruct) {
        let metaArgs = forwarded || [];
        if (!forwarded) {
          const list = unwrap(node.arguments[1]);
          if (list?.type === 'ArrayExpression'
            && !list.elements.some((entry) => !entry || entry.type === 'SpreadElement')) {
            metaArgs = list.elements;
          } else {
            add(unknownWriterValue(), [], true);
            return forms;
          }
        }
        const target = metaArgs[0];
        const list = metaArgs[metaApply ? 2 : 1];
        if (!target) add(resolve(target), [], true);
        else if (unwrap(list)?.type === 'ArrayExpression'
          && !unwrap(list).elements.some((entry) => entry?.type === 'SpreadElement')) {
          add(resolve(target), unwrap(list).elements);
        } else add(resolve(target), [], true);
      } else if (forwarded) add(base, forwarded);
      else {
        const list = unwrap(node.arguments[1]);
        if (list?.type === 'ArrayExpression' && !list.elements.some((entry) => entry?.type === 'SpreadElement')) {
          add(base, list.elements);
        } else add(base, [], true);
      }
      return forms;
    }
    const dynamicBase = calleeNode?.type === 'MemberExpression' && calleeNode.computed
      ? resolve(calleeNode.object) : null;
    const dynamicNames = calleeNode?.type === 'MemberExpression' && calleeNode.computed
      ? staticPropertyNames(calleeNode.property) : { names: [], unknown: false };
    if (dynamicBase && dynamicNames.unknown && (dynamicBase.paths || []).some((path) => {
      const canonical = canonicalPath(path);
      return canonical.length === 1 && writerFamilies.has(canonical[0]);
    })) {
      add(unknownWriterValue(), node.arguments, true);
      return forms;
    }
    const callablePaths = new Set((callable?.paths || []).map((path) => canonicalPath(path).join('.')));
    if (callablePaths.has('Reflect.apply') || callablePaths.has('Reflect.construct')) {
      const metaApply = callablePaths.has('Reflect.apply');
      const target = node.arguments[0];
      const list = unwrap(node.arguments[metaApply ? 2 : 1]);
      if (list?.type === 'ArrayExpression'
        && !list.elements.some((entry) => !entry || entry.type === 'SpreadElement')) {
        add(resolve(target), list.elements);
      } else add(unknownWriterValue(), [], true);
      return forms;
    }
    const direct = canonicalPath(staticMemberPath(calleeNode));
    if (directCalleeName === 'Reflect.apply') {
      const target = node.arguments[0];
      const list = unwrap(node.arguments[2]);
      if (list?.type === 'ArrayExpression' && !list.elements.some((entry) => entry?.type === 'SpreadElement')) {
        add(resolve(target), list.elements);
      } else add(resolve(target), [], true);
      return forms;
    }
    if (direct.join('.') === 'Reflect.construct') {
      const target = node.arguments[0];
      const list = unwrap(node.arguments[1]);
      if (list?.type === 'ArrayExpression' && !list.elements.some((entry) => entry?.type === 'SpreadElement')) {
        add(resolve(target), list.elements);
      } else add(resolve(target), [], true);
      return forms;
    }
    add(callable, node.arguments);
    return forms;
  };
  const writerMutates = (writer, args, indeterminate) => {
    if (!writer) return false;
    if (indeterminate) {
      const target = args[0];
      return !target || valueMayBeProtected(resolve(target));
    }
    const name = writer;
    if (name.endsWith('.*')) {
      const target = args[0];
      return !target || valueMayBeProtected(resolve(target));
    }
    const target = args[0];
    if (!target) return true;
    if (name.endsWith('setPrototypeOf')) return valueMayBeProtected(resolve(target));
    if (name.endsWith('defineProperty') || name.endsWith('deleteProperty') || name.endsWith('.set')) {
      const propertyNode = args[1];
      const propertyNames = staticPropertyNames(propertyNode).names;
      if (!propertyNames.length) return valueMayBeProtected(resolve(target));
      return propertyNames.some((property) => valueMayBeProtected(resolve(target), property));
    }
    if (name.endsWith('defineProperties')) {
      const receiver = resolve(target);
      const descriptors = resolve(args[1]);
      if (receiverIsProtectedRoot(receiver)) return true;
      for (const property of descriptors?.containers || []) {
        for (const key of property.keys()) if (valueMayBeProtected(receiver, key)) return true;
      }
      return descriptors?.unknown === true && valueMayBeProtected(receiver);
    }
    if (name.endsWith('assign')) {
      const receiver = resolve(target);
      if (receiverIsProtectedRoot(receiver)) return true;
      for (const source of args.slice(1)) {
        const sourceValue = resolve(source);
        for (const container of sourceValue.containers || []) {
          for (const key of container.keys()) if (valueMayBeProtected(receiver, key)) return true;
        }
        if (sourceValue.unknown && valueMayBeProtected(receiver)) return true;
      }
    }
    return false;
  };
  let mutated = false;
  const inspect = (root, callDepth = 0, activeFunctions = new Set()) => visit(root, (node) => {
    if (mutated) return;
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression'
      || (node.type === 'UnaryExpression' && node.operator === 'delete')
      || ['ForInStatement', 'ForOfStatement'].includes(node.type)) {
      const target = node.type === 'ForInStatement' || node.type === 'ForOfStatement'
        ? node.left?.type === 'VariableDeclaration' ? node.left.declarations?.[0]?.id : node.left
        : node.left || node.argument;
      if (target?.type === 'MemberExpression') {
        const object = resolve(target.object);
        const properties = target.computed ? staticPropertyNames(target.property) : {
          names: [target.property?.name].filter(Boolean), unknown: false,
        };
        if (properties.unknown || !properties.names.length) mutated = valueMayBeProtected(object);
        else mutated = properties.names.some((property) => valueMayBeProtected(object, property));
      }
      return;
    }
    if (node.type !== 'CallExpression' && node.type !== 'NewExpression') return;
    for (const form of invocationForms(node)) {
      for (const writer of form.writers || []) {
        if (writerMutates(writer, form.args, form.indeterminate)) {
          mutated = true;
          return;
        }
      }
    }
    if (mutated || callDepth >= 12) return;
    const callable = resolve(node.callee);
    for (const functionNode of callable.functions || []) {
      if (activeFunctions.has(functionNode)) continue;
      const parameterValues = new Map();
      for (let index = 0; index < (functionNode.params || []).length; index += 1) {
        const argument = node.arguments[index];
        const value = !argument || argument.type === 'SpreadElement'
          ? unknownValue()
          : resolve(argument);
        for (const name of patternNames(functionNode.params[index])) parameterValues.set(name, value);
      }
      activeParameterValues.push(parameterValues);
      try {
        inspect(functionNode.body, callDepth + 1, new Set([...activeFunctions, functionNode]));
      } finally {
        activeParameterValues.pop();
      }
      if (mutated) return;
    }
  });
  inspect(program);
  return mutated;
}

export function programHasTrustedGlobalMutation(program, globals) {
  const trustedGlobals = [...new Set((globals || []).filter((name) => (
    typeof name === 'string' && name.length > 0
  )))];
  if (!trustedGlobals.length) return false;
  const protectedPaths = trustedGlobals.flatMap((name) => [
    [name],
    ['globalThis', name],
    ['global', name],
  ]);
  return trustedGlobalMutationValueFlow(program, protectedPaths, trustedGlobals);
}

function protectedCollectionMutationCalls(functionNode, protectedPath, methods) {
  const aliasState = protectedReceiverAliasState(functionNode, [protectedPath]);
  if (aliasState.unsafe) return [{ method: 'unknown', node: null }];
  const { aliases } = aliasState;
  const methodSet = new Set(methods);
  const exactPath = (actual, expected) => actual.length === expected.length
    && expected.every((part, index) => actual[index] === part);
  const protectedMethod = (node) => {
    const path = staticMemberPathWithAliases(node, aliases);
    return path.length === protectedPath.length + 1
      && exactPath(path.slice(0, -1), protectedPath)
      && methodSet.has(path.at(-1))
      ? path.at(-1)
      : '';
  };
  const protectedReceiver = (node) => exactPath(
    staticMemberPathWithAliases(node, aliases),
    protectedPath,
  );
  const collectionPrototypeMethod = (node) => {
    const path = staticMemberPath(node);
    return path.length === 3
      && ['Map', 'Set'].includes(path[0])
      && path[1] === 'prototype'
      && methodSet.has(path[2])
      ? path[2]
      : '';
  };
  const boundCollectionMutation = (node) => {
    node = unwrap(node);
    if (node?.type !== 'CallExpression') return '';
    const bindCall = unwrap(node.callee);
    if (bindCall?.type !== 'CallExpression') return '';
    const bindCallee = unwrap(bindCall.callee);
    if (bindCallee?.type !== 'MemberExpression'
      || bindCallee.computed
      || !identifier(bindCallee.property, 'bind')
      || bindCall.arguments.length < 1) return '';
    const target = unwrap(bindCallee.object);
    const method = protectedMethod(target) || collectionPrototypeMethod(target);
    return method && protectedReceiver(bindCall.arguments[0]) ? method : '';
  };
  const mutations = [];
  visit(functionNode?.body, (node) => {
    if (node.type !== 'CallExpression') return;
    const callee = unwrap(node.callee);
    const directMethod = protectedMethod(callee);
    if (directMethod) {
      mutations.push({ method: directMethod, node });
      return;
    }
    if (callee?.type === 'MemberExpression' && callee.computed
      && protectedReceiver(callee.object)) {
      mutations.push({ method: 'unknown', node });
      return;
    }
    const calleePath = staticMemberPathWithAliases(callee, aliases);
    if (['call', 'apply'].includes(calleePath.at(-1))) {
      const target = unwrap(callee.object);
      const method = protectedMethod(target) || collectionPrototypeMethod(target);
      if (method && protectedReceiver(node.arguments[0])) {
        mutations.push({ method, node });
        return;
      }
    }
    if (exactPath(calleePath, ['Reflect', 'apply'])) {
      const method = protectedMethod(node.arguments[0])
        || collectionPrototypeMethod(node.arguments[0]);
      if (method && protectedReceiver(node.arguments[1])) {
        mutations.push({ method, node });
      }
      return;
    }
    const boundMethod = boundCollectionMutation(node);
    if (boundMethod) {
      mutations.push({ method: boundMethod, node });
    }
  });
  return mutations;
}

function countMemberWrites(functionNode, protectedPath) {
  const reflectiveCalls = new Set([
    'Object.assign', 'Object.defineProperties', 'Object.defineProperty',
    'Reflect.deleteProperty', 'Reflect.set',
  ]);
  let count = 0;
  visit(functionNode?.body, (node) => {
    const directWrite = node.type === 'AssignmentExpression'
      || node.type === 'UpdateExpression'
      || ['ForInStatement', 'ForOfStatement'].includes(node.type)
      || (node.type === 'UnaryExpression' && node.operator === 'delete');
    const reflectiveWrite = node.type === 'CallExpression'
      && reflectiveCalls.has(staticMemberPath(node.callee).join('.'));
    if ((directWrite || reflectiveWrite)
      && functionHasMemberWrite({ body: node }, [protectedPath])) count += 1;
  });
  return count;
}

function exactTopLevelRequireBinding(program, localName, requiredName, modulePath) {
  const matches = [];
  for (const statement of program?.body || []) {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') continue;
    for (const declaration of statement.declarations) {
      if (!call(declaration.init, ['require'], [(value) => literal(value, modulePath)])
        || declaration.id?.type !== 'ObjectPattern') continue;
      for (const property of declaration.id.properties) {
        if (property.type === 'Property'
          && property.kind === 'init'
          && !property.computed
          && propertyName(property) === requiredName
          && identifier(property.value, localName)) matches.push(property);
      }
    }
  }
  return matches.length === 1
    && topLevelBindingCount(program, localName) === 1
    && stableProgramIdentifiers(program, [localName, 'require'], { globals: ['require'] });
}

function exactTopLevelModuleExports(program, expected) {
  const assignments = directAssignmentStatements(program, ['module', 'exports']);
  return topLevelCommonJsBindingsStable(program)
    && assignments.length === 1
    && exactObject(assignments[0].expression.right, expected);
}

function topLevelModuleExportsIncludes(program, expected) {
  const assignments = directAssignmentStatements(program, ['module', 'exports']);
  return topLevelCommonJsBindingsStable(program)
    && assignments.length === 1
    && objectIncludesExactProperties(assignments[0].expression.right, expected);
}

function topLevelCommonJsBindingsStable(program) {
  if (!program || topLevelBindingCount(program, 'module') > 0
    || topLevelBindingCount(program, 'exports') > 0
    || functionHasIdentifierWrite(program, ['module', 'exports'])
    || programHasNestedBinding(program, ['module', 'exports'])) return false;
  let changed = false;
  visit(program, (node) => {
    if (changed || node.type !== 'CallExpression') return;
    const path = staticMemberPath(node.callee);
    if (path.join('.') === 'Object.defineProperty'
      || path.join('.') === 'Object.defineProperties') {
      const receiver = staticMemberPath(node.arguments[0]).join('.');
      if (receiver === 'module' || receiver === 'exports') changed = true;
    }
  });
  return !changed;
}

function functionHasOwnParameterBinding(functionNode, protectedNames) {
  const protectedSet = new Set(protectedNames);
  return (functionNode?.params || [])
    .flatMap((parameter) => patternNames(parameter))
    .some((name) => protectedSet.has(name));
}

function exactProtectedIdentifierParameters(functionNode, names, protectedNames = names) {
  return exactIdentifierParameters(functionNode, names)
    && !functionHasNestedBinding(functionNode, protectedNames)
    && !functionHasIdentifierWrite(functionNode, protectedNames);
}

function computedIdentifierMember(node, objectName, propertyName) {
  node = unwrap(node);
  return node?.type === 'MemberExpression'
    && node.computed === true
    && identifier(node.object, objectName)
    && identifier(node.property, propertyName);
}

function arrowCallsExactly(node, path, argumentMatchers, { await_: awaited = false } = {}) {
  node = unwrap(node);
  if (node?.type !== 'ArrowFunctionExpression') return false;
  if (node.body.type === 'BlockStatement') {
    return node.body.body.length === 1
      && (awaited
        ? exactReturn(node.body.body[0], (value) => call(value, path, argumentMatchers), { await_: true })
        : exactReturn(node.body.body[0], (value) => call(value, path, argumentMatchers)));
  }
  let body = unwrap(node.body);
  if (awaited) {
    if (body?.type !== 'AwaitExpression') return false;
    body = unwrap(body.argument);
  }
  return call(body, path, argumentMatchers);
}

function exactNotCall(node, path, argumentMatchers) {
  return unary(node, '!', (argument) => call(argument, path, argumentMatchers));
}

function exactItemGuard(node) {
  return logical(
    node,
    '||',
    (left) => unary(left, '!', (argument) => identifier(argument, 'item')),
    (right) => exactNotCall(right, ['item', 'matches'], [(argument) => identifier(argument, 'message')]),
  );
}

function exactMessageAuthorityGuard(node) {
  return logical(
    node,
    '||',
    (left) => unary(left, '!', (argument) => identifier(argument, 'message')),
    (right) => exactNotCall(right, ['sameIdentity'], [
      (argument) => identifier(argument, 'message'),
      (argument) => member(argument, ['this', 'authority']),
      (argument) => identifier(argument, 'AUTHORITY_FIELDS'),
    ]),
  );
}

function exactOperation(node, operator, value) {
  return binary(
    node,
    operator,
    (left) => member(left, ['message', 'operation']),
    (right) => literal(right, value),
  );
}

function executionDeadlineError(node) {
  node = unwrap(node);
  if (construct(node, 'Error')) return true;
  return call(node, ['Object', 'assign'], [
    (entry) => construct(entry, 'Error'),
    (entry) => exactObject(entry, {
      code: (value) => literal(value, 'execution_worker_deadline_exceeded'),
    }),
  ]);
}

function legacyCancellationRequestAstContract(request) {
  if (!exactIdentifierParameters(request, [
    'supervisor', 'operation', 'identity', 'payload', 'options', 'signal',
  ])) return false;
  const pending = directDeclarator(request.body, 'pending', 'const');
  const cancelIdentity = directDeclarator(request.body, 'cancelIdentity', 'const');
  const onAbort = directDeclarator(request.body, 'onAbort', 'const');
  if (!pending || !cancelIdentity || !onAbort
    || !call(pending.declaration.init, ['supervisor', 'request'], [
      (value) => identifier(value, 'operation'),
      (value) => identifier(value, 'identity'),
      (value) => identifier(value, 'payload'),
      (value) => identifier(value, 'options'),
    ])
    || !identifier(cancelIdentity.declaration.init, 'identity')
    || functionHasNestedBinding(request, [
      'identity', 'operation', 'options', 'payload', 'Promise', 'signal', 'supervisor',
    ])
    || functionHasIdentifierWrite(request, [
      'cancelIdentity', 'identity', 'onAbort', 'operation', 'options', 'payload',
      'pending', 'Promise', 'signal', 'supervisor',
    ])) return false;
  const abortFunction = unwrap(onAbort.declaration.init);
  if (abortFunction?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(abortFunction, [])
    || abortFunction.body?.type !== 'BlockStatement'
    || abortFunction.body.body.length !== 1
    || !directCallStatement(abortFunction.body.body[0], ['supervisor', 'cancel'], [
      (value) => identifier(value, 'cancelIdentity'),
      (value) => literal(value, 'user-requested'),
    ])) return false;

  const noSignal = request.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && !statement.alternate
    && unary(statement.test, '!', (value) => identifier(value, 'signal'))
    && exactReturn(statement.consequent, (value) => identifier(value, 'pending'), { await_: true })
  ));
  const addListener = request.body.body.filter((statement) => directCallStatement(
    statement,
    ['signal', 'addEventListener'],
    [
      (value) => literal(value, 'abort'),
      (value) => identifier(value, 'onAbort'),
      (value) => exactObject(value, { once: (entry) => literal(entry, true) }),
    ],
  ));
  const alreadyAborted = request.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && !statement.alternate
    && member(statement.test, ['signal', 'aborted'])
    && directCallStatement(statement.consequent, ['onAbort'], [])
  ));
  const guardedWait = request.body.body.filter((statement) => (
    statement.type === 'TryStatement'
    && !statement.handler
    && statement.block.body.length === 1
    && exactReturn(statement.block.body[0], (value) => identifier(value, 'pending'), { await_: true })
    && statement.finalizer?.body.length === 1
    && directCallStatement(statement.finalizer.body[0], ['signal', 'removeEventListener'], [
      (value) => literal(value, 'abort'),
      (value) => identifier(value, 'onAbort'),
    ])
  ));
  if (noSignal.length !== 1 || addListener.length !== 1
    || alreadyAborted.length !== 1 || guardedWait.length !== 1) return false;
  const requestBody = request.body.body;
  if (!directStatementsOrderedAndReachable(request.body, [
    pending.statement,
    onAbort.statement,
    noSignal[0],
    addListener[0],
    alreadyAborted[0],
    guardedWait[0],
  ])) return false;
  return true;
}

function normalizedCancellationIdentity(node) {
  node = unwrap(node);
  if (node?.type !== 'LogicalExpression' || node.operator !== '&&'
    || !identifier(node.left, 'identity')) return false;
  const value = unwrap(node.right);
  if (value?.type !== 'ObjectExpression' || value.properties.length !== 2) return false;
  const [spread, generation] = value.properties;
  return spread?.type === 'SpreadElement'
    && identifier(spread.argument, 'identity')
    && generation?.type === 'Property'
    && generation.kind === 'init'
    && !generation.computed
    && propertyName(generation) === 'runtimeGeneration'
    && call(generation.value, ['Number'], [
      (entry) => member(entry, ['identity', 'runtimeGeneration']),
    ]);
}

function currentCancellationRequestAstContract(request) {
  const body = request?.body;
  if (body?.type !== 'BlockStatement'
    || !exactIdentifierParameters(request, [
      'supervisor', 'operation', 'identity', 'payload', 'options', 'signal',
    ])
    || functionHasNestedBinding(request, [
      'identity', 'operation', 'options', 'payload', 'signal', 'supervisor',
    ])
    || functionHasIdentifierWrite(request, [
      'cancel', 'cancelIdentity', 'identity', 'operation', 'options', 'payload',
      'pending', 'signal', 'supervisor',
    ])) return false;
  const cancelIdentity = directDeclarator(body, 'cancelIdentity', 'const');
  const cancel = directDeclarator(body, 'cancel', 'const');
  const attempts = body.body.filter((statement) => (
    statement.type === 'TryStatement' && !statement.handler && statement.finalizer
  ));
  if (!cancelIdentity || !normalizedCancellationIdentity(cancelIdentity.declaration.init)
    || !cancel || attempts.length !== 1) return false;
  const cancelFunction = unwrap(cancel.declaration.init);
  if (cancelFunction?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(cancelFunction, [])
    || cancelFunction.body?.type !== 'BlockStatement'
    || cancelFunction.body.body.length !== 1
    || !directCallStatement(cancelFunction.body.body[0], ['supervisor', 'cancel'], [
      (entry) => identifier(entry, 'cancelIdentity'),
      (entry) => literal(entry, 'user-requested'),
    ], { void_: true })) return false;
  const listenerAdds = body.body.filter((statement) => directCallStatement(
    statement,
    ['signal', 'addEventListener'],
    [
      (entry) => literal(entry, 'abort'),
      (entry) => identifier(entry, 'cancel'),
      (entry) => exactObject(entry, { once: (value) => literal(value, true) }),
    ],
  ));
  const [attempt] = attempts;
  const pending = directDeclarator(attempt.block, 'pending', 'const');
  const aborted = attempt.block.body.filter((statement) => (
    statement.type === 'IfStatement'
    && !statement.alternate
    && member(statement.test, ['signal', 'aborted'])
    && directCallStatement(statement.consequent, ['cancel'], [])
  ));
  const returns = attempt.block.body.filter((statement) => exactReturn(
    statement, (entry) => identifier(entry, 'pending'), { await_: true },
  ));
  const removes = attempt.finalizer.body.filter((statement) => directCallStatement(
    statement,
    ['signal', 'removeEventListener'],
    [(entry) => literal(entry, 'abort'), (entry) => identifier(entry, 'cancel')],
  ));
  if (!pending || !call(pending.declaration.init, ['supervisor', 'request'], [
    (entry) => identifier(entry, 'operation'),
    (entry) => identifier(entry, 'identity'),
    (entry) => identifier(entry, 'payload'),
    (entry) => identifier(entry, 'options'),
  ]) || listenerAdds.length !== 1 || aborted.length !== 1
    || returns.length !== 1 || removes.length !== 1
    || !directStatementsOrderedAndReachable(attempt.block, [
      pending.statement, aborted[0], returns[0],
    ])
    || !directStatementReachable(attempt.finalizer, removes[0])) return false;
  const outer = body.body;
  return directStatementsOrderedAndReachable(body, [
    cancelIdentity.statement, cancel.statement, listenerAdds[0], attempt,
  ]);
}

function currentCancellationSettlementAstContract(settlement) {
  const expectedParameters = [
    'cancellationTimeoutMs', 'child', 'deadlineCancellationTimeoutMs', 'deadlineMs',
    'now', 'onCancellationTimeout', 'onDeadline', 'operation', 'reject', 'resolve',
    'terminateChild',
  ].sort();
  const timeoutBindingNames = [
    'boundedCancellationTimeoutMs', 'boundedDeadlineCancellationTimeoutMs',
    'boundedDeadlineMs', 'requestedCancellationTimeoutMs',
    'requestedDeadlineCancellationTimeoutMs', 'requestedDeadlineMs',
  ];
  const localBindingNames = ['armDeadline', 'cancellationTimer', 'clear', 'deadline'];
  const parameter = settlement.params.length === 1 ? settlement.params[0] : null;
  if (!objectPatternBindsExactly(parameter, expectedParameters, {
    propertyDefaults: {
      deadlineCancellationTimeoutMs: (value) => identifier(value, 'cancellationTimeoutMs'),
      now: (value) => member(value, ['Date', 'now']),
    },
    requiredPropertyDefaults: ['deadlineCancellationTimeoutMs', 'now'],
  })
    || functionHasNestedBinding(settlement, [
      ...expectedParameters, ...timeoutBindingNames, ...localBindingNames,
      'Date', 'Error', 'Math', 'Number', 'Object', 'clearTimeout', 'setTimeout',
    ], { allowedDirectBindings: [...timeoutBindingNames, ...localBindingNames] })
    || functionHasIdentifierWrite(settlement, [
      ...expectedParameters, ...timeoutBindingNames, 'Date', 'Error', 'Math', 'Number',
      'Object', 'clear', 'armDeadline', 'clearTimeout', 'setTimeout',
    ])) return false;

  if (!safeTimerTimeoutBinding(settlement, {
    sourceName: 'deadlineMs', requestedName: 'requestedDeadlineMs',
    boundedName: 'boundedDeadlineMs', maximum: 2_147_483_646,
  }) || !safeTimerTimeoutBinding(settlement, {
    sourceName: 'cancellationTimeoutMs', requestedName: 'requestedCancellationTimeoutMs',
    boundedName: 'boundedCancellationTimeoutMs', maximum: 2_147_483_647,
  }) || !safeTimerTimeoutBinding(settlement, {
    sourceName: 'deadlineCancellationTimeoutMs',
    requestedName: 'requestedDeadlineCancellationTimeoutMs',
    boundedName: 'boundedDeadlineCancellationTimeoutMs', maximum: 2_147_483_647,
  })) return false;

  const cancellationTimer = directDeclarator(settlement.body, 'cancellationTimer', 'let');
  const deadline = directDeclarator(settlement.body, 'deadline', 'let');
  const clear = directDeclarator(settlement.body, 'clear', 'const');
  const armDeadline = directDeclarator(settlement.body, 'armDeadline', 'const');
  if (!cancellationTimer || !deadline
    || cancellationTimer.statement !== deadline.statement
    || !literal(cancellationTimer.declaration.init, null)
    || !literal(deadline.declaration.init, null) || !clear || !armDeadline) return false;

  const clearFunction = unwrap(clear.declaration.init);
  if (clearFunction?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(clearFunction, [])
    || clearFunction.body?.type !== 'BlockStatement'
    || clearFunction.body.body.length !== 2
    || !directCallStatement(clearFunction.body.body[0], ['clearTimeout'], [
      (value) => identifier(value, 'deadline'),
    ])
    || !directCallStatement(clearFunction.body.body[1], ['clearTimeout'], [
      (value) => identifier(value, 'cancellationTimer'),
    ])) return false;

  const armDeadlineFunction = unwrap(armDeadline.declaration.init);
  if (armDeadlineFunction?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(armDeadlineFunction, [])
    || armDeadlineFunction.body?.type !== 'BlockStatement'
    || armDeadlineFunction.body.body.length !== 3
    || !directCallStatement(armDeadlineFunction.body.body[0], ['clearTimeout'], [
      (value) => identifier(value, 'deadline'),
    ])) return false;
  const deadlineAssignments = directAssignmentStatements(
    armDeadlineFunction.body, ['deadline'],
  );
  if (deadlineAssignments.length !== 1) return false;
  const deadlineCall = unwrap(deadlineAssignments[0].expression.right);
  if (!call(deadlineCall, ['setTimeout']) || deadlineCall.arguments.length !== 2
    || !binary(
      deadlineCall.arguments[1], '+',
      (value) => identifier(value, 'boundedDeadlineMs'),
      (value) => literal(value, 1),
    )
    || !directCallStatement(armDeadlineFunction.body.body[2], ['deadline', 'unref'], [])) {
    return false;
  }

  const deadlineCallback = unwrap(deadlineCall.arguments[0]);
  if (deadlineCallback?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(deadlineCallback, [])
    || deadlineCallback.body?.type !== 'BlockStatement'
    || deadlineCallback.body.body.length !== 5
    || !directCallStatement(deadlineCallback.body.body[0], ['clearTimeout'], [
      (value) => identifier(value, 'deadline'),
    ])) return false;
  const deadlineReset = unwrap(deadlineCallback.body.body[1]?.expression);
  const startBranch = deadlineCallback.body.body[4];
  if (deadlineReset?.type !== 'AssignmentExpression' || deadlineReset.operator !== '='
    || !identifier(deadlineReset.left, 'deadline') || !literal(deadlineReset.right, null)
    || !directCallStatement(deadlineCallback.body.body[2], ['onDeadline'], [])
    || !directCallStatement(deadlineCallback.body.body[3], ['reject'], [
      (value) => executionDeadlineError(value),
    ])
    || startBranch?.type !== 'IfStatement'
    || !binary(
      startBranch.test, '===',
      (value) => identifier(value, 'operation'),
      (value) => literal(value, 'execution.start'),
    )
    || startBranch.consequent?.type !== 'BlockStatement'
    || startBranch.consequent.body.length !== 2
    || !directCallStatement(startBranch.alternate, ['clear'], [])) return false;
  const deadlineCancellationAssignment = unwrap(
    startBranch.consequent.body[0]?.expression,
  );
  if (deadlineCancellationAssignment?.type !== 'AssignmentExpression'
    || deadlineCancellationAssignment.operator !== '='
    || !identifier(deadlineCancellationAssignment.left, 'cancellationTimer')) return false;
  const deadlineCancellationCall = unwrap(deadlineCancellationAssignment.right);
  if (!call(deadlineCancellationCall, ['setTimeout'])
    || deadlineCancellationCall.arguments.length !== 2
    || !identifier(
      deadlineCancellationCall.arguments[1], 'boundedDeadlineCancellationTimeoutMs',
    )
    || !directCallStatement(
      startBranch.consequent.body[1], ['cancellationTimer', 'unref'], [],
    )) return false;
  const deadlineCancellationCallback = unwrap(deadlineCancellationCall.arguments[0]);
  if (deadlineCancellationCallback?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(deadlineCancellationCallback, [])
    || deadlineCancellationCallback.body?.type !== 'BlockStatement'
    || deadlineCancellationCallback.body.body.length !== 2
    || !directCallStatement(
      deadlineCancellationCallback.body.body[0], ['onCancellationTimeout'], [],
    )) return false;
  const fallbackTermination = deadlineCancellationCallback.body.body[1];
  if (fallbackTermination?.type !== 'IfStatement'
    || !unary(
      fallbackTermination.test, '!', (value) => identifier(value, 'onCancellationTimeout'),
    )
    || !directCallStatement(fallbackTermination.consequent, ['terminateChild'], [
      (value) => identifier(value, 'child'),
      (value) => literal(value, 'cancel-timeout'),
    ], { void_: true })) return false;

  const initialArm = settlement.body.body.filter((statement) => directCallStatement(
    statement, ['armDeadline'], [],
  ));
  const returned = returnedObject(settlement);
  let armCancellationFunction = null;
  let renewDeadlineFunction = null;
  const returnedValid = returned && exactObject(returned, {
    armCancellation: (value) => {
      armCancellationFunction = unwrap(value);
      return armCancellationFunction?.type === 'ArrowFunctionExpression'
        && !armCancellationFunction.async
        && exactIdentifierParameters(armCancellationFunction, [])
        && armCancellationFunction.body?.type === 'BlockStatement';
    },
    renewDeadline: (value) => {
      renewDeadlineFunction = unwrap(value);
      return renewDeadlineFunction?.type === 'ArrowFunctionExpression'
        && !renewDeadlineFunction.async
        && exactIdentifierParameters(renewDeadlineFunction, [])
        && renewDeadlineFunction.body?.type === 'BlockStatement';
    },
    resolve: (value) => {
      value = unwrap(value);
      return value?.type === 'ArrowFunctionExpression'
        && exactIdentifierParameters(value, ['value'])
        && value.body?.type === 'BlockStatement' && value.body.body.length === 2
        && directCallStatement(value.body.body[0], ['clear'], [])
        && directCallStatement(value.body.body[1], ['resolve'], [
          (entry) => identifier(entry, 'value'),
        ]);
    },
    reject: (value) => {
      value = unwrap(value);
      return value?.type === 'ArrowFunctionExpression'
        && exactIdentifierParameters(value, ['error'])
        && value.body?.type === 'BlockStatement' && value.body.body.length === 2
        && directCallStatement(value.body.body[0], ['clear'], [])
        && directCallStatement(value.body.body[1], ['reject'], [
          (entry) => identifier(entry, 'error'),
        ]);
    },
  });
  if (!returnedValid || initialArm.length !== 1
    || armCancellationFunction.body.body.length !== 3
    || renewDeadlineFunction.body.body.length !== 2) return false;
  const cancellationGuard = armCancellationFunction.body.body[0];
  const cancellationAssignment = unwrap(
    armCancellationFunction.body.body[1]?.expression,
  );
  if (cancellationGuard?.type !== 'IfStatement'
    || !identifier(cancellationGuard.test, 'cancellationTimer')
    || !bareReturn(cancellationGuard.consequent)
    || cancellationAssignment?.type !== 'AssignmentExpression'
    || cancellationAssignment.operator !== '='
    || !identifier(cancellationAssignment.left, 'cancellationTimer')) return false;
  const cancellationCall = unwrap(cancellationAssignment.right);
  const cancellationCallback = unwrap(cancellationCall?.arguments?.[0]);
  if (!call(cancellationCall, ['setTimeout']) || cancellationCall.arguments.length !== 2
    || cancellationCallback?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(cancellationCallback, [])
    || !directCallStatement(
      { type: 'ExpressionStatement', expression: cancellationCallback.body },
      ['terminateChild'], [
        (value) => identifier(value, 'child'),
        (value) => literal(value, 'cancel-timeout'),
      ], { void_: true },
    )
    || !identifier(cancellationCall.arguments[1], 'boundedCancellationTimeoutMs')
    || !directCallStatement(
      armCancellationFunction.body.body[2], ['cancellationTimer', 'unref'], [],
    )) return false;
  if (!directCallStatement(renewDeadlineFunction.body.body[0], ['armDeadline'], [])
    || !exactReturn(renewDeadlineFunction.body.body[1], (value) => binary(
      value, '+',
      (left) => call(left, ['now'], []),
      (right) => identifier(right, 'boundedDeadlineMs'),
    ))) return false;

  const timeoutCalls = [];
  visit(settlement.body, (node) => {
    if (call(node, ['setTimeout'])) timeoutCalls.push(node);
  });
  if (timeoutCalls.length !== 3
    || !timeoutCalls.includes(deadlineCall)
    || !timeoutCalls.includes(deadlineCancellationCall)
    || !timeoutCalls.includes(cancellationCall)
    || countAssignments(settlement, (left) => identifier(left, 'deadline')) !== 2
    || countAssignments(settlement, (left) => identifier(left, 'cancellationTimer')) !== 2) {
    return false;
  }
  const returnedStatement = settlement.body.body.filter(
    (statement) => statement.type === 'ReturnStatement',
  );
  return returnedStatement.length === 1 && directStatementsOrderedAndReachable(settlement.body, [
    directDeclarator(settlement.body, 'requestedDeadlineMs', 'const').statement,
    directDeclarator(settlement.body, 'boundedDeadlineMs', 'const').statement,
    directDeclarator(settlement.body, 'requestedCancellationTimeoutMs', 'const').statement,
    directDeclarator(settlement.body, 'boundedCancellationTimeoutMs', 'const').statement,
    directDeclarator(
      settlement.body, 'requestedDeadlineCancellationTimeoutMs', 'const',
    ).statement,
    directDeclarator(
      settlement.body, 'boundedDeadlineCancellationTimeoutMs', 'const',
    ).statement,
    cancellationTimer.statement, clear.statement, armDeadline.statement,
    initialArm[0], returnedStatement[0],
  ]);
}

function cancellationAstContract(source) {
  const program = parseProgram(source);
  const request = topFunction(program, 'requestExecutionWorkerTurn');
  const settlement = topFunction(program, 'createExecutionWorkerRequestSettlement');
  if (!request || !settlement
    || !stableProgramIdentifiers(program, [
      'Date', 'Error', 'Math', 'Number', 'Object', 'Promise', 'clearTimeout',
      'createExecutionWorkerRequestSettlement', 'requestExecutionWorkerTurn', 'setTimeout',
    ], { globals: [
      'Date', 'Error', 'Math', 'Number', 'Object', 'Promise', 'clearTimeout', 'setTimeout',
    ] })
    || !(legacyCancellationRequestAstContract(request)
      || currentCancellationRequestAstContract(request))) return false;

  if (currentCancellationSettlementAstContract(settlement)) return true;

  const settlementParameter = settlement.params.length === 1 ? settlement.params[0] : null;
  const expectedParameters = [
    'cancellationTimeoutMs', 'child', 'deadlineMs', 'onDeadline',
    'operation', 'reject', 'resolve', 'terminateChild',
  ].sort();
  const timeoutBindingNames = [
    'boundedCancellationTimeoutMs', 'boundedDeadlineMs',
    'requestedCancellationTimeoutMs', 'requestedDeadlineMs',
  ];
  if (!objectPatternBindsExactly(settlementParameter, expectedParameters)
    || functionHasNestedBinding(settlement, [
      ...expectedParameters, ...timeoutBindingNames,
      'Error', 'Math', 'Number', 'clearTimeout', 'setTimeout',
    ], { allowedDirectBindings: timeoutBindingNames })
    || functionHasIdentifierWrite(settlement, [
      ...expectedParameters, ...timeoutBindingNames,
      'Error', 'Math', 'Number', 'clearTimeout', 'setTimeout',
    ])
    || functionHasNestedBinding(settlement, ['cancellationTimer'], {
      allowedDirectBindings: ['cancellationTimer'],
    })) return false;
  const cancellationTimer = directDeclarator(settlement.body, 'cancellationTimer', 'let');
  const clear = directDeclarator(settlement.body, 'clear', 'const');
  const deadline = directDeclarator(settlement.body, 'deadline', 'const');
  if (!cancellationTimer || !literal(cancellationTimer.declaration.init, null)
    || !clear || !deadline
    || !safeTimerTimeoutBinding(settlement, {
      sourceName: 'deadlineMs', requestedName: 'requestedDeadlineMs',
      boundedName: 'boundedDeadlineMs', maximum: 2_147_483_646,
    })
    || !safeTimerTimeoutBinding(settlement, {
      sourceName: 'cancellationTimeoutMs', requestedName: 'requestedCancellationTimeoutMs',
      boundedName: 'boundedCancellationTimeoutMs', maximum: 2_147_483_647,
    })) return false;
  const clearFunction = unwrap(clear.declaration.init);
  if (clearFunction?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(clearFunction, [])
    || clearFunction.body?.type !== 'BlockStatement'
    || clearFunction.body.body.length !== 2
    || !directCallStatement(clearFunction.body.body[0], ['clearTimeout'], [
      (value) => identifier(value, 'deadline'),
    ])
    || !directCallStatement(clearFunction.body.body[1], ['clearTimeout'], [
      (value) => identifier(value, 'cancellationTimer'),
    ])) return false;

  const deadlineCall = unwrap(deadline.declaration.init);
  if (deadlineCall?.type !== 'CallExpression'
    || !member(deadlineCall.callee, ['setTimeout'])
    || deadlineCall.arguments.length !== 2
    || !binary(
      deadlineCall.arguments[1], '+',
      (value) => identifier(value, 'boundedDeadlineMs'),
      (value) => literal(value, 1),
    )) return false;
  const deadlineCallback = unwrap(deadlineCall.arguments[0]);
  if (deadlineCallback?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(deadlineCallback, [])
    || deadlineCallback.body?.type !== 'BlockStatement') return false;
  const deadlineBody = deadlineCallback.body.body;
  if (deadlineBody.length !== 4
    || !directCallStatement(deadlineBody[0], ['clear'], [])
    || !directCallStatement(deadlineBody[1], ['onDeadline'], [])
    || !directCallStatement(deadlineBody[2], ['reject'], [(value) => executionDeadlineError(value)])
    || deadlineBody[3]?.type !== 'IfStatement'
    || !binary(
      deadlineBody[3].test, '===',
      (value) => identifier(value, 'operation'),
      (value) => literal(value, 'execution.start'),
    )
    || !directCallStatement(deadlineBody[3].consequent, ['terminateChild'], [
      (value) => identifier(value, 'child'),
      (value) => literal(value, 'execution-deadline'),
    ], { void_: true })) return false;

  const returned = returnedObject(settlement);
  if (!returned || !exactObject(returned, {
    armCancellation: (value) => {
      value = unwrap(value);
      if (value?.type !== 'ArrowFunctionExpression'
        || !exactIdentifierParameters(value, [])
        || value.body?.type !== 'BlockStatement') return false;
      const [guard, assignment, unref] = value.body.body;
      if (![2, 3].includes(value.body.body.length)
        || guard?.type !== 'IfStatement'
        || !identifier(guard.test, 'cancellationTimer')
        || !bareReturn(guard.consequent)) return false;
      if (unref && !directCallStatement(unref, ['cancellationTimer', 'unref'], [])) return false;
      const expression = unwrap(assignment?.expression);
      if (assignment?.type !== 'ExpressionStatement'
        || expression?.type !== 'AssignmentExpression'
        || expression.operator !== '='
        || !identifier(expression.left, 'cancellationTimer')) return false;
      const timer = unwrap(expression.right);
      if (timer?.type !== 'CallExpression' || !member(timer.callee, ['setTimeout'])
        || timer.arguments.length !== 2
        || !identifier(timer.arguments[1], 'boundedCancellationTimeoutMs')) return false;
      const callback = unwrap(timer.arguments[0]);
      return callback?.type === 'ArrowFunctionExpression'
        && callback.body?.type === 'BlockStatement'
        && callback.body.body.length === 1
        && directCallStatement(callback.body.body[0], ['terminateChild'], [
          (entry) => identifier(entry, 'child'),
          (entry) => literal(entry, 'cancel-timeout'),
        ], { void_: true });
    },
    resolve: (value) => {
      value = unwrap(value);
      return value?.type === 'ArrowFunctionExpression'
        && value.params.length === 1
        && identifier(value.params[0], 'value')
        && value.body?.type === 'BlockStatement'
        && value.body.body.length === 2
        && directCallStatement(value.body.body[0], ['clear'], [])
        && directCallStatement(value.body.body[1], ['resolve'], [
          (entry) => identifier(entry, 'value'),
        ]);
    },
    reject: (value) => {
      value = unwrap(value);
      return value?.type === 'ArrowFunctionExpression'
        && value.params.length === 1
        && identifier(value.params[0], 'error')
        && value.body?.type === 'BlockStatement'
        && value.body.body.length === 2
        && directCallStatement(value.body.body[0], ['clear'], [])
        && directCallStatement(value.body.body[1], ['reject'], [
          (entry) => identifier(entry, 'error'),
        ]);
    },
  })) return false;
  return directStatementsOrderedAndReachable(settlement.body, [
    directDeclarator(settlement.body, 'requestedDeadlineMs', 'const').statement,
    directDeclarator(settlement.body, 'boundedDeadlineMs', 'const').statement,
    directDeclarator(settlement.body, 'requestedCancellationTimeoutMs', 'const').statement,
    directDeclarator(settlement.body, 'boundedCancellationTimeoutMs', 'const').statement,
    cancellationTimer.statement, clear.statement, deadline.statement,
  ]);
}

function graceTimerPromise(node, timeoutName) {
  node = unwrap(node);
  if (!construct(node, 'Promise') || node.arguments.length !== 1) return false;
  const executor = unwrap(node.arguments[0]);
  if (executor?.type !== 'ArrowFunctionExpression'
    || executor.params.length !== 1
    || !identifier(executor.params[0], 'resolve')) return false;
  if (executor.body.type === 'BlockStatement') {
    return executor.body.body.length === 1
      && directCallStatement(executor.body.body[0], ['setTimeout'], [
        (value) => identifier(value, 'resolve'),
        (value) => identifier(value, timeoutName),
      ]);
  }
  return call(executor.body, ['setTimeout'], [
    (value) => identifier(value, 'resolve'),
    (value) => identifier(value, timeoutName),
  ]);
}

function currentTerminationCleanup(node) {
  node = unwrap(node);
  if (node?.type !== 'ConditionalExpression'
    || !logical(
      node.test,
      '&&',
      (entry) => identifier(entry, 'pid'),
      (entry) => binary(
        entry,
        '===',
        (value) => unary(value, 'typeof', (target) => identifier(target, 'processTreeKiller')),
        (value) => literal(value, 'function'),
      ),
    )
    || !call(node.alternate, ['Promise', 'resolve'], [(entry) => literal(entry, false)])) return false;
  return methodCall(
    node.consequent,
    'catch',
    (caught) => methodCall(
      caught,
      'then',
      (resolved) => call(resolved, ['Promise', 'resolve'], []),
      [(callback) => exactIdentifierParameters(unwrap(callback), [])
        && arrowCallsExactly(callback, ['processTreeKiller'], [
          (entry) => identifier(entry, 'pid'),
          (entry) => exactObject(entry, { reason: (value) => identifier(value, 'reason') }),
        ])],
    ),
    [(callback) => exactIdentifierParameters(unwrap(callback), [])
      && unwrap(callback)?.type === 'ArrowFunctionExpression'
      && literal(unwrap(callback).body, false)],
  );
}

function currentTerminationDeadline(body, timeoutName) {
  const timer = directDeclarator(body, 'timer', 'let');
  const deadline = directDeclarator(body, 'deadline', 'const');
  if (!timer || !literal(timer.declaration.init, null) || !deadline
    || !construct(deadline.declaration.init, 'Promise')
    || deadline.declaration.init.arguments.length !== 1) return false;
  const executor = unwrap(deadline.declaration.init.arguments[0]);
  if (executor?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(executor, ['resolveDeadline'])
    || executor.body?.type !== 'BlockStatement'
    || executor.body.body.length !== 1) return false;
  const assignment = unwrap(executor.body.body[0]?.expression);
  if (assignment?.type !== 'AssignmentExpression'
    || assignment.operator !== '='
    || !identifier(assignment.left, 'timer')) return false;
  const timeout = unwrap(assignment.right);
  return call(timeout, ['setTimeout'], [
    (entry) => identifier(entry, 'resolveDeadline'),
    (entry) => identifier(entry, timeoutName),
  ]);
}

function deadlineExpiredIdentity(node, candidateName) {
  return logical(
    node,
    '&&',
    (left) => member(left, ['expired', 'deadlineExpired']),
    (right) => call(right, ['expired', 'matches'], [
      (value) => identifier(value, candidateName),
    ]),
  );
}

function safeTimerTimeoutBinding(functionNode, {
  boundedName,
  maximum,
  requestedName,
  sourceName,
  fallback = 1,
}) {
  const maximumIsMatcher = typeof maximum === 'function';
  const fallbackIsMatcher = typeof fallback === 'function';
  if ((!maximumIsMatcher && (!Number.isSafeInteger(maximum) || maximum <= 0))
    || (!fallbackIsMatcher && (!Number.isSafeInteger(fallback) || fallback <= 0
      || (!maximumIsMatcher && fallback > maximum)))
    || functionHasNestedBinding(functionNode, [requestedName, boundedName], {
      allowedDirectBindings: [requestedName, boundedName],
    })
    || functionHasIdentifierWrite(functionNode, [requestedName, boundedName])) return false;
  const requested = directDeclarator(functionNode?.body, requestedName, 'const');
  const bounded = directDeclarator(functionNode?.body, boundedName, 'const');
  if (!requested || !bounded
    || !call(requested.declaration.init, ['Number'], [
      (value) => identifier(value, sourceName),
    ])
    || !directStatementsOrderedAndReachable(functionNode.body, [
      requested.statement, bounded.statement,
    ])) return false;
  const sourceArgument = unwrap(requested.declaration.init)?.arguments?.[0];
  const sourceReferences = identifierReferenceNodes(functionNode, sourceName);
  if (sourceReferences.length !== 1 || sourceReferences[0] !== sourceArgument) return false;
  const value = unwrap(bounded.declaration.init);
  if (value?.type !== 'ConditionalExpression'
    || !logical(
      value.test,
      '&&',
      (left) => call(left, ['Number', 'isSafeInteger'], [
        (entry) => identifier(entry, requestedName),
      ]),
      (right) => binary(
        right,
        '>',
        (entry) => identifier(entry, requestedName),
        (entry) => literal(entry, 0),
      ),
    )
    || !(fallbackIsMatcher ? fallback(value.alternate) : literal(value.alternate, fallback))) {
    return false;
  }
  const boundedValue = unwrap(value.consequent);
  if (!call(boundedValue, ['Math', 'min']) || boundedValue.arguments.length !== 2) return false;
  const requestedMatcher = (entry) => identifier(entry, requestedName);
  const maximumMatcher = maximumIsMatcher
    ? maximum
    : (entry) => literal(entry, maximum);
  return (requestedMatcher(boundedValue.arguments[0]) && maximumMatcher(boundedValue.arguments[1]))
    || (maximumMatcher(boundedValue.arguments[0]) && requestedMatcher(boundedValue.arguments[1]));
}

function deadlineTerminalCleanup(statement) {
  if (statement?.type !== 'IfStatement'
    || !call(statement.test, ['isExecutionWorkerTerminalOperation'], [
      (value) => member(value, ['message', 'operation']),
    ])
    || statement.consequent?.type !== 'BlockStatement'
    || statement.consequent.body.length !== 2) return false;
  return directCallStatement(statement.consequent.body[0], ['clearTimeout'], [
    (value) => member(value, ['expired', 'cancelDeadline']),
  ]) && directCallStatement(statement.consequent.body[1], ['pending', 'delete'], [
    (value) => member(value, ['message', 'requestId']),
  ]);
}

function deadlineAstContract(source) {
  const program = parseProgram(source);
  const validateReply = topFunction(program, 'validateExecutionWorkerReply');
  const settleExpired = topFunction(program, 'settleExpiredExecutionWorkerReply');
  const cancelExpired = topFunction(program, 'cancelExpiredExecution');
  const schedule = topFunction(program, 'scheduleExecutionWorkerDeadline');
  const createCallbacks = topFunction(program, 'createExecutionWorkerDeadlineCallbacks');
  if (!validateReply || !settleExpired || !cancelExpired || !schedule || !createCallbacks
    || !exactTopLevelRequireBinding(
      program, 'createEnvelope', 'createEnvelope', './execution-worker-protocol.cjs',
    )
    || !exactTopLevelRequireBinding(
      program, 'validateEnvelope', 'validateEnvelope', './execution-worker-protocol.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'isExecutionWorkerTerminalOperation',
      'isExecutionWorkerTerminalOperation',
      './execution-worker-context-usage.cjs',
    )
    || !stableProgramIdentifiers(program, [
      'Error', 'Math', 'Number', 'Object', 'clearTimeout', 'setTimeout',
      'cancelExpiredExecution', 'createEnvelope', 'createExecutionWorkerDeadlineCallbacks',
      'isExecutionWorkerTerminalOperation', 'scheduleExecutionWorkerDeadline',
      'settleExpiredExecutionWorkerReply', 'validateEnvelope', 'validateExecutionWorkerReply',
    ], { globals: ['Error', 'Math', 'Number', 'Object', 'clearTimeout', 'setTimeout'] })
    || !exactIdentifierParameters(validateReply, ['raw', 'pending', 'now'])
    || !exactIdentifierParameters(settleExpired, ['message', 'pending'])
    || !exactParameterList(cancelExpired, [
      (value) => objectPatternBindsExactly(value, [
        'message', 'item', 'pending', 'child', 'terminateChild', 'now', 'graceMs',
      ]),
    ])
    || !exactParameterList(schedule, [
      (value) => objectPatternBindsExactly(value, [
        'message', 'pending', 'child', 'terminateChild', 'now', 'deadlineMs', 'graceMs',
      ]),
    ])
    || !exactParameterList(createCallbacks, [
      (value) => objectPatternBindsExactly(value, [
        'operation', 'requestId', 'message', 'pending', 'child', 'terminateChild', 'now',
        'graceMs',
      ]),
    ])) return false;

  const protectedByFunction = [
    [validateReply, ['raw', 'pending', 'now', 'validateEnvelope',
      'isExecutionWorkerTerminalOperation']],
    [settleExpired, ['message', 'pending', 'isExecutionWorkerTerminalOperation']],
    [cancelExpired, ['message', 'item', 'pending', 'child', 'terminateChild', 'now',
      'graceMs', 'setTimeout', 'clearTimeout', 'createEnvelope', 'Math', 'Number']],
    [schedule, ['message', 'pending', 'child', 'terminateChild', 'now', 'deadlineMs',
      'graceMs', 'setTimeout', 'cancelExpiredExecution', 'Math', 'Number', 'Object', 'Error']],
    [createCallbacks, ['operation', 'requestId', 'message', 'pending', 'child',
      'terminateChild', 'now', 'graceMs', 'createEnvelope', 'Math']],
  ];
  if (protectedByFunction.some(([fn, names]) => (
    functionHasNestedBinding(fn, names) || functionHasIdentifierWrite(fn, names)
  ))) return false;
  if (functionHasProtectedAliasMutation(validateReply, [
    ['pending', 'get'], ['pending', 'delete'], ['expired', 'matches'],
  ]) || functionHasProtectedAliasMutation(settleExpired, [
    ['pending', 'get'], ['pending', 'delete'], ['expired', 'matches'],
  ]) || functionHasProtectedAliasMutation(cancelExpired, [
    ['pending', 'get'], ['terminateChild'], ['child', 'postMessage'],
  ]) || functionHasProtectedAliasMutation(schedule, [
    ['pending', 'get'], ['pending', 'delete'], ['item', 'reject'], ['terminateChild'],
  ]) || functionHasProtectedAliasMutation(createCallbacks, [
    ['pending', 'get'], ['pending', 'has'], ['pending', 'delete'],
    ['child', 'postMessage'], ['terminateChild'],
  ])) return false;

  const expired = directDeclarator(validateReply.body, 'expired', 'const');
  const validationTime = directDeclarator(validateReply.body, 'validationTime', 'const');
  const validatedMessage = directDeclarator(validateReply.body, 'message', 'const');
  const validateExpiredBranch = validateReply.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && deadlineExpiredIdentity(statement.test, 'message')
    && statement.consequent?.type === 'BlockStatement'
  ));
  if (!expired || !call(expired.declaration.init, ['pending', 'get'], [
    (value) => member(value, ['raw', 'requestId']),
  ]) || !validationTime || !validatedMessage
    || !call(validatedMessage.declaration.init, ['validateEnvelope'], [
      (value) => identifier(value, 'raw'),
      (value) => exactObject(value, {
        direction: (entry) => literal(entry, 'worker-to-host'),
        now: (entry) => identifier(entry, 'validationTime'),
      }),
    ])
    || validateExpiredBranch.length !== 1) return false;
  const validationChoice = unwrap(validationTime.declaration.init);
  if (validationChoice?.type !== 'ConditionalExpression'
    || !logical(
      validationChoice.test,
      '&&',
      (left) => deadlineExpiredIdentity(left, 'raw'),
      (right) => binary(
        right,
        '===',
        (value) => member(value, ['raw', 'deadlineAt']),
        (value) => member(value, ['expired', 'deadlineAt']),
      ),
    )
    || !binary(
      validationChoice.consequent,
      '-',
      (value) => member(value, ['expired', 'deadlineAt']),
      (value) => literal(value, 1),
    )
    || !call(validationChoice.alternate, ['now'], [])) return false;
  const validateBranchBody = validateExpiredBranch[0].consequent;
  if (validateBranchBody.body.length !== 2
    || !deadlineTerminalCleanup(validateBranchBody.body[0])
    || !exactReturn(validateBranchBody.body[1], (value) => objectIncludesExactProperties(value, {
      operation: (entry) => literal(entry, 'execution.expired'),
    }, { allowedSpreads: [(entry) => identifier(entry, 'message')] }))
    || !directStatementsOrderedAndReachable(validateReply.body, [
      expired.statement, validationTime.statement, validatedMessage.statement,
      validateExpiredBranch[0], validateReply.body.body.at(-1),
    ])
    || !exactReturn(validateReply.body.body.at(-1), (value) => identifier(value, 'message'))) {
    return false;
  }

  const settledExpired = directDeclarator(settleExpired.body, 'expired', 'const');
  const settleGuard = settleExpired.body.body[1];
  const settleCleanup = settleExpired.body.body[2];
  if (!settledExpired || !call(settledExpired.declaration.init, ['pending', 'get'], [
    (value) => member(value, ['message', 'requestId']),
  ]) || settleGuard?.type !== 'IfStatement'
    || !logical(
      settleGuard.test,
      '||',
      (left) => unary(left, '!', (value) => member(value, ['expired', 'deadlineExpired'])),
      (right) => exactNotCall(right, ['expired', 'matches'], [
        (value) => identifier(value, 'message'),
      ]),
    )
    || !exactReturn(settleGuard.consequent, (value) => literal(value, false))
    || !deadlineTerminalCleanup(settleCleanup)
    || !exactReturn(settleExpired.body.body[3], (value) => literal(value, true))
    || !directStatementsOrderedAndReachable(settleExpired.body, settleExpired.body.body)) {
    return false;
  }

  if (!safeTimerTimeoutBinding(cancelExpired, {
    sourceName: 'graceMs', requestedName: 'requestedGraceMs', boundedName: 'boundedGraceMs',
    maximum: 2_147_483_647,
  })) return false;
  const expiredAssignments = directAssignmentStatements(cancelExpired.body, ['item', 'deadlineExpired']);
  const cancellationAssignments = directAssignmentStatements(cancelExpired.body, ['item', 'cancelDeadline']);
  const cancelUnrefs = cancelExpired.body.body.filter((statement) => directCallStatement(
    statement, ['item', 'cancelDeadline', 'unref'], [],
  ));
  const cancelPost = cancelExpired.body.body.find((statement) => statement.type === 'TryStatement');
  const cancelTimer = unwrap(cancellationAssignments[0]?.expression?.right);
  const cancelTimerCallback = unwrap(cancelTimer?.arguments?.[0]);
  const cancelTimerGuard = cancelTimerCallback?.body?.body?.[0];
  if (expiredAssignments.length !== 1 || !literal(expiredAssignments[0].expression.right, true)
    || cancellationAssignments.length !== 1
    || !call(cancelTimer, ['setTimeout']) || cancelTimer.arguments.length !== 2
    || !identifier(cancelTimer.arguments[1], 'boundedGraceMs')
    || cancelTimerCallback?.type !== 'ArrowFunctionExpression'
    || !exactProtectedIdentifierParameters(cancelTimerCallback, [])
    || cancelTimerCallback.body?.type !== 'BlockStatement'
    || cancelTimerCallback.body.body.length !== 1
    || cancelTimerGuard?.type !== 'IfStatement'
    || !binary(
      cancelTimerGuard.test,
      '===',
      (value) => call(value, ['pending', 'get'], [
        (entry) => member(entry, ['message', 'requestId']),
      ]),
      (value) => identifier(value, 'item'),
    )
    || !directCallStatement(cancelTimerGuard.consequent, ['terminateChild'], [
      (value) => identifier(value, 'child'),
      (value) => literal(value, 'request-deadline-timeout'),
    ])
    || cancelUnrefs.length !== 1 || !cancelPost
    || cancelPost.block.body.length !== 1 || cancelPost.handler?.body?.body.length !== 1
    || !directCallStatement(cancelPost.block.body[0], ['child', 'postMessage'], [
      (value) => call(value, ['createEnvelope'], [
        (entry) => literal(entry, 'execution.cancel'),
        (entry) => identifier(entry, 'message'),
        (entry) => exactObject(entry, {
          reason: (item) => literal(item, 'execution_worker_deadline_exceeded'),
        }),
        (entry) => exactObject(entry, {
          deadlineMs: (item) => identifier(item, 'boundedGraceMs'),
          now: (item) => call(item, ['now'], []),
        }),
      ]),
    ])
    || !directCallStatement(cancelPost.handler.body.body[0], ['terminateChild'], [
      (value) => identifier(value, 'child'),
      (value) => literal(value, 'request-deadline-timeout'),
    ])) return false;
  const cancelOrdered = [
    directDeclarator(cancelExpired.body, 'requestedGraceMs', 'const')?.statement,
    directDeclarator(cancelExpired.body, 'boundedGraceMs', 'const')?.statement,
    expiredAssignments[0], cancellationAssignments[0], cancelUnrefs[0], cancelPost,
  ];
  if (cancelOrdered.some((entry) => !entry)
    || !directStatementsOrderedAndReachable(cancelExpired.body, cancelOrdered)) return false;

  if (!safeTimerTimeoutBinding(schedule, {
    sourceName: 'deadlineMs', requestedName: 'requestedDeadlineMs',
    boundedName: 'boundedDeadlineMs', maximum: 2_147_483_646,
  })) return false;
  const timer = directDeclarator(schedule.body, 'timer', 'const');
  const timerCall = unwrap(timer?.declaration?.init);
  const timerCallback = unwrap(timerCall?.arguments?.[0]);
  if (!timer || !call(timerCall, ['setTimeout']) || timerCall.arguments.length !== 2
    || !binary(
      timerCall.arguments[1],
      '+',
      (value) => identifier(value, 'boundedDeadlineMs'),
      (value) => literal(value, 1),
    )
    || timerCallback?.type !== 'ArrowFunctionExpression'
    || !exactProtectedIdentifierParameters(timerCallback, [])
    || timerCallback.body?.type !== 'BlockStatement') return false;
  const timerItem = directDeclarator(timerCallback.body, 'item', 'const');
  const timerGuard = timerCallback.body.body[1];
  const timerError = directDeclarator(timerCallback.body, 'error', 'const');
  const timerRejects = timerCallback.body.body.filter((statement) => directCallStatement(
    statement, ['item', 'reject'], [(value) => identifier(value, 'error')],
  ));
  const nonStart = timerCallback.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && binary(
      statement.test,
      '!==',
      (value) => member(value, ['message', 'operation']),
      (value) => literal(value, 'execution.start'),
    )
    && statement.consequent?.type === 'BlockStatement'
    && statement.consequent.body.length === 2
    && directCallStatement(statement.consequent.body[0], ['pending', 'delete'], [
      (value) => member(value, ['message', 'requestId']),
    ])
    && bareReturn(statement.consequent.body[1])
  ));
  const startsCancellation = timerCallback.body.body.filter((statement) => directCallStatement(
    statement, ['cancelExpiredExecution'], [
      (value) => exactObject(value, {
        message: (entry) => identifier(entry, 'message'),
        item: (entry) => identifier(entry, 'item'),
        pending: (entry) => identifier(entry, 'pending'),
        child: (entry) => identifier(entry, 'child'),
        terminateChild: (entry) => identifier(entry, 'terminateChild'),
        now: (entry) => identifier(entry, 'now'),
        graceMs: (entry) => identifier(entry, 'graceMs'),
      }),
    ],
  ));
  if (!timerItem || !call(timerItem.declaration.init, ['pending', 'get'], [
    (value) => member(value, ['message', 'requestId']),
  ]) || timerGuard?.type !== 'IfStatement'
    || !unary(timerGuard.test, '!', (value) => identifier(value, 'item'))
    || !bareReturn(timerGuard.consequent)
    || !timerError || !executionDeadlineError(timerError.declaration.init)
    || timerRejects.length !== 1 || nonStart.length !== 1 || startsCancellation.length !== 1
    || !directStatementsOrderedAndReachable(timerCallback.body, [
      timerItem.statement, timerGuard, timerError.statement, timerRejects[0],
      nonStart[0], startsCancellation[0],
    ])) return false;
  const scheduleUnrefs = schedule.body.body.filter((statement) => directCallStatement(
    statement, ['timer', 'unref'], [],
  ));
  const scheduleReturns = schedule.body.body.filter((statement) => exactReturn(
    statement, (value) => identifier(value, 'timer'),
  ));
  if (scheduleUnrefs.length !== 1 || scheduleReturns.length !== 1
    || !directStatementsOrderedAndReachable(schedule.body, [
      directDeclarator(schedule.body, 'requestedDeadlineMs', 'const').statement,
      directDeclarator(schedule.body, 'boundedDeadlineMs', 'const').statement,
      timer.statement, scheduleUnrefs[0], scheduleReturns[0],
    ])) return false;

  if (!safeTimerTimeoutBinding(createCallbacks, {
    sourceName: 'graceMs', requestedName: 'requestedCallbackGraceMs',
    boundedName: 'boundedCallbackGraceMs', maximum: 2_147_483_647,
  })) return false;
  const callbacksObject = returnedObject(createCallbacks);
  if (!callbacksObject || !exactObject(callbacksObject, {
    onDeadline: (value) => {
      value = unwrap(value);
      if (value?.type !== 'ArrowFunctionExpression'
        || !exactProtectedIdentifierParameters(value, [])
        || value.body?.type !== 'BlockStatement') return false;
      const item = directDeclarator(value.body, 'item', 'const');
      const nonStartBranch = value.body.body[1];
      const missing = value.body.body[2];
      const writes = directAssignmentStatements(value.body, ['item', 'deadlineExpired']);
      const deadlineWrites = directAssignmentStatements(value.body, ['item', 'deadlineAt']);
      const attempt = value.body.body.find((statement) => statement.type === 'TryStatement');
      return Boolean(item
        && call(item.declaration.init, ['pending', 'get'], [
          (entry) => identifier(entry, 'requestId'),
        ])
        && nonStartBranch?.type === 'IfStatement'
        && binary(
          nonStartBranch.test,
          '!==',
          (entry) => identifier(entry, 'operation'),
          (entry) => literal(entry, 'execution.start'),
        )
        && nonStartBranch.consequent?.type === 'BlockStatement'
        && nonStartBranch.consequent.body.length === 2
        && directCallStatement(nonStartBranch.consequent.body[0], ['pending', 'delete'], [
          (entry) => identifier(entry, 'requestId'),
        ])
        && bareReturn(nonStartBranch.consequent.body[1])
        && missing?.type === 'IfStatement'
        && unary(missing.test, '!', (entry) => identifier(entry, 'item'))
        && bareReturn(missing.consequent)
        && writes.length === 1 && literal(writes[0].expression.right, true)
        && deadlineWrites.length === 1
        && member(deadlineWrites[0].expression.right, ['message', 'deadlineAt'])
        && attempt?.block?.body.length === 1
        && attempt?.handler?.body?.body.length === 1
        && directCallStatement(attempt.block.body[0], ['child', 'postMessage'], [
          (entry) => call(entry, ['createEnvelope'], [
            (itemEntry) => literal(itemEntry, 'execution.cancel'),
            (itemEntry) => identifier(itemEntry, 'message'),
            (itemEntry) => exactObject(itemEntry, {
              reason: (reason) => literal(reason, 'execution_worker_deadline_exceeded'),
            }),
            (itemEntry) => exactObject(itemEntry, {
              deadlineMs: (deadline) => identifier(deadline, 'boundedCallbackGraceMs'),
              now: (nowCall) => call(nowCall, ['now'], []),
            }),
          ]),
        ])
        && exactReturn(attempt.handler.body.body[0], (entry) => call(entry, ['terminateChild'], [
          (target) => identifier(target, 'child'),
          (reason) => literal(reason, 'request-deadline-timeout'),
        ]))
        && directStatementsOrderedAndReachable(value.body, [
          item.statement, nonStartBranch, missing, writes[0], deadlineWrites[0], attempt,
        ]));
    },
    onCancellationTimeout: (value) => {
      value = unwrap(value);
      if (value?.type !== 'ArrowFunctionExpression'
        || !exactProtectedIdentifierParameters(value, [])
        || value.body?.type !== 'BlockStatement'
        || value.body.body.length !== 1) return false;
      const branch = value.body.body[0];
      return branch?.type === 'IfStatement'
        && call(branch.test, ['pending', 'has'], [(entry) => identifier(entry, 'requestId')])
        && exactReturn(branch.consequent, (entry) => call(entry, ['terminateChild'], [
          (target) => identifier(target, 'child'),
          (reason) => literal(reason, 'request-deadline-timeout'),
        ]));
    },
  })) return false;
  const callbackMutations = protectedCollectionMutationCalls(
    createCallbacks, ['pending'], ['add', 'clear', 'delete', 'set'],
  );
  return callbackMutations.length === 1 && callbackMutations[0].method === 'delete'
    && topLevelModuleExportsIncludes(program, {
      validateExecutionWorkerReply: (value) => identifier(value, 'validateExecutionWorkerReply'),
      settleExpiredExecutionWorkerReply: (value) => identifier(
        value, 'settleExpiredExecutionWorkerReply',
      ),
      scheduleExecutionWorkerDeadline: (value) => identifier(
        value, 'scheduleExecutionWorkerDeadline',
      ),
      createExecutionWorkerDeadlineCallbacks: (value) => identifier(
        value, 'createExecutionWorkerDeadlineCallbacks',
      ),
    });
}

function exactStringSetBinding(program, name, expectedValues) {
  const binding = directDeclarator(program, name, 'const');
  const value = unwrap(binding?.declaration?.init);
  const entries = unwrap(value?.arguments?.[0]);
  return Boolean(binding
    && construct(value, 'Set')
    && value.arguments.length === 1
    && entries?.type === 'ArrayExpression'
    && entries.elements.length === expectedValues.length
    && expectedValues.every((expected, index) => literal(entries.elements[index], expected)));
}

function exactSetMembershipFunction(functionNode, setName) {
  return exactProtectedIdentifierParameters(functionNode, ['name'], [
    'name', setName, 'String',
  ])
    && functionNode.body?.body?.length === 1
    && exactReturn(functionNode.body.body[0], (value) => call(value, [setName, 'has'], [
      (entry) => call(entry, ['String'], [
        (candidate) => logical(
          candidate,
          '||',
          (left) => identifier(left, 'name'),
          (right) => literal(right, ''),
        ),
      ]),
    ]));
}

function callbackPromiseFailureSink(statement, settlementName = 'settlement') {
  if (statement?.type !== 'ExpressionStatement') return false;
  const expression = unwrap(statement.expression);
  if (expression?.type !== 'UnaryExpression' || expression.operator !== 'void') return false;
  return methodCall(
    expression.argument,
    'catch',
    (receiver) => call(receiver, ['Promise', 'resolve'], [
      (value) => identifier(value, settlementName),
    ]),
    [(callback) => exactProtectedIdentifierParameters(unwrap(callback), [], [
      'name', 'reportBestEffortFailure',
    ]) && arrowCallsExactly(callback, ['reportBestEffortFailure'], [
      (value) => identifier(value, 'name'),
    ])],
  );
}

function callbackInvocationAssignment(statement) {
  const expression = unwrap(statement?.expression);
  return statement?.type === 'ExpressionStatement'
    && expression?.type === 'AssignmentExpression'
    && expression.operator === '='
    && identifier(expression.left, 'settlement')
    && call(expression.right, ['invokeCallback'], [
      (value) => identifier(value, 'callback'),
      (value) => identifier(value, 'name'),
      (value) => member(value, ['payload', 'value']),
    ]);
}

function callbackCatchClause(handler, { rethrow = false } = {}) {
  const body = handler?.body;
  if (!body || body.type !== 'BlockStatement') return false;
  if (rethrow) {
    const guard = body.body[0];
    return identifier(handler.param, 'error')
      && body.body.length === 3
      && guard?.type === 'IfStatement'
      && unary(guard.test, '!', (value) => identifier(value, 'bestEffort'))
      && guard.consequent?.type === 'ThrowStatement'
      && identifier(guard.consequent.argument, 'error')
      && directCallStatement(body.body[1], ['reportBestEffortFailure'], [
        (value) => identifier(value, 'name'),
      ])
      && exactReturn(body.body[2], (value) => literal(value, true));
  }
  return handler.param === null
    && body.body.length === 2
    && directCallStatement(body.body[0], ['reportBestEffortFailure'], [
      (value) => identifier(value, 'name'),
    ])
    && bareReturn(body.body[1]);
}

function callbackSettlementAstContract(sourceByPath) {
  const source = sourceByPath.get(
    'electron/host-core/agent/execution-worker-callback-settlement.cjs',
  ) || '';
  const desktopSource = sourceByPath.get(
    'electron/host-core/agent/desktop-host-context.cjs',
  ) || '';
  const program = parseProgram(source);
  const desktopProgram = parseProgram(desktopSource);
  const bestEffort = topFunction(program, 'isBestEffortExecutionWorkerCallback');
  const immediate = topFunction(program, 'isImmediateNonBlockingExecutionWorkerCallback');
  const reserved = topFunction(program, 'isReservedExecutionWorkerObserverCallback');
  const raw = topFunction(program, 'isRawExecutionWorkerObserverCallback');
  const reportFailure = topFunction(program, 'reportBestEffortFailure');
  const invoke = topFunction(program, 'invokeCallback');
  const settle = topFunction(program, 'settleExecutionWorkerCallback');
  const reportFailureAttempt = reportFailure?.body?.body?.[0];
  const callbackLists = {
    BEST_EFFORT_CALLBACKS: [
      'onExecutionPhase', 'onCriticalPathTiming', 'onProviderReceiptHash',
      'onContextUsageSnapshot', 'onModelGatewayDiagnostic', 'onProviderDiagnostic',
      'onNativeSessionCreated', 'onToolFailureDiagnostic', 'onRaw', 'onRawDiagnostic',
      'onCompactDiagnostic',
    ],
    IMMEDIATE_NON_BLOCKING_CALLBACKS: [
      'onExecutionPhase', 'onCriticalPathTiming', 'onProviderReceiptHash',
      'onModelGatewayDiagnostic', 'onProviderDiagnostic',
    ],
    DEFERRED_OBSERVER_CALLBACKS: ['onRaw', 'onRawDiagnostic', 'onCompactDiagnostic'],
    RESERVED_OBSERVER_CALLBACKS: [
      'onExecutionPhase', 'onCriticalPathTiming', 'onProviderReceiptHash',
      'onContextUsageSnapshot', 'onModelGatewayDiagnostic', 'onProviderDiagnostic',
      'onNativeSessionCreated', 'onToolFailureDiagnostic', 'onCompactDiagnostic',
      'onRaw', 'onRawDiagnostic',
    ],
    RAW_OBSERVER_CALLBACKS: ['onRaw', 'onRawDiagnostic'],
  };
  if (!bestEffort || !immediate || !reserved || !raw || !reportFailure || !invoke || !settle
    || !Object.entries(callbackLists).every(([name, values]) => (
      exactStringSetBinding(program, name, values)
    ))
    || !stableProgramIdentifiers(program, [
      ...Object.keys(callbackLists), 'Array', 'console', 'Object', 'Promise', 'Set', 'String',
      'isBestEffortExecutionWorkerCallback', 'isImmediateNonBlockingExecutionWorkerCallback',
      'isRawExecutionWorkerObserverCallback', 'isReservedExecutionWorkerObserverCallback',
      'invokeCallback', 'reportBestEffortFailure', 'setImmediate',
      'settleExecutionWorkerCallback',
    ], {
      globals: ['Array', 'console', 'Object', 'Promise', 'Set', 'String', 'setImmediate'],
    })
    || !exactSetMembershipFunction(bestEffort, 'BEST_EFFORT_CALLBACKS')
    || !exactSetMembershipFunction(immediate, 'IMMEDIATE_NON_BLOCKING_CALLBACKS')
    || !exactSetMembershipFunction(reserved, 'RESERVED_OBSERVER_CALLBACKS')
    || !exactSetMembershipFunction(raw, 'RAW_OBSERVER_CALLBACKS')
    || !exactProtectedIdentifierParameters(reportFailure, ['name'], ['name', 'console', 'String'])
    || functionHasMemberWrite({ body: program }, [['console', 'warn']])
    || reportFailure.body?.body?.length !== 1
    || reportFailureAttempt?.type !== 'TryStatement'
    || reportFailureAttempt.finalizer
    || reportFailureAttempt.block?.body?.length !== 1
    || !directCallStatement(reportFailureAttempt.block.body[0], ['console', 'warn'], [
      (value) => literal(value, '[execution-worker] best-effort callback failed'),
      (value) => exactObject(value, {
        callback: (entry) => methodCall(
          entry,
          'slice',
          (receiver) => call(receiver, ['String'], [
            (argument) => logical(
              argument,
              '||',
              (left) => identifier(left, 'name'),
              (right) => literal(right, ''),
            ),
          ]),
          [(argument) => literal(argument, 0), (argument) => literal(argument, 80)],
        ),
        redacted: (entry) => literal(entry, true),
      }),
    ])
    || reportFailureAttempt.handler?.param !== null
    || reportFailureAttempt.handler?.body?.body?.length !== 0
    || !exactIdentifierParameters(invoke, ['callback', 'name', 'value'])
    || functionHasNestedBinding(invoke, ['callback', 'name', 'value', 'Array'])
    || functionHasIdentifierWrite(invoke, ['callback', 'name', 'value', 'Array'])
    || invoke.body?.body?.length !== 1) return false;
  const invokeReturn = invoke.body.body[0];
  const invokeChoice = unwrap(invokeReturn?.argument);
  if (invokeReturn?.type !== 'ReturnStatement'
    || invokeChoice?.type !== 'ConditionalExpression'
    || !logical(
      invokeChoice.test,
      '&&',
      (left) => call(left, ['Array', 'isArray'], [(entry) => identifier(entry, 'value')]),
      (right) => binary(
        right,
        '===',
        (entry) => identifier(entry, 'name'),
        (entry) => literal(entry, 'onCriticalPathTiming'),
      ),
    )
    || !call(invokeChoice.consequent, ['callback'], [
      (entry) => unwrap(entry)?.type === 'SpreadElement'
        && identifier(unwrap(entry).argument, 'value'),
    ])
    || !call(invokeChoice.alternate, ['callback'], [
      (entry) => identifier(entry, 'value'),
    ])) return false;

  if (!exactParameterList(settle, [
    (value) => objectPatternBindsExactly(value, ['callbacks', 'message', 'settlements'], {
      topLevelDefault: true,
      propertyDefaults: {
        callbacks: (entry) => exactObject(entry, {}),
        message: (entry) => exactObject(entry, {}),
        settlements: (entry) => unwrap(entry)?.type === 'ArrayExpression'
          && unwrap(entry).elements.length === 0,
      },
      requiredPropertyDefaults: ['callbacks', 'message', 'settlements'],
    }),
  ])) return false;
  const protectedNames = [
    'callbacks', 'message', 'settlements', 'Array', 'DEFERRED_OBSERVER_CALLBACKS',
    'Object', 'Promise', 'setImmediate', 'isBestEffortExecutionWorkerCallback',
    'isImmediateNonBlockingExecutionWorkerCallback',
    'isReservedExecutionWorkerObserverCallback', 'invokeCallback', 'reportBestEffortFailure',
  ];
  if (functionHasNestedBinding(settle, protectedNames)
    || functionHasIdentifierWrite(settle, protectedNames)
    || functionHasMemberWrite(settle, [
      ['callbacks'], ['message'], ['settlements'],
    ], { allowedReadonlyDynamicAliases: ['callback'] })) return false;
  const payload = directDeclarator(settle.body, 'payload', 'const');
  const name = directDeclarator(settle.body, 'name', 'const');
  const callback = directDeclarator(settle.body, 'callback', 'const');
  const bestEffortBinding = directDeclarator(settle.body, 'bestEffort', 'const');
  const immediateObserver = directDeclarator(settle.body, 'immediateObserver', 'const');
  const deferredObserver = directDeclarator(settle.body, 'deferredObserver', 'const');
  const settlement = directDeclarator(settle.body, 'settlement', 'let');
  const guard = settle.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && logical(
      statement.test,
      '||',
      (left) => exactNotCall(left, ['Object', 'hasOwn'], [
        (entry) => identifier(entry, 'callbacks'),
        (entry) => identifier(entry, 'name'),
      ]),
      (right) => binary(
        right,
        '!==',
        (entry) => unary(entry, 'typeof', (value) => (
          computedIdentifierMember(value, 'callbacks', 'name')
        )),
        (entry) => literal(entry, 'function'),
      ),
    )
    && exactReturn(statement.consequent, (value) => literal(value, false))
  ));
  if (!payload || !name || !callback || !bestEffortBinding || !immediateObserver
    || !deferredObserver || !settlement || settlement.declaration.init !== null
    || guard.length !== 1) return false;
  const payloadValue = unwrap(payload.declaration.init);
  if (payloadValue?.type !== 'ConditionalExpression'
    || !logical(
      payloadValue.test,
      '&&',
      (left) => member(left, ['message', 'payload']),
      (right) => binary(
        right,
        '===',
        (entry) => unary(entry, 'typeof', (value) => member(value, ['message', 'payload'])),
        (entry) => literal(entry, 'object'),
      ),
    )
    || !member(payloadValue.consequent, ['message', 'payload'])
    || !exactObject(payloadValue.alternate, {})
    || !call(name.declaration.init, ['String'], [
      (value) => logical(
        value,
        '||',
        (left) => member(left, ['payload', 'callback']),
        (right) => literal(right, ''),
      ),
    ])
    || !computedIdentifierMember(callback.declaration.init, 'callbacks', 'name')
    || !call(bestEffortBinding.declaration.init, ['isBestEffortExecutionWorkerCallback'], [
      (value) => identifier(value, 'name'),
    ])
    || !call(immediateObserver.declaration.init, [
      'isReservedExecutionWorkerObserverCallback',
    ], [(value) => identifier(value, 'name')])
    || !call(deferredObserver.declaration.init, ['DEFERRED_OBSERVER_CALLBACKS', 'has'], [
      (value) => identifier(value, 'name'),
    ])) return false;

  const deferredBranch = settle.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && logical(
      statement.test,
      '&&',
      (left) => identifier(left, 'bestEffort'),
      (right) => logical(
        right,
        '||',
        (entry) => unary(entry, '!', (value) => identifier(value, 'immediateObserver')),
        (entry) => identifier(entry, 'deferredObserver'),
      ),
    )
  ));
  if (deferredBranch.length !== 1
    || deferredBranch[0].consequent?.type !== 'BlockStatement'
    || deferredBranch[0].consequent.body.length !== 2) return false;
  const deferredStart = deferredBranch[0].consequent.body[0];
  const deferredReturn = deferredBranch[0].consequent.body[1];
  const deferredCall = unwrap(deferredStart?.expression);
  const deferredCallback = unwrap(deferredCall?.arguments?.[0]);
  if (deferredStart?.type !== 'ExpressionStatement'
    || !call(deferredCall, ['setImmediate']) || deferredCall.arguments.length !== 1
    || deferredCallback?.type !== 'ArrowFunctionExpression'
    || !exactProtectedIdentifierParameters(deferredCallback, [], protectedNames)
    || deferredCallback.body?.type !== 'BlockStatement'
    || deferredCallback.body.body.length !== 3
    || !exactReturn(deferredReturn, (value) => literal(value, true))) return false;
  const deferredSettlement = directDeclarator(deferredCallback.body, 'settlement', 'let');
  const deferredTry = deferredCallback.body.body[1];
  if (!deferredSettlement || deferredSettlement.declaration.init !== null
    || deferredTry?.type !== 'TryStatement' || deferredTry.finalizer
    || deferredTry.block.body.length !== 1
    || !callbackInvocationAssignment(deferredTry.block.body[0])
    || !callbackCatchClause(deferredTry.handler)
    || !callbackPromiseFailureSink(deferredCallback.body.body[2])) return false;

  const mainTry = settle.body.body.filter((statement) => statement.type === 'TryStatement');
  if (mainTry.length !== 1 || mainTry[0].finalizer
    || mainTry[0].block.body.length !== 1
    || !callbackInvocationAssignment(mainTry[0].block.body[0])
    || !callbackCatchClause(mainTry[0].handler, { rethrow: true })) return false;
  const immediateBranch = settle.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && logical(
      statement.test,
      '||',
      (left) => identifier(left, 'immediateObserver'),
      (right) => call(right, ['isImmediateNonBlockingExecutionWorkerCallback'], [
        (value) => identifier(value, 'name'),
      ]),
    )
  ));
  if (immediateBranch.length !== 1
    || immediateBranch[0].consequent?.type !== 'BlockStatement'
    || immediateBranch[0].consequent.body.length !== 1
    || !callbackPromiseFailureSink(immediateBranch[0].consequent.body[0])
    || immediateBranch[0].alternate?.type !== 'BlockStatement'
    || immediateBranch[0].alternate.body.length !== 1
    || !directCallStatement(immediateBranch[0].alternate.body[0], ['settlements', 'push'], [
      (value) => call(value, ['Promise', 'resolve'], [
        (entry) => identifier(entry, 'settlement'),
      ]),
    ])) return false;
  const settlementMutations = protectedCollectionMutationCalls(
    settle, ['settlements'], ['add', 'clear', 'delete', 'pop', 'push', 'set', 'shift', 'splice'],
  );
  const finalReturn = settle.body.body.at(-1);
  const callbackSetMutations = Object.keys(callbackLists).flatMap((setName) => (
    protectedCollectionMutationCalls(
      { body: program }, setName.split('.'), ['add', 'clear', 'delete'],
    )
  ));
  const desktopRun = topFunction(desktopProgram, 'runAgentInExecutionWorker');
  const desktopAttempts = (desktopRun?.body?.body || []).filter((statement) => (
    statement.type === 'TryStatement' && statement.finalizer
  ));
  const desktopAttempt = desktopAttempts.length === 1 ? desktopAttempts[0] : null;
  const eventSettlements = directDeclarator(desktopAttempt?.block, 'eventSettlements', 'const');
  const terminal = directDeclarator(desktopAttempt?.block, 'terminal', 'const');
  const allWaits = (desktopAttempt?.block?.body || []).filter((statement) => directCallStatement(
    statement, ['Promise', 'all'], [(value) => identifier(value, 'eventSettlements')],
    { await_: true },
  ));
  const terminalAwait = unwrap(terminal?.declaration?.init);
  const requestCall = terminalAwait?.type === 'AwaitExpression'
    ? unwrap(terminalAwait.argument) : null;
  const eventOptions = unwrap(requestCall?.arguments?.[4]);
  const eventProperty = uniqueObjectProperty(eventOptions, 'onEvent');
  const onEvent = unwrap(eventProperty?.value);
  const desktopSettlementMutations = protectedCollectionMutationCalls(
    desktopRun,
    ['eventSettlements'],
    ['add', 'clear', 'delete', 'pop', 'push', 'set', 'shift', 'splice'],
  );
  const desktopIntegrationPassed = desktopRun && desktopAttempt && eventSettlements
    && eventSettlements.declaration.init?.type === 'ArrayExpression'
    && eventSettlements.declaration.init.elements.length === 0
    && terminal && terminalAwait?.type === 'AwaitExpression'
    && requestCall?.type === 'CallExpression'
    && call(requestCall, ['requestExecutionWorkerTurn'])
    && requestCall.arguments.length === 6
    && eventOptions?.type === 'ObjectExpression' && eventProperty
    && onEvent?.type === 'ArrowFunctionExpression'
    && exactProtectedIdentifierParameters(onEvent, ['message'], [
      'callbacks', 'eventSettlements', 'message', 'settleExecutionWorkerCallback',
    ])
    && arrowCallsExactly(onEvent, ['settleExecutionWorkerCallback'], [
      (value) => exactObject(value, {
        callbacks: (entry) => identifier(entry, 'callbacks'),
        message: (entry) => identifier(entry, 'message'),
        settlements: (entry) => identifier(entry, 'eventSettlements'),
      }),
    ])
    && allWaits.length === 1
    && directStatementsOrderedAndReachable(desktopAttempt.block, [
      eventSettlements.statement, terminal.statement, allWaits[0],
    ])
    && exactTopLevelRequireBinding(
      desktopProgram,
      'settleExecutionWorkerCallback',
      'settleExecutionWorkerCallback',
      './execution-worker-callback-settlement.cjs',
    )
    && !functionHasNestedBinding(desktopRun, [
      'settleExecutionWorkerCallback', 'callbacks', 'Promise',
    ])
    && !functionHasNestedBinding({ body: desktopAttempt.block }, [
      'eventSettlements',
    ], { allowedDirectBindings: ['eventSettlements'] })
    && !functionHasIdentifierWrite(desktopRun, [
      'settleExecutionWorkerCallback', 'callbacks', 'eventSettlements', 'Promise',
    ])
    && !functionHasMemberWrite(desktopRun, [['eventSettlements']])
    && desktopSettlementMutations.length === 0;
  return settle.body.body.length === 12
    && settlementMutations.length === 1 && settlementMutations[0].method === 'push'
    && callbackSetMutations.length === 0 && desktopIntegrationPassed
    && exactReturn(finalReturn, (value) => literal(value, true))
    && directStatementsOrderedAndReachable(settle.body, [
      payload.statement, name.statement, guard[0], callback.statement,
      bestEffortBinding.statement, immediateObserver.statement, deferredObserver.statement,
      deferredBranch[0], settlement.statement, mainTry[0], immediateBranch[0], finalReturn,
    ])
    && topLevelModuleExportsIncludes(program, {
      isBestEffortExecutionWorkerCallback: (value) => identifier(
        value, 'isBestEffortExecutionWorkerCallback',
      ),
      isImmediateNonBlockingExecutionWorkerCallback: (value) => identifier(
        value, 'isImmediateNonBlockingExecutionWorkerCallback',
      ),
      isRawExecutionWorkerObserverCallback: (value) => identifier(
        value, 'isRawExecutionWorkerObserverCallback',
      ),
      isReservedExecutionWorkerObserverCallback: (value) => identifier(
        value, 'isReservedExecutionWorkerObserverCallback',
      ),
      settleExecutionWorkerCallback: (value) => identifier(value, 'settleExecutionWorkerCallback'),
    });
}

function eventFlowAstContract(sourceByPath) {
  const source = sourceByPath.get('electron/host-core/agent/execution-worker-event-flow.cjs') || '';
  const supervisorSource = sourceByPath.get(
    'electron/host-core/agent/execution-worker-supervisor.cjs',
  ) || '';
  const supervisorMessageSource = sourceByPath.get(
    'electron/host-core/agent/execution-worker-supervisor-message.cjs',
  ) || '';
  const entrySource = sourceByPath.get(
    'electron/host-core/agent/execution-worker-entry.cjs',
  ) || '';
  const program = parseProgram(source);
  const supervisorProgram = parseProgram(supervisorSource);
  const supervisorMessageProgram = parseProgram(supervisorMessageSource);
  const entryProgram = parseProgram(entrySource);
  const coalescer = topClass(program, 'RuntimeActivityCoalescer');
  const activityKey = topFunction(program, 'activityKey');
  const isCoalescible = topFunction(program, 'isCoalescibleRuntimeActivity');
  const isTerminal = topFunction(program, 'isTerminalActivity');
  const coalescerConstructor = classMethod(coalescer, 'constructor');
  const coalescerEmitFresh = classMethod(coalescer, 'emitFresh');
  const coalescerDiscard = classMethod(coalescer, 'discard');
  const coalescerClear = classMethod(coalescer, 'clear');
  const coalescerFlush = classMethod(coalescer, 'flush');
  const coalescerArm = classMethod(coalescer, 'arm');
  const coalescerPush = classMethod(coalescer, 'push');
  const coalescerClose = classMethod(coalescer, 'close');
  const coalescerPendingCount = classMethod(coalescer, 'pendingCount');
  const dispatch = topFunction(program, 'dispatchExecutionEvent');
  const route = topFunction(program, 'routeExecutionWorkerResultMessage');
  const supervisorCreator = topFunction(supervisorProgram, 'createExecutionWorkerSupervisor');
  const supervisorOnMessage = localArrow(supervisorCreator?.body, 'onMessage');
  const supervisorEventHandler = topFunction(
    supervisorMessageProgram, 'handleExecutionWorkerEventMessage',
  );
  const createExecution = topFunction(entryProgram, 'createExecution');
  if (!coalescer || !activityKey || !isCoalescible || !isTerminal
    || !coalescerConstructor || !coalescerEmitFresh || !coalescerDiscard || !coalescerClear
    || !coalescerFlush || !coalescerArm || !coalescerPush || !coalescerClose
    || !coalescerPendingCount
    || !dispatch || !route || !supervisorCreator || !supervisorOnMessage
    || !supervisorEventHandler || !createExecution
    || !exactTopLevelRequireBinding(
      program,
      'isExecutionWorkerTerminalOperation',
      'isExecutionWorkerTerminalOperation',
      './execution-worker-context-usage.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'logExecutionWorkerCancellation',
      'logExecutionWorkerCancellation',
      './execution-worker-process-lifecycle.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'observeExecutionWorkerEvent',
      'observeExecutionWorkerEvent',
      './execution-worker-process-lifecycle.cjs',
    )
    || !exactTopLevelRequireBinding(
      supervisorProgram,
      'handleExecutionWorkerEventMessage',
      'handleExecutionWorkerEventMessage',
      './execution-worker-supervisor-message.cjs',
    )
    || !exactTopLevelRequireBinding(
      supervisorMessageProgram,
      'dispatchExecutionEvent',
      'dispatchExecutionEvent',
      './execution-worker-event-flow.cjs',
    )
    || !exactTopLevelRequireBinding(
      entryProgram,
      'createRuntimeActivityCoalescer',
      'createRuntimeActivityCoalescer',
      './execution-worker-event-flow.cjs',
    )
    || !stableProgramIdentifiers(program, [
      'Date', 'Error', 'Map', 'clearTimeout', 'dispatchExecutionEvent',
      'isExecutionWorkerTerminalOperation',
      'logExecutionWorkerCancellation', 'observeExecutionWorkerEvent',
      'routeExecutionWorkerResultMessage', 'RuntimeActivityCoalescer',
      'activityKey', 'isCoalescibleRuntimeActivity', 'isTerminalActivity',
      'Math', 'Number', 'setTimeout', 'String',
    ], {
      globals: [
        'Date', 'Error', 'Map', 'Math', 'Number', 'String', 'clearTimeout', 'setTimeout',
      ],
    })
    || !exactIdentifierParameters(dispatch, ['item', 'message', 'postBrokerResult'])
    || !exactParameterList(route, [
      (value) => identifier(value, 'message'),
      (value) => objectPatternBindsExactly(value, [
        'pending', 'child', 'terminateChild', 'contextUsageRoutes', 'now',
        'postBrokerResult', 'logger',
      ]),
    ])
    || functionHasNestedBinding(dispatch, ['item', 'message', 'postBrokerResult'])
    || functionHasIdentifierWrite(dispatch, ['item', 'message', 'postBrokerResult'])
    || functionHasNestedBinding(route, [
      'message', 'pending', 'child', 'terminateChild', 'contextUsageRoutes', 'now',
      'postBrokerResult', 'logger', 'Error', 'dispatchExecutionEvent',
      'isExecutionWorkerTerminalOperation', 'logExecutionWorkerCancellation',
      'observeExecutionWorkerEvent',
    ])
    || functionHasIdentifierWrite(route, [
      'message', 'pending', 'child', 'terminateChild', 'contextUsageRoutes', 'now',
      'postBrokerResult', 'logger', 'Error', 'dispatchExecutionEvent',
      'isExecutionWorkerTerminalOperation', 'logExecutionWorkerCancellation',
      'observeExecutionWorkerEvent',
    ])) return false;

  const activityKeyReturn = activityKey.body?.body?.[0];
  const activityKeyValue = unwrap(activityKeyReturn?.argument);
  const factStringField = (node, field) => call(node, ['String'], [
    (value) => logical(
      value,
      '||',
      (left) => member(left, ['fact', field]),
      (right) => literal(right, ''),
    ),
  ]);
  if (!exactIdentifierParameters(activityKey, ['fact'])
    || activityKey.body?.body?.length !== 1
    || activityKeyReturn?.type !== 'ReturnStatement'
    || activityKeyValue?.type !== 'TemplateLiteral'
    || activityKeyValue.expressions.length !== 3
    || activityKeyValue.quasis.length !== 4
    || activityKeyValue.quasis[0]?.value?.cooked !== ''
    || activityKeyValue.quasis[1]?.value?.cooked !== '\u0000'
    || activityKeyValue.quasis[2]?.value?.cooked !== '\u0000'
    || activityKeyValue.quasis[3]?.value?.cooked !== ''
    || !factStringField(activityKeyValue.expressions[0], 'scope')
    || !factStringField(activityKeyValue.expressions[1], 'node')
    || !factStringField(activityKeyValue.expressions[2], 'identity')
    || functionHasNestedBinding(activityKey, ['fact', 'String'])
    || functionHasIdentifierWrite(activityKey, ['fact', 'String'])) return false;

  const coalescibleGuard = isCoalescible.body?.body?.[0];
  const semanticDeltaBranch = isCoalescible.body?.body?.[1];
  const coalescibleReturn = isCoalescible.body?.body?.[2];
  if (!exactIdentifierParameters(isCoalescible, ['fact'])
    || isCoalescible.body?.body?.length !== 3
    || coalescibleGuard?.type !== 'IfStatement'
    || !logical(
      coalescibleGuard.test,
      '||',
      (left) => unary(left, '!', (value) => identifier(value, 'fact')),
      (right) => binary(
        right,
        '!==',
        (value) => member(value, ['fact', 'edge']),
        (value) => literal(value, 'progressed'),
      ),
    )
    || !exactReturn(coalescibleGuard.consequent, (value) => literal(value, false))
    || semanticDeltaBranch?.type !== 'IfStatement'
    || !binary(
      semanticDeltaBranch.test,
      '===',
      (value) => member(value, ['fact', 'node']),
      (value) => literal(value, 'semantic_delta'),
    )
    || !exactReturn(semanticDeltaBranch.consequent, (value) => binary(
      value,
      '===',
      (left) => member(left, ['fact', 'contentKind']),
      (right) => literal(right, 'tool_input'),
    ))
    || !exactReturn(coalescibleReturn, (value) => logical(
      value,
      '&&',
      (left) => logical(
        left,
        '||',
        (entry) => binary(
          entry,
          '===',
          (item) => member(item, ['fact', 'node']),
          (item) => literal(item, 'tool_activity'),
        ),
        (entry) => binary(
          entry,
          '===',
          (item) => member(item, ['fact', 'node']),
          (item) => literal(item, 'hook_activity'),
        ),
      ),
      (right) => logical(
        right,
        '||',
        (entry) => binary(
          entry,
          '===',
          (item) => member(item, ['fact', 'progressClass']),
          (item) => literal(item, 'liveness'),
        ),
        (entry) => binary(
          entry,
          '===',
          (item) => member(item, ['fact', 'progressClass']),
          (item) => literal(item, 'advisory'),
        ),
      ),
    ))
    || functionHasNestedBinding(isCoalescible, ['fact'])
    || functionHasIdentifierWrite(isCoalescible, ['fact'])) return false;

  const terminalActivityReturn = isTerminal.body?.body?.[0];
  if (!exactIdentifierParameters(isTerminal, ['fact'])
    || isTerminal.body?.body?.length !== 1
    || !exactReturn(terminalActivityReturn, (value) => logical(
      value,
      '||',
      (left) => logical(
        left,
        '||',
        (entry) => binary(
          entry,
          '===',
          (item) => member(item, ['fact', 'progressClass']),
          (item) => literal(item, 'terminal'),
        ),
        (entry) => binary(
          entry,
          '===',
          (item) => member(item, ['fact', 'node']),
          (item) => literal(item, 'runtime_terminal_received'),
        ),
      ),
      (right) => binary(
        right,
        '===',
        (entry) => member(entry, ['fact', 'node']),
        (entry) => literal(entry, 'transport_lost'),
      ),
    ))
    || functionHasNestedBinding(isTerminal, ['fact'])
    || functionHasIdentifierWrite(isTerminal, ['fact'])) return false;

  const emitFreshSequence = directDeclarator(coalescerEmitFresh.body, 'sourceSequence', 'const');
  const emitFreshGuard = coalescerEmitFresh.body?.body?.[1];
  const emitFreshStaleGuard = emitFreshGuard?.consequent?.body?.[0];
  const emitFreshSequenceWrites = directAssignmentStatements(
    emitFreshGuard?.consequent, ['this', 'lastEmittedSequence'],
  );
  const emitFreshEmit = coalescerEmitFresh.body?.body?.[2];
  if (!exactIdentifierParameters(coalescerEmitFresh, ['fact'])
    || coalescerEmitFresh.body?.body?.length !== 3
    || !emitFreshSequence
    || !call(emitFreshSequence.declaration.init, ['Number'], [
      (value) => member(value, ['fact', 'sourceSequence']),
    ])
    || emitFreshGuard?.type !== 'IfStatement'
    || !call(emitFreshGuard.test, ['Number', 'isSafeInteger'], [
      (value) => identifier(value, 'sourceSequence'),
    ])
    || emitFreshGuard.consequent?.type !== 'BlockStatement'
    || emitFreshGuard.consequent.body.length !== 2
    || emitFreshStaleGuard?.type !== 'IfStatement'
    || !binary(
      emitFreshStaleGuard.test,
      '<=',
      (value) => identifier(value, 'sourceSequence'),
      (value) => member(value, ['this', 'lastEmittedSequence']),
    )
    || !bareReturn(emitFreshStaleGuard.consequent)
    || emitFreshSequenceWrites.length !== 1
    || !identifier(emitFreshSequenceWrites[0].expression.right, 'sourceSequence')
    || countMemberWrites(coalescerEmitFresh, ['this', 'lastEmittedSequence']) !== 1
    || countMemberWrites(coalescerEmitFresh, ['this', 'emit']) !== 0
    || !directCallStatement(emitFreshEmit, ['this', 'emit'], [
      (value) => identifier(value, 'fact'),
    ])
    || functionHasNestedBinding(coalescerEmitFresh, ['fact', 'sourceSequence', 'Number'], {
      allowedDirectBindings: ['sourceSequence'],
    })
    || functionHasIdentifierWrite(coalescerEmitFresh, ['fact', 'sourceSequence', 'Number'])
    || !directStatementsOrderedAndReachable(coalescerEmitFresh.body, [
      emitFreshSequence.statement, emitFreshGuard, emitFreshEmit,
    ])) return false;

  if (!exactParameterList(coalescerConstructor, [
    (value) => objectPatternBindsExactly(value, [
      'emit', 'now', 'schedule', 'cancel', 'windowMs', 'maxKeys',
    ], {
      topLevelDefault: true,
      propertyDefaults: {
        now: (entry) => member(entry, ['Date', 'now']),
        schedule: (entry) => identifier(entry, 'setTimeout'),
        cancel: (entry) => identifier(entry, 'clearTimeout'),
        windowMs: (entry) => identifier(entry, 'DEFAULT_WINDOW_MS'),
        maxKeys: (entry) => identifier(entry, 'DEFAULT_MAX_KEYS'),
      },
      requiredPropertyDefaults: ['now', 'schedule', 'cancel', 'windowMs', 'maxKeys'],
    }),
  ])
    || !exactIdentifierParameters(coalescerArm, ['key', 'entry', 'delay'])
    || !exactIdentifierParameters(coalescerDiscard, ['key'])
    || !exactIdentifierParameters(coalescerClear, [])
    || !exactIdentifierParameters(coalescerFlush, ['key'])
    || !exactIdentifierParameters(coalescerPush, ['fact'])
    || !exactIdentifierParameters(coalescerClose, [])
    || !exactIdentifierParameters(coalescerPendingCount, [])
    || functionHasNestedBinding(coalescerConstructor, [
      'emit', 'now', 'schedule', 'cancel', 'windowMs', 'maxKeys', 'Math', 'Number',
    ])
    || functionHasIdentifierWrite(coalescerConstructor, [
      'emit', 'now', 'schedule', 'cancel', 'windowMs', 'maxKeys', 'Math', 'Number',
    ])
    || functionHasNestedBinding(coalescerArm, [
      'key', 'entry', 'delay', 'Math', 'Number',
    ])
    || functionHasIdentifierWrite(coalescerArm, [
      'key', 'entry', 'delay', 'Math', 'Number',
    ])
    || !safeTimerTimeoutBinding(coalescerConstructor, {
      sourceName: 'windowMs', requestedName: 'requestedWindowMs',
      boundedName: 'boundedWindowMs', maximum: 2_147_483_647, fallback: 100,
    })
    || !safeTimerTimeoutBinding(coalescerArm, {
      sourceName: 'delay', requestedName: 'requestedDelay',
      boundedName: 'boundedDelay', maximum: 2_147_483_647,
    })
    || !safeTimerTimeoutBinding(coalescerConstructor, {
      sourceName: 'maxKeys', requestedName: 'requestedMaxKeys',
      boundedName: 'boundedMaxKeys', maximum: 128, fallback: 128,
    })) return false;
  const windowAssignments = directAssignmentStatements(
    coalescerConstructor.body, ['this', 'windowMs'],
  );
  const maxKeyAssignments = directAssignmentStatements(
    coalescerConstructor.body, ['this', 'maxKeys'],
  );
  const armEntries = directStatementEntriesIncludingTryBlock(coalescerArm.body);
  const timerAssignments = armEntries.filter((entry) => {
    const expression = unwrap(entry.statement?.expression);
    if (entry.statement?.type !== 'ExpressionStatement'
      || expression?.type !== 'AssignmentExpression'
      || expression.operator !== '='
      || !member(expression.left, ['entry', 'timer'])) return false;
    return call(expression.right, ['this', 'schedule'], [
      (value) => exactProtectedIdentifierParameters(unwrap(value), [], ['key'])
        && arrowCallsExactly(value, ['this', 'flush'], [
          (argument) => identifier(argument, 'key'),
        ]),
      (value) => identifier(value, 'boundedDelay'),
    ]);
  });
  const otherCoalescerMethods = (coalescer.body?.body || [])
    .filter((method) => method.type === 'MethodDefinition'
      && !['constructor'].includes(propertyName(method)))
    .map((method) => method.value);
  if (windowAssignments.length !== 1
    || !identifier(windowAssignments[0].expression.right, 'boundedWindowMs')
    || maxKeyAssignments.length !== 1
    || !identifier(maxKeyAssignments[0].expression.right, 'boundedMaxKeys')
    || timerAssignments.length !== 1
    || !directEntryReachable(coalescerArm.body, timerAssignments[0])
    || countMemberWrites(coalescerConstructor, ['this', 'windowMs']) !== 1
    || countMemberWrites(coalescerConstructor, ['this', 'maxKeys']) !== 1
    || otherCoalescerMethods.some((method) => functionHasMemberWrite(
      method, [['this', 'windowMs'], ['this', 'maxKeys'], ['this', 'schedule']],
    ))) return false;

  const armAttempts = coalescerArm.body.body.filter((statement) => (
    statement.type === 'TryStatement' && statement.handler
  ));
  const armAttempt = armAttempts.length === 1 ? armAttempts[0] : null;
  const armFallbackValue = directDeclarator(armAttempt?.handler?.body, 'value', 'const');
  const armDelete = armAttempt?.handler?.body?.body?.[1];
  const armFallbackEmit = armAttempt?.handler?.body?.body?.[2];
  const armEntryMutations = protectedCollectionMutationCalls(
    coalescerArm, ['this', 'entries'], ['add', 'clear', 'delete', 'set'],
  );
  if (coalescerArm.body.body.length !== 3
    || armAttempts.length !== 1 || armAttempt.finalizer
    || armAttempt.block.body.length !== 2
    || !directCallStatement(armAttempt.block.body[1], ['entry', 'timer', 'unref'], [])
    || armAttempt.handler.param !== null || armAttempt.handler.body.body.length !== 3
    || !armFallbackValue || !member(armFallbackValue.declaration.init, ['entry', 'pending'])
    || !directCallStatement(armDelete, ['this', 'entries', 'delete'], [
      (value) => identifier(value, 'key'),
    ])
    || armFallbackEmit?.type !== 'IfStatement'
    || !identifier(armFallbackEmit.test, 'value')
    || !directCallStatement(armFallbackEmit.consequent, ['this', 'emitFresh'], [
      (value) => identifier(value, 'value'),
    ])
    || armEntryMutations.length !== 1 || armEntryMutations[0].method !== 'delete'
    || armEntryMutations[0].node !== unwrap(armDelete.expression)
    || !directStatementsOrderedAndReachable(armAttempt.handler.body, [
      armFallbackValue.statement, armDelete, armFallbackEmit,
    ])) return false;

  const discardEntry = directDeclarator(coalescerDiscard.body, 'entry', 'const');
  const discardGuard = coalescerDiscard.body.body[1];
  const discardDelete = coalescerDiscard.body.body[2];
  const discardTimerGuard = coalescerDiscard.body.body[3];
  const discardCancel = coalescerDiscard.body.body[4];
  const discardEntryMutations = protectedCollectionMutationCalls(
    coalescerDiscard, ['this', 'entries'], ['add', 'clear', 'delete', 'set'],
  );
  if (coalescerDiscard.body.body.length !== 5
    || !discardEntry || !call(discardEntry.declaration.init, ['this', 'entries', 'get'], [
      (value) => identifier(value, 'key'),
    ])
    || discardGuard?.type !== 'IfStatement'
    || !unary(discardGuard.test, '!', (value) => identifier(value, 'entry'))
    || !bareReturn(discardGuard.consequent)
    || !directCallStatement(discardDelete, ['this', 'entries', 'delete'], [
      (value) => identifier(value, 'key'),
    ])
    || discardTimerGuard?.type !== 'IfStatement'
    || !unary(discardTimerGuard.test, '!', (value) => member(value, ['entry', 'timer']))
    || !bareReturn(discardTimerGuard.consequent)
    || discardCancel?.type !== 'TryStatement'
    || discardCancel.block.body.length !== 1
    || !directCallStatement(discardCancel.block.body[0], ['this', 'cancel'], [
      (value) => member(value, ['entry', 'timer']),
    ])
    || !discardCancel.handler || discardCancel.finalizer
    || discardEntryMutations.length !== 1 || discardEntryMutations[0].method !== 'delete'
    || discardEntryMutations[0].node !== unwrap(discardDelete.expression)
    || !directStatementsOrderedAndReachable(
      coalescerDiscard.body, coalescerDiscard.body.body,
    )) return false;
  const clearLoops = coalescerClear.body.body.filter((statement) => (
    statement.type === 'ForOfStatement'
    && statement.await === false
    && statement.left?.type === 'VariableDeclaration'
    && statement.left.kind === 'const'
    && statement.left.declarations.length === 1
    && identifier(statement.left.declarations[0].id, 'key')
    && call(statement.right, ['this', 'entries', 'keys'], [])
    && directCallStatement(statement.body, ['this', 'discard'], [
      (value) => identifier(value, 'key'),
    ])
  ));
  if (coalescerClear.body.body.length !== 1 || clearLoops.length !== 1) return false;

  const flushClosed = coalescerFlush.body.body[0];
  const flushEntry = directDeclarator(coalescerFlush.body, 'entry', 'const');
  const flushMissing = coalescerFlush.body.body[2];
  const flushValue = directDeclarator(coalescerFlush.body, 'value', 'const');
  const flushPendingWrites = directAssignmentStatements(
    coalescerFlush.body, ['entry', 'pending'],
  );
  const flushTimerWrites = directAssignmentStatements(
    coalescerFlush.body, ['entry', 'timer'],
  );
  const flushLastSentWrites = directAssignmentStatements(
    coalescerFlush.body, ['entry', 'lastSentAt'],
  );
  const flushEmits = coalescerFlush.body.body.filter((statement) => directCallStatement(
    statement, ['this', 'emitFresh'], [(value) => identifier(value, 'value')],
  ));
  const flushEntryMutations = protectedCollectionMutationCalls(
    coalescerFlush, ['this', 'entries'], ['add', 'clear', 'delete', 'set'],
  );
  if (coalescerFlush.body.body.length !== 8
    || flushClosed?.type !== 'IfStatement'
    || !member(flushClosed.test, ['this', 'closed']) || !bareReturn(flushClosed.consequent)
    || !flushEntry || !call(flushEntry.declaration.init, ['this', 'entries', 'get'], [
      (value) => identifier(value, 'key'),
    ])
    || flushMissing?.type !== 'IfStatement'
    || !unary(flushMissing.test, '!', (value) => member(value, ['entry', 'pending']))
    || !bareReturn(flushMissing.consequent)
    || !flushValue || !member(flushValue.declaration.init, ['entry', 'pending'])
    || flushPendingWrites.length !== 1 || !literal(flushPendingWrites[0].expression.right, null)
    || flushTimerWrites.length !== 1 || !literal(flushTimerWrites[0].expression.right, null)
    || flushLastSentWrites.length !== 1
    || !call(flushLastSentWrites[0].expression.right, ['this', 'now'], [])
    || countMemberWrites(coalescerFlush, ['entry', 'pending']) !== 1
    || countMemberWrites(coalescerFlush, ['entry', 'timer']) !== 1
    || countMemberWrites(coalescerFlush, ['entry', 'lastSentAt']) !== 1
    || flushEntryMutations.length !== 0 || flushEmits.length !== 1
    || !directStatementsOrderedAndReachable(coalescerFlush.body, [
      flushClosed, flushEntry.statement, flushMissing, flushValue.statement,
      flushPendingWrites[0], flushTimerWrites[0], flushLastSentWrites[0], flushEmits[0],
    ])) return false;

  const closeGuard = coalescerClose.body.body[0];
  const closeWrites = directAssignmentStatements(coalescerClose.body, ['this', 'closed']);
  const closeClears = coalescerClose.body.body.filter((statement) => directCallStatement(
    statement, ['this', 'clear'], [],
  ));
  if (coalescerClose.body.body.length !== 3
    || closeGuard?.type !== 'IfStatement'
    || !member(closeGuard.test, ['this', 'closed']) || !bareReturn(closeGuard.consequent)
    || closeWrites.length !== 1 || !literal(closeWrites[0].expression.right, true)
    || closeClears.length !== 1
    || !directStatementsOrderedAndReachable(coalescerClose.body, [
      closeGuard, closeWrites[0], closeClears[0],
    ])) return false;
  const nonCoalescible = coalescerPush.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && unary(statement.test, '!', (value) => call(value, ['isCoalescibleRuntimeActivity'], [
      (entry) => identifier(entry, 'fact'),
    ]))
    && statement.consequent?.type === 'BlockStatement'
  ));
  if (nonCoalescible.length !== 1) return false;
  const terminalClears = nonCoalescible[0].consequent.body.filter((statement) => (
    statement.type === 'IfStatement'
    && call(statement.test, ['isTerminalActivity'], [(value) => identifier(value, 'fact')])
    && directCallStatement(statement.consequent, ['this', 'clear'], [])
    && directCallStatement(statement.alternate, ['this', 'discard'], [
      (value) => identifier(value, 'key'),
    ])
  ));
  const nonCoalescibleEmits = nonCoalescible[0].consequent.body.filter((statement) => (
    directCallStatement(statement, ['this', 'emitFresh'], [
      (value) => identifier(value, 'fact'),
    ])
  ));
  const nonCoalescibleReturn = nonCoalescible[0].consequent.body.at(-1);
  if (nonCoalescible[0].consequent.body.length !== 3
    || terminalClears.length !== 1 || nonCoalescibleEmits.length !== 1
    || !bareReturn(nonCoalescibleReturn)
    || !directStatementsOrderedAndReachable(nonCoalescible[0].consequent, [
      terminalClears[0], nonCoalescibleEmits[0], nonCoalescibleReturn,
    ])) return false;

  const pushGuard = coalescerPush.body.body[0];
  const pushKey = directDeclarator(coalescerPush.body, 'key', 'const');
  const pushEntry = directDeclarator(coalescerPush.body, 'entry', 'let');
  const pushCurrentTime = directDeclarator(coalescerPush.body, 'currentTime', 'const');
  const newEntryBranch = coalescerPush.body.body[5];
  const newEntryCapacityGuard = newEntryBranch?.consequent?.body?.[0];
  const newEntryAssignment = unwrap(newEntryBranch?.consequent?.body?.[1]?.expression);
  const newEntrySet = newEntryBranch?.consequent?.body?.[2];
  const newEntryEmit = newEntryBranch?.consequent?.body?.[3];
  const newEntryReturn = newEntryBranch?.consequent?.body?.[4];
  const immediateWindowBranch = coalescerPush.body.body[6];
  const immediateWindowWrite = unwrap(immediateWindowBranch?.consequent?.body?.[0]?.expression);
  const immediateWindowEmit = immediateWindowBranch?.consequent?.body?.[1];
  const immediateWindowReturn = immediateWindowBranch?.consequent?.body?.[2];
  const pendingWriteStatement = coalescerPush.body.body[7];
  const pendingWrite = unwrap(pendingWriteStatement?.expression);
  const armGuard = coalescerPush.body.body[8];
  const pushEntryMutations = protectedCollectionMutationCalls(
    coalescerPush, ['this', 'entries'], ['add', 'clear', 'delete', 'set'],
  );
  if (coalescerPush.body.body.length !== 9
    || pushGuard?.type !== 'IfStatement'
    || !logical(
      pushGuard.test,
      '||',
      (value) => member(value, ['this', 'closed']),
      (value) => unary(value, '!', (entry) => identifier(entry, 'fact')),
    )
    || !bareReturn(pushGuard.consequent)
    || !pushKey || !call(pushKey.declaration.init, ['activityKey'], [
      (value) => identifier(value, 'fact'),
    ])
    || !pushEntry || !call(pushEntry.declaration.init, ['this', 'entries', 'get'], [
      (value) => identifier(value, 'key'),
    ])
    || !pushCurrentTime || !call(pushCurrentTime.declaration.init, ['this', 'now'], [])
    || newEntryBranch?.type !== 'IfStatement'
    || !unary(newEntryBranch.test, '!', (value) => identifier(value, 'entry'))
    || newEntryBranch.consequent?.type !== 'BlockStatement'
    || newEntryBranch.consequent.body.length !== 5
    || newEntryCapacityGuard?.type !== 'IfStatement'
    || !binary(
      newEntryCapacityGuard.test,
      '>=',
      (value) => member(value, ['this', 'entries', 'size']),
      (value) => member(value, ['this', 'maxKeys']),
    )
    || !bareReturn(newEntryCapacityGuard.consequent)
    || newEntryAssignment?.type !== 'AssignmentExpression'
    || newEntryAssignment.operator !== '=' || !identifier(newEntryAssignment.left, 'entry')
    || !exactObject(newEntryAssignment.right, {
      lastSentAt: (value) => identifier(value, 'currentTime'),
      pending: (value) => literal(value, null),
      timer: (value) => literal(value, null),
    })
    || !directCallStatement(newEntrySet, ['this', 'entries', 'set'], [
      (value) => identifier(value, 'key'),
      (value) => identifier(value, 'entry'),
    ])
    || !directCallStatement(newEntryEmit, ['this', 'emitFresh'], [
      (value) => identifier(value, 'fact'),
    ])
    || !bareReturn(newEntryReturn)
    || pushEntryMutations.length !== 1 || pushEntryMutations[0].method !== 'set'
    || pushEntryMutations[0].node !== unwrap(newEntrySet.expression)
    || immediateWindowBranch?.type !== 'IfStatement' || immediateWindowBranch.alternate
    || !logical(
      immediateWindowBranch.test,
      '&&',
      (value) => binary(
        value,
        '>=',
        (left) => binary(
          left,
          '-',
          (entry) => identifier(entry, 'currentTime'),
          (entry) => member(entry, ['entry', 'lastSentAt']),
        ),
        (right) => member(right, ['this', 'windowMs']),
      ),
      (value) => unary(value, '!', (entry) => member(entry, ['entry', 'timer'])),
    )
    || immediateWindowBranch.consequent?.type !== 'BlockStatement'
    || immediateWindowBranch.consequent.body.length !== 3
    || immediateWindowWrite?.type !== 'AssignmentExpression'
    || immediateWindowWrite.operator !== '='
    || !member(immediateWindowWrite.left, ['entry', 'lastSentAt'])
    || !identifier(immediateWindowWrite.right, 'currentTime')
    || !directCallStatement(immediateWindowEmit, ['this', 'emitFresh'], [
      (value) => identifier(value, 'fact'),
    ])
    || !bareReturn(immediateWindowReturn)
    || pendingWrite?.type !== 'AssignmentExpression' || pendingWrite.operator !== '='
    || !member(pendingWrite.left, ['entry', 'pending'])
    || !identifier(pendingWrite.right, 'fact')
    || armGuard?.type !== 'IfStatement' || armGuard.alternate
    || !unary(armGuard.test, '!', (value) => member(value, ['entry', 'timer']))
    || !directCallStatement(armGuard.consequent, ['this', 'arm'], [
      (value) => identifier(value, 'key'),
      (value) => identifier(value, 'entry'),
      (value) => call(value, ['Math', 'max'], [
        (entry) => literal(entry, 0),
        (entry) => binary(
          entry,
          '-',
          (left) => member(left, ['this', 'windowMs']),
          (right) => binary(
            right,
            '-',
            (candidate) => identifier(candidate, 'currentTime'),
            (candidate) => member(candidate, ['entry', 'lastSentAt']),
          ),
        ),
      ]),
    ])
    || countAssignments(coalescerPush, (target) => identifier(target, 'entry')) !== 1
    || countMemberWrites(coalescerPush, ['entry', 'lastSentAt']) !== 1
    || countMemberWrites(coalescerPush, ['entry', 'pending']) !== 1
    || functionHasNestedBinding(coalescerPush, ['key', 'entry', 'currentTime'], {
      allowedDirectBindings: ['key', 'entry', 'currentTime'],
    })
    || !directStatementsOrderedAndReachable(newEntryBranch.consequent, [
      newEntryCapacityGuard, newEntryBranch.consequent.body[1], newEntrySet,
      newEntryEmit, newEntryReturn,
    ])
    || !directStatementsOrderedAndReachable(coalescerPush.body, [
      pushGuard, pushKey.statement, nonCoalescible[0], pushEntry.statement,
      pushCurrentTime.statement, newEntryBranch, immediateWindowBranch,
      pendingWriteStatement, armGuard,
    ])) return false;

  const pendingCountBinding = directDeclarator(coalescerPendingCount.body, 'count', 'let');
  const pendingCountLoop = coalescerPendingCount.body.body[1];
  const pendingCountReturn = coalescerPendingCount.body.body[2];
  const pendingCountExpression = unwrap(pendingCountLoop?.body?.expression);
  const pendingCountValue = unwrap(pendingCountExpression?.right);
  const pendingCountEntryMutations = protectedCollectionMutationCalls(
    coalescerPendingCount, ['this', 'entries'], ['add', 'clear', 'delete', 'set'],
  );
  if (coalescerPendingCount.body.body.length !== 3
    || !pendingCountBinding || !literal(pendingCountBinding.declaration.init, 0)
    || pendingCountLoop?.type !== 'ForOfStatement' || pendingCountLoop.await !== false
    || pendingCountLoop.left?.type !== 'VariableDeclaration'
    || pendingCountLoop.left.kind !== 'const'
    || pendingCountLoop.left.declarations.length !== 1
    || !identifier(pendingCountLoop.left.declarations[0].id, 'entry')
    || pendingCountLoop.left.declarations[0].init !== null
    || !call(pendingCountLoop.right, ['this', 'entries', 'values'], [])
    || pendingCountLoop.body?.type !== 'ExpressionStatement'
    || pendingCountExpression?.type !== 'AssignmentExpression'
    || pendingCountExpression.operator !== '+='
    || !identifier(pendingCountExpression.left, 'count')
    || pendingCountValue?.type !== 'ConditionalExpression'
    || !member(pendingCountValue.test, ['entry', 'pending'])
    || !literal(pendingCountValue.consequent, 1)
    || !literal(pendingCountValue.alternate, 0)
    || !exactReturn(pendingCountReturn, (value) => identifier(value, 'count'))
    || countAssignments(
      coalescerPendingCount, (target) => identifier(target, 'count'),
    ) !== 1
    || functionHasNestedBinding(coalescerPendingCount, ['count'], {
      allowedDirectBindings: ['count'],
    })
    || functionHasMemberWrite(coalescerPendingCount, [['this', 'entries']])
    || pendingCountEntryMutations.length !== 0
    || !directStatementsOrderedAndReachable(coalescerPendingCount.body, [
      pendingCountBinding.statement, pendingCountLoop, pendingCountReturn,
    ])) return false;

  const sequenceWrites = directAssignmentStatements(dispatch.body, ['item', 'lastSequence']);
  const dispatchAttempts = dispatch.body.body.filter((statement) => statement.type === 'TryStatement');
  if (sequenceWrites.length !== 1
    || !member(sequenceWrites[0].expression.right, ['message', 'sequence'])
    || countMemberWrites(dispatch, ['item', 'lastSequence']) !== 1
    || dispatchAttempts.length !== 1 || dispatchAttempts[0].handler
    || dispatchAttempts[0].block.body.length !== 1
    || !directCallStatement(dispatchAttempts[0].block.body[0], ['item', 'onEvent'], [
      (value) => identifier(value, 'message'),
    ])
    || dispatchAttempts[0].finalizer?.body.length !== 1
    || !directCallStatement(dispatchAttempts[0].finalizer.body[0], ['postBrokerResult'], [
      (value) => literal(value, 'stream.credit'),
      (value) => identifier(value, 'message'),
      (value) => exactObject(value, { credit: (entry) => literal(entry, 1) }),
    ])
    || !directStatementsOrderedAndReachable(dispatch.body, [
      sequenceWrites[0], dispatchAttempts[0],
    ])) return false;

  if (functionHasProtectedAliasMutation(route, [
    ['pending', 'get'], ['pending', 'delete'], ['item', 'matches'], ['item', 'reject'],
    ['item', 'resolve'], ['contextUsageRoutes', 'handle'], ['contextUsageRoutes', 'retain'],
  ])) return false;
  const contextGuard = route.body.body[0];
  const eventBranch = route.body.body[1];
  if (contextGuard?.type !== 'IfStatement'
    || !call(contextGuard.test, ['contextUsageRoutes', 'handle'], [
      (value) => identifier(value, 'message'),
      (value) => identifier(value, 'pending'),
      (value) => identifier(value, 'child'),
      (value) => identifier(value, 'terminateChild'),
    ])
    || !exactReturn(contextGuard.consequent, (value) => literal(value, true))
    || eventBranch?.type !== 'IfStatement'
    || !exactOperation(eventBranch.test, '===', 'execution.event')
    || eventBranch.consequent?.type !== 'BlockStatement') return false;
  const eventBody = eventBranch.consequent;
  const eventItem = directDeclarator(eventBody, 'item', 'const');
  const eventIdentity = eventBody.body[1];
  const sequenceBranch = eventBody.body[2];
  if (!eventItem || !call(eventItem.declaration.init, ['pending', 'get'], [
    (value) => member(value, ['message', 'requestId']),
  ]) || eventIdentity?.type !== 'IfStatement'
    || !exactItemGuard(eventIdentity.test)
    || !exactReturn(eventIdentity.consequent, (value) => literal(value, true))
    || sequenceBranch?.type !== 'IfStatement'
    || !binary(
      sequenceBranch.test,
      '<=',
      (value) => member(value, ['message', 'sequence']),
      (value) => member(value, ['item', 'lastSequence']),
    )
    || sequenceBranch.consequent?.type !== 'BlockStatement') return false;
  const rejectionBody = sequenceBranch.consequent;
  const sequenceError = directDeclarator(rejectionBody, 'error', 'const');
  const sequenceCode = unwrap(rejectionBody.body[1]?.expression);
  const sequenceDelete = rejectionBody.body[2];
  const sequenceReject = rejectionBody.body[3];
  const sequenceTerminate = rejectionBody.body[4];
  const sequenceReturn = rejectionBody.body[5];
  if (rejectionBody.body.length !== 6 || !sequenceError
    || !construct(sequenceError.declaration.init, 'Error')
    || sequenceCode?.type !== 'AssignmentExpression'
    || sequenceCode.operator !== '=' || !member(sequenceCode.left, ['error', 'code'])
    || !literal(sequenceCode.right, 'execution_worker_sequence_violation')
    || !directCallStatement(sequenceDelete, ['pending', 'delete'], [
      (value) => member(value, ['message', 'requestId']),
    ])
    || !directCallStatement(sequenceReject, ['item', 'reject'], [
      (value) => identifier(value, 'error'),
    ])
    || !directCallStatement(sequenceTerminate, ['terminateChild'], [
      (value) => identifier(value, 'child'),
      (value) => literal(value, 'sequence-violation'),
    ])
    || !exactReturn(sequenceReturn, (value) => literal(value, true))
    || !directStatementsOrderedAndReachable(rejectionBody, rejectionBody.body)) return false;
  const observes = eventBody.body.filter((statement) => directCallStatement(
    statement, ['observeExecutionWorkerEvent'], [
      (value) => identifier(value, 'item'),
      (value) => identifier(value, 'message'),
      (value) => call(value, ['now'], []),
    ],
  ));
  const forwards = eventBody.body.filter((statement) => directCallStatement(
    statement, ['dispatchExecutionEvent'], [
      (value) => identifier(value, 'item'),
      (value) => identifier(value, 'message'),
      (value) => identifier(value, 'postBrokerResult'),
    ],
  ));
  const eventReturns = eventBody.body.filter((statement) => exactReturn(
    statement, (value) => literal(value, true),
  ));
  if (observes.length !== 1 || forwards.length !== 1 || eventReturns.length !== 1
    || !directStatementsOrderedAndReachable(eventBody, [
      eventItem.statement, eventIdentity, sequenceBranch, observes[0], forwards[0], eventReturns[0],
    ])) return false;

  const terminalGuard = route.body.body[2];
  const terminalItem = directDeclarator(route.body, 'item', 'const');
  const terminalIdentity = route.body.body[4];
  const cancellationLog = route.body.body[5];
  const terminalDelete = route.body.body[6];
  const retain = route.body.body[7];
  const resolve = route.body.body[8];
  const terminalReturn = route.body.body[9];
  if (route.body.body.length !== 10
    || terminalGuard?.type !== 'IfStatement'
    || !exactNotCall(terminalGuard.test, ['isExecutionWorkerTerminalOperation'], [
      (value) => member(value, ['message', 'operation']),
    ])
    || !exactReturn(terminalGuard.consequent, (value) => literal(value, false))
    || !terminalItem || !call(terminalItem.declaration.init, ['pending', 'get'], [
      (value) => member(value, ['message', 'requestId']),
    ])
    || terminalIdentity?.type !== 'IfStatement'
    || !exactItemGuard(terminalIdentity.test)
    || !exactReturn(terminalIdentity.consequent, (value) => literal(value, true))
    || cancellationLog?.type !== 'IfStatement'
    || !exactOperation(cancellationLog.test, '===', 'execution.terminal')
    || !directCallStatement(cancellationLog.consequent, ['logExecutionWorkerCancellation'], [
      (value) => identifier(value, 'logger'),
      (value) => identifier(value, 'item'),
      (value) => identifier(value, 'message'),
      (value) => call(value, ['now'], []),
    ])
    || !directCallStatement(terminalDelete, ['pending', 'delete'], [
      (value) => member(value, ['message', 'requestId']),
    ])
    || !directCallStatement(retain, ['contextUsageRoutes', 'retain'], [
      (value) => identifier(value, 'message'),
      (value) => identifier(value, 'item'),
    ])
    || !directCallStatement(resolve, ['item', 'resolve'], [
      (value) => identifier(value, 'message'),
    ])
    || !exactReturn(terminalReturn, (value) => literal(value, true))
    || !directStatementsOrderedAndReachable(route.body, route.body.body)) return false;
  const pendingMutations = protectedCollectionMutationCalls(
    route, ['pending'], ['add', 'clear', 'delete', 'set'],
  );
  if (pendingMutations.length !== 2
    || pendingMutations.some((entry) => entry.method !== 'delete')) return false;

  if (functionHasNestedBinding(supervisorCreator, ['handleExecutionWorkerEventMessage'])
    || functionHasIdentifierWrite(supervisorCreator, ['handleExecutionWorkerEventMessage'])
    || functionHasNestedBinding(supervisorOnMessage, [
      'message', 'handleExecutionWorkerEventMessage', 'pending', 'child', 'terminateChild',
      'now', 'postBrokerResult',
    ], { allowedDirectBindings: ['message'] })
    || functionHasIdentifierWrite(supervisorOnMessage, [
      'handleExecutionWorkerEventMessage', 'pending', 'child', 'terminateChild',
      'now', 'postBrokerResult',
    ])) return false;
  const supervisorMessage = directDeclarator(supervisorOnMessage.body, 'message', 'let');
  const supervisorDecodeAttempts = supervisorOnMessage.body?.body?.filter((statement) => (
    statement.type === 'TryStatement' && statement.handler && !statement.finalizer
  )) || [];
  const supervisorMessageAssignments = supervisorDecodeAttempts.flatMap((statement) => (
    directAssignmentStatements(statement.block, ['message'])
  ));
  const directMessageInput = exactIdentifierParameters(supervisorOnMessage, ['message'])
    && !supervisorMessage && supervisorDecodeAttempts.length === 0
    && countAssignments(supervisorOnMessage, (target) => identifier(target, 'message')) === 0;
  const decodedMessageInput = exactIdentifierParameters(supervisorOnMessage, ['raw'])
    && supervisorMessage?.declaration.init === null
    && supervisorDecodeAttempts.length === 1 && supervisorMessageAssignments.length === 1
    && countAssignments(supervisorOnMessage, (target) => identifier(target, 'message')) === 1
    && call(supervisorMessageAssignments[0].expression.right, [
      'validateExecutionWorkerReply',
    ], [
      (value) => identifier(value, 'raw'),
      (value) => identifier(value, 'pending'),
      (value) => identifier(value, 'now'),
    ])
    && directStatementReachable(
      supervisorDecodeAttempts[0].block, supervisorMessageAssignments[0],
    );
  if (!directMessageInput && !decodedMessageInput) return false;
  const eventForwards = supervisorOnMessage.body?.body?.filter((statement) => (
    statement.type === 'IfStatement'
    && exactOperation(statement.test, '===', 'execution.event')
    && statement.consequent?.type === 'BlockStatement'
    && statement.consequent.body.length === 2
    && directCallStatement(statement.consequent.body[0], ['handleExecutionWorkerEventMessage'], [
      (value) => identifier(value, 'message'),
      (value) => objectIncludesExactProperties(value, {
        pending: (entry) => identifier(entry, 'pending'),
        child: (entry) => identifier(entry, 'child'),
        terminateChild: (entry) => identifier(entry, 'terminateChild'),
        postBrokerResult: (entry) => identifier(entry, 'postBrokerResult'),
      }),
    ])
    && bareReturn(statement.consequent.body[1])
  )) || [];
  const messageDispatches = supervisorEventHandler.body?.body?.filter((statement) => (
    directCallStatement(statement, ['dispatchExecutionEvent'], [
      (value) => identifier(value, 'item'),
      (value) => identifier(value, 'message'),
      (value) => identifier(value, 'postBrokerResult'),
    ])
  )) || [];

  const runtimeActivity = directDeclarator(createExecution.body, 'runtimeActivity', 'const');
  const callbacks = directDeclarator(createExecution.body, 'callbacks', 'const');
  const executionResult = returnedObject(createExecution);
  const callbackProperty = uniqueObjectProperty(callbacks?.declaration?.init, 'onRuntimeActivity');
  const queueDepthProperty = uniqueObjectProperty(executionResult, 'queueDepth');
  const runProperty = uniqueObjectProperty(executionResult, 'run');
  const callbackFunction = unwrap(callbackProperty?.value);
  const queueDepthFunction = unwrap(queueDepthProperty?.value);
  const runFunction = unwrap(runProperty?.value);
  const runtimeCalls = { create: 0, push: 0, pending: 0, close: 0 };
  visit(createExecution.body, (node) => {
    if (call(node, ['createRuntimeActivityCoalescer'])) runtimeCalls.create += 1;
    if (call(node, ['runtimeActivity', 'push'])) runtimeCalls.push += 1;
    if (call(node, ['runtimeActivity', 'pendingCount'])) runtimeCalls.pending += 1;
    if (call(node, ['runtimeActivity', 'close'])) runtimeCalls.close += 1;
  });
  const runAttempts = (runFunction?.body?.body || []).filter((statement) => (
    statement.type === 'TryStatement' && statement.finalizer
  ));
  const closeStatements = runAttempts[0]?.finalizer?.body?.filter((statement) => (
    directCallStatement(statement, ['runtimeActivity', 'close'], [])
  )) || [];
  const queueDepthReturns = (queueDepthFunction?.body?.body || []).filter((statement) => (
    statement.type === 'ReturnStatement' && statement.argument
  ));
  let queueDepthPendingCalls = 0;
  visit(queueDepthReturns[0]?.argument, (node) => {
    if (call(node, ['runtimeActivity', 'pendingCount'], [])) queueDepthPendingCalls += 1;
  });
  return eventForwards.length === 1 && directStatementReachable(
    supervisorOnMessage.body, eventForwards[0],
  ) && messageDispatches.length === 1 && directStatementReachable(
    supervisorEventHandler.body, messageDispatches[0],
  ) && runtimeActivity
    && call(runtimeActivity.declaration.init, ['createRuntimeActivityCoalescer'], [
      (value) => exactObject(value, {
        emit: (entry) => exactProtectedIdentifierParameters(unwrap(entry), ['value'])
          && arrowCallsExactly(entry, ['emit'], [
            (argument) => literal(argument, 'onRuntimeActivity'),
            (argument) => identifier(argument, 'value'),
          ]),
      }),
    ])
    && callbackFunction?.type === 'ArrowFunctionExpression'
    && exactProtectedIdentifierParameters(callbackFunction, ['value'])
    && arrowCallsExactly(callbackFunction, ['runtimeActivity', 'push'], [
      (value) => identifier(value, 'value'),
    ])
    && queueDepthFunction && queueDepthReturns.length === 1
    && directStatementReachable(queueDepthFunction.body, queueDepthReturns[0])
    && queueDepthPendingCalls === 1 && runFunction
    && runtimeCalls.create === 1 && runtimeCalls.push === 1
    && runtimeCalls.pending === 1 && runtimeCalls.close === 1
    && runAttempts.length === 1 && closeStatements.length === 1
    && directStatementReachable(runAttempts[0].finalizer, closeStatements[0])
    && topLevelModuleExportsIncludes(program, {
    dispatchExecutionEvent: (value) => identifier(value, 'dispatchExecutionEvent'),
    routeExecutionWorkerResultMessage: (value) => identifier(
      value, 'routeExecutionWorkerResultMessage',
    ),
  });
}

function currentTerminationAfterRace(callback) {
  callback = unwrap(callback);
  if (callback?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(callback, [])
    || callback.body?.type !== 'BlockStatement'
    || callback.body.body.length !== 3) return false;
  const [clear, kill, result] = callback.body.body;
  if (clear?.type !== 'IfStatement'
    || !identifier(clear.test, 'timer')
    || !directCallStatement(clear.consequent, ['clearTimeout'], [
      (entry) => identifier(entry, 'timer'),
    ])
    || kill?.type !== 'TryStatement'
    || kill.handler?.body?.body.length !== 0
    || kill.finalizer
    || kill.block.body.length !== 1
    || !directCallStatement(kill.block.body[0], ['target', 'kill'], [])
    || !exactReturn(result, (entry) => literal(entry, true))) return false;
  return true;
}

function terminationAstContract(source) {
  const program = parseProgram(source);
  const creator = topFunction(program, 'createExecutionWorkerTerminator');
  if (!creator || creator.params.length !== 1
    || !stableProgramIdentifiers(program, [
      'Math', 'Number', 'Promise', 'WeakMap', 'clearTimeout',
      'createExecutionWorkerTerminator', 'setTimeout',
    ], { globals: ['Math', 'Number', 'Promise', 'WeakMap', 'clearTimeout', 'setTimeout'] })) return false;
  if (!objectPatternBindsExactly(creator.params[0], [
    'cleanupGraceMs', 'processId', 'processTreeKiller',
  ], {
    topLevelDefault: true,
    propertyDefaults: {
      cleanupGraceMs: (value) => literal(value, 250),
    },
    requiredPropertyDefaults: ['cleanupGraceMs'],
  })
    || functionHasNestedBinding(creator, [
      'cleanupGraceMs', 'processId', 'processTreeKiller', 'Math', 'Number', 'Promise',
      'clearTimeout', 'setTimeout', 'WeakMap',
    ])
    || functionHasIdentifierWrite(creator, [
      'cleanupGraceMs', 'processId', 'processTreeKiller', 'Math', 'Number', 'Promise',
      'clearTimeout', 'setTimeout', 'WeakMap',
    ])
    || functionHasMemberWrite(creator, [['flights']])) return false;
  const flights = directDeclarator(creator.body, 'flights', 'const');
  if (!flights || !construct(flights.declaration.init, 'WeakMap', [])) return false;
  const returns = creator.body.body.filter((statement) => statement.type === 'ReturnStatement');
  if (returns.length !== 1) return false;
  const terminator = unwrap(returns[0].argument);
  const timeoutBindingNames = ['requestedCleanupGraceMs', 'boundedCleanupGraceMs'];
  if (terminator?.type !== 'ArrowFunctionExpression'
    || !exactParameterList(terminator, [
      (value) => identifier(value, 'target'),
      (value) => defaultedIdentifierParameter(
        value, 'reason', (fallback) => literal(fallback, 'terminated'),
      ),
    ])
    || terminator.body?.type !== 'BlockStatement'
    || functionHasNestedBinding(terminator, [
      'cleanupGraceMs', 'flights', 'processId', 'processTreeKiller', 'Math', 'Number',
      'Promise', 'clearTimeout', 'reason', 'setTimeout', 'target', 'WeakMap',
      ...timeoutBindingNames,
    ], { allowedDirectBindings: timeoutBindingNames })
    || functionHasIdentifierWrite(terminator, [
      'cleanupGraceMs', 'flights', 'processId', 'processTreeKiller', 'Math', 'Number',
      'Promise', 'clearTimeout', 'reason', 'setTimeout', 'target', 'WeakMap',
      ...timeoutBindingNames,
    ])
    || !safeTimerTimeoutBinding(terminator, {
      sourceName: 'cleanupGraceMs', requestedName: 'requestedCleanupGraceMs',
      boundedName: 'boundedCleanupGraceMs', maximum: 2_147_483_647,
    })) return false;
  const body = terminator.body;
  const targetGuard = body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && unary(statement.test, '!', (value) => identifier(value, 'target'))
    && exactReturn(statement.consequent, (value) => call(value, ['Promise', 'resolve'], [
      (entry) => literal(entry, false),
    ]))
  ));
  const existing = directDeclarator(body, 'existing', 'const');
  const existingGuard = body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && identifier(statement.test, 'existing')
    && exactReturn(statement.consequent, (value) => identifier(value, 'existing'))
  ));
  const pid = directDeclarator(body, 'pid', 'const');
  const cleanup = directDeclarator(body, 'cleanup', 'const');
  const flight = directDeclarator(body, 'flight', 'const');
  if (targetGuard.length !== 1 || !existing
    || !call(existing.declaration.init, ['flights', 'get'], [(value) => identifier(value, 'target')])
    || existingGuard.length !== 1 || !pid
    || !call(pid.declaration.init, ['processId'], [
      (value) => member(value, ['target', 'pid']),
    ]) || !cleanup || !flight) return false;
  const requestedCleanupGraceMs = directDeclarator(
    body, 'requestedCleanupGraceMs', 'const',
  );
  const boundedCleanupGraceMs = directDeclarator(
    body, 'boundedCleanupGraceMs', 'const',
  );
  if (!directStatementsOrderedAndReachable(body, [
    targetGuard[0], existing.statement, existingGuard[0],
    requestedCleanupGraceMs.statement, boundedCleanupGraceMs.statement, pid.statement,
  ])) return false;

  const cleanupChain = unwrap(cleanup.declaration.init);
  const legacyCleanup = cleanupChain?.type === 'CallExpression'
    && methodCall(
      cleanupChain,
      'then',
      (receiver) => call(receiver, ['Promise', 'resolve'], []),
      [(callback) => exactIdentifierParameters(unwrap(callback), [])
        && arrowCallsExactly(callback, ['processTreeKiller'], [
          (value) => identifier(value, 'pid'),
          (value) => exactObject(value, { reason: (entry) => identifier(entry, 'reason') }),
        ])],
    )
    && cleanupChain.arguments.length === 1;
  if (!legacyCleanup && !currentTerminationCleanup(cleanupChain)) return false;

  const flightChain = unwrap(flight.declaration.init);
  if (flightChain?.type !== 'CallExpression'
    || !methodCall(
      flightChain,
      'then',
      (receiver) => call(receiver, ['Promise', 'race']),
      null,
    )
    || flightChain.arguments.length !== 1) return false;
  const race = unwrap(flightChain.callee.object);
  if (!call(race, ['Promise', 'race']) || race.arguments.length !== 1
    || race.arguments[0]?.type !== 'ArrayExpression'
    || race.arguments[0].elements.length !== 2
    || !identifier(race.arguments[0].elements[0], 'cleanup')
    || !(graceTimerPromise(race.arguments[0].elements[1], 'boundedCleanupGraceMs')
      || (identifier(race.arguments[0].elements[1], 'deadline')
        && currentTerminationDeadline(body, 'boundedCleanupGraceMs')))) return false;
  const afterRace = unwrap(flightChain.arguments[0]);
  const legacyAfterRace = afterRace?.type === 'ArrowFunctionExpression'
    && exactIdentifierParameters(afterRace, [])
    && afterRace.body?.type === 'BlockStatement'
    && afterRace.body.body.length === 2
    && directCallStatement(afterRace.body.body[0], ['target', 'kill'], [])
    && exactReturn(afterRace.body.body[1], (value) => literal(value, true));
  if (!legacyAfterRace && !currentTerminationAfterRace(afterRace)) return false;

  const sets = body.body.filter((statement) => directCallStatement(statement, ['flights', 'set'], [
    (value) => identifier(value, 'target'),
    (value) => identifier(value, 'flight'),
  ]));
  const finalizers = body.body.filter((statement) => {
    if (statement.type !== 'ExpressionStatement') return false;
    const expression = unwrap(statement.expression);
    if (expression?.type !== 'UnaryExpression' || expression.operator !== 'void') return false;
    const finallyCall = unwrap(expression.argument);
    return call(finallyCall, ['flight', 'finally'])
      && finallyCall.arguments.length === 1
      && exactIdentifierParameters(unwrap(finallyCall.arguments[0]), [])
      && arrowCallsExactly(finallyCall.arguments[0], ['flights', 'delete'], [
        (value) => identifier(value, 'target'),
      ]);
  });
  const finalReturns = body.body.filter((statement) => exactReturn(
    statement, (value) => identifier(value, 'flight'),
  ));
  return sets.length === 1 && finalizers.length === 1 && finalReturns.length === 1
    && directStatementsOrderedAndReachable(body, [sets[0], finalizers[0], finalReturns[0]]);
}

function supervisorMessageAstContract(source) {
  const program = parseProgram(source);
  const event = topFunction(program, 'handleExecutionWorkerEventMessage');
  const observer = topFunction(program, 'handleExecutionWorkerObserverMessage');
  if (!event || !observer
    || !stableProgramIdentifiers(program, [
      'Error', 'dispatchExecutionEvent', 'handleExecutionWorkerEventMessage',
      'handleExecutionWorkerObserverMessage', 'isReservedExecutionWorkerObserverCallback',
    ], { globals: ['Error'] })
    || !exactParameterList(event, [
      (value) => identifier(value, 'message'),
      (value) => objectPatternBindsExactly(value, [
        'pending', 'postBrokerResult', 'terminateChild', 'child',
      ]),
    ])
    || !exactParameterList(observer, [
      (value) => identifier(value, 'message'),
      (value) => objectPatternBindsExactly(value, ['pending']),
    ])
    || functionHasNestedBinding(event, [
      'child', 'dispatchExecutionEvent', 'Error', 'message', 'pending',
      'postBrokerResult', 'terminateChild',
    ])
    || functionHasIdentifierWrite(event, [
      'child', 'dispatchExecutionEvent', 'Error', 'message', 'pending',
      'postBrokerResult', 'terminateChild',
    ])
    || functionHasNestedBinding(observer, [
      'isReservedExecutionWorkerObserverCallback', 'message', 'pending',
    ])
    || functionHasIdentifierWrite(observer, [
      'isReservedExecutionWorkerObserverCallback', 'message', 'pending',
    ])
    || functionHasMemberWrite(event, [['pending']])
    || functionHasMemberWrite(observer, [['pending']])) return false;
  const item = directDeclarator(event.body, 'item', 'const');
  const guard = event.body.body.filter((statement) => (
    statement.type === 'IfStatement' && exactItemGuard(statement.test)
    && bareReturn(statement.consequent)
  ));
  const sequence = event.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && binary(
      statement.test, '<=',
      (value) => member(value, ['message', 'sequence']),
      (value) => member(value, ['item', 'lastSequence']),
    )
  ));
  if (!item || !call(item.declaration.init, ['pending', 'get'], [
    (value) => member(value, ['message', 'requestId']),
  ]) || guard.length !== 1 || sequence.length !== 1
    || sequence[0].consequent?.type !== 'BlockStatement') return false;
  const sequenceBody = sequence[0].consequent.body;
  const error = sequenceBody[0]?.type === 'VariableDeclaration'
    ? sequenceBody[0].declarations.find((declaration) => identifier(declaration.id, 'error')) : null;
  const codeAssignment = unwrap(sequenceBody[1]?.expression);
  const hasTypedCode = sequenceBody.length === 6
    && sequenceBody[1]?.type === 'ExpressionStatement'
    && codeAssignment?.type === 'AssignmentExpression'
    && codeAssignment.operator === '='
    && member(codeAssignment.left, ['error', 'code'])
    && literal(codeAssignment.right, 'execution_worker_sequence_violation');
  const actionOffset = hasTypedCode ? 1 : 0;
  const expectedDeleteStatement = sequenceBody[1 + actionOffset];
  const expectedDeleteCall = unwrap(expectedDeleteStatement?.expression);
  const eventPendingMutations = protectedCollectionMutationCalls(
    event,
    ['pending'],
    ['clear', 'delete'],
  );
  const observerPendingMutations = protectedCollectionMutationCalls(
    observer,
    ['pending'],
    ['clear', 'delete'],
  );
  if (![5, 6].includes(sequenceBody.length) || (sequenceBody.length === 6 && !hasTypedCode)
    || !error || !construct(error.init, 'Error')
    || !directCallStatement(expectedDeleteStatement, ['pending', 'delete'], [
      (value) => member(value, ['message', 'requestId']),
    ])
    || eventPendingMutations.length !== 1
    || eventPendingMutations[0].method !== 'delete'
    || eventPendingMutations[0].node !== expectedDeleteCall
    || observerPendingMutations.length !== 0
    || !directCallStatement(sequenceBody[2 + actionOffset], ['item', 'reject'], [
      (value) => identifier(value, 'error'),
    ])
    || !directCallStatement(sequenceBody[3 + actionOffset], ['terminateChild'], [
      (value) => identifier(value, 'child'),
      (value) => literal(value, 'sequence-violation'),
    ])
    || !bareReturn(sequenceBody[4 + actionOffset])) return false;
  const dispatches = event.body.body.filter((statement) => directCallStatement(
    statement,
    ['dispatchExecutionEvent'],
    [
      (value) => identifier(value, 'item'),
      (value) => identifier(value, 'message'),
      (value) => identifier(value, 'postBrokerResult'),
    ],
  ));

  const observerItem = directDeclarator(observer.body, 'item', 'const');
  const observerGuard = observer.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && logical(
      statement.test,
      '||',
      exactItemGuard,
      (right) => exactNotCall(right, ['isReservedExecutionWorkerObserverCallback'], [
        (value) => member(value, ['message', 'payload', 'callback']),
      ]),
    )
    && bareReturn(statement.consequent)
  ));
  const observerEvents = observer.body.body.filter((statement) => directCallStatement(
    statement, ['item', 'onEvent'], [(value) => identifier(value, 'message')],
  ));
  return dispatches.length === 1
    && observerItem
    && call(observerItem.declaration.init, ['pending', 'get'], [
      (value) => member(value, ['message', 'requestId']),
    ])
    && observerGuard.length === 1
    && observerEvents.length === 1
    && directStatementsOrderedAndReachable(event.body, [
      item.statement, guard[0], sequence[0], dispatches[0],
    ])
    && directStatementsOrderedAndReachable(observer.body, [
      observerItem.statement, observerGuard[0], observerEvents[0],
    ]);
}

function localArrow(block, name) {
  const binding = directDeclarator(block, name, 'const');
  const value = unwrap(binding?.declaration?.init);
  return value?.type === 'ArrowFunctionExpression' ? value : null;
}

function exactSupervisorHandlerBranch(statement, operation, helper, expectedObject) {
  if (statement?.type !== 'IfStatement'
    || !exactOperation(statement.test, '===', operation)
    || statement.consequent?.type !== 'BlockStatement'
    || statement.consequent.body.length !== 2) return false;
  return directCallStatement(statement.consequent.body[0], [helper], [
    (value) => identifier(value, 'message'),
    (value) => exactObject(value, expectedObject),
  ]) && bareReturn(statement.consequent.body[1]);
}

function supervisorAstContract(source) {
  const program = parseProgram(source);
  const creator = topFunction(program, 'createExecutionWorkerSupervisor');
  const rejectPendingHelper = topFunction(program, 'rejectPending');
  const exitFailureHelper = topFunction(program, 'executionWorkerExitFailure');
  if (!creator || !exactIdentifierParameters(creator, [])
    || !exactTopLevelRequireBinding(
      program,
      'createExecutionWorkerRequestSettlement',
      'createExecutionWorkerRequestSettlement',
      './execution-worker-cancellation.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'createExecutionWorkerTerminator',
      'createExecutionWorkerTerminator',
      './execution-worker-termination.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'handleExecutionWorkerEventMessage',
      'handleExecutionWorkerEventMessage',
      './execution-worker-supervisor-message.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'handleExecutionWorkerObserverMessage',
      'handleExecutionWorkerObserverMessage',
      './execution-worker-supervisor-message.cjs',
    )
    || !stableProgramIdentifiers(program, [
      'Promise', 'cancellationTimeoutMs', 'createChild',
      'createExecutionWorkerRequestSettlement', 'createExecutionWorkerSupervisor',
      'createExecutionWorkerTerminator', 'deadlineMs', 'executionWorkerExitFailure',
      'handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage',
      'isExecutionWorkerTerminalOperation', 'postBrokerResult', 'processId',
      'processTreeKiller', 'rejectPending',
    ], { globals: ['Promise'] })
    || !exactProtectedIdentifierParameters(rejectPendingHelper, ['error'])
    || !exactProtectedIdentifierParameters(exitFailureHelper, ['code', 'signal'])
    || functionHasNestedBinding(creator, [
    'createExecutionWorkerRequestSettlement', 'createExecutionWorkerTerminator',
    'handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage',
    'cancellationTimeoutMs', 'createChild', 'deadlineMs',
    'isExecutionWorkerTerminalOperation', 'postBrokerResult', 'processId',
    'processTreeKiller', 'rejectPending', 'executionWorkerExitFailure',
  ])
    || functionHasIdentifierWrite(creator, [
      'createExecutionWorkerRequestSettlement', 'createExecutionWorkerTerminator',
      'handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage',
      'cancellationTimeoutMs', 'createChild', 'deadlineMs',
      'isExecutionWorkerTerminalOperation', 'postBrokerResult', 'processId',
      'processTreeKiller', 'rejectPending', 'executionWorkerExitFailure',
    ])
    || functionHasNestedBinding(creator, ['child', 'pending'], {
      allowedDirectBindings: ['child', 'pending'],
    })
    || functionHasIdentifierWrite(creator, [
      'pending', 'terminateChild', 'terminateOwnedChild',
    ])
    || countAssignments(creator, (left) => patternNames(left).includes('child')) !== 1) return false;
  const terminateOwnedChild = directDeclarator(creator.body, 'terminateOwnedChild', 'const');
  if (!terminateOwnedChild || !call(
    terminateOwnedChild.declaration.init,
    ['createExecutionWorkerTerminator'],
    [(value) => exactObject(value, {
      processId: (entry) => identifier(entry, 'processId'),
      processTreeKiller: (entry) => identifier(entry, 'processTreeKiller'),
      cleanupGraceMs: (entry) => literal(entry, 250),
    })],
  )) return false;
  const terminateChild = localArrow(creator.body, 'terminateChild');
  const onMessage = localArrow(creator.body, 'onMessage');
  const request = localArrow(creator.body, 'request');
  const stop = localArrow(creator.body, 'stop');
  const onExit = localArrow(creator.body, 'onExit');
  if (!terminateChild || !onMessage || !request || !stop || !onExit
    || !exactParameterList(terminateChild, [
      (value) => defaultedIdentifierParameter(value, 'target', (fallback) => identifier(fallback, 'child')),
      (value) => defaultedIdentifierParameter(
        value, 'reason', (fallback) => literal(fallback, 'terminated'),
      ),
    ])
    || !exactIdentifierParameters(onMessage, ['message'])
    || !exactIdentifierParameters(request, ['operation', 'requestId'])
    || !exactIdentifierParameters(stop, [])
    || !exactIdentifierParameters(onExit, ['code', 'signal'])
    || !arrowCallsExactly(terminateChild, ['terminateOwnedChild'], [
      (value) => identifier(value, 'target'),
      (value) => identifier(value, 'reason'),
    ])
    || functionHasNestedBinding(terminateChild, [
      'child', 'reason', 'target', 'terminateOwnedChild',
    ])
    || functionHasIdentifierWrite(terminateChild, [
      'child', 'reason', 'target', 'terminateOwnedChild',
    ])
    || functionHasNestedBinding(onMessage, [
      'child', 'handleExecutionWorkerEventMessage',
      'handleExecutionWorkerObserverMessage', 'isExecutionWorkerTerminalOperation',
      'message', 'pending', 'postBrokerResult', 'terminateChild',
    ])
    || functionHasIdentifierWrite(onMessage, [
      'child', 'handleExecutionWorkerEventMessage',
      'handleExecutionWorkerObserverMessage', 'isExecutionWorkerTerminalOperation',
      'message', 'pending', 'postBrokerResult', 'terminateChild',
    ])
    || functionHasNestedBinding(request, [
      'cancellationTimeoutMs', 'child', 'createExecutionWorkerRequestSettlement',
      'deadlineMs', 'operation', 'pending', 'Promise', 'requestId', 'terminateChild',
    ])
    || functionHasIdentifierWrite(request, [
      'cancellationTimeoutMs', 'child', 'createExecutionWorkerRequestSettlement',
      'deadlineMs', 'operation', 'pending', 'Promise', 'requestId', 'terminateChild',
    ])
    || functionHasNestedBinding(onExit, [
      'code', 'executionWorkerExitFailure', 'rejectPending', 'signal',
    ])
    || functionHasIdentifierWrite(onExit, [
      'code', 'executionWorkerExitFailure', 'rejectPending', 'signal',
    ])
    || functionHasNestedBinding(stop, ['terminateChild'])
    || functionHasIdentifierWrite(stop, ['terminateChild'])) return false;

  const eventBranches = onMessage.body.body.filter((statement) => exactSupervisorHandlerBranch(
    statement, 'execution.event', 'handleExecutionWorkerEventMessage', {
      pending: (value) => identifier(value, 'pending'),
      postBrokerResult: (value) => identifier(value, 'postBrokerResult'),
      terminateChild: (value) => identifier(value, 'terminateChild'),
      child: (value) => identifier(value, 'child'),
    },
  ));
  const observerBranches = onMessage.body.body.filter((statement) => exactSupervisorHandlerBranch(
    statement, 'execution.observer', 'handleExecutionWorkerObserverMessage', {
      pending: (value) => identifier(value, 'pending'),
    },
  ));
  const terminalBranches = onMessage.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && call(statement.test, ['isExecutionWorkerTerminalOperation'], [
      (value) => member(value, ['message', 'operation']),
    ])
  ));
  if (eventBranches.length !== 1 || observerBranches.length !== 1
    || terminalBranches.length !== 1 || terminalBranches[0].consequent?.type !== 'BlockStatement') return false;
  const terminal = terminalBranches[0].consequent;
  const terminalItem = directDeclarator(terminal, 'item', 'const');
  if (!terminalItem || !call(terminalItem.declaration.init, ['pending', 'get'], [
    (value) => member(value, ['message', 'requestId']),
  ]) || terminal.body.length !== 5
    || terminal.body[1]?.type !== 'IfStatement'
    || !exactItemGuard(terminal.body[1].test)
    || !bareReturn(terminal.body[1].consequent)
    || !directCallStatement(terminal.body[2], ['pending', 'delete'], [
      (value) => member(value, ['message', 'requestId']),
    ])
    || !directCallStatement(terminal.body[3], ['item', 'resolve'], [
      (value) => identifier(value, 'message'),
    ])
    || !bareReturn(terminal.body[4])) return false;
  if (!directStatementsOrderedAndReachable(onMessage.body, [
    eventBranches[0], observerBranches[0], terminalBranches[0],
  ])) return false;

  if (request.body?.type !== 'NewExpression'
    || !identifier(request.body.callee, 'Promise')
    || request.body.arguments.length !== 1) return false;
  const executor = unwrap(request.body.arguments[0]);
  if (executor?.type !== 'ArrowFunctionExpression' || executor.body?.type !== 'BlockStatement'
    || !exactIdentifierParameters(executor, ['resolveRequest', 'reject'])
    || functionHasNestedBinding(executor, [
      'createExecutionWorkerRequestSettlement', 'pending', 'reject', 'requestId', 'resolveRequest',
    ])
    || functionHasIdentifierWrite(executor, [
      'createExecutionWorkerRequestSettlement', 'pending', 'reject', 'requestId', 'resolveRequest',
    ])) return false;
  const settlement = directDeclarator(executor.body, 'settlement', 'const');
  const settlementCall = unwrap(settlement?.declaration?.init);
  const settlementOptions = unwrap(settlementCall?.arguments?.[0]);
  const legacySettlement = settlementCall?.type === 'CallExpression'
    && call(settlementCall, ['createExecutionWorkerRequestSettlement'])
    && settlementCall.arguments.length === 1
    && exactObject(settlementOptions, {
      child: (entry) => identifier(entry, 'child'),
      operation: (entry) => identifier(entry, 'operation'),
      deadlineMs: (entry) => identifier(entry, 'deadlineMs'),
      cancellationTimeoutMs: (entry) => identifier(entry, 'cancellationTimeoutMs'),
      terminateChild: (entry) => identifier(entry, 'terminateChild'),
      onDeadline: (entry) => exactIdentifierParameters(unwrap(entry), [])
        && arrowCallsExactly(entry, ['pending', 'delete'], [
          (argument) => identifier(argument, 'requestId'),
        ]),
      resolve: (entry) => identifier(entry, 'resolveRequest'),
      reject: (entry) => identifier(entry, 'reject'),
    });
  const deadlineSpreadSettlement = settlementCall?.type === 'CallExpression'
    && call(settlementCall, ['createExecutionWorkerRequestSettlement'])
    && settlementCall.arguments.length === 1
    && settlementOptions?.properties?.length === 10
    && exactTopLevelRequireBinding(
      program,
      'createExecutionWorkerDeadlineCallbacks',
      'createExecutionWorkerDeadlineCallbacks',
      './execution-worker-deadline.cjs',
    )
    && objectIncludesExactProperties(settlementOptions, {
      child: (entry) => identifier(entry, 'child'),
      operation: (entry) => identifier(entry, 'operation'),
      deadlineMs: (entry) => identifier(entry, 'deadlineMs'),
      cancellationTimeoutMs: (entry) => identifier(entry, 'cancellationTimeoutMs'),
      deadlineCancellationTimeoutMs: (entry) => identifier(entry, 'deadlineCancelGraceMs'),
      terminateChild: (entry) => identifier(entry, 'terminateChild'),
      resolve: (entry) => identifier(entry, 'resolveRequest'),
      reject: (entry) => identifier(entry, 'reject'),
      now: (entry) => identifier(entry, 'now'),
    }, {
      allowedSpreads: [(entry) => call(entry, ['createExecutionWorkerDeadlineCallbacks'], [
        (value) => exactObject(value, {
          operation: (item) => identifier(item, 'operation'),
          requestId: (item) => identifier(item, 'requestId'),
          message: (item) => identifier(item, 'message'),
          pending: (item) => identifier(item, 'pending'),
          child: (item) => identifier(item, 'child'),
          terminateChild: (item) => identifier(item, 'terminateChild'),
          now: (item) => identifier(item, 'now'),
          graceMs: (item) => identifier(item, 'deadlineCancelGraceMs'),
        }),
      ])],
    });
  if (!settlement || (!legacySettlement && !deadlineSpreadSettlement)) return false;
  const pendingSets = executor.body.body.filter((statement) => directCallStatement(
    statement,
    ['pending', 'set'],
    [(value) => identifier(value, 'requestId'), (value) => identifier(value, 'settlement')],
  ));
  if (pendingSets.length !== 1
    || !directStatementsOrderedAndReachable(executor.body, [settlement.statement, pendingSets[0]])) {
    return false;
  }

  if (stop.body?.type !== 'BlockStatement') return false;
  const stoppedChild = directDeclarator(stop.body, 'stoppedChild', 'const');
  const stopCalls = stop.body.body.filter((statement) => directCallStatement(
    statement,
    ['terminateChild'],
    [(value) => identifier(value, 'stoppedChild'), (value) => literal(value, 'stop')],
    { await_: true },
  ));
  if (!stoppedChild || !identifier(stoppedChild.declaration.init, 'child') || stopCalls.length !== 1
    || !directStatementsOrderedAndReachable(stop.body, [stoppedChild.statement, stopCalls[0]])) return false;
  const api = returnedObject(creator);
  return Boolean(api && exactObject(api, {
    onExit: (value) => identifier(value, 'onExit'),
    onMessage: (value) => identifier(value, 'onMessage'),
    request: (value) => identifier(value, 'request'),
    stop: (value) => identifier(value, 'stop'),
  }));
}

function currentSupervisorIdentityMatcher(node) {
  node = unwrap(node);
  if (node?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(node, ['candidate'])) return false;
  const terms = [];
  const collect = (entry) => {
    entry = unwrap(entry);
    if (entry?.type === 'LogicalExpression' && entry.operator === '&&') {
      collect(entry.left);
      collect(entry.right);
    } else {
      terms.push(entry);
    }
  };
  collect(node.body);
  const fields = [
    'principalId', 'serverScope', 'runtimeGeneration',
    'ownershipGeneration', 'sessionId', 'turnId',
  ];
  return terms.length === fields.length && fields.every((field) => (
    terms.filter((term) => binary(
      term,
      '===',
      (left) => member(left, ['candidate', field]),
      (right) => member(right, ['message', field]),
    )).length === 1
  ));
}

function exactSupervisorDecodeFailureLog(statement) {
  if (statement?.type !== 'ExpressionStatement') return false;
  return call(statement.expression, ['logger', 'error'], [
    (value) => literal(value, '[execution-worker] rejected message'),
    (value) => exactObject(value, {
      code: (entry) => member(entry, ['error', 'code']),
    }),
  ]);
}

function exactSupervisorDecodeFailureTermination(statement, { allowReturn = false } = {}) {
  const argumentMatchers = [
    (value) => identifier(value, 'child'),
    (value) => literal(value, 'message-validation-failed'),
  ];
  return directCallStatement(
    statement,
    ['terminateChild'],
    argumentMatchers,
    { void_: true },
  ) || (allowReturn && exactReturn(
    statement,
    (value) => call(value, ['terminateChild'], argumentMatchers),
  ));
}

function supervisorDecodeFailureCatchContract(handler) {
  if (handler?.type !== 'CatchClause'
    || !identifier(handler.param, 'error')
    || handler.body?.type !== 'BlockStatement'
    || functionHasNestedBinding({ body: handler.body }, [
      'child', 'error', 'logger', 'terminateChild',
    ])
    || functionHasIdentifierWrite({ body: handler.body }, [
      'child', 'error', 'logger', 'terminateChild',
    ])) return false;

  let directChildKill = false;
  visit(handler.body, (node) => {
    if (directChildKill || unwrap(node)?.type !== 'CallExpression') return;
    if (staticMemberPath(unwrap(node).callee).join('.') === 'child.kill') directChildKill = true;
  });
  if (directChildKill) return false;

  const statements = handler.body.body;
  const logAttempt = statements[0];
  if (logAttempt?.type !== 'TryStatement'
    || logAttempt.block?.body?.length !== 1
    || !exactSupervisorDecodeFailureLog(logAttempt.block.body[0])
    || !directStatementReachable(logAttempt.block, logAttempt.block.body[0])) return false;

  if (!logAttempt.handler && logAttempt.finalizer) {
    const finalizer = logAttempt.finalizer;
    return statements.length === 2
      && finalizer.body.length === 1
      && exactSupervisorDecodeFailureTermination(finalizer.body[0])
      && bareReturn(statements[1])
      && directStatementReachable(finalizer, finalizer.body[0])
      && directStatementsOrderedAndReachable(handler.body, [logAttempt, statements[1]]);
  }

  if (!logAttempt.handler || logAttempt.finalizer
    || logAttempt.handler.param !== null
    || logAttempt.handler.body?.body?.length !== 0) return false;
  if (statements.length === 2) {
    return statements[1].type === 'ReturnStatement'
      && exactSupervisorDecodeFailureTermination(statements[1], { allowReturn: true })
      && directStatementsOrderedAndReachable(handler.body, statements);
  }
  return statements.length === 3
    && exactSupervisorDecodeFailureTermination(statements[1])
    && bareReturn(statements[2])
    && directStatementsOrderedAndReachable(handler.body, statements);
}

function heartbeatElapsedComparison(node, tickName, boundedName) {
  return binary(
    node,
    '<',
    (left) => binary(
      left,
      '-',
      (entry) => call(entry, ['clock'], []),
      (entry) => identifier(entry, tickName),
    ),
    (right) => identifier(right, boundedName),
  );
}

function heartbeatWatchdogAstContract(source) {
  const program = parseProgram(source);
  const creator = topFunction(program, 'createExecutionWorkerHeartbeatWatchdog');
  if (!creator || !exactParameterList(creator, [
    (value) => objectPatternBindsExactly(value, [
      'now', 'clock', 'timeoutMs', 'confirmationMs', 'isReady',
      'shouldDeferTimeout', 'onTimeout',
    ], {
      propertyDefaults: {
        clock: (entry) => identifier(entry, 'now'),
        shouldDeferTimeout: (entry) => {
          entry = unwrap(entry);
          return entry?.type === 'ArrowFunctionExpression'
            && exactIdentifierParameters(entry, [])
            && literal(entry.body, false);
        },
      },
      requiredPropertyDefaults: ['clock', 'shouldDeferTimeout'],
    }),
  ])
    || !stableProgramIdentifiers(program, [
      'Math', 'Number', 'Object', 'clearImmediate', 'clearTimeout',
      'createExecutionWorkerHeartbeatWatchdog', 'setImmediate', 'setTimeout',
    ], {
      globals: [
        'Math', 'Number', 'Object', 'clearImmediate', 'clearTimeout',
        'setImmediate', 'setTimeout',
      ],
    })) return false;

  const boundedNames = [
    'requestedHeartbeatTimeoutMs', 'boundedHeartbeatTimeoutMs',
    'requestedHeartbeatConfirmationMs', 'boundedHeartbeatConfirmationMs',
  ];
  const protectedNames = [
    'clock', 'confirmationMs', 'isReady', 'now', 'onTimeout',
    'shouldDeferTimeout', 'timeoutMs', 'Math', 'Number', 'setImmediate', 'setTimeout',
    ...boundedNames,
  ];
  if (functionHasNestedBinding(creator, protectedNames, { allowedDirectBindings: boundedNames })
    || functionHasIdentifierWrite(creator, protectedNames)
    || !safeTimerTimeoutBinding(creator, {
      sourceName: 'timeoutMs', requestedName: 'requestedHeartbeatTimeoutMs',
      boundedName: 'boundedHeartbeatTimeoutMs', maximum: 2_147_483_646,
      fallback: 15_000,
    })
    || !safeTimerTimeoutBinding(creator, {
      sourceName: 'confirmationMs', requestedName: 'requestedHeartbeatConfirmationMs',
      boundedName: 'boundedHeartbeatConfirmationMs', maximum: 2_147_483_646,
      fallback: 15_000,
    })) return false;

  const scheduleBinding = directDeclarator(creator.body, 'schedule', 'const');
  const schedule = unwrap(scheduleBinding?.declaration?.init);
  const observeBinding = directDeclarator(creator.body, 'observe', 'const');
  const observe = unwrap(observeBinding?.declaration?.init);
  if (!scheduleBinding || schedule?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(schedule, []) || schedule.body?.type !== 'BlockStatement'
    || schedule.body.body.length !== 2
    || !directCallStatement(schedule.body.body[0], ['clear'], [])
    || !observeBinding || observe?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(observe, []) || observe.body?.type !== 'BlockStatement') return false;

  const timerAssignment = unwrap(schedule.body.body[1]?.expression);
  const timerCall = unwrap(timerAssignment?.right);
  if (schedule.body.body[1]?.type !== 'ExpressionStatement'
    || timerAssignment?.type !== 'AssignmentExpression' || timerAssignment.operator !== '='
    || !identifier(timerAssignment.left, 'timer')
    || !call(timerCall, ['setTimeout']) || timerCall.arguments.length !== 2
    || !binary(
      timerCall.arguments[1],
      '+',
      (left) => {
        left = unwrap(left);
        return left?.type === 'ConditionalExpression'
          && binary(
            left.test,
            '===',
            (entry) => identifier(entry, 'suspectAt'),
            (entry) => literal(entry, null),
          )
          && identifier(left.consequent, 'boundedHeartbeatTimeoutMs')
          && identifier(left.alternate, 'boundedHeartbeatConfirmationMs');
      },
      (right) => literal(right, 1),
    )) return false;
  const timerCallback = unwrap(timerCall.arguments[0]);
  if (timerCallback?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(timerCallback, [])
    || timerCallback.body?.type !== 'BlockStatement') return false;

  const timeoutComparisons = [];
  const confirmationComparisons = [];
  const recursiveScheduleReturns = [];
  const timeoutCalls = [];
  const immediateCalls = [];
  visit(creator.body, (node) => {
    if (heartbeatElapsedComparison(
      node, 'lastActivityTick', 'boundedHeartbeatTimeoutMs',
    )) timeoutComparisons.push(node);
    if (heartbeatElapsedComparison(
      node, 'suspectAt', 'boundedHeartbeatConfirmationMs',
    )) confirmationComparisons.push(node);
    if (exactReturn(node, (value) => call(value, ['schedule'], []))) {
      recursiveScheduleReturns.push(node);
    }
    if (call(node, ['setTimeout'])) timeoutCalls.push(node);
    if (call(node, ['setImmediate'])) immediateCalls.push(node);
  });
  if (timeoutComparisons.length !== 2 || confirmationComparisons.length !== 1
    || recursiveScheduleReturns.length !== 4
    || timeoutCalls.length !== 1 || timeoutCalls[0] !== timerCall
    || immediateCalls.length !== 1) return false;

  const confirmationAssignments = timerCallback.body.body.filter((statement) => {
    const expression = unwrap(statement?.expression);
    return statement?.type === 'ExpressionStatement'
      && expression?.type === 'AssignmentExpression' && expression.operator === '='
      && identifier(expression.left, 'confirmation')
      && call(expression.right, ['setImmediate']);
  });
  if (confirmationAssignments.length !== 1
    || unwrap(confirmationAssignments[0].expression).right !== immediateCalls[0]
    || !directStatementReachable(timerCallback.body, confirmationAssignments[0])) return false;

  const observeSchedules = observe.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && call(statement.test, ['isReady'], [])
    && directCallStatement(statement.consequent, ['schedule'], [])
  ));
  const requestedTimeout = directDeclarator(
    creator.body, 'requestedHeartbeatTimeoutMs', 'const',
  );
  const boundedTimeout = directDeclarator(
    creator.body, 'boundedHeartbeatTimeoutMs', 'const',
  );
  const requestedConfirmation = directDeclarator(
    creator.body, 'requestedHeartbeatConfirmationMs', 'const',
  );
  const boundedConfirmation = directDeclarator(
    creator.body, 'boundedHeartbeatConfirmationMs', 'const',
  );
  return observeSchedules.length === 1
    && directStatementsOrderedAndReachable(creator.body, [
      requestedTimeout.statement, boundedTimeout.statement,
      requestedConfirmation.statement, boundedConfirmation.statement,
      scheduleBinding.statement, observeBinding.statement,
    ]);
}

function currentSupervisorAstContract(source, lifecycleSource) {
  const program = parseProgram(source);
  const creator = topFunction(program, 'createExecutionWorkerSupervisor');
  if (!heartbeatWatchdogAstContract(lifecycleSource)
    || !creator || !exactParameterList(creator, [
    (value) => objectPatternIncludesExactBindings(value, {
      enabled: (entry) => defaultedIdentifierParameter(
        entry, 'enabled', (fallback) => literal(fallback, true),
      ),
      fork: (entry) => identifier(entry, 'fork'),
      entry: (entry) => defaultedIdentifierParameter(
        entry, 'entry', (fallback) => identifier(fallback, 'DEFAULT_ENTRY'),
      ),
      now: (entry) => defaultedIdentifierParameter(
        entry, 'now', (fallback) => member(fallback, ['Date', 'now']),
      ),
      startupTimeoutMs: (entry) => defaultedIdentifierParameter(
        entry, 'startupTimeoutMs', (fallback) => literal(fallback, 10_000),
      ),
      restartDelayMs: (entry) => defaultedIdentifierParameter(
        entry, 'restartDelayMs', (fallback) => literal(fallback, 250),
      ),
      cancellationTimeoutMs: (entry) => defaultedIdentifierParameter(
        entry, 'cancellationTimeoutMs', (fallback) => literal(fallback, 5_000),
      ),
      maxPendingRequests: (entry) => defaultedIdentifierParameter(
        entry, 'maxPendingRequests', (fallback) => literal(fallback, 32),
      ),
      maxRestarts: (entry) => defaultedIdentifierParameter(
        entry, 'maxRestarts', (fallback) => literal(fallback, 2),
      ),
      onInteractionRequest: (entry) => identifier(entry, 'onInteractionRequest'),
      onCapabilityRequest: (entry) => identifier(entry, 'onCapabilityRequest'),
      stripMainOwnedCapabilitiesForTest: (entry) => defaultedIdentifierParameter(
        entry, 'stripMainOwnedCapabilitiesForTest', (fallback) => literal(fallback, false),
      ),
      processTreeKiller: (entry) => defaultedIdentifierParameter(
        entry,
        'processTreeKiller',
        (fallback) => identifier(fallback, 'killExecutionWorkerProcessTree'),
      ),
      processTreeCleanupGraceMs: (entry) => defaultedIdentifierParameter(
        entry, 'processTreeCleanupGraceMs', (fallback) => literal(fallback, 250),
      ),
    }, { topLevelDefault: true }),
  ])
    || !exactTopLevelRequireBinding(
      program,
      'createEnvelope',
      'createEnvelope',
      './execution-worker-protocol.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'createExecutionWorkerRequestSettlement',
      'createExecutionWorkerRequestSettlement',
      './execution-worker-cancellation.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'createExecutionWorkerDeadlineCallbacks',
      'createExecutionWorkerDeadlineCallbacks',
      './execution-worker-deadline.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'createExecutionWorkerTerminator',
      'createExecutionWorkerTerminator',
      './execution-worker-termination.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'handleExecutionWorkerEventMessage',
      'handleExecutionWorkerEventMessage',
      './execution-worker-supervisor-message.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'handleExecutionWorkerObserverMessage',
      'handleExecutionWorkerObserverMessage',
      './execution-worker-supervisor-message.cjs',
    )
    || !stableProgramIdentifiers(program, [
      'Date', 'Map', 'Math', 'Number', 'Object', 'Promise', 'WeakMap',
      'clearTimeout', 'createEnvelope', 'setTimeout',
      'createExecutionWorkerDeadlineCallbacks',
      'createExecutionWorkerRequestSettlement', 'createExecutionWorkerSupervisor',
      'createExecutionWorkerTerminator', 'handleExecutionWorkerEventMessage',
      'handleExecutionWorkerObserverMessage',
    ], {
      globals: [
        'Date', 'Map', 'Math', 'Number', 'Object', 'Promise', 'WeakMap',
        'clearTimeout', 'setTimeout',
      ],
    })
    || functionHasNestedBinding(creator, [
      'createExecutionWorkerRequestSettlement', 'createExecutionWorkerTerminator',
      'createExecutionWorkerDeadlineCallbacks',
      'handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage',
      'deadlineCancelGraceMs', 'entry', 'fork', 'processTreeKiller',
      'processTreeCleanupGraceMs', 'restartDelayMs', 'startupTimeoutMs',
      'requestedRestartDelayMs', 'boundedRestartDelayMs',
      'requestedStartupTimeoutMs', 'boundedStartupTimeoutMs',
    ], {
      allowedDirectBindings: [
        'requestedRestartDelayMs', 'boundedRestartDelayMs',
        'requestedStartupTimeoutMs', 'boundedStartupTimeoutMs',
      ],
    })
    || functionHasIdentifierWrite(creator, [
      'createExecutionWorkerRequestSettlement', 'createExecutionWorkerTerminator',
      'createExecutionWorkerDeadlineCallbacks',
      'handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage',
      'deadlineCancelGraceMs', 'entry', 'fork', 'processTreeKiller',
      'processTreeCleanupGraceMs', 'restartDelayMs', 'startupTimeoutMs',
      'requestedRestartDelayMs', 'boundedRestartDelayMs',
      'requestedStartupTimeoutMs', 'boundedStartupTimeoutMs',
    ])
    || !safeTimerTimeoutBinding(creator, {
      sourceName: 'restartDelayMs', requestedName: 'requestedRestartDelayMs',
      boundedName: 'boundedRestartDelayMs', maximum: 2_147_483_647, fallback: 250,
    })
    || !safeTimerTimeoutBinding(creator, {
      sourceName: 'startupTimeoutMs', requestedName: 'requestedStartupTimeoutMs',
      boundedName: 'boundedStartupTimeoutMs', maximum: 2_147_483_646, fallback: 10_000,
    })) return false;

  const creatorOptions = unwrap(creator.params[0]);
  const creatorOptionPattern = creatorOptions?.type === 'AssignmentPattern'
    && exactObject(creatorOptions.right, {}) ? unwrap(creatorOptions.left) : null;
  const deadlineCancelGraceProperties = creatorOptionPattern?.type === 'ObjectPattern'
    ? creatorOptionPattern.properties.filter((property) => (
      property.type === 'Property' && property.kind === 'init' && !property.computed
      && propertyName(property) === 'deadlineCancelGraceMs'
    )) : [];
  const hasDeadlineCancelGraceOption = deadlineCancelGraceProperties.length === 1
    && defaultedIdentifierParameter(
      deadlineCancelGraceProperties[0].value,
      'deadlineCancelGraceMs',
      (fallback) => literal(fallback, 0),
    );

  const pending = directDeclarator(creator.body, 'pending', 'const');
  const child = directDeclarator(creator.body, 'child', 'let');
  const terminationCauses = directDeclarator(creator.body, 'terminationCauses', 'const');
  const terminateOwnedChild = directDeclarator(creator.body, 'terminateOwnedChild', 'const');
  const terminateChild = localArrow(creator.body, 'terminateChild');
  const onMessage = localArrow(creator.body, 'onMessage');
  const onExit = localArrow(creator.body, 'onExit');
  const start = localArrow(creator.body, 'start');
  const request = localArrow(creator.body, 'request');
  const stop = localArrow(creator.body, 'stop');
  if (!pending || !construct(pending.declaration.init, 'Map', [])
    || !child || !literal(child.declaration.init, null)
    || !terminationCauses || !construct(terminationCauses.declaration.init, 'WeakMap', [])
    || !terminateOwnedChild || !call(
      terminateOwnedChild.declaration.init,
      ['createExecutionWorkerTerminator'],
      [(value) => exactObject(value, {
        processId: (entry) => identifier(entry, 'processId'),
        processTreeKiller: (entry) => identifier(entry, 'processTreeKiller'),
        cleanupGraceMs: (entry) => identifier(entry, 'processTreeCleanupGraceMs'),
      })],
    )
    || !terminateChild || !onMessage || !onExit || !start || !request || !stop
    || !exactParameterList(terminateChild, [
      (value) => defaultedIdentifierParameter(value, 'target', (fallback) => identifier(fallback, 'child')),
      (value) => defaultedIdentifierParameter(
        value, 'reason', (fallback) => literal(fallback, 'terminated'),
      ),
    ])
    || terminateChild.body?.type !== 'BlockStatement'
    || terminateChild.body.body.length !== 2
    || terminateChild.body.body[0]?.type !== 'IfStatement'
    || !identifier(terminateChild.body.body[0].test, 'target')
    || !directCallStatement(
      terminateChild.body.body[0].consequent,
      ['terminationCauses', 'set'],
      [(value) => identifier(value, 'target'), (value) => identifier(value, 'reason')],
    )
    || !exactReturn(terminateChild.body.body[1], (value) => call(
      value,
      ['terminateOwnedChild'],
      [(entry) => identifier(entry, 'target'), (entry) => identifier(entry, 'reason')],
    ))) return false;

  const restartBranches = onExit.body?.type === 'BlockStatement'
    ? onExit.body.body.filter((statement) => (
      statement.type === 'IfStatement'
      && logical(
        statement.test,
        '&&',
        (left) => binary(
          left,
          '===',
          (entry) => identifier(entry, 'phase'),
          (entry) => literal(entry, 'degraded'),
        ),
        (right) => identifier(right, 'lastAuthority'),
      )
      && statement.consequent?.type === 'BlockStatement'
    )) : [];
  const restartBranch = restartBranches.length === 1 ? restartBranches[0] : null;
  const restartAssignments = restartBranch
    ? directAssignmentStatements(restartBranch.consequent, ['restartTimer']) : [];
  const restartCall = unwrap(restartAssignments[0]?.expression?.right);
  const restartCallback = unwrap(restartCall?.arguments?.[0]);
  const restartStartExpression = unwrap(restartCallback?.body?.body?.[1]?.expression);
  const restartStartCall = restartStartExpression?.type === 'UnaryExpression'
    && restartStartExpression.operator === 'void'
    ? unwrap(restartStartExpression.argument) : null;
  const restartUnrefs = restartBranch ? restartBranch.consequent.body.filter((statement) => (
    directCallStatement(statement, ['restartTimer', 'unref'], [])
  )) : [];
  if (!restartBranch || restartAssignments.length !== 1
    || !call(restartCall, ['setTimeout']) || restartCall.arguments.length !== 2
    || restartCallback?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(restartCallback, [])
    || restartCallback.body?.type !== 'BlockStatement'
    || restartCallback.body.body.length !== 2
    || !directAssignmentStatements(restartCallback.body, ['restartTimer']).some((statement) => (
      literal(unwrap(statement.expression).right, null)
    ))
    || !methodCall(
      restartStartCall,
      'catch',
      (receiver) => call(receiver, ['start'], [
        (entry) => identifier(entry, 'lastAuthority'),
      ]),
      [(callback) => exactIdentifierParameters(unwrap(callback), [])],
    )
    || !identifier(restartCall.arguments[1], 'boundedRestartDelayMs')
    || restartUnrefs.length !== 1
    || !directStatementsOrderedAndReachable(restartBranch.consequent, [
      restartAssignments[0], restartUnrefs[0],
    ])
    || !directStatementReachable(onExit.body, restartBranch)) return false;

  if (!exactIdentifierParameters(onMessage, ['raw'])
    || onMessage.body?.type !== 'BlockStatement'
    || functionHasNestedBinding(onMessage, [
      'child', 'handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage',
      'logger', 'message', 'onMessage', 'pending', 'raw', 'terminateChild',
      'validateEnvelope', 'validateExecutionWorkerReply',
    ], { allowedDirectBindings: ['message'] })
    || functionHasIdentifierWrite(onMessage, [
      'child', 'handleExecutionWorkerEventMessage', 'handleExecutionWorkerObserverMessage',
      'logger', 'onMessage', 'pending', 'raw', 'terminateChild',
      'validateEnvelope', 'validateExecutionWorkerReply',
    ])
    || countAssignments(onMessage, (left) => identifier(left, 'message')) !== 1) return false;
  const decodeAttempts = onMessage.body.body.filter((statement) => (
    statement.type === 'TryStatement' && statement.handler && !statement.finalizer
  ));
  const message = directDeclarator(onMessage.body, 'message', 'let');
  if (!message || message.declaration.init !== null || decodeAttempts.length !== 1) return false;
  const decoded = directAssignmentStatements(decodeAttempts[0].block, ['message']);
  const legacyDecode = decoded.length === 1
    && exactTopLevelRequireBinding(
      program,
      'validateEnvelope',
      'validateEnvelope',
      './execution-worker-protocol.cjs',
    )
    && call(decoded[0].expression.right, ['validateEnvelope'], [
      (value) => identifier(value, 'raw'),
      (value) => exactObject(value, {
        direction: (entry) => literal(entry, 'worker-to-host'),
        now: (entry) => call(entry, ['now'], []),
      }),
    ]);
  const deadlineAwareDecode = decoded.length === 1
    && exactTopLevelRequireBinding(
      program,
      'validateExecutionWorkerReply',
      'validateExecutionWorkerReply',
      './execution-worker-deadline.cjs',
    )
    && call(decoded[0].expression.right, ['validateExecutionWorkerReply'], [
      (value) => identifier(value, 'raw'),
      (value) => identifier(value, 'pending'),
      (value) => identifier(value, 'now'),
    ]);
  if ((!legacyDecode && !deadlineAwareDecode)
    || !directStatementReachable(decodeAttempts[0].block, decoded[0])
    || !supervisorDecodeFailureCatchContract(decodeAttempts[0].handler)) return false;
  const ownershipGuards = onMessage.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && binary(
      statement.test,
      '!==',
      (left) => member(left, ['message', 'ownershipGeneration']),
      (right) => identifier(right, 'ownershipGeneration'),
    )
    && bareReturn(statement.consequent)
  ));
  const eventBranches = onMessage.body.body.filter((statement) => exactSupervisorHandlerBranch(
    statement, 'execution.event', 'handleExecutionWorkerEventMessage', {
      pending: (value) => identifier(value, 'pending'),
      postBrokerResult: (value) => identifier(value, 'postBrokerResult'),
      terminateChild: (value) => identifier(value, 'terminateChild'),
      child: (value) => identifier(value, 'child'),
      now: (value) => identifier(value, 'now'),
    },
  ));
  const observerBranches = onMessage.body.body.filter((statement) => exactSupervisorHandlerBranch(
    statement, 'execution.observer', 'handleExecutionWorkerObserverMessage', {
      pending: (value) => identifier(value, 'pending'),
      now: (value) => identifier(value, 'now'),
    },
  ));
  const terminalBranches = onMessage.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && call(statement.test, ['isExecutionWorkerTerminalOperation'], [
      (value) => member(value, ['message', 'operation']),
    ])
    && statement.consequent?.type === 'BlockStatement'
  ));
  if (ownershipGuards.length !== 1 || eventBranches.length !== 1
    || observerBranches.length !== 1 || terminalBranches.length !== 1
    || !directStatementsOrderedAndReachable(onMessage.body, [
      message.statement, decodeAttempts[0], ownershipGuards[0], eventBranches[0],
      observerBranches[0], terminalBranches[0],
    ])) return false;
  const terminal = terminalBranches[0].consequent;
  const terminalItem = directDeclarator(terminal, 'item', 'const');
  if (!terminalItem || !call(terminalItem.declaration.init, ['pending', 'get'], [
    (value) => member(value, ['message', 'requestId']),
  ]) || terminal.body.length !== 7
    || terminal.body[1]?.type !== 'IfStatement'
    || !exactItemGuard(terminal.body[1].test)
    || !bareReturn(terminal.body[1].consequent)
    || !directCallStatement(terminal.body[2], ['pending', 'delete'], [
      (value) => member(value, ['message', 'requestId']),
    ])
    || !directCallStatement(terminal.body[3], ['logExecutionWorkerCancellation'], [
      (value) => identifier(value, 'logger'),
      (value) => identifier(value, 'item'),
      (value) => identifier(value, 'message'),
      (value) => identifier(value, 'now'),
    ])
    || !directCallStatement(terminal.body[4], ['contextUsageRoutes', 'retain'], [
      (value) => identifier(value, 'message'),
      (value) => identifier(value, 'item'),
    ])
    || !directCallStatement(terminal.body[5], ['item', 'resolve'], [
      (value) => identifier(value, 'message'),
    ])
    || !bareReturn(terminal.body[6])) return false;
  const onMessageMutations = protectedCollectionMutationCalls(
    onMessage, ['pending'], ['add', 'clear', 'delete', 'set'],
  );
  if (onMessageMutations.length !== 1 || onMessageMutations[0].method !== 'delete'
    || onMessageMutations[0].node !== unwrap(terminal.body[2].expression)) return false;

  const requestOptions = unwrap(request.params?.[3]);
  const requestOptionPattern = requestOptions?.type === 'AssignmentPattern'
    && exactObject(requestOptions.right, {}) ? unwrap(requestOptions.left) : null;
  const requestOptionProperties = requestOptionPattern?.type === 'ObjectPattern'
    ? requestOptionPattern.properties : [];
  const requestOption = (name, matcher) => {
    const matches = requestOptionProperties.filter((property) => (
      property.type === 'Property' && property.kind === 'init' && !property.computed
      && propertyName(property) === name
    ));
    return matches.length === 1 && matcher(unwrap(matches[0].value));
  };
  if (!exactParameterList(request, [
    (value) => identifier(value, 'operation'),
    (value) => identifier(value, 'identity'),
    (value) => identifier(value, 'payload'),
    () => true,
  ])
    || requestOptionProperties.length !== 5
    || requestOptionProperties.some((property) => (
      property.type !== 'Property' || property.kind !== 'init' || property.computed
    ))
    || !requestOption('onEvent', (value) => identifier(value, 'onEvent'))
    || !requestOption('onContextUsage', (value) => identifier(value, 'onContextUsage'))
    || !requestOption('onInteractionRequest', (value) => identifier(
      value, 'requestInteractionHandler',
    ))
    || !requestOption('onCapabilityRequest', (value) => identifier(
      value, 'requestCapabilityHandler',
    ))
    || !requestOption('deadlineMs', (value) => defaultedIdentifierParameter(
      value, 'deadlineMs', (fallback) => literal(fallback, 30_000),
    ))
    || functionHasNestedBinding(request, [
      'identity', 'operation', 'payload', 'requestCapabilityHandler',
      'requestInteractionHandler',
    ])
    || functionHasIdentifierWrite(request, [
      'identity', 'operation', 'payload', 'requestCapabilityHandler',
      'requestInteractionHandler',
    ])) return false;
  const requestId = directDeclarator(request.body, 'requestId', 'const');
  const requestMessage = directDeclarator(request.body, 'message', 'const');
  if (!requestId || !logical(
    requestId.declaration.init,
    '||',
    (left) => member(left, ['identity', 'requestId']),
    (right) => call(right, ['randomUUID'], []),
  ) || !requestMessage || !call(requestMessage.declaration.init, ['createEnvelope'], [
    (value) => identifier(value, 'operation'),
    (value) => unwrap(value)?.properties?.length === 3
      && objectIncludesExactProperties(value, {
        requestId: (entry) => identifier(entry, 'requestId'),
        ownershipGeneration: (entry) => identifier(entry, 'ownershipGeneration'),
      }, { allowedSpreads: [(entry) => identifier(entry, 'identity')] }),
    (value) => identifier(value, 'payload'),
    (value) => exactObject(value, {
      deadlineMs: (entry) => identifier(entry, 'deadlineMs'),
      now: (entry) => call(entry, ['now'], []),
    }),
  ])) return false;
  const promiseReturns = request.body.body.filter((statement) => (
    statement.type === 'ReturnStatement'
    && construct(statement.argument, 'Promise')
    && statement.argument.arguments.length === 1
  ));
  if (promiseReturns.length !== 1) return false;
  const executor = unwrap(promiseReturns[0].argument.arguments[0]);
  if (executor?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(executor, ['resolveRequest', 'reject'])
    || executor.body?.type !== 'BlockStatement'
    || functionHasNestedBinding(executor, [
      'child', 'createExecutionWorkerDeadlineCallbacks',
      'createExecutionWorkerRequestSettlement', 'message', 'pending',
      'deadlineCancelGraceMs', 'reject', 'requestId', 'resolveRequest',
    ], { allowedDirectBindings: ['settlement'] })
    || functionHasIdentifierWrite(executor, [
      'child', 'createExecutionWorkerDeadlineCallbacks',
      'createExecutionWorkerRequestSettlement', 'message', 'pending',
      'deadlineCancelGraceMs', 'reject', 'requestId', 'resolveRequest', 'settlement',
    ])) return false;
  const settlement = directDeclarator(executor.body, 'settlement', 'const');
  const settlementCall = unwrap(settlement?.declaration?.init);
  const settlementOptions = unwrap(settlementCall?.arguments?.[0]);
  const legacySettlement = settlementCall?.type === 'CallExpression'
    && call(settlementCall, ['createExecutionWorkerRequestSettlement'])
    && settlementCall.arguments.length === 1
    && exactObject(settlementOptions, {
      child: (entry) => identifier(entry, 'child'),
      operation: (entry) => identifier(entry, 'operation'),
      deadlineMs: (entry) => identifier(entry, 'deadlineMs'),
      cancellationTimeoutMs: (entry) => identifier(entry, 'cancellationTimeoutMs'),
      terminateChild: (entry) => identifier(entry, 'terminateChild'),
      onDeadline: (entry) => exactIdentifierParameters(unwrap(entry), [])
        && arrowCallsExactly(entry, ['pending', 'delete'], [
          (argument) => identifier(argument, 'requestId'),
        ]),
      resolve: (entry) => identifier(entry, 'resolveRequest'),
      reject: (entry) => identifier(entry, 'reject'),
    });
  const deadlineSpreadSettlement = hasDeadlineCancelGraceOption
    && settlementCall?.type === 'CallExpression'
    && call(settlementCall, ['createExecutionWorkerRequestSettlement'])
    && settlementCall.arguments.length === 1
    && settlementOptions?.properties?.length === 10
    && objectIncludesExactProperties(settlementOptions, {
      child: (entry) => identifier(entry, 'child'),
      operation: (entry) => identifier(entry, 'operation'),
      deadlineMs: (entry) => identifier(entry, 'deadlineMs'),
      cancellationTimeoutMs: (entry) => identifier(entry, 'cancellationTimeoutMs'),
      deadlineCancellationTimeoutMs: (entry) => identifier(entry, 'deadlineCancelGraceMs'),
      terminateChild: (entry) => identifier(entry, 'terminateChild'),
      resolve: (entry) => identifier(entry, 'resolveRequest'),
      reject: (entry) => identifier(entry, 'reject'),
      now: (entry) => identifier(entry, 'now'),
    }, {
      allowedSpreads: [(entry) => call(entry, ['createExecutionWorkerDeadlineCallbacks'], [
        (value) => exactObject(value, {
          operation: (item) => identifier(item, 'operation'),
          requestId: (item) => identifier(item, 'requestId'),
          message: (item) => identifier(item, 'message'),
          pending: (item) => identifier(item, 'pending'),
          child: (item) => identifier(item, 'child'),
          terminateChild: (item) => identifier(item, 'terminateChild'),
          now: (item) => identifier(item, 'now'),
          graceMs: (item) => identifier(item, 'deadlineCancelGraceMs'),
        }),
      ])],
    });
  if (!settlement || (!legacySettlement && !deadlineSpreadSettlement)) return false;
  const pendingSets = executor.body.body.filter((statement) => directCallStatement(
    statement,
    ['pending', 'set'],
    [
      (value) => identifier(value, 'requestId'),
      (value) => unwrap(value)?.properties?.length === 8
        && objectIncludesExactProperties(value, {
          lastSequence: (entry) => unary(entry, '-', (value) => literal(value, 1)),
          lastContextUsageSequence: (entry) => unary(
            entry, '-', (value) => literal(value, 1),
          ),
          onEvent: (entry) => identifier(entry, 'onEvent'),
          onContextUsage: (entry) => identifier(entry, 'onContextUsage'),
          onInteractionRequest: (entry) => identifier(entry, 'requestInteractionHandler'),
          onCapabilityRequest: (entry) => identifier(entry, 'requestCapabilityHandler'),
          matches: currentSupervisorIdentityMatcher,
        }, { allowedSpreads: [(entry) => identifier(entry, 'settlement')] }),
    ],
  ));
  const posts = executor.body.body.filter((statement) => directCallStatement(
    statement, ['child', 'postMessage'], [(value) => identifier(value, 'message')],
  ));
  const requestMutations = protectedCollectionMutationCalls(
    request, ['pending'], ['add', 'clear', 'delete', 'set'],
  );
  const expectedRequestMutationCount = deadlineSpreadSettlement ? 1 : 2;
  if (pendingSets.length !== 1 || posts.length !== 1
    || requestMutations.length !== expectedRequestMutationCount
    || requestMutations.filter((entry) => entry.method === 'set').length !== 1
    || requestMutations.filter((entry) => entry.method === 'delete').length
      !== (deadlineSpreadSettlement ? 0 : 1)
    || !directStatementsOrderedAndReachable(executor.body, [
      settlement.statement, pendingSets[0], posts[0],
    ])) {
    return false;
  }

  if (!exactIdentifierParameters(start, ['authority']) || start.async !== true
    || !exactIdentifierParameters(stop, []) || stop.async !== true) return false;
  const childAssignments = directAssignmentStatements(start.body, ['child']);
  const spawnedChild = directDeclarator(start.body, 'spawnedChild', 'const');
  if (childAssignments.length !== 1 || !call(childAssignments[0].expression.right, ['fork'], [
    (value) => identifier(value, 'entry'),
    (value) => value?.type === 'ArrayExpression' && value.elements.length === 0,
    (value) => exactObject(value, {
      serviceName: (entry) => literal(entry, 'QWork Execution Worker'),
      stdio: (entry) => literal(entry, 'pipe'),
      env: (entry) => call(entry, ['workerEnvironment'], [
        (argument) => member(argument, ['process', 'env']),
        (argument) => identifier(argument, 'authority'),
      ]),
    }),
  ]) || !spawnedChild || !identifier(spawnedChild.declaration.init, 'child')) return false;
  const messageListeners = start.body.body.filter((statement) => directCallStatement(
    statement, ['child', 'on'], [
      (value) => literal(value, 'message'),
      (value) => identifier(value, 'onMessage'),
    ],
  ));
  const exitListeners = start.body.body.filter((statement) => directCallStatement(
    statement, ['child', 'once'], [
      (value) => literal(value, 'exit'),
      (value) => exactIdentifierParameters(unwrap(value), ['exitCode'])
        && arrowCallsExactly(value, ['onExit'], [
          (entry) => identifier(entry, 'spawnedChild'),
          (entry) => exactObject(entry, { exitCode: (item) => identifier(item, 'exitCode') }),
        ]),
    ],
  ));
  const errorListeners = start.body.body.filter((statement) => directCallStatement(
    statement, ['child', 'once'], [
      (value) => literal(value, 'error'),
      (value) => exactIdentifierParameters(unwrap(value), ['processError'])
        && arrowCallsExactly(value, ['onExit'], [
          (entry) => identifier(entry, 'spawnedChild'),
          (entry) => exactObject(entry, {
            processError: (item) => identifier(item, 'processError'),
          }),
      ]),
    ],
  ));
  const initializePosts = start.body.body.filter((statement) => directCallStatement(
    statement,
    ['child', 'postMessage'],
    [(value) => call(value, ['createEnvelope'], [
      (entry) => literal(entry, 'worker.initialize'),
      (entry) => identifier(entry, 'identity'),
      (entry) => exactObject(entry, { protocolVersion: (item) => literal(item, 1) }),
      (entry) => exactObject(entry, {
        deadlineMs: (item) => identifier(item, 'boundedStartupTimeoutMs'),
        now: (item) => call(item, ['now'], []),
      }),
    ])],
  ));
  const startupAssignments = directAssignmentStatements(start.body, ['startupTimer']);
  const startupCall = unwrap(startupAssignments[0]?.expression?.right);
  const startupCallback = unwrap(startupCall?.arguments?.[0]);
  const startupUnrefs = start.body.body.filter((statement) => directCallStatement(
    statement, ['startupTimer', 'unref'], [],
  ));
  if (messageListeners.length !== 1 || exitListeners.length !== 1 || errorListeners.length !== 1
    || initializePosts.length !== 1 || startupAssignments.length !== 1
    || !call(startupCall, ['setTimeout']) || startupCall.arguments.length !== 2
    || startupCallback?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(startupCallback, [])
    || !arrowCallsExactly(startupCallback, ['terminateChild'], [
      (entry) => identifier(entry, 'child'),
      (entry) => literal(entry, 'startup-timeout'),
    ])
    || !binary(
      startupCall.arguments[1], '+',
      (entry) => identifier(entry, 'boundedStartupTimeoutMs'),
      (entry) => literal(entry, 1),
    )
    || startupUnrefs.length !== 1
    || !directStatementsOrderedAndReachable(start.body, [
      childAssignments[0], spawnedChild.statement, messageListeners[0],
      exitListeners[0], errorListeners[0], initializePosts[0],
      startupAssignments[0], startupUnrefs[0],
    ])) {
    return false;
  }
  const onExitBinding = directDeclarator(creator.body, 'onExit', 'const');
  const startBinding = directDeclarator(creator.body, 'start', 'const');
  if (!onExitBinding || !startBinding
    || !directStatementsOrderedAndReachable(creator.body, [
      directDeclarator(creator.body, 'requestedRestartDelayMs', 'const').statement,
      directDeclarator(creator.body, 'boundedRestartDelayMs', 'const').statement,
      directDeclarator(creator.body, 'requestedStartupTimeoutMs', 'const').statement,
      directDeclarator(creator.body, 'boundedStartupTimeoutMs', 'const').statement,
      onExitBinding.statement, startBinding.statement,
    ])) return false;

  const stoppedChild = directDeclarator(stop.body, 'stoppedChild', 'const');
  const stopCalls = stop.body.body.filter((statement) => directCallStatement(
    statement,
    ['terminateChild'],
    [(value) => identifier(value, 'stoppedChild'), (value) => literal(value, 'stop')],
    { await_: true },
  ));
  const clearStoppedChild = stop.body.body.filter((statement) => {
    if (statement.type !== 'IfStatement'
      || !binary(
        statement.test,
        '===',
        (left) => identifier(left, 'child'),
        (right) => identifier(right, 'stoppedChild'),
      )) return false;
    const assignment = unwrap(statement.consequent?.expression);
    return statement.consequent?.type === 'ExpressionStatement'
      && assignment?.type === 'AssignmentExpression'
      && assignment.operator === '='
      && identifier(assignment.left, 'child')
      && literal(assignment.right, null);
  });
  const api = returnedObject(creator);
  return Boolean(stoppedChild && identifier(stoppedChild.declaration.init, 'child')
    && stopCalls.length === 1 && clearStoppedChild.length === 1
    && directStatementsOrderedAndReachable(stop.body, [
      stoppedChild.statement, stopCalls[0], clearStoppedChild[0],
    ])
    && api && objectIncludesExactProperties(api, {
      enabled: (value) => literal(value, true),
      request: (value) => identifier(value, 'request'),
      start: (value) => identifier(value, 'start'),
      stop: (value) => identifier(value, 'stop'),
    }));
}

function supervisorExitAstContract(source) {
  const program = parseProgram(source);
  const creator = topFunction(program, 'createExecutionWorkerSupervisor');
  const rejectPendingHelper = topFunction(program, 'rejectPending');
  const exitFailureHelper = topFunction(program, 'executionWorkerExitFailure');
  const onExit = creator ? localArrow(creator.body, 'onExit') : null;
  const api = creator ? returnedObject(creator) : null;
  const legacyContract = Boolean(onExit
    && exactProtectedIdentifierParameters(rejectPendingHelper, ['error'])
    && exactProtectedIdentifierParameters(exitFailureHelper, ['code', 'signal'])
    && onExit.body?.type === 'BlockStatement'
    && onExit.body.body.length === 1
    && directCallStatement(onExit.body.body[0], ['rejectPending'], [
      (value) => call(value, ['executionWorkerExitFailure'], [
        (entry) => identifier(entry, 'code'),
        (entry) => identifier(entry, 'signal'),
      ]),
    ])
    && api
    && exactObject(api, {
      onExit: (value) => identifier(value, 'onExit'),
      onMessage: (value) => identifier(value, 'onMessage'),
      request: (value) => identifier(value, 'request'),
      stop: (value) => identifier(value, 'stop'),
    }));
  if (legacyContract) return true;

  if (!creator || !onExit
    || !exactTopLevelRequireBinding(
      program,
      'executionWorkerExitFailure',
      'executionWorkerExitFailure',
      './execution-worker-process-lifecycle.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'executionWorkerTerminationCause',
      'executionWorkerTerminationCause',
      './execution-worker-process-lifecycle.cjs',
    )
    || !stableProgramIdentifiers(program, [
      'executionWorkerExitFailure', 'executionWorkerTerminationCause',
    ])) return false;

  const pending = directDeclarator(creator.body, 'pending', 'const');
  const rejectPending = localArrow(creator.body, 'rejectPending');
  if (!pending || !construct(pending.declaration.init, 'Map', [])
    || !rejectPending
    || !exactProtectedIdentifierParameters(rejectPending, ['code', 'message'], [
      'code', 'message', 'pending',
    ])
    || rejectPending.body?.type !== 'BlockStatement'
    || rejectPending.body.body.length !== 2) return false;

  const [rejectLoop, clearPending] = rejectPending.body.body;
  const itemBinding = rejectLoop?.left?.type === 'VariableDeclaration'
    && rejectLoop.left.kind === 'const'
    && rejectLoop.left.declarations.length === 1
    ? rejectLoop.left.declarations[0]
    : null;
  const rejectBody = rejectLoop?.body?.type === 'BlockStatement'
    ? rejectLoop.body.body
    : [];
  const errorBinding = rejectBody[0]?.type === 'VariableDeclaration'
    && rejectBody[0].kind === 'const'
    && rejectBody[0].declarations.length === 1
    ? rejectBody[0].declarations[0]
    : null;
  const codeAssignment = unwrap(rejectBody[1]?.expression);
  if (rejectLoop?.type !== 'ForOfStatement'
    || rejectLoop.await === true
    || !itemBinding
    || !identifier(itemBinding.id, 'item')
    || !call(rejectLoop.right, ['pending', 'values'], [])
    || rejectBody.length !== 3
    || !errorBinding
    || !identifier(errorBinding.id, 'error')
    || !construct(errorBinding.init, 'Error', [(value) => identifier(value, 'message')])
    || codeAssignment?.type !== 'AssignmentExpression'
    || codeAssignment.operator !== '='
    || !member(codeAssignment.left, ['error', 'code'])
    || !identifier(codeAssignment.right, 'code')
    || !directCallStatement(rejectBody[2], ['item', 'reject'], [
      (value) => identifier(value, 'error'),
    ])
    || !directCallStatement(clearPending, ['pending', 'clear'], [])) return false;

  if (!exactParameterList(onExit, [
    (value) => identifier(value, 'exitedChild'),
    (value) => objectPatternBindsExactly(value, ['exitCode', 'processError'], {
      topLevelDefault: true,
      propertyDefaults: {
        exitCode: (entry) => literal(entry, null),
        processError: (entry) => literal(entry, null),
      },
      requiredPropertyDefaults: ['exitCode', 'processError'],
    }),
  ])
    || functionHasNestedBinding(onExit, [
      'executionWorkerExitFailure', 'executionWorkerTerminationCause',
      'exitCode', 'exitedChild', 'processError', 'rejectPending',
      'terminationCause',
    ], { allowedDirectBindings: ['terminationCause'] })
    || functionHasIdentifierWrite(onExit, [
      'executionWorkerExitFailure', 'executionWorkerTerminationCause',
      'exitCode', 'exitedChild', 'processError', 'rejectPending',
      'terminationCause',
    ])) return false;

  const childGuards = onExit.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && binary(
      statement.test,
      '!==',
      (value) => identifier(value, 'child'),
      (value) => identifier(value, 'exitedChild'),
    )
    && bareReturn(statement.consequent)
  ));
  const terminationCause = directDeclarator(onExit.body, 'terminationCause', 'const');
  const typedRejects = onExit.body.body.filter((statement) => directCallStatement(
    statement,
    ['rejectPending'],
    [(value) => {
      value = unwrap(value);
      return value?.type === 'SpreadElement'
        && call(value.argument, ['executionWorkerExitFailure'], [
          (entry) => identifier(entry, 'terminationCause'),
        ]);
    }],
  ));
  return childGuards.length === 1
    && terminationCause
    && call(terminationCause.declaration.init, ['executionWorkerTerminationCause'], [
      (value) => exactObject(value, {
        storedCause: (entry) => call(entry, ['terminationCauses', 'get'], [
          (item) => identifier(item, 'exitedChild'),
        ]),
        processError: (entry) => identifier(entry, 'processError'),
        intentionalStop: (entry) => identifier(entry, 'intentionalStop'),
      }),
    ])
    && typedRejects.length === 1
    && directStatementsOrderedAndReachable(onExit.body, [
      childGuards[0], terminationCause.statement, typedRejects[0],
    ]);
}

function defaultRunnerFactory(constructor) {
  if (constructor?.params.length !== 1) return false;
  const parameter = constructor.params[0]?.type === 'AssignmentPattern'
    ? constructor.params[0].left : constructor.params[0];
  if (parameter?.type !== 'ObjectPattern') return false;
  const properties = parameter.properties.filter((property) => propertyName(property) === 'createRunner');
  if (properties.length !== 1 || properties[0].value?.type !== 'AssignmentPattern') return false;
  return executionRunnerFactoryExpression(properties[0].value.right);
}

function executionRunnerFactoryExpression(value) {
  const factory = unwrap(value);
  if (factory?.type !== 'ArrowFunctionExpression' || factory.params.length !== 0
    || factory.body?.type !== 'NewExpression') return false;
  return construct(factory.body, 'Worker', [
    (value) => call(value, ['require', 'resolve'], [
      (entry) => literal(entry, './execution-worker-entry.cjs'),
    ]),
  ]);
}

function controllerInitialStateContract(constructor) {
  let valid = false;
  visit(constructor?.body, (node) => {
    if (valid || node.type !== 'CallExpression' || !call(node, ['Object', 'assign'])) return;
    if (node.arguments.length !== 2 || !member(node.arguments[0], ['this'])) return;
    const state = unwrap(node.arguments[1]);
    if (state?.type !== 'ObjectExpression') return;
    const expected = {
      parentPort: (value) => identifier(value, 'parentPort'),
      createRunner: (value) => identifier(value, 'createRunner'),
      exit: (value) => identifier(value, 'exit'),
      runner: (value) => literal(value, null),
      authority: (value) => literal(value, null),
      turn: (value) => literal(value, null),
      heartbeat: (value) => literal(value, null),
      stopped: (value) => literal(value, false),
    };
    valid = objectIncludesExactProperties(state, expected)
      && state.properties.length === Object.keys(expected).length;
  });
  return valid;
}

function functionFreezesProtectedReceiver(functionNode, receiverPath) {
  let found = false;
  visit(functionNode?.body, (node) => {
    if (found || node.type !== 'CallExpression' || !call(node, ['Object', 'freeze'])) return;
    found = node.arguments.length === 1 && member(node.arguments[0], receiverPath);
  });
  return found;
}

function decodedMessageBinding(method, direction) {
  const binding = directDeclarator(method?.body, 'message', 'const');
  return Boolean(binding && call(binding.declaration.init, ['this', 'decode'], [
    (value) => identifier(value, 'raw'),
    (value) => literal(value, direction),
  ]));
}

function constantBoolean(node) {
  node = unwrap(node);
  if (node?.type === 'Literal') return Boolean(node.value);
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return Boolean(node.quasis[0]?.value?.cooked);
  }
  if (['ArrayExpression', 'ArrowFunctionExpression', 'ClassExpression', 'FunctionExpression',
    'NewExpression', 'ObjectExpression'].includes(node?.type)) return true;
  if (node?.type === 'UnaryExpression' && node.operator === '!') {
    const value = constantBoolean(node.argument);
    return value === null ? null : !value;
  }
  if (node?.type === 'UnaryExpression' && node.operator === 'void') return false;
  if (node?.type === 'SequenceExpression' && node.expressions.length > 0) {
    return constantBoolean(node.expressions.at(-1));
  }
  if (node?.type === 'BinaryExpression'
    && ['===', '!==', '<', '<=', '>', '>='].includes(node.operator)) {
    const primitive = (candidate) => {
      candidate = unwrap(candidate);
      if (candidate?.type === 'Literal'
        && (candidate.value === null
          || ['boolean', 'bigint', 'number', 'string'].includes(typeof candidate.value))) {
        return { known: true, value: candidate.value };
      }
      if (candidate?.type === 'TemplateLiteral' && candidate.expressions.length === 0) {
        return { known: true, value: candidate.quasis[0]?.value?.cooked || '' };
      }
      return null;
    };
    const left = primitive(node.left);
    const right = primitive(node.right);
    if (left && right) {
      switch (node.operator) {
        case '===': return left.value === right.value;
        case '!==': return left.value !== right.value;
        case '<': return left.value < right.value;
        case '<=': return left.value <= right.value;
        case '>': return left.value > right.value;
        case '>=': return left.value >= right.value;
        default: break;
      }
    }
  }
  if (node?.type === 'LogicalExpression') {
    const left = constantBoolean(node.left);
    const right = constantBoolean(node.right);
    if (node.operator === '||') {
      if (left === true || right === true) return true;
      if (left === false) return right;
      if (right === false) return left;
    }
    if (node.operator === '&&') {
      if (left === false || right === false) return false;
      if (left === true) return right;
      if (right === true) return left;
    }
    return null;
  }
  if (node?.type === 'ConditionalExpression') {
    const condition = constantBoolean(node.test);
    if (condition === true) return constantBoolean(node.consequent);
    if (condition === false) return constantBoolean(node.alternate);
    const consequent = constantBoolean(node.consequent);
    const alternate = constantBoolean(node.alternate);
    return consequent !== null && consequent === alternate ? consequent : null;
  }
  return null;
}

function containsEscapingBreak(node) {
  let found = false;
  const scan = (candidate, root = false) => {
    if (found) return;
    if (!candidate) return;
    if (!root && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(candidate.type)) {
      return;
    }
    if (candidate.type === 'BreakStatement') {
      found = true;
      return;
    }
    for (const child of childNodes(candidate)) scan(child);
  };
  scan(node, true);
  return found;
}

function switchDefinitelyAbrupt(statement) {
  if (statement.type !== 'SwitchStatement'
    || !(statement.cases || []).some((entry) => entry.test === null)
    || containsEscapingBreak(statement.cases)) return false;
  const cases = statement.cases || [];
  let suffixAbrupt = false;
  for (let index = cases.length - 1; index >= 0; index -= 1) {
    const consequent = cases[index].consequent || [];
    const ownAbrupt = consequent.length > 0 && blockDefinitelyAbrupt({ body: consequent });
    suffixAbrupt = ownAbrupt || suffixAbrupt;
    if (!suffixAbrupt) return false;
  }
  return suffixAbrupt;
}

function blockDefinitelyAbrupt(block) {
  for (const statement of block?.body || []) {
    if (statementDefinitelyAbrupt(statement)) return true;
  }
  return false;
}

function statementDefinitelyAbrupt(statement) {
  if (!statement) return false;
  if (['ReturnStatement', 'ThrowStatement'].includes(statement.type)) return true;
  if (statement.type === 'BlockStatement') return blockDefinitelyAbrupt(statement);
  if (statement.type === 'LabeledStatement') return statementDefinitelyAbrupt(statement.body);
  if (statement.type === 'TryStatement') {
    if (statement.finalizer && blockDefinitelyAbrupt(statement.finalizer)) return true;
    const tryAbrupt = blockDefinitelyAbrupt(statement.block);
    if (!statement.handler) return tryAbrupt;
    return tryAbrupt && blockDefinitelyAbrupt(statement.handler.body);
  }
  if (statement.type === 'SwitchStatement') return switchDefinitelyAbrupt(statement);
  if (['WhileStatement', 'DoWhileStatement', 'ForStatement'].includes(statement.type)) {
    const condition = statement.type === 'ForStatement' && !statement.test
      ? true : constantBoolean(statement.test);
    return condition === true && !containsEscapingBreak(statement.body);
  }
  if (statement.type !== 'IfStatement') return false;
  const condition = constantBoolean(statement.test);
  if (condition === true) return statementDefinitelyAbrupt(statement.consequent);
  if (condition === false) return statementDefinitelyAbrupt(statement.alternate);
  return Boolean(statement.alternate)
    && statementDefinitelyAbrupt(statement.consequent)
    && statementDefinitelyAbrupt(statement.alternate);
}

function directStatementsOrderedAndReachable(block, statements) {
  if (!block || !Array.isArray(statements) || !statements.length) return false;
  const body = block.body || [];
  const indices = statements.map((statement) => body.indexOf(statement));
  return indices.every((index, position) => index >= 0
    && directStatementReachable(block, statements[position])
    && (position === 0 || indices[position - 1] < index));
}

function directStatementReachable(block, target) {
  const statements = block?.body || [];
  const index = statements.indexOf(target);
  return index >= 0
    && !statements.slice(0, index).some((statement) => statementDefinitelyAbrupt(statement));
}

function directStatementEntriesIncludingTryBlock(block) {
  const entries = [];
  for (const statement of block?.body || []) {
    if (statement.type === 'TryStatement') {
      for (const nested of statement.block?.body || []) {
        entries.push({ statement: nested, block: statement.block, wrapper: statement });
      }
    } else {
      entries.push({ statement, block, wrapper: null });
    }
  }
  return entries;
}

function directEntryReachable(rootBlock, entry) {
  if (!entry) return false;
  if (!entry.wrapper) return entry.block === rootBlock
    && directStatementReachable(rootBlock, entry.statement);
  return directStatementReachable(rootBlock, entry.wrapper)
    && directStatementReachable(entry.block, entry.statement);
}

function directEntriesOrdered(rootBlock, entries) {
  if (!entries.length || entries.some((entry) => !directEntryReachable(rootBlock, entry))) return false;
  const block = entries[0].block;
  if (entries.some((entry) => entry.block !== block || entry.wrapper !== entries[0].wrapper)) return false;
  const statements = block?.body || [];
  return entries.every((entry, index) => (
    index === 0 || statements.indexOf(entries[index - 1].statement) < statements.indexOf(entry.statement)
  ));
}

function controllerTryFailsClosed(statement, { returnsFalse = false } = {}) {
  if (!statement?.handler || statement.finalizer) return false;
  const body = statement.handler.body;
  const finishes = (body?.body || []).filter((candidate) => directCallStatement(
    candidate, ['this', 'finish'], [(value) => literal(value, 1)],
  ));
  if (finishes.length !== 1 || !directStatementReachable(body, finishes[0])) return false;
  if (!returnsFalse) return true;
  const failures = (body?.body || []).filter((candidate) => exactReturn(
    candidate, (value) => literal(value, false),
  ));
  return failures.length === 1
    && directStatementsOrderedAndReachable(body, [finishes[0], failures[0]]);
}

function exactRunnerListener(statement, eventName, callbackMatcher) {
  if (statement?.type !== 'ExpressionStatement') return false;
  const expression = unwrap(statement.expression);
  const callee = unwrap(expression?.callee);
  return expression?.type === 'CallExpression'
    && callee?.type === 'MemberExpression'
    && !callee.computed
    && ['on', 'once'].some((name) => identifier(callee.property, name))
    && member(callee.object, ['this', 'runner'])
    && expression.arguments.length === 2
    && literal(expression.arguments[0], eventName)
    && callbackMatcher(unwrap(expression.arguments[1]));
}

function inlineRunnerFailureHandler(callback) {
  return callback?.type === 'ArrowFunctionExpression'
    && exactIdentifierParameters(callback, [])
    && arrowCallsExactly(callback, ['this', 'finish'], [(value) => literal(value, 1)]);
}

function controllerAstContract(source) {
  const program = parseProgram(source);
  const controller = topClass(program, 'ExecutionWorkerController');
  const startController = topFunction(program, 'startExecutionWorkerController');
  const authorityFields = directDeclarator(program, 'AUTHORITY_FIELDS', 'const');
  const turnFields = directDeclarator(program, 'TURN_FIELDS', 'const');
  const sameIdentityBinding = directDeclarator(program, 'sameIdentity', 'const');
  const sameIdentityFunction = unwrap(sameIdentityBinding?.declaration?.init);
  if (!controller || !authorityFields || !turnFields
    || !topLevelCommonJsBindingsStable(program)
    || !exactTopLevelRequireBinding(program, 'Worker', 'Worker', 'node:worker_threads')
    || !exactTopLevelRequireBinding(
      program,
      'validateEnvelope',
      'validateEnvelope',
      './execution-worker-protocol.cjs',
    )
    || !stableProgramIdentifiers(program, [
      'AUTHORITY_FIELDS', 'ExecutionWorkerController', 'TURN_FIELDS', 'sameIdentity',
      'Worker', 'process', 'require', 'validateEnvelope',
    ], {
      globals: ['process', 'require'],
    })) return false;
  const constructor = classMethod(controller, 'constructor');
  const decode = classMethod(controller, 'decode');
  const finish = classMethod(controller, 'finish');
  const initialize = classMethod(controller, 'initialize');
  const accept = classMethod(controller, 'acceptMessage');
  const host = classMethod(controller, 'onHostMessage');
  const runner = classMethod(controller, 'onRunnerMessage');
  const runnerError = classMethod(controller, 'onRunnerError');
  const runnerExit = classMethod(controller, 'onRunnerExit');
  if (!constructor || !decode || !finish || !initialize || !accept || !host || !runner
    || !startController
    || sameIdentityFunction?.type !== 'ArrowFunctionExpression'
    || !exactProtectedIdentifierParameters(
      sameIdentityFunction, ['message', 'authority', 'fields'],
    )
    || !logical(
      sameIdentityFunction.body,
      '&&',
      (value) => identifier(value, 'authority'),
      (value) => methodCall(
        value,
        'every',
        (receiver) => identifier(receiver, 'fields'),
        [(callback) => {
          callback = unwrap(callback);
          return callback?.type === 'ArrowFunctionExpression'
            && exactProtectedIdentifierParameters(callback, ['field'])
            && binary(
              callback.body,
              '===',
              (entry) => computedIdentifierMember(entry, 'message', 'field'),
              (entry) => computedIdentifierMember(entry, 'authority', 'field'),
            );
        }],
      ),
    )
    || !objectPatternBindsExactly(constructor.params[0], [
      'parentPort', 'createRunner', 'exit',
    ], {
      topLevelDefault: true,
      propertyDefaults: {
        parentPort: (value) => member(value, ['process', 'parentPort']),
        createRunner: executionRunnerFactoryExpression,
        exit: (value) => exactIdentifierParameters(unwrap(value), ['code'])
          && arrowCallsExactly(value, ['process', 'exit'], [
            (entry) => identifier(entry, 'code'),
          ]),
      },
      requiredPropertyDefaults: ['parentPort', 'createRunner', 'exit'],
    })
    || !exactIdentifierParameters(decode, ['raw', 'direction'])
    || !exactIdentifierParameters(finish, ['code'])
    || !exactIdentifierParameters(initialize, ['message'])
    || !exactIdentifierParameters(accept, ['message'])
    || !exactIdentifierParameters(host, ['raw'])
    || !exactIdentifierParameters(runner, ['raw'])
    || (runnerError && !exactIdentifierParameters(runnerError, ['error']))
    || (runnerExit && !exactIdentifierParameters(runnerExit, ['code']))
    || !exactIdentifierParameters(startController, ['options'])
    || !defaultRunnerFactory(constructor)
    || functionHasNestedBinding(constructor, ['createRunner', 'exit', 'parentPort'])
    || functionHasIdentifierWrite(constructor, ['createRunner', 'exit', 'parentPort'])
    || functionHasNestedBinding(decode, ['direction', 'raw'])
    || functionHasIdentifierWrite(decode, ['direction', 'raw'])
    || functionHasNestedBinding(finish, ['code'])
    || functionHasIdentifierWrite(finish, ['code'])
    || functionHasNestedBinding(initialize, ['message'])
    || functionHasIdentifierWrite(initialize, ['message'])
    || functionHasNestedBinding(accept, ['message'])
    || functionHasIdentifierWrite(accept, ['message'])
    || functionHasNestedBinding(host, ['raw'])
    || functionHasIdentifierWrite(host, ['raw'])
    || functionHasNestedBinding(runner, ['raw'])
    || functionHasIdentifierWrite(runner, ['raw'])
    || (runnerError && functionHasNestedBinding(runnerError, ['error']))
    || (runnerError && functionHasIdentifierWrite(runnerError, ['error']))
    || (runnerExit && functionHasNestedBinding(runnerExit, ['code']))
    || (runnerExit && functionHasIdentifierWrite(runnerExit, ['code']))
    || functionHasNestedBinding(startController, ['options'])
    || functionHasIdentifierWrite(startController, ['options'])
    || startController.body.body.length !== 1
    || !exactReturn(startController.body.body[0], (value) => construct(
      value, 'ExecutionWorkerController', [(entry) => identifier(entry, 'options')],
    ))) return false;
  const controllerBindingPaths = [
    ['this', 'authority'], ['this', 'createRunner'], ['this', 'runner'],
  ];
  const otherControllerMethods = (controller.body?.body || [])
    .filter((method) => method.type === 'MethodDefinition'
      && !['constructor', 'initialize'].includes(propertyName(method)))
    .map((method) => method.value);
  if (functionHasProtectedAliasMutation(constructor, controllerBindingPaths)
    || functionHasProtectedAliasMutation(initialize, controllerBindingPaths)
    || countMemberWrites(constructor, ['this', 'authority']) !== 1
    || countMemberWrites(constructor, ['this', 'createRunner']) !== 1
    || countMemberWrites(constructor, ['this', 'runner']) !== 1
    || countMemberWrites(initialize, ['this', 'authority']) !== 1
    || countMemberWrites(initialize, ['this', 'createRunner']) !== 0
    || countMemberWrites(initialize, ['this', 'runner']) !== 1
    || !controllerInitialStateContract(constructor)
    || functionFreezesProtectedReceiver(constructor, ['this'])
    || functionFreezesProtectedReceiver(initialize, ['this'])
    || otherControllerMethods.some((method) => functionHasMemberWrite(
      method, controllerBindingPaths,
    ))) return false;
  const decodeTry = decode.body.body.filter((statement) => statement.type === 'TryStatement');
  if (decodeTry.length !== 1 || decodeTry[0].block.body.length !== 1
    || !exactReturn(decodeTry[0].block.body[0], (value) => call(value, ['validateEnvelope'], [
      (entry) => identifier(entry, 'raw'),
      (entry) => exactObject(entry, { direction: (item) => identifier(item, 'direction') }),
    ]))) return false;

  const initializeGuard = initialize.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && member(statement.test, ['this', 'authority'])
    && exactReturn(statement.consequent, (value) => literal(value, false))
  ));
  const authorityAssignments = directAssignmentStatements(initialize.body, ['this', 'authority'])
    .filter((statement) => identifier(statement.expression.right, 'message'));
  const initializeEntries = directStatementEntriesIncludingTryBlock(initialize.body);
  const runnerAssignments = initializeEntries.filter((entry) => (
    entry.statement?.type === 'ExpressionStatement'
      && unwrap(entry.statement.expression)?.type === 'AssignmentExpression'
      && unwrap(entry.statement.expression).operator === '='
      && member(unwrap(entry.statement.expression).left, ['this', 'runner'])
  ))
    .filter((entry) => call(entry.statement.expression.right, ['this', 'createRunner'], []));
  if (initializeGuard.length !== 1 || authorityAssignments.length !== 1 || runnerAssignments.length !== 1
    || !directStatementsOrderedAndReachable(initialize.body, [
      initializeGuard[0], authorityAssignments[0],
    ])) return false;
  const messageListeners = initializeEntries.filter((entry) => exactRunnerListener(
    entry.statement,
    'message',
    (callback) => callback?.type === 'ArrowFunctionExpression'
      && exactIdentifierParameters(callback, ['raw'])
      && arrowCallsExactly(callback, ['this', 'onRunnerMessage'], [
        (value) => identifier(value, 'raw'),
      ]),
  ));
  const errorListeners = initializeEntries.filter((entry) => exactRunnerListener(
    entry.statement,
    'error',
    (callback) => inlineRunnerFailureHandler(callback)
      || (runnerError
        && callback?.type === 'ArrowFunctionExpression'
        && exactIdentifierParameters(callback, ['error'])
        && arrowCallsExactly(callback, ['this', 'onRunnerError'], [
          (value) => identifier(value, 'error'),
        ])),
  ));
  const exitListeners = initializeEntries.filter((entry) => exactRunnerListener(
    entry.statement,
    'exit',
    (callback) => inlineRunnerFailureHandler(callback)
      || (runnerExit
        && callback?.type === 'ArrowFunctionExpression'
        && exactIdentifierParameters(callback, ['code'])
        && arrowCallsExactly(callback, ['this', 'onRunnerExit'], [
          (value) => identifier(value, 'code'),
        ])),
  ));
  const initializeSuccesses = initializeEntries.filter((entry) => exactReturn(
    entry.statement, (value) => literal(value, true),
  ));
  if (messageListeners.length !== 1 || errorListeners.length !== 1 || exitListeners.length !== 1
    || initializeSuccesses.length !== 1
    || !directEntriesOrdered(initialize.body, [
      runnerAssignments[0], messageListeners[0], errorListeners[0], exitListeners[0],
      initializeSuccesses[0],
    ])) return false;
  const initializeOuterStatement = runnerAssignments[0].wrapper || runnerAssignments[0].statement;
  if (!directStatementsOrderedAndReachable(initialize.body, [
    authorityAssignments[0], initializeOuterStatement,
  ]) || (runnerAssignments[0].wrapper
      && !controllerTryFailsClosed(runnerAssignments[0].wrapper, { returnsFalse: true }))) return false;

  const startBranches = accept.body.body.filter((statement) => (
    statement.type === 'IfStatement' && exactOperation(statement.test, '===', 'execution.start')
  ));
  if (startBranches.length !== 1 || startBranches[0].consequent?.type !== 'BlockStatement') return false;
  const startBody = startBranches[0].consequent.body;
  if (startBody.length !== 3
    || startBody[0]?.type !== 'IfStatement'
    || !member(startBody[0].test, ['this', 'turn'])
    || !exactReturn(startBody[0].consequent, (value) => literal(value, false))
    || startBody[1]?.type !== 'ExpressionStatement'
    || startBody[1].expression?.type !== 'AssignmentExpression'
    || !member(startBody[1].expression.left, ['this', 'turn'])
    || !identifier(startBody[1].expression.right, 'message')
    || !exactReturn(startBody[2], (value) => literal(value, true))) return false;
  const authorityGuards = accept.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && exactNotCall(statement.test, ['sameIdentity'], [
      (value) => identifier(value, 'message'),
      (value) => member(value, ['this', 'authority']),
      (value) => identifier(value, 'AUTHORITY_FIELDS'),
    ])
    && exactReturn(statement.consequent, (value) => literal(value, false))
  ));
  const turnGuards = accept.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && exactNotCall(statement.test, ['sameIdentity'], [
      (value) => identifier(value, 'message'),
      (value) => member(value, ['this', 'turn']),
      (value) => identifier(value, 'TURN_FIELDS'),
    ])
    && exactReturn(statement.consequent, (value) => literal(value, false))
  ));
  const finalReturns = accept.body.body.filter((statement) => statement.type === 'ReturnStatement');
  if (authorityGuards.length !== 1 || turnGuards.length !== 1 || finalReturns.length !== 1) return false;
  const final = unwrap(finalReturns[0].argument);
  if (final?.type !== 'ConditionalExpression'
    || !binary(
      final.test, '===',
      (value) => member(value, ['message', 'operation']),
      (value) => literal(value, 'context-usage.refresh'),
    )
    || !binary(
      final.consequent, '===',
      (value) => member(value, ['message', 'payload', 'executionRequestId']),
      (value) => member(value, ['this', 'turn', 'requestId']),
    )
    || !binary(
      final.alternate, '===',
      (value) => member(value, ['message', 'requestId']),
      (value) => member(value, ['this', 'turn', 'requestId']),
    )) return false;

  if (!decodedMessageBinding(host, 'host-to-worker')
    || !decodedMessageBinding(runner, 'worker-to-host')) return false;
  const hostGuard = host.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && logical(
      statement.test,
      '||',
      (left) => unary(left, '!', (value) => identifier(value, 'message')),
      (right) => exactNotCall(right, ['this', 'acceptMessage'], [
        (value) => identifier(value, 'message'),
      ]),
    )
    && bareReturn(statement.consequent)
  ));
  const hostForwards = directStatementEntriesIncludingTryBlock(host.body).filter((entry) => directCallStatement(
    entry.statement, ['this', 'runner', 'postMessage'], [(value) => identifier(value, 'message')],
  ));
  const hostForwardOuter = hostForwards[0]?.wrapper || hostForwards[0]?.statement;
  if (hostGuard.length !== 1 || hostForwards.length !== 1
    || !directStatementReachable(host.body, hostGuard[0])
    || !directEntryReachable(host.body, hostForwards[0])
    || !directStatementsOrderedAndReachable(host.body, [hostGuard[0], hostForwardOuter])
    || (hostForwards[0].wrapper && !controllerTryFailsClosed(hostForwards[0].wrapper))) return false;

  const runnerAuthority = runner.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && exactMessageAuthorityGuard(statement.test)
    && bareReturn(statement.consequent)
  ));
  const heartbeat = runner.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && exactOperation(statement.test, '===', 'worker.heartbeat')
    && bareReturn(statement.consequent)
  ));
  const ready = runner.body.body.filter((statement) => (
    statement.type === 'IfStatement' && exactOperation(statement.test, '===', 'worker.ready')
  ));
  if (runnerAuthority.length !== 1 || heartbeat.length !== 1 || ready.length !== 1
    || ready[0].alternate?.type !== 'IfStatement') return false;
  const startsHeartbeat = directCallStatement(ready[0].consequent, ['this', 'startHeartbeat'], [])
    || (ready[0].consequent?.type === 'BlockStatement'
      && ready[0].consequent.body.length === 1
      && ready[0].consequent.body[0]?.type === 'IfStatement'
      && exactNotCall(ready[0].consequent.body[0].test, ['this', 'startHeartbeat'], [])
      && bareReturn(ready[0].consequent.body[0].consequent));
  if (!startsHeartbeat) return false;
  const pressureGuard = ready[0].alternate;
  if (!logical(
    pressureGuard.test,
    '&&',
    (left) => exactOperation(left, '!==', 'worker.pressure'),
    (right) => exactNotCall(right, ['sameIdentity'], [
      (value) => identifier(value, 'message'),
      (value) => member(value, ['this', 'turn']),
      (value) => identifier(value, 'TURN_FIELDS'),
    ]),
  ) || !bareReturn(pressureGuard.consequent)) return false;
  const runnerForwards = runner.body.body.filter((statement) => directCallStatement(
    statement, ['this', 'parentPort', 'postMessage'], [(value) => identifier(value, 'message')],
  ));
  if (runnerForwards.length !== 1
    || !directStatementReachable(runner.body, runnerAuthority[0])
    || !directStatementReachable(runner.body, heartbeat[0])
    || !directStatementReachable(runner.body, ready[0])
    || !directStatementReachable(runner.body, runnerForwards[0])) return false;
  return directStatementsOrderedAndReachable(runner.body, [
    runnerAuthority[0], heartbeat[0], ready[0], runnerForwards[0],
  ]);
}

function genuineTimeoutInFunction(functionNode, timeoutNames) {
  return (functionNode?.body?.body || []).some((statement) => {
    if (!['ExpressionStatement', 'ReturnStatement', 'VariableDeclaration'].includes(statement.type)
      || !directStatementReachable(
      functionNode.body, statement,
    )) return false;
    let found = false;
    visit(statement, (node) => {
      if (found || !call(node, ['Promise', 'race']) || node.arguments.length !== 1) return;
      const races = unwrap(node.arguments[0]);
      if (races?.type !== 'ArrayExpression') return;
      found = races.elements.some((element) => {
        element = unwrap(element);
        if (element?.type !== 'NewExpression' || !identifier(element.callee, 'Promise')
          || element.arguments.length !== 1) return false;
        const executor = unwrap(element.arguments[0]);
        if (executor?.type !== 'ArrowFunctionExpression'
          || executor.params.length !== 1
          || !['resolve', 'resolveDeadline'].some((name) => (
            exactProtectedIdentifierParameters(executor, [name])
          ))) return false;
        const resolver = executor.params[0].name;
        return executor.body?.type === 'CallExpression'
          && call(executor.body, ['setTimeout'])
          && executor.body.arguments.length === 2
          && identifier(executor.body.arguments[0], resolver)
          && timeoutNames.some((name) => identifier(executor.body.arguments[1], name));
      });
    });
    return found;
  });
}

function finitePositiveTimeoutBinding(functionNode, {
  boundedName = 'boundedTimeout',
  fallback = 1,
  requestedName = 'requestedTimeout',
  sourceName = 'timeoutMs',
} = {}) {
  return safeTimerTimeoutBinding(functionNode, {
    boundedName,
    fallback,
    maximum: 2_147_483_647,
    requestedName,
    sourceName,
  });
}

function managerPressureCondition(node) {
  return binary(
    node,
    '>=',
    (value) => member(value, ['manager', 'executions', 'size']),
    (value) => member(value, ['manager', 'maxConcurrentExecutions']),
  ) || binary(
    node,
    '>=',
    (value) => member(value, ['manager', 'queue', 'length']),
    (value) => member(value, ['manager', 'queueLimit']),
  );
}

function managerPressureRejection(statement) {
  if (statement?.type !== 'ReturnStatement') return false;
  const rejection = unwrap(statement.argument);
  if (!call(rejection, ['Promise', 'reject']) || rejection.arguments.length !== 1) return false;
  const error = unwrap(rejection.arguments[0]);
  return call(error, ['managerError'])
    && [2, 3].includes(error.arguments.length)
    && literal(error.arguments[0], 'execution_worker_pressure_admission_closed')
    && error.arguments[1]?.type === 'Literal'
    && typeof error.arguments[1].value === 'string'
    && error.arguments[1].value.length > 0
    && (error.arguments.length === 2 || literal(error.arguments[2], 'pending'));
}

function managerPressureBranch(waitForSlot) {
  const branches = (waitForSlot?.body?.body || []).filter((statement) => (
    statement.type === 'IfStatement'
    && managerPressureCondition(statement.test)
    && directStatementReachable(waitForSlot.body, statement)
  ));
  if (branches.length !== 1) return null;
  const consequent = branches[0].consequent?.type === 'BlockStatement'
    ? branches[0].consequent : { body: [branches[0].consequent] };
  const rejections = (consequent.body || []).filter((statement) => (
    managerPressureRejection(statement) && directStatementReachable(consequent, statement)
  ));
  return rejections.length === 1 ? branches[0] : null;
}

function directManagerSupervisorBinding(node) {
  node = unwrap(node);
  return call(node, ['manager', 'supervisorFactory'])
    && node.arguments.length === 1
    && unwrap(node.arguments[0])?.type === 'ObjectExpression';
}

function managerLeaseReturn(statement, { releaseFunction = null } = {}) {
  if (statement?.type !== 'ReturnStatement') return false;
  const value = unwrap(statement.argument);
  if (call(value, ['executionWorkerLease'])
    && [3, 4].includes(value.arguments.length)
    && identifier(value.arguments[0], 'manager')
    && identifier(value.arguments[1], 'requestId')
    && identifier(value.arguments[2], 'record')
    && (value.arguments.length === 3 || identifier(value.arguments[3], 'state'))) return true;
  return Boolean(releaseFunction) && exactObject(value, {
    supervisor: (entry) => identifier(entry, 'supervisor'),
    release: (entry) => identifier(entry, 'release'),
  });
}

function managerCreatorParametersValid(creator) {
  if (exactIdentifierParameters(creator, [])
    || exactIdentifierParameters(creator, ['manager'])) return true;
  if (creator?.params.length !== 1) return false;
  let parameter = unwrap(creator.params[0]);
  if (parameter?.type !== 'AssignmentPattern' || !exactObject(parameter.right, {})) return false;
  parameter = unwrap(parameter.left);
  if (parameter?.type !== 'ObjectPattern' || parameter.properties.length !== 7) return false;
  const rest = parameter.properties.filter((property) => property.type === 'RestElement');
  const properties = parameter.properties.filter((property) => property.type === 'Property');
  if (rest.length !== 1 || !identifier(rest[0].argument, 'supervisorOptions')
    || properties.length !== 6) return false;
  const expected = {
    enabled: (value) => defaultedIdentifierParameter(value, 'enabled', (entry) => literal(entry, true)),
    fork: (value) => identifier(value, 'fork'),
    maxConcurrentExecutions: (value) => defaultedIdentifierParameter(
      value, 'maxConcurrentExecutions', (entry) => literal(entry, 16),
    ),
    maxQueuedExecutions: (value) => defaultedIdentifierParameter(
      value, 'maxQueuedExecutions', (entry) => literal(entry, 64),
    ),
    supervisorFactory: (value) => defaultedIdentifierParameter(
      value, 'supervisorFactory', (entry) => identifier(entry, 'createExecutionWorkerSupervisor'),
    ),
    stripMainOwnedCapabilitiesForTest: (value) => defaultedIdentifierParameter(
      value, 'stripMainOwnedCapabilitiesForTest', (entry) => literal(entry, false),
    ),
  };
  return Object.entries(expected).every(([name, matcher]) => {
    const matches = properties.filter((property) => propertyName(property) === name);
    return matches.length === 1 && matcher(matches[0].value);
  });
}

function managerIsolationAstContract(source) {
  const program = parseProgram(source);
  const creator = topFunction(program, 'createExecutionWorkerManager');
  const acquire = topFunction(program, 'acquireExecutionWorker');
  const waitForSlot = topFunction(program, 'waitForExecutionSlot');
  const managerError = topFunction(program, 'managerError');
  const validateAcquisition = topFunction(program, 'validateAcquisition');
  const stopRecord = topFunction(program, 'stopExecutionRecord');
  const releaseRecord = topFunction(program, 'releaseExecutionRecord');
  const drainRecord = topFunction(program, 'drainExecutionRecord');
  const createLease = topFunction(program, 'executionWorkerLease');
  const createRecord = topFunction(program, 'createExecutionRecord');
  const createSupervisor = topFunction(program, 'createExecutionSupervisor');
  const executionSession = topFunction(program, 'executionSessionIdentity');
  const sameSession = topFunction(program, 'sameExecutionSession');
  const retireSession = topFunction(program, 'retireDrainingSession');
  const creatorParametersValid = managerCreatorParametersValid(creator);
  const acquireParametersValid = exactParameterList(acquire, [
    (value) => identifier(value, 'manager'),
    (value) => identifier(value, 'operation') || identifier(value, 'authority'),
    (value) => identifier(value, 'identity'),
    (value) => identifier(value, 'options')
      || defaultedIdentifierParameter(value, 'options', (fallback) => exactObject(fallback, {})),
  ]);
  const waitParametersValid = exactIdentifierParameters(waitForSlot, ['manager', 'requestId'])
    || exactIdentifierParameters(waitForSlot, ['manager', 'requestId', 'signal']);
  if (!creator || !acquire || !waitForSlot || !creatorParametersValid
    || !acquireParametersValid || !waitParametersValid
    || !(exactProtectedIdentifierParameters(managerError, ['code', 'message'])
      || exactParameterList(managerError, [
        (value) => identifier(value, 'code'),
        (value) => identifier(value, 'message'),
        (value) => defaultedIdentifierParameter(value, 'pressure', (entry) => literal(entry, null)),
      ]))
    || (validateAcquisition && !exactProtectedIdentifierParameters(
      validateAcquisition, ['manager', 'identity'],
    ))
    || (stopRecord && !exactProtectedIdentifierParameters(
      stopRecord, ['manager', 'requestId', 'record'],
    ))
    || (releaseRecord && !exactProtectedIdentifierParameters(
      releaseRecord, ['manager', 'requestId', 'record'],
    ))
    || (createLease
      && !exactProtectedIdentifierParameters(createLease, ['manager', 'requestId', 'record'])
      && !exactProtectedIdentifierParameters(
        createLease, ['manager', 'requestId', 'record', 'state'],
      ))
    || (createRecord && !exactProtectedIdentifierParameters(createRecord, ['supervisor']))
    || (createSupervisor && !exactProtectedIdentifierParameters(createSupervisor, ['manager']))
    || functionHasNestedBinding(waitForSlot, ['manager', 'requestId', 'signal'])
    || functionHasIdentifierWrite(waitForSlot, ['manager', 'requestId', 'signal'])) return false;
  if (drainRecord) {
    const drainUsesTimeout = drainRecord.params.length === 5;
    const timeoutBindingNames = ['boundedTimeout', 'requestedTimeout'];
    const drainParametersValid = exactIdentifierParameters(
      drainRecord, ['manager', 'requestId', 'record', 'settlement'],
    ) || exactParameterList(drainRecord, [
      (value) => identifier(value, 'manager'),
      (value) => identifier(value, 'requestId'),
      (value) => identifier(value, 'record'),
      (value) => identifier(value, 'settlement'),
      (value) => objectPatternBindsExactly(value, ['timeoutMs'], {
        topLevelDefault: true,
        propertyDefaults: { timeoutMs: (entry) => literal(entry, 1) },
        requiredPropertyDefaults: ['timeoutMs'],
      }),
    ]);
    if (!drainParametersValid
      || functionHasNestedBinding(drainRecord, [
        ...timeoutBindingNames, 'manager', 'Math', 'Number', 'record', 'requestId',
        'settlement', 'timeoutMs',
      ], { allowedDirectBindings: timeoutBindingNames })
      || functionHasIdentifierWrite(drainRecord, [
        ...timeoutBindingNames, 'manager', 'Math', 'Number', 'record', 'requestId',
        'settlement', 'timeoutMs',
      ])
      || (drainUsesTimeout && !safeTimerTimeoutBinding(drainRecord, {
        sourceName: 'timeoutMs', requestedName: 'requestedTimeout',
        boundedName: 'boundedTimeout', maximum: 2_147_483_647,
      }))) return false;
  }
  const helperNames = (program.body || [])
    .filter((node) => node.type === 'FunctionDeclaration' && node.id)
    .map((node) => node.id.name);
  const acquireParameterNames = ['authority', 'identity', 'manager', 'operation', 'options'];
  const managerFunctions = [
    creator, acquire, waitForSlot, managerError, validateAcquisition, stopRecord,
    releaseRecord, drainRecord, createLease, createRecord, createSupervisor,
  ].filter(Boolean);
  const managerBuiltins = [
    'Error', 'Map', 'Math', 'Number', 'Object', 'Promise', 'String', 'setTimeout',
  ];
  const managerCreatorOptions = [
    'enabled', 'fork', 'maxConcurrentExecutions', 'maxQueuedExecutions',
    'stripMainOwnedCapabilitiesForTest', 'supervisorFactory', 'supervisorOptions',
  ];
  if (!stableProgramIdentifiers(program, [...helperNames, ...managerBuiltins], {
    globals: managerBuiltins,
  })
    || managerFunctions.some((functionNode) => functionHasMemberWrite(functionNode, [
      ['manager', 'concurrencyLimit'],
      ['manager', 'enabled'],
      ['manager', 'executions'],
      ['manager', 'fork'],
      ['manager', 'maxConcurrentExecutions'],
      ['manager', 'maxQueuedExecutions'],
      ['manager', 'queueLimit'],
      ['manager', 'supervisorFactory'],
      ['manager', 'supervisorOptions'],
      ['record', 'supervisor'],
    ]))
    || functionHasNestedBinding(creator, helperNames)
    || functionHasNestedBinding(creator, managerCreatorOptions)
    || functionHasIdentifierWrite(creator, managerCreatorOptions)
    || functionHasNestedBinding(creator, ['manager'], {
      allowedDirectBindings: ['manager'],
    })
    || functionHasNestedBinding(acquire, helperNames)
    || functionHasNestedBinding(acquire, acquireParameterNames)
    || functionHasIdentifierWrite(acquire, acquireParameterNames)
    || functionHasNestedBinding(acquire, ['record', 'release', 'requestId', 'supervisor'], {
      allowedDirectBindings: ['record', 'release', 'requestId', 'supervisor'],
    })) return false;
  const managerBindings = directDeclarators(creator.body, 'manager');
  if (managerBindings.length > 1 || countAssignments(
    creator,
    (left) => patternNames(left).includes('manager'),
  ) > 0) return false;
  const requestId = directDeclarator(acquire.body, 'requestId', 'const');
  const supervisor = directDeclarator(acquire.body, 'supervisor', 'const');
  const record = directDeclarator(acquire.body, 'record', 'const');
  const helperSupervisorBinding = call(supervisor?.declaration?.init, ['createExecutionSupervisor'], [
    (value) => identifier(value, 'manager'),
  ]);
  const helperRecordBinding = call(record?.declaration?.init, ['createExecutionRecord'], [
    (value) => identifier(value, 'supervisor'),
  ]);
  const directSupervisorBinding = directManagerSupervisorBinding(supervisor?.declaration?.init);
  const directRecordBinding = exactObject(record?.declaration?.init, {
    supervisor: (value) => identifier(value, 'supervisor'),
  });
  if (!requestId || !supervisor || !record
    || !(call(requestId.declaration.init, ['validateAcquisition'], [
      (value) => identifier(value, 'manager'),
      (value) => identifier(value, 'identity'),
    ]) || member(requestId.declaration.init, ['identity', 'requestId']))
    || !(helperSupervisorBinding || directSupervisorBinding)
    || !(helperRecordBinding || directRecordBinding)
    || helperSupervisorBinding !== helperRecordBinding
    || countAssignments(acquire, (left) => patternNames(left).includes('requestId')) !== 0
    || countAssignments(acquire, (left) => patternNames(left).includes('supervisor')) !== 0
    || countAssignments(acquire, (left) => patternNames(left).includes('record')) !== 0) return false;
  const directAdmissionCalls = acquire.body.body.filter((statement) => {
    let expression = null;
    if (statement.type === 'ExpressionStatement') {
      expression = unwrap(statement.expression);
    } else if (statement.type === 'VariableDeclaration'
      && statement.kind === 'const'
      && statement.declarations.length === 1) {
      expression = unwrap(statement.declarations[0].init);
    }
    if (expression?.type === 'AwaitExpression') expression = unwrap(expression.argument);
    const wait = expression;
    return call(wait, ['waitForExecutionSlot'])
      && wait.arguments.length >= 2
      && identifier(wait.arguments[0], 'manager')
      && identifier(wait.arguments[1], 'requestId')
      && (wait.arguments.length === 2
        || (wait.arguments.length === 3
          && member(wait.arguments[2], ['options', 'signal'])));
  });
  const admissionWaits = directAdmissionCalls.filter((statement) => {
    const expression = statement.type === 'ExpressionStatement'
      ? unwrap(statement.expression)
      : unwrap(statement.declarations[0].init);
    return expression?.type === 'AwaitExpression';
  });
  const indexes = acquire.body.body.filter((statement) => directCallStatement(
    statement,
    ['manager', 'executions', 'set'],
    [(value) => identifier(value, 'requestId'), (value) => identifier(value, 'record')],
  ));
  if (indexes.length !== 1
    || !directStatementsOrderedAndReachable(acquire.body, [
      supervisor.statement, record.statement, indexes[0],
    ])) return false;
  if (directAdmissionCalls.length > 0 && (
    directAdmissionCalls.length !== 1
    || admissionWaits.length !== 1
    || !directStatementsOrderedAndReachable(acquire.body, [
      admissionWaits[0], supervisor.statement,
    ])
  )) return false;
  const executionMutationMethods = ['add', 'clear', 'delete', 'set'];
  const exactExecutionMutations = (functionNode, expected) => {
    const actual = protectedCollectionMutationCalls(
      functionNode,
      ['manager', 'executions'],
      executionMutationMethods,
    );
    return actual.length === expected.length && expected.every((entry) => actual.some(
      (mutation) => mutation.method === entry.method && mutation.node === entry.node,
    ));
  };
  const indexCall = unwrap(indexes[0].expression);
  const releases = directDeclarators(acquire.body, 'release');
  const releaseFunction = releases.length === 1 ? unwrap(releases[0].declaration.init) : null;
  if (releases.length > 1
    || (releases.length === 1 && releases[0].statement.kind !== 'const')
    || (releaseFunction && (releaseFunction.type !== 'ArrowFunctionExpression'
      || releaseFunction.body?.type !== 'BlockStatement'
      || !exactIdentifierParameters(releaseFunction, [])))
    || countAssignments(acquire, (left) => patternNames(left).includes('release')) !== 0) return false;
  let releaseDeleteCall = null;
  if (releaseFunction) {
    const deletes = releaseFunction.body.body.filter((statement) => directCallStatement(
      statement, ['manager', 'executions', 'delete'], [(value) => identifier(value, 'requestId')],
    ));
    const stops = releaseFunction.body.body.filter((statement) => (
      directCallStatement(statement, ['supervisor', 'stop'], [], { await_: true })
      || exactReturn(statement, (value) => call(value, ['supervisor', 'stop'], []))
      || exactReturn(
        statement,
        (value) => call(value, ['supervisor', 'stop'], []),
        { await_: true },
      )
    ));
    let stopCallCount = 0;
    visit(releaseFunction.body, (node) => {
      if (call(node, ['supervisor', 'stop'], [])) stopCallCount += 1;
    });
    releaseDeleteCall = unwrap(deletes[0]?.expression);
    if (deletes.length !== 1 || stops.length !== 1
      || stopCallCount !== 1
      || !directStatementReachable(releaseFunction.body, deletes[0])
      || !directStatementReachable(releaseFunction.body, stops[0])
      || !directStatementsOrderedAndReachable(releaseFunction.body, [deletes[0], stops[0]])
      || !exactExecutionMutations(releaseFunction, [
        { method: 'delete', node: releaseDeleteCall },
      ])) return false;
  }
  const acquireMutations = [{ method: 'set', node: indexCall }];
  if (releaseDeleteCall) acquireMutations.push({ method: 'delete', node: releaseDeleteCall });
  if (!exactExecutionMutations(acquire, acquireMutations)) return false;
  for (const helper of [releaseRecord, drainRecord].filter(Boolean)) {
    const deletes = helper.body.body.filter((statement) => directCallStatement(
      statement,
      ['manager', 'executions', 'delete'],
      [(value) => identifier(value, 'requestId')],
    ));
    const deleteCall = unwrap(deletes[0]?.expression);
    if (deletes.length !== 1
      || !directStatementReachable(helper.body, deletes[0])
      || !exactExecutionMutations(helper, [{ method: 'delete', node: deleteCall }])) return false;
  }
  if (managerFunctions.some((functionNode) => (
    functionNode !== acquire
    && functionNode !== releaseRecord
    && functionNode !== drainRecord
    && !exactExecutionMutations(functionNode, [])
  ))) return false;
  const successReturns = directStatementEntriesIncludingTryBlock(acquire.body).filter((entry) => (
    managerLeaseReturn(entry.statement, { releaseFunction })
  ));
  if (successReturns.length !== 1 || !directEntryReachable(acquire.body, successReturns[0])) return false;
  const successOuter = successReturns[0].wrapper || successReturns[0].statement;
  if (!directStatementsOrderedAndReachable(acquire.body, [indexes[0], successOuter])) return false;
  const drain = topFunction(program, 'drainExecutionRecord');
  if (drain && (!finitePositiveTimeoutBinding(drain)
    || !genuineTimeoutInFunction(drain, ['boundedTimeout']))) return false;
  return true;
}

function currentManagerIsolationAstContract(source) {
  const program = parseProgram(source);
  const creator = topFunction(program, 'createExecutionWorkerManager');
  const acquire = topFunction(program, 'acquireExecutionWorker');
  const waitForSlot = topFunction(program, 'waitForExecutionSlot');
  const validateAcquisition = topFunction(program, 'validateAcquisition');
  const stopRecord = topFunction(program, 'stopExecutionRecord');
  const releaseRecord = topFunction(program, 'releaseExecutionRecord');
  const drainRecord = topFunction(program, 'drainExecutionRecord');
  const createLease = topFunction(program, 'executionWorkerLease');
  const createRecord = topFunction(program, 'createExecutionRecord');
  const createSupervisor = topFunction(program, 'createExecutionSupervisor');
  const executionSession = topFunction(program, 'executionSessionIdentity');
  const sameSession = topFunction(program, 'sameExecutionSession');
  const retireSession = topFunction(program, 'retireDrainingSession');
  const protectedHelpers = [
    'acquireExecutionWorker', 'admitNextExecution', 'createExecutionRecord',
    'createExecutionSupervisor', 'createExecutionWorkerManager', 'drainExecutionRecord',
    'executionWorkerLease', 'releaseExecutionRecord', 'stopExecutionRecord',
    'executionSessionIdentity', 'retireDrainingSession', 'sameExecutionSession',
    'validateAcquisition', 'waitForExecutionSlot',
  ];
  const drainTimeoutBindings = ['requestedTimeout', 'boundedTimeout'];
  if (!creator || !acquire || !waitForSlot || !validateAcquisition || !stopRecord
    || !releaseRecord || !drainRecord || !createLease || !createRecord || !createSupervisor
    || !managerCreatorParametersValid(creator)
    || !exactParameterList(acquire, [
      (value) => identifier(value, 'manager'),
      (value) => identifier(value, 'authority'),
      (value) => identifier(value, 'identity'),
      (value) => defaultedIdentifierParameter(value, 'options', (entry) => exactObject(entry, {})),
    ])
    || !exactIdentifierParameters(waitForSlot, ['manager', 'requestId', 'signal'])
    || !exactProtectedIdentifierParameters(validateAcquisition, ['manager', 'identity'])
    || !exactProtectedIdentifierParameters(stopRecord, ['manager', 'requestId', 'record'])
    || !exactProtectedIdentifierParameters(releaseRecord, ['manager', 'requestId', 'record'])
    || !exactParameterList(drainRecord, [
      (value) => identifier(value, 'manager'),
      (value) => identifier(value, 'requestId'),
      (value) => identifier(value, 'record'),
      (value) => identifier(value, 'settlement'),
      (value) => objectPatternBindsExactly(value, ['timeoutMs'], {
        topLevelDefault: true,
        propertyDefaults: { timeoutMs: (entry) => literal(entry, 1) },
        requiredPropertyDefaults: ['timeoutMs'],
      }),
    ])
    || !exactProtectedIdentifierParameters(createLease, ['manager', 'requestId', 'record', 'state'])
    || !(exactProtectedIdentifierParameters(createRecord, ['supervisor'])
      || (exactProtectedIdentifierParameters(createRecord, ['supervisor', 'authority', 'identity'])
        && executionSession && sameSession && retireSession))
    || !exactProtectedIdentifierParameters(createSupervisor, ['manager'])
    || !stableProgramIdentifiers(program, [
      ...protectedHelpers, 'Error', 'Map', 'Math', 'Number', 'Object', 'Promise',
      'Set', 'String', 'clearTimeout', 'setTimeout',
    ], {
      globals: ['Error', 'Map', 'Math', 'Number', 'Object', 'Promise', 'Set',
        'String', 'clearTimeout', 'setTimeout'],
    })
    || functionHasMemberWrite(program, [
      ['manager', 'executions'], ['manager', 'supervisorFactory'],
      ['manager', 'supervisorOptions'], ['record', 'supervisor'],
    ])
    || functionHasNestedBinding(drainRecord, [
      ...drainTimeoutBindings, 'Math', 'Number', 'setTimeout', 'timeoutMs',
    ], { allowedDirectBindings: drainTimeoutBindings })
    || functionHasIdentifierWrite(drainRecord, [
      ...drainTimeoutBindings, 'Math', 'Number', 'setTimeout', 'timeoutMs',
    ])
    || !safeTimerTimeoutBinding(drainRecord, {
      sourceName: 'timeoutMs', requestedName: 'requestedTimeout',
      boundedName: 'boundedTimeout', maximum: 2_147_483_647,
    })) return false;

  const validatedRequestId = directDeclarator(validateAcquisition.body, 'requestId', 'const');
  const validatedReturns = validateAcquisition.body.body.filter((statement) => exactReturn(
    statement, (value) => identifier(value, 'requestId'),
  ));
  if (!validatedRequestId || !methodCall(
    validatedRequestId.declaration.init,
    'trim',
    (receiver) => call(receiver, ['String'], [
      (value) => logical(
        value,
        '||',
        (left) => member(left, ['identity', 'requestId']),
        (right) => literal(right, ''),
      ),
    ]),
    [],
  ) || validatedReturns.length !== 1) return false;

  const supervisorReturn = createSupervisor.body.body.filter((statement) => exactReturn(
    statement,
    (value) => call(value, ['manager', 'supervisorFactory'])
      && value.arguments.length === 1
      && unwrap(value.arguments[0])?.properties?.length === 6
      && objectIncludesExactProperties(value.arguments[0], {
        enabled: (entry) => literal(entry, true),
        fork: (entry) => member(entry, ['manager', 'fork']),
        maxPendingRequests: (entry) => literal(entry, 1),
        maxRestarts: (entry) => literal(entry, 0),
        stripMainOwnedCapabilitiesForTest: (entry) => member(
          entry, ['manager', 'stripMainOwnedCapabilitiesForTest'],
        ),
      }, {
        allowedSpreads: [(entry) => member(entry, ['manager', 'supervisorOptions'])],
      }),
  ));
  const recordObject = returnedObject(createRecord);
  const leaseObject = returnedObject(createLease);
  const legacyRecordObject = recordObject && exactObject(recordObject, {
    supervisor: (value) => identifier(value, 'supervisor'),
    released: (value) => literal(value, false),
    holdsSlot: (value) => literal(value, false),
    resolveDrain: (value) => literal(value, null),
    finalizationPromise: (value) => literal(value, null),
    stopPromise: (value) => literal(value, null),
  });
  const sessionAwareRecordObject = recordObject && recordObject.properties.length === 7
    && objectIncludesExactProperties(recordObject, {
      supervisor: (value) => identifier(value, 'supervisor'),
      sessionIdentity: (value) => call(value, ['executionSessionIdentity'], [
        (entry) => identifier(entry, 'authority'),
        (entry) => identifier(entry, 'identity'),
      ]),
      released: (value) => literal(value, false),
      holdsSlot: (value) => literal(value, false),
      resolveDrain: (value) => literal(value, null),
      finalizationPromise: (value) => literal(value, null),
      stopPromise: (value) => literal(value, null),
    });
  if (supervisorReturn.length !== 1 || (!legacyRecordObject && !sessionAwareRecordObject)
    || !leaseObject || !exactObject(leaseObject, {
    drain: (value) => exactParameterList(unwrap(value), [
      (entry) => identifier(entry, 'settlement'),
      (entry) => identifier(entry, 'options'),
    ]) && arrowCallsExactly(value, ['drainExecutionRecord'], [
      (entry) => identifier(entry, 'manager'),
      (entry) => identifier(entry, 'requestId'),
      (entry) => identifier(entry, 'record'),
      (entry) => identifier(entry, 'settlement'),
      (entry) => identifier(entry, 'options'),
    ]),
    release: (value) => exactIdentifierParameters(unwrap(value), [])
      && arrowCallsExactly(value, ['releaseExecutionRecord'], [
        (entry) => identifier(entry, 'manager'),
        (entry) => identifier(entry, 'requestId'),
        (entry) => identifier(entry, 'record'),
      ]),
    state: (value) => identifier(value, 'state'),
    supervisor: (value) => member(value, ['record', 'supervisor']),
  })) return false;

  const stopAssignments = directAssignmentStatements(stopRecord.body, ['record', 'stopPromise']);
  const stopGuard = stopRecord.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && member(statement.test, ['record', 'stopPromise'])
    && exactReturn(statement.consequent, (value) => member(value, ['record', 'stopPromise']))
  ));
  const stopReturns = stopRecord.body.body.filter((statement) => exactReturn(
    statement, (value) => member(value, ['record', 'stopPromise']),
  ));
  const stopChain = unwrap(stopAssignments[0]?.expression?.right);
  const stopChainValid = methodCall(
    stopChain,
    'finally',
    (receiver) => methodCall(
      receiver,
      'then',
      (base) => call(base, ['Promise', 'resolve'], []),
      [(callback) => exactIdentifierParameters(unwrap(callback), [])
        && arrowCallsExactly(callback, ['record', 'supervisor', 'stop'], [])],
    ),
    [(callback) => {
      callback = unwrap(callback);
      if (callback?.type !== 'ArrowFunctionExpression'
        || !exactIdentifierParameters(callback, [])
        || callback.body?.type !== 'BlockStatement'
        || callback.body.body.length !== 2
        || !directCallStatement(callback.body.body[0], ['manager', 'drainingExecutions', 'delete'], [
          (entry) => identifier(entry, 'requestId'),
        ])) return false;
      const admit = callback.body.body[1];
      return admit?.type === 'IfStatement'
        && unary(admit.test, '!', (entry) => member(entry, ['manager', 'stopping']))
        && directCallStatement(admit.consequent, ['admitNextExecution'], [
          (entry) => identifier(entry, 'manager'),
        ]);
    }],
  );
  if (stopGuard.length !== 1 || stopAssignments.length !== 1 || stopReturns.length !== 1
    || !stopChainValid
    || !directStatementsOrderedAndReachable(stopRecord.body, [
      stopGuard[0], stopAssignments[0], stopReturns.at(-1),
    ])) {
    return false;
  }

  const releaseDeletes = releaseRecord.body.body.filter((statement) => directCallStatement(
    statement, ['manager', 'executions', 'delete'], [(value) => identifier(value, 'requestId')],
  ));
  const releaseStops = releaseRecord.body.body.filter((statement) => exactReturn(
    statement, (value) => call(value, ['stopExecutionRecord'], [
      (entry) => identifier(entry, 'manager'),
      (entry) => identifier(entry, 'requestId'),
      (entry) => identifier(entry, 'record'),
    ]),
  ));
  if (releaseDeletes.length !== 1 || releaseStops.length !== 1
    || !directStatementsOrderedAndReachable(releaseRecord.body, [
      releaseDeletes[0], releaseStops[0],
    ])) return false;

  const deadline = directDeclarator(drainRecord.body, 'deadline', 'const');
  const deadlineExecutor = unwrap(deadline?.declaration?.init?.arguments?.[0]);
  const deadlineAssignment = unwrap(deadlineExecutor?.body?.body?.[0]?.expression);
  const requestedTimeout = directDeclarator(drainRecord.body, 'requestedTimeout', 'const');
  const boundedTimeout = directDeclarator(drainRecord.body, 'boundedTimeout', 'const');
  const drainDeletes = drainRecord.body.body.filter((statement) => directCallStatement(
    statement, ['manager', 'executions', 'delete'], [(value) => identifier(value, 'requestId')],
  ));
  const finalizationAssignments = directAssignmentStatements(
    drainRecord.body, ['record', 'finalizationPromise'],
  );
  const finalizationChain = unwrap(finalizationAssignments[0]?.expression?.right);
  const finalizationValid = methodCall(
    finalizationChain,
    'then',
    (receiver) => call(receiver, ['Promise', 'race'])
      && receiver.arguments.length === 1
      && receiver.arguments[0]?.type === 'ArrayExpression'
      && receiver.arguments[0].elements.length === 3
      && methodCall(
        receiver.arguments[0].elements[0],
        'catch',
        (entry) => call(entry, ['Promise', 'resolve'], [
          (value) => identifier(value, 'settlement'),
        ]),
        [(callback) => exactIdentifierParameters(unwrap(callback), [])
          && unwrap(callback)?.body?.type === 'BlockStatement'
          && unwrap(callback).body.body.length === 0],
      )
      && identifier(receiver.arguments[0].elements[1], 'deadline')
      && identifier(receiver.arguments[0].elements[2], 'preempted'),
    [(callback) => {
      callback = unwrap(callback);
      if (callback?.type !== 'ArrowFunctionExpression'
        || !exactIdentifierParameters(callback, [])
        || callback.body?.type !== 'BlockStatement') return false;
      const returns = callback.body.body.filter((statement) => exactReturn(
        statement, (value) => call(value, ['stopExecutionRecord'], [
          (entry) => identifier(entry, 'manager'),
          (entry) => identifier(entry, 'requestId'),
          (entry) => identifier(entry, 'record'),
        ]),
      ));
      return returns.length === 1 && directStatementReachable(callback.body, returns[0]);
    }],
  );
  if (!deadline || !construct(deadline.declaration.init, 'Promise')
    || deadlineExecutor?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(deadlineExecutor, ['resolveDeadline'])
    || deadlineExecutor.body?.type !== 'BlockStatement'
    || deadlineExecutor.body.body.length !== 2
    || deadlineAssignment?.type !== 'AssignmentExpression'
    || !identifier(deadlineAssignment.left, 'timer')
    || !call(deadlineAssignment.right, ['setTimeout'], [
      (entry) => identifier(entry, 'resolveDeadline'),
      (entry) => identifier(entry, 'boundedTimeout'),
    ])
    || !directCallStatement(deadlineExecutor.body.body[1], ['timer', 'unref'], [])
    || drainDeletes.length !== 1 || finalizationAssignments.length !== 1
    || !finalizationValid) return false;
  const drainTimeoutCalls = [];
  visit(drainRecord.body, (node) => {
    if (call(node, ['setTimeout'])) drainTimeoutCalls.push(node);
  });
  if (drainTimeoutCalls.length !== 1
    || drainTimeoutCalls[0] !== unwrap(deadlineAssignment.right)) return false;
  const drainReturns = drainRecord.body.body.filter((statement) => exactReturn(
    statement, (value) => member(value, ['record', 'finalizationPromise']),
  ));
  if (drainReturns.length < 1
    || !directStatementsOrderedAndReachable(drainRecord.body, [
      drainDeletes[0], requestedTimeout.statement, boundedTimeout.statement,
      deadline.statement, finalizationAssignments[0], drainReturns.at(-1),
    ])) return false;

  const requestId = directDeclarator(acquire.body, 'requestId', 'const');
  const reserved = directDeclarator(acquire.body, 'reserved', 'const');
  const supervisor = directDeclarator(acquire.body, 'supervisor', 'const');
  const record = directDeclarator(acquire.body, 'record', 'const');
  const indexes = acquire.body.body.filter((statement) => directCallStatement(
    statement, ['manager', 'executions', 'set'], [
      (value) => identifier(value, 'requestId'),
      (value) => identifier(value, 'record'),
    ],
  ));
  const attempts = acquire.body.body.filter((statement) => (
    statement.type === 'TryStatement' && statement.handler && !statement.finalizer
  ));
  if (!requestId || !call(requestId.declaration.init, ['validateAcquisition'], [
    (value) => identifier(value, 'manager'),
    (value) => identifier(value, 'identity'),
  ]) || !reserved || reserved.declaration.init?.type !== 'AwaitExpression'
    || !call(reserved.declaration.init.argument, ['waitForExecutionSlot'], [
      (value) => identifier(value, 'manager'),
      (value) => identifier(value, 'requestId'),
      (value) => member(value, ['options', 'signal']),
    ])
    || !supervisor || !call(supervisor.declaration.init, ['createExecutionSupervisor'], [
      (value) => identifier(value, 'manager'),
    ])
    || !record || !(call(record.declaration.init, ['createExecutionRecord'], [
      (value) => identifier(value, 'supervisor'),
    ]) || call(record.declaration.init, ['createExecutionRecord'], [
      (value) => identifier(value, 'supervisor'),
      (value) => identifier(value, 'authority'),
      (value) => identifier(value, 'identity'),
    ]))
    || indexes.length !== 1 || attempts.length !== 1) return false;
  const attempt = attempts[0];
  const state = directDeclarator(attempt.block, 'state', 'const');
  const success = attempt.block.body.filter((statement) => exactReturn(
    statement, (value) => call(value, ['executionWorkerLease'], [
      (entry) => identifier(entry, 'manager'),
      (entry) => identifier(entry, 'requestId'),
      (entry) => identifier(entry, 'record'),
      (entry) => identifier(entry, 'state'),
    ]),
  ));
  const failureDeletes = attempt.handler.body.body.filter((statement) => directCallStatement(
    statement, ['manager', 'executions', 'delete'], [(value) => identifier(value, 'requestId')],
  ));
  const failureStops = attempt.handler.body.body.filter((statement) => {
    let value = unwrap(statement?.expression);
    if (statement?.type !== 'ExpressionStatement' || value?.type !== 'AwaitExpression') return false;
    value = unwrap(value.argument);
    return methodCall(value, 'catch', (receiver) => call(receiver, ['supervisor', 'stop'], []), [
      (callback) => exactIdentifierParameters(unwrap(callback), [])
        && unwrap(callback)?.body?.type === 'BlockStatement'
        && unwrap(callback).body.body.length === 0,
    ]);
  });
  const rethrows = attempt.handler.body.body.filter((statement) => (
    statement.type === 'ThrowStatement' && identifier(statement.argument, 'error')
  ));
  const acquireMutations = protectedCollectionMutationCalls(
    acquire, ['manager', 'executions'], ['add', 'clear', 'delete', 'set'],
  );
  if (!state || state.declaration.init?.type !== 'AwaitExpression'
    || !call(state.declaration.init.argument, ['supervisor', 'start'], [
      (value) => identifier(value, 'authority'),
    ])
    || success.length !== 1 || failureDeletes.length !== 1
    || failureStops.length !== 1 || rethrows.length !== 1
    || acquireMutations.length !== 2
    || acquireMutations.filter((entry) => entry.method === 'set').length !== 1
    || acquireMutations.filter((entry) => entry.method === 'delete').length !== 1
    || !directStatementsOrderedAndReachable(acquire.body, [
      reserved.statement, supervisor.statement, record.statement, indexes[0], attempt,
    ])
    || !directStatementsOrderedAndReachable(attempt.handler.body, [
      failureDeletes[0], failureStops[0], rethrows[0],
    ])) return false;

  const releaseMutations = protectedCollectionMutationCalls(
    releaseRecord, ['manager', 'executions'], ['add', 'clear', 'delete', 'set'],
  );
  const drainMutations = protectedCollectionMutationCalls(
    drainRecord, ['manager', 'executions'], ['add', 'clear', 'delete', 'set'],
  );
  const manager = directDeclarator(creator.body, 'manager', 'const');
  const managerStop = localArrow(creator.body, 'stop');
  const managerApi = returnedObject(creator);
  if (!manager || !objectIncludesExactProperties(manager.declaration.init, {
    executions: (value) => construct(value, 'Map', []),
    supervisorFactory: (value) => identifier(value, 'supervisorFactory'),
    supervisorOptions: (value) => identifier(value, 'supervisorOptions'),
  }) || !managerStop || !exactIdentifierParameters(managerStop, []) || managerStop.async !== true
    || !managerApi || !objectIncludesExactProperties(managerApi, {
      acquire: (value) => exactIdentifierParameters(unwrap(value), ['authority', 'identity', 'options'])
        && arrowCallsExactly(value, ['acquireExecutionWorker'], [
          (entry) => identifier(entry, 'manager'),
          (entry) => identifier(entry, 'authority'),
          (entry) => identifier(entry, 'identity'),
          (entry) => identifier(entry, 'options'),
        ]),
      stop: (value) => identifier(value, 'stop'),
    })
    || releaseMutations.length !== 1 || releaseMutations[0].method !== 'delete'
    || drainMutations.length !== 1 || drainMutations[0].method !== 'delete') return false;
  const stopClears = managerStop.body.body.filter((statement) => directCallStatement(
    statement, ['manager', 'executions', 'clear'], [],
  ));
  let awaitedStopRecords = 0;
  visit(managerStop.body, (node) => {
    if (node.type === 'AwaitExpression' && call(node.argument, ['stopExecutionRecord'], [
      (entry) => identifier(entry, 'manager'),
      (entry) => identifier(entry, 'requestId'),
      (entry) => identifier(entry, 'record'),
    ])) awaitedStopRecords += 1;
  });
  const managerStopMutations = protectedCollectionMutationCalls(
    managerStop, ['manager', 'executions'], ['add', 'clear', 'delete', 'set'],
  );
  return stopClears.length === 1 && awaitedStopRecords === 1
    && managerStopMutations.length === 1 && managerStopMutations[0].method === 'clear';
}

function managerPressureAstContract(source) {
  const program = parseProgram(source);
  const acquire = topFunction(program, 'acquireExecutionWorker');
  const waitForSlot = topFunction(program, 'waitForExecutionSlot');
  if (!acquire || !waitForSlot
    || functionHasNestedBinding(acquire, ['waitForExecutionSlot'])
    || functionHasIdentifierWrite(acquire, ['waitForExecutionSlot'])) {
    return false;
  }
  const supervisor = directDeclarator(acquire.body, 'supervisor', 'const');
  if (!supervisor) return false;
  const waits = acquire.body.body.filter((statement) => {
    let expression = null;
    if (statement.type === 'ExpressionStatement') {
      expression = unwrap(statement.expression);
    } else if (statement.type === 'VariableDeclaration'
      && statement.kind === 'const'
      && statement.declarations.length === 1) {
      expression = unwrap(statement.declarations[0].init);
    }
    if (expression?.type !== 'AwaitExpression') return false;
    const wait = unwrap(expression.argument);
    return call(wait, ['waitForExecutionSlot'])
      && wait.arguments.length >= 2
      && identifier(wait.arguments[0], 'manager')
      && identifier(wait.arguments[1], 'requestId')
      && (wait.arguments.length === 2
        || (wait.arguments.length === 3
          && member(wait.arguments[2], ['options', 'signal'])));
  });
  return Boolean(managerPressureBranch(waitForSlot))
    && waits.length === 1
    && directStatementsOrderedAndReachable(acquire.body, [waits[0], supervisor.statement]);
}

function contextHelperAstContract(sourceByPath) {
  const wrapperSource = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage.cjs') || '';
  const implementationSource = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage-lease.cjs') || '';
  const wrapper = parseProgram(wrapperSource);
  const implementation = parseProgram(implementationSource);
  const creator = topFunction(implementation, 'createExecutionWorkerContextUsageLease');
  const drain = topFunction(implementation, 'releaseExecutionWorkerLeaseAfterContextUsage');
  if (!wrapper || !creator || !drain
    || !exactTopLevelRequireBinding(
      wrapper,
      'createExecutionWorkerContextUsageLease',
      'createExecutionWorkerContextUsageLease',
      './execution-worker-context-usage-lease.cjs',
    )
    || !exactTopLevelRequireBinding(
      wrapper,
      'releaseExecutionWorkerLeaseAfterContextUsage',
      'releaseExecutionWorkerLeaseAfterContextUsage',
      './execution-worker-context-usage-lease.cjs',
    )
    || !exactTopLevelModuleExports(wrapper, {
      createExecutionWorkerContextUsageLease: (value) => identifier(
        value, 'createExecutionWorkerContextUsageLease',
      ),
      releaseExecutionWorkerLeaseAfterContextUsage: (value) => identifier(
        value, 'releaseExecutionWorkerLeaseAfterContextUsage',
      ),
    })
    || !exactTopLevelModuleExports(implementation, {
      createExecutionWorkerContextUsageLease: (value) => identifier(
        value, 'createExecutionWorkerContextUsageLease',
      ),
      releaseExecutionWorkerLeaseAfterContextUsage: (value) => identifier(
        value, 'releaseExecutionWorkerLeaseAfterContextUsage',
      ),
    })
    || !stableProgramIdentifiers(implementation, [
      'Math', 'Number', 'Promise', 'createExecutionWorkerContextUsageLease',
      'releaseExecutionWorkerLeaseAfterContextUsage', 'setTimeout',
    ], { globals: ['Math', 'Number', 'Promise', 'setTimeout'] })
    || !exactParameterList(drain, [
      (value) => identifier(value, 'lease'),
      (value) => identifier(value, 'settlement'),
      (value) => objectPatternBindsExactly(value, ['timeoutMs'], {
        topLevelDefault: true,
        propertyDefaults: {
          timeoutMs: (entry) => literal(entry, 1000),
        },
        requiredPropertyDefaults: ['timeoutMs'],
      }),
    ])
    || !exactParameterList(creator, [
      (value) => objectPatternBindsExactly(value, ['timeoutMs'], {
        topLevelDefault: true,
        propertyDefaults: {
          timeoutMs: (entry) => literal(entry, 1000),
        },
        requiredPropertyDefaults: ['timeoutMs'],
      }),
    ])
    || functionHasOwnParameterBinding(creator, ['releaseExecutionWorkerLeaseAfterContextUsage'])
    || functionHasNestedBinding(creator, [
      'Math', 'Number', 'Promise', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'setTimeout', 'timeoutMs',
    ])
    || functionHasIdentifierWrite(creator, [
      'Math', 'Number', 'Promise', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'setTimeout', 'timeoutMs',
    ])
    || functionHasNestedBinding(drain, [
      'lease', 'Math', 'Number', 'Promise', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'setTimeout', 'settlement', 'timeoutMs', 'requestedTimeout', 'boundedTimeout',
    ], { allowedDirectBindings: ['requestedTimeout', 'boundedTimeout'] })
    || functionHasIdentifierWrite(drain, [
      'lease', 'Math', 'Number', 'Promise', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'setTimeout', 'settlement', 'timeoutMs',
    ])
    || functionHasMemberWrite(drain, [['lease', 'drain']])
    || functionHasMemberWrite(creator, [['executionWorkerLease', 'release']])) return false;
  const completed = directDeclarator(creator.body, 'completed', 'let');
  const settlement = directDeclarator(creator.body, 'settlement', 'const');
  const requested = directDeclarator(drain.body, 'requestedTimeout', 'const');
  const bounded = directDeclarator(drain.body, 'boundedTimeout', 'const');
  if (!completed || !literal(completed.declaration.init, false)
    || !settlement
    || !construct(settlement.declaration.init, 'Promise')
    || settlement.declaration.init.arguments.length !== 1
    || !exactProtectedIdentifierParameters(
      unwrap(settlement.declaration.init.arguments[0]), ['resolve'],
    )
    || countAssignments(
      creator,
      (left) => patternNames(left).includes('completed'),
    ) !== 1
    || !requested || !bounded
    || !safeTimerTimeoutBinding(drain, {
      sourceName: 'timeoutMs', requestedName: 'requestedTimeout',
      boundedName: 'boundedTimeout', maximum: 11_000, fallback: 1000,
    })) return false;
  const returned = returnedObject(creator);
  if (!returned) return false;
  let releaseFunction = null;
  const returnedValid = exactObject(returned, {
    observeTerminal: (value) => {
      value = unwrap(value);
      if (value?.type !== 'ArrowFunctionExpression' || value.body?.type !== 'BlockStatement'
        || !exactIdentifierParameters(value, ['payload'])
        || value.body.body.length !== 1) return false;
      const expression = unwrap(value.body.body[0]?.expression);
      return expression?.type === 'AssignmentExpression'
        && identifier(expression.left, 'completed')
        && binary(
          expression.right, '===',
          (entry) => member(entry, ['payload', 'outcome']),
          (entry) => literal(entry, 'completed'),
        );
    },
    release: (value) => {
      value = unwrap(value);
      releaseFunction = value;
      return value?.type === 'ArrowFunctionExpression' && value.async === true
        && value.params.length === 1
        && identifier(value.params[0], 'executionWorkerLease')
        && value.body?.type === 'BlockStatement';
    },
    settle: (value) => identifier(value, 'settle'),
  });
  if (!returnedValid || !releaseFunction
    || functionHasNestedBinding(releaseFunction, [
      'completed', 'executionWorkerLease', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'settlement', 'timeoutMs',
    ])
    || functionHasIdentifierWrite(releaseFunction, [
      'completed', 'executionWorkerLease', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'settlement', 'timeoutMs',
    ])
    || functionHasMemberWrite(releaseFunction, [['executionWorkerLease', 'release']])) return false;
  const completedBranches = releaseFunction.body.body.filter((statement) => (
    statement.type === 'IfStatement' && identifier(statement.test, 'completed')
  ));
  if (completedBranches.length !== 1 || completedBranches[0].consequent?.type !== 'BlockStatement') return false;
  const completedBody = completedBranches[0].consequent.body;
  if (completedBody.length !== 2
    || !directCallStatement(completedBody[0], ['releaseExecutionWorkerLeaseAfterContextUsage'], [
      (value) => identifier(value, 'executionWorkerLease'),
      (value) => identifier(value, 'settlement'),
      (value) => exactObject(value, { timeoutMs: (entry) => identifier(entry, 'timeoutMs') }),
    ], { await_: true })
    || !exactReturn(completedBody[1], (value) => literal(value, true))) return false;
  const incompleteReleases = releaseFunction.body.body.filter((statement) => directCallStatement(
    statement, ['executionWorkerLease', 'release'], [], { await_: true },
  ));
  return incompleteReleases.length === 1;
}

function currentContextHelperAstContract(sourceByPath) {
  const wrapperSource = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage.cjs') || '';
  const implementationSource = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage-lease.cjs') || '';
  const wrapper = parseProgram(wrapperSource);
  const implementation = parseProgram(implementationSource);
  const creator = topFunction(implementation, 'createExecutionWorkerContextUsageLease');
  const releaseAfterUsage = topFunction(
    implementation, 'releaseExecutionWorkerLeaseAfterContextUsage',
  );
  const timeout = directDeclarator(
    implementation, 'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS', 'const',
  );
  const helperExports = {
    createExecutionWorkerContextUsageLease: (value) => identifier(
      value, 'createExecutionWorkerContextUsageLease',
    ),
    releaseExecutionWorkerLeaseAfterContextUsage: (value) => identifier(
      value, 'releaseExecutionWorkerLeaseAfterContextUsage',
    ),
  };
  if (!wrapper || !implementation || !creator || !releaseAfterUsage || !timeout
    || !literal(timeout.declaration.init, 11_000)
    || !exactTopLevelRequireBinding(
      wrapper,
      'createExecutionWorkerContextUsageLease',
      'createExecutionWorkerContextUsageLease',
      './execution-worker-context-usage-lease.cjs',
    )
    || !exactTopLevelRequireBinding(
      wrapper,
      'releaseExecutionWorkerLeaseAfterContextUsage',
      'releaseExecutionWorkerLeaseAfterContextUsage',
      './execution-worker-context-usage-lease.cjs',
    )
    || !topLevelModuleExportsIncludes(wrapper, helperExports)
    || !topLevelModuleExportsIncludes(implementation, helperExports)
    || !stableProgramIdentifiers(implementation, [
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS', 'Math', 'Number', 'Promise',
      'clearTimeout', 'createExecutionWorkerContextUsageLease',
      'releaseExecutionWorkerLeaseAfterContextUsage', 'setTimeout',
    ], { globals: ['Math', 'Number', 'Promise', 'clearTimeout', 'setTimeout'] })
    || !exactParameterList(releaseAfterUsage, [
      (value) => identifier(value, 'lease'),
      (value) => identifier(value, 'settlement'),
      (value) => objectPatternBindsExactly(value, ['timeoutMs'], {
        topLevelDefault: true,
        propertyDefaults: {
          timeoutMs: (entry) => identifier(
            entry, 'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS',
          ),
        },
        requiredPropertyDefaults: ['timeoutMs'],
      }),
    ])
    || !exactParameterList(creator, [
      (value) => objectPatternBindsExactly(value, ['timeoutMs'], {
        topLevelDefault: true,
        propertyDefaults: {
          timeoutMs: (entry) => identifier(
            entry, 'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS',
          ),
        },
        requiredPropertyDefaults: ['timeoutMs'],
      }),
    ])
    || functionHasNestedBinding(releaseAfterUsage, [
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS', 'lease', 'Math', 'Number',
      'Promise', 'clearTimeout', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'settlement', 'setTimeout', 'timeoutMs', 'requestedTimeout', 'boundedTimeout',
      'deadline', 'release', 'timer',
    ], { allowedDirectBindings: [
      'requestedTimeout', 'boundedTimeout', 'deadline', 'release', 'timer',
    ] })
    || functionHasIdentifierWrite(releaseAfterUsage, [
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS', 'lease', 'Math', 'Number',
      'Promise', 'clearTimeout', 'deadline', 'release',
      'releaseExecutionWorkerLeaseAfterContextUsage', 'settlement', 'setTimeout', 'timeoutMs',
    ])
    || functionHasNestedBinding(creator, [
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS', 'completed',
      'releaseExecutionWorkerLeaseAfterContextUsage', 'timeoutMs',
    ], { allowedDirectBindings: ['completed'] })
    || functionHasIdentifierWrite(creator, [
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS',
      'releaseExecutionWorkerLeaseAfterContextUsage', 'timeoutMs',
    ])
    || functionHasMemberWrite(releaseAfterUsage, [
      ['lease', 'drain'], ['lease', 'release'],
    ])) return false;

  const bounded = directDeclarator(releaseAfterUsage.body, 'boundedTimeout', 'const');
  if (!bounded
    || !safeTimerTimeoutBinding(releaseAfterUsage, {
      sourceName: 'timeoutMs', requestedName: 'requestedTimeout',
      boundedName: 'boundedTimeout',
      fallback: (entry) => identifier(
        entry, 'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS',
      ),
      maximum: (entry) => identifier(
        entry, 'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS',
      ),
    })) return false;
  const drainBranches = releaseAfterUsage.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && binary(
      statement.test,
      '===',
      (left) => unary(left, 'typeof', (entry) => member(entry, ['lease', 'drain'])),
      (right) => literal(right, 'function'),
    )
    && statement.consequent?.type === 'BlockStatement'
    && statement.consequent.body.length === 1
    && exactReturn(statement.consequent.body[0], (value) => methodCall(
      value,
      'then',
      (receiver) => call(receiver, ['Promise', 'resolve'], [
        (entry) => call(entry, ['lease', 'drain'], [
          (argument) => identifier(argument, 'settlement'),
          (argument) => exactObject(argument, {
            timeoutMs: (timeoutValue) => identifier(timeoutValue, 'boundedTimeout'),
          }),
        ]),
      ]),
      [
        (callback) => exactIdentifierParameters(unwrap(callback), [])
          && literal(unwrap(callback).body, true),
        (callback) => exactIdentifierParameters(unwrap(callback), [])
          && literal(unwrap(callback).body, false),
      ],
    ))
  ));
  const missingRelease = releaseAfterUsage.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && binary(
      statement.test,
      '!==',
      (left) => unary(left, 'typeof', (entry) => member(entry, ['lease', 'release'])),
      (right) => literal(right, 'function'),
    )
    && exactReturn(statement.consequent, (value) => call(value, ['Promise', 'resolve'], [
      (entry) => literal(entry, false),
    ]))
  ));
  const deadline = directDeclarator(releaseAfterUsage.body, 'deadline', 'const');
  const release = directDeclarator(releaseAfterUsage.body, 'release', 'const');
  const timer = directDeclarator(releaseAfterUsage.body, 'timer', 'let');
  if (drainBranches.length !== 1 || missingRelease.length !== 1
    || !deadline || !construct(deadline.declaration.init, 'Promise')
    || !timer || !literal(timer.declaration.init, null) || !release) return false;
  const deadlineExecutor = unwrap(deadline.declaration.init.arguments?.[0]);
  const deadlineTimerAssignment = unwrap(deadlineExecutor?.body?.body?.[0]?.expression);
  if (deadline.declaration.init.arguments.length !== 1
    || deadlineExecutor?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(deadlineExecutor, ['resolveDeadline'])
    || deadlineExecutor.body?.type !== 'BlockStatement'
    || deadlineExecutor.body.body.length !== 2
    || deadlineTimerAssignment?.type !== 'AssignmentExpression'
    || deadlineTimerAssignment.operator !== '='
    || !identifier(deadlineTimerAssignment.left, 'timer')
    || !call(deadlineTimerAssignment.right, ['setTimeout'], [
      (value) => identifier(value, 'resolveDeadline'),
      (value) => identifier(value, 'boundedTimeout'),
    ])
    || !directCallStatement(deadlineExecutor.body.body[1], ['timer', 'unref'], [])
    || countAssignments(releaseAfterUsage, (left) => identifier(left, 'timer')) !== 1) {
    return false;
  }
  const timeoutCalls = [];
  visit(releaseAfterUsage.body, (node) => {
    if (call(node, ['setTimeout'])) timeoutCalls.push(node);
  });
  if (timeoutCalls.length !== 1
    || timeoutCalls[0] !== unwrap(deadlineTimerAssignment.right)) return false;
  const releaseChain = unwrap(release.declaration.init);
  const releaseChainValid = methodCall(
    releaseChain,
    'then',
    (receiver) => call(receiver, ['Promise', 'race'])
      && receiver.arguments.length === 1
      && receiver.arguments[0]?.type === 'ArrayExpression'
      && receiver.arguments[0].elements.length === 2
      && methodCall(
        receiver.arguments[0].elements[0],
        'catch',
        (entry) => call(entry, ['Promise', 'resolve'], [
          (value) => identifier(value, 'settlement'),
        ]),
        [(callback) => exactIdentifierParameters(unwrap(callback), [])
          && unwrap(callback)?.body?.type === 'BlockStatement'
          && unwrap(callback).body.body.length === 0],
      )
      && identifier(receiver.arguments[0].elements[1], 'deadline'),
    [(callback) => {
      callback = unwrap(callback);
      if (callback?.type !== 'ArrowFunctionExpression' || callback.async !== true
        || !exactIdentifierParameters(callback, [])
        || callback.body?.type !== 'BlockStatement'
        || callback.body.body.length !== 2) return false;
      const [clear, attempt] = callback.body.body;
      if (clear?.type !== 'IfStatement' || !identifier(clear.test, 'timer')
        || !directCallStatement(clear.consequent, ['clearTimeout'], [
          (value) => identifier(value, 'timer'),
        ])
        || attempt?.type !== 'TryStatement' || attempt.finalizer
        || attempt.block.body.length !== 2 || attempt.handler?.body?.body.length !== 1
        || !directCallStatement(attempt.block.body[0], ['lease', 'release'], [], { await_: true })
        || !exactReturn(attempt.block.body[1], (value) => literal(value, true))
        || !exactReturn(attempt.handler.body.body[0], (value) => literal(value, false))) return false;
      return true;
    }],
  );
  const swallowedRelease = releaseAfterUsage.body.body.filter((statement) => {
    const expression = unwrap(statement?.expression);
    if (statement?.type !== 'ExpressionStatement'
      || expression?.type !== 'UnaryExpression' || expression.operator !== 'void') return false;
    return methodCall(expression.argument, 'catch', (receiver) => identifier(receiver, 'release'), [
      (callback) => exactIdentifierParameters(unwrap(callback), [])
        && unwrap(callback)?.body?.type === 'BlockStatement'
        && unwrap(callback).body.body.length === 0,
    ]);
  });
  const releaseReturns = releaseAfterUsage.body.body.filter((statement) => exactReturn(
    statement, (value) => identifier(value, 'release'),
  ));
  if (!releaseChainValid || swallowedRelease.length !== 1 || releaseReturns.length !== 1
    || !directStatementsOrderedAndReachable(releaseAfterUsage.body, [
      directDeclarator(releaseAfterUsage.body, 'requestedTimeout', 'const').statement,
      bounded.statement, drainBranches[0], missingRelease[0], timer.statement,
      deadline.statement, release.statement, swallowedRelease[0], releaseReturns[0],
    ])) return false;

  const completed = directDeclarator(creator.body, 'completed', 'let');
  const settle = directDeclarator(creator.body, 'settle', 'let');
  const settlement = directDeclarator(creator.body, 'settlement', 'const');
  const settlementExecutor = unwrap(settlement?.declaration?.init?.arguments?.[0]);
  if (!completed || !literal(completed.declaration.init, false) || !settle
    || settle.declaration.init !== null || !settlement
    || !construct(settlement.declaration.init, 'Promise')
    || settlementExecutor?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(settlementExecutor, ['resolve'])
    || settlementExecutor.body?.type !== 'BlockStatement'
    || settlementExecutor.body.body.length !== 1) return false;
  const settleAssignment = unwrap(settlementExecutor.body.body[0]?.expression);
  if (settleAssignment?.type !== 'AssignmentExpression'
    || settleAssignment.operator !== '='
    || !identifier(settleAssignment.left, 'settle')
    || !identifier(settleAssignment.right, 'resolve')
    || countAssignments(creator, (left) => patternNames(left).includes('completed')) !== 1) {
    return false;
  }
  const returned = returnedObject(creator);
  let releaseFunction = null;
  if (!returned || !exactObject(returned, {
    observeTerminal: (value) => {
      value = unwrap(value);
      if (value?.type !== 'ArrowFunctionExpression'
        || !exactIdentifierParameters(value, ['payload'])
        || value.body?.type !== 'BlockStatement'
        || value.body.body.length !== 1) return false;
      const assignment = unwrap(value.body.body[0]?.expression);
      return assignment?.type === 'AssignmentExpression'
        && assignment.operator === '='
        && identifier(assignment.left, 'completed')
        && binary(
          assignment.right,
          '===',
          (left) => member(left, ['payload', 'outcome']),
          (right) => literal(right, 'completed'),
        );
    },
    release: (value) => {
      releaseFunction = unwrap(value);
      return releaseFunction?.type === 'ArrowFunctionExpression'
        && releaseFunction.async === true
        && exactIdentifierParameters(releaseFunction, ['lease'])
        && releaseFunction.body?.type === 'BlockStatement';
    },
    settle: (value) => identifier(value, 'settle'),
  }) || !releaseFunction
    || functionHasNestedBinding(releaseFunction, [
      'completed', 'lease', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'settlement', 'timeoutMs',
    ])
    || functionHasIdentifierWrite(releaseFunction, [
      'completed', 'lease', 'releaseExecutionWorkerLeaseAfterContextUsage',
      'settlement', 'timeoutMs',
    ])
    || functionHasMemberWrite(releaseFunction, [['lease', 'release']])) return false;
  const completedBranches = releaseFunction.body.body.filter((statement) => (
    statement.type === 'IfStatement'
    && identifier(statement.test, 'completed')
    && statement.consequent?.type === 'BlockStatement'
  ));
  if (completedBranches.length !== 1) return false;
  const completedBody = completedBranches[0].consequent.body;
  if (completedBody.length !== 2
    || !directCallStatement(completedBody[0], ['releaseExecutionWorkerLeaseAfterContextUsage'], [
      (value) => identifier(value, 'lease'),
      (value) => identifier(value, 'settlement'),
      (value) => exactObject(value, { timeoutMs: (entry) => identifier(entry, 'timeoutMs') }),
    ], { void_: true })
    || !exactReturn(completedBody[1], (value) => literal(value, true))) return false;
  const incompleteAttempts = releaseFunction.body.body.filter((statement) => (
    statement.type === 'TryStatement' && !statement.finalizer
  ));
  if (incompleteAttempts.length !== 1) return false;
  const incomplete = incompleteAttempts[0];
  return incomplete.block.body.length === 2
    && directCallStatement(incomplete.block.body[0], ['lease', 'release'], [], { await_: true })
    && exactReturn(incomplete.block.body[1], (value) => literal(value, true))
    && incomplete.handler?.body?.body.length === 1
    && exactReturn(incomplete.handler.body.body[0], (value) => literal(value, false))
    && directStatementsOrderedAndReachable(releaseFunction.body, [
      completedBranches[0], incomplete,
    ]);
}

function desktopAstContract(sourceByPath) {
  const source = sourceByPath.get('electron/host-core/agent/desktop-host-context.cjs') || '';
  const program = parseProgram(source);
  const run = topFunction(program, 'runAgentInExecutionWorker');
  const directReleaseParametersValid = exactIdentifierParameters(run, ['identity', 'signal'])
    || exactIdentifierParameters(run, ['supervisor', 'identity', 'signal']);
  const parametersValid = directReleaseParametersValid || exactParameterList(run, [
      (value) => objectPatternBindsExactly(value, [
        'supervisor', 'identity', 'callbacks', 'contextUsageReleaseTimeoutMs',
      ], {
        topLevelDefault: true,
        propertyDefaults: {
          contextUsageReleaseTimeoutMs: (entry) => literal(entry, 1000),
        },
        requiredPropertyDefaults: ['contextUsageReleaseTimeoutMs'],
      }),
    ]);
  if (!run || !parametersValid
    || !stableProgramIdentifiers(program, [
      'createExecutionWorkerContextUsageLease', 'executionWorkerManager',
      'runAgentInExecutionWorker',
    ])) return false;
  const runParameterNames = run.params.flatMap((parameter) => patternNames(parameter));
  if (functionHasOwnParameterBinding(run, ['executionWorkerManager'])
    || functionHasNestedBinding(run, [
      'createExecutionWorkerContextUsageLease', 'executionWorkerManager', ...runParameterNames,
    ])
    || functionHasIdentifierWrite(run, [
      'createExecutionWorkerContextUsageLease', 'executionWorkerManager', ...runParameterNames,
    ])
    || functionHasMemberWrite(run, [
      ['contextUsageLease', 'release'],
      ['executionWorkerLease', 'supervisor', 'request'],
      ['supervisor', 'acquire'],
    ])) return false;
  const lease = directDeclarator(run.body, 'executionWorkerLease', 'let');
  const attempts = run.body.body.filter((statement) => statement.type === 'TryStatement' && statement.finalizer);
  if (!lease || !literal(lease.declaration.init, null) || attempts.length !== 1
    || countAssignments(run, (left) => identifier(left, 'executionWorkerLease')) !== 1) return false;
  const attempt = attempts[0];
  const acquisitionStatements = attempt.block.body.filter((statement) => {
    const expression = unwrap(statement?.expression);
    if (statement.type !== 'ExpressionStatement'
      || expression?.type !== 'AssignmentExpression'
      || !identifier(expression.left, 'executionWorkerLease')
      || expression.right?.type !== 'AwaitExpression') return false;
    const acquisition = unwrap(expression.right.argument);
    if (acquisition?.type !== 'CallExpression' || acquisition.arguments.length !== 3) return false;
    const directManager = member(acquisition.callee, ['executionWorkerManager', 'acquire'])
      && literal(acquisition.arguments[0], 'execution.start')
      && identifier(acquisition.arguments[1], 'identity')
      && exactObject(acquisition.arguments[2], {
        signal: (value) => identifier(value, 'signal'),
      });
    const delegatedManager = member(acquisition.callee, ['supervisor', 'acquire'])
      && identifier(acquisition.arguments[1], 'identity')
      && ((literal(acquisition.arguments[0], 'execution.start')
          && exactObject(acquisition.arguments[2], {
            signal: (value) => identifier(value, 'signal'),
          }))
        || (exactObject(acquisition.arguments[0], {
          authority: (value) => literal(value, true),
        }) && exactObject(acquisition.arguments[2], {
          signal: (value) => member(value, ['callbacks', 'abortController', 'signal']),
        })));
    return directManager || delegatedManager;
  });
  if (acquisitionStatements.length !== 1) return false;
  const directReleases = attempt.finalizer.body.filter((statement) => directCallStatement(
    statement, ['executionWorkerLease', 'release'], [], { await_: true },
  ));
  if (directReleases.length === 1) return directReleaseParametersValid;
  if (!exactTopLevelRequireBinding(
    program,
    'createExecutionWorkerContextUsageLease',
    'createExecutionWorkerContextUsageLease',
    './execution-worker-context-usage.cjs',
  )) return false;
  const contextLease = directDeclarator(run.body, 'contextUsageLease', 'const');
  if (!contextLease || !call(contextLease.declaration.init, ['createExecutionWorkerContextUsageLease'])) return false;
  const delegatedReleases = attempt.finalizer.body.filter((statement) => directCallStatement(
    statement,
    ['contextUsageLease', 'release'],
    [(value) => identifier(value, 'executionWorkerLease')],
    { await_: true },
  ));
  return delegatedReleases.length === 1
    && (contextHelperAstContract(sourceByPath) || currentContextHelperAstContract(sourceByPath));
}

function currentDesktopAstContract(sourceByPath) {
  const source = sourceByPath.get('electron/host-core/agent/desktop-host-context.cjs') || '';
  const program = parseProgram(source);
  const run = topFunction(program, 'runAgentInExecutionWorker');
  if (!run || !exactParameterList(run, [
    (value) => objectPatternIncludesExactBindings(value, {
      supervisor: (entry) => identifier(entry, 'supervisor'),
      callbacks: (entry) => identifier(entry, 'callbacks'),
      identity: (entry) => identifier(entry, 'identity'),
      contextUsageReleaseTimeoutMs: (entry) => defaultedIdentifierParameter(
        entry,
        'contextUsageReleaseTimeoutMs',
        (fallback) => identifier(fallback, 'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS'),
      ),
    }, { topLevelDefault: true }),
  ])
    || !exactTopLevelRequireBinding(
      program,
      'createExecutionWorkerContextUsageLease',
      'createExecutionWorkerContextUsageLease',
      './execution-worker-context-usage.cjs',
    )
    || !exactTopLevelRequireBinding(
      program,
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS',
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS',
      './execution-worker-context-usage.cjs',
    )
    || !stableProgramIdentifiers(program, [
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS',
      'createExecutionWorkerContextUsageLease', 'runAgentInExecutionWorker',
    ])
    || functionHasNestedBinding(run, [
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS', 'callbacks', 'contextUsageLease',
      'contextUsageReleaseTimeoutMs', 'createExecutionWorkerContextUsageLease',
      'executionWorkerLease', 'identity', 'supervisor',
    ], { allowedDirectBindings: ['contextUsageLease', 'executionWorkerLease'] })
    || functionHasIdentifierWrite(run, [
      'CONTEXT_USAGE_BACKGROUND_RELEASE_TIMEOUT_MS', 'callbacks',
      'contextUsageReleaseTimeoutMs', 'createExecutionWorkerContextUsageLease', 'identity',
    ])) return false;

  const lease = directDeclarator(run.body, 'executionWorkerLease', 'let');
  const contextLease = directDeclarator(run.body, 'contextUsageLease', 'const');
  const attempts = run.body.body.filter((statement) => (
    statement.type === 'TryStatement' && statement.finalizer
  ));
  if (!lease || !literal(lease.declaration.init, null)
    || !contextLease || !call(contextLease.declaration.init, [
      'createExecutionWorkerContextUsageLease',
    ], [
      (value) => exactObject(value, {
        timeoutMs: (entry) => identifier(entry, 'contextUsageReleaseTimeoutMs'),
      }),
    ])
    || attempts.length !== 1
    || countAssignments(run, (left) => identifier(left, 'executionWorkerLease')) !== 1
    || countAssignments(run, (left) => identifier(left, 'supervisor')) !== 1) return false;

  const attempt = attempts[0];
  const acquisitions = attempt.block.body.filter((statement) => {
    const expression = unwrap(statement?.expression);
    if (statement?.type !== 'ExpressionStatement'
      || expression?.type !== 'AssignmentExpression'
      || expression.operator !== '='
      || !identifier(expression.left, 'executionWorkerLease')
      || expression.right?.type !== 'AwaitExpression') return false;
    return call(expression.right.argument, ['supervisor', 'acquire'], [
      (value) => exactObject(value, {
        principalId: (entry) => member(entry, ['identity', 'principalId']),
        serverScope: (entry) => member(entry, ['identity', 'serverScope']),
        runtimeGeneration: (entry) => call(entry, ['String'], [
          (argument) => member(argument, ['identity', 'runtimeGeneration']),
        ]),
        runtimeEntry: (entry) => member(entry, ['identity', 'runtimeEntry']),
        runtimeHome: (entry) => call(entry, ['getRuntimeHome'], []),
        appRoot: (entry) => logical(
          entry,
          '||',
          (left) => call(left, ['textValue'], [
            (argument) => member(argument, ['process', 'env', 'QBOT_APP_ROOT']),
          ]),
          (right) => call(right, ['getRepoPath'], []),
        ),
      }),
      (value) => identifier(value, 'identity'),
      (value) => exactObject(value, {
        signal: (entry) => member(entry, ['callbacks', 'abortController', 'signal']),
      }),
    ]);
  });
  const supervisorAssignments = directAssignmentStatements(attempt.block, ['supervisor']);
  if (acquisitions.length !== 1 || supervisorAssignments.length !== 1
    || !member(
      supervisorAssignments[0].expression.right, ['executionWorkerLease', 'supervisor'],
    )) return false;
  const protectedPaths = [
    ['contextUsageLease', 'release'],
    ['executionWorkerLease', 'supervisor'],
    ['supervisor', 'acquire'],
  ];
  const remainingAttempt = {
    body: {
      ...attempt.block,
      body: attempt.block.body.filter((statement) => (
        statement !== acquisitions[0] && statement !== supervisorAssignments[0]
      )),
    },
  };
  const outerWithoutAttempt = {
    body: {
      ...run.body,
      body: run.body.body.filter((statement) => statement !== attempt),
    },
  };
  if (functionHasMemberWrite(remainingAttempt, protectedPaths)
    || functionHasMemberWrite(outerWithoutAttempt, protectedPaths)
    || functionHasMemberWrite({ body: attempt.finalizer }, protectedPaths)) return false;
  const terminal = directDeclarator(attempt.block, 'terminal', 'const');
  let terminalCall = unwrap(terminal?.declaration?.init);
  if (terminalCall?.type !== 'AwaitExpression') return false;
  terminalCall = unwrap(terminalCall.argument);
  if (!call(terminalCall, ['requestExecutionWorkerTurn'], [
    (value) => identifier(value, 'supervisor'),
    (value) => literal(value, 'execution.start'),
    (value) => exactObject(value, {
      principalId: (entry) => member(entry, ['identity', 'principalId']),
      serverScope: (entry) => member(entry, ['identity', 'serverScope']),
      runtimeGeneration: (entry) => call(entry, ['String'], [
        (argument) => member(argument, ['identity', 'runtimeGeneration']),
      ]),
      sessionId: (entry) => member(entry, ['identity', 'sessionId']),
      turnId: (entry) => member(entry, ['identity', 'turnId']),
      requestId: (entry) => member(entry, ['identity', 'requestId']),
    }),
    (value) => unwrap(value)?.type === 'ObjectExpression'
      && value.properties.every((property) => property.type === 'Property' && !property.computed),
    (value) => objectIncludesExactProperties(value, {
      deadlineMs: (entry) => identifier(entry, 'deadlineMs'),
      onContextUsage: (entry) => call(entry, ['createHostContextUsageHandler'], [
        (argument) => exactObject(argument, {
          supervisor: (item) => identifier(item, 'supervisor'),
          identity: (item) => identifier(item, 'identity'),
          callbacks: (item) => identifier(item, 'callbacks'),
          onSettled: (item) => member(item, ['contextUsageLease', 'settle']),
        }),
      ]),
    }),
    (value) => member(value, ['callbacks', 'abortController', 'signal']),
  ])) return false;
  const observations = attempt.block.body.filter((statement) => directCallStatement(
    statement, ['contextUsageLease', 'observeTerminal'], [
      (value) => member(value, ['terminal', 'payload']),
    ],
  ));
  const releases = attempt.finalizer.body.filter((statement) => directCallStatement(
    statement, ['contextUsageLease', 'release'], [
      (value) => identifier(value, 'executionWorkerLease'),
    ], { await_: true },
  ));
  return observations.length === 1 && releases.length === 1
    && directStatementsOrderedAndReachable(attempt.block, [
      acquisitions[0], supervisorAssignments[0], terminal.statement, observations[0],
    ])
    && currentContextHelperAstContract(sourceByPath);
}

export function auditQworkSuccessorAstContracts(sourceByPath) {
  const read = (path) => sourceByPath.get(path) || '';
  const result = {
    cancellation: cancellationAstContract(read('electron/host-core/agent/execution-worker-cancellation.cjs')),
    controller: controllerAstContract(read('electron/host-core/agent/execution-worker-controller.cjs')),
    deadline: deadlineAstContract(read('electron/host-core/agent/execution-worker-deadline.cjs')),
    callback_settlement: callbackSettlementAstContract(sourceByPath),
    event_flow: eventFlowAstContract(sourceByPath),
    desktop: desktopAstContract(sourceByPath) || currentDesktopAstContract(sourceByPath),
    manager: managerIsolationAstContract(
      read('electron/host-core/agent/execution-worker-manager.cjs'),
    ) || currentManagerIsolationAstContract(
      read('electron/host-core/agent/execution-worker-manager.cjs'),
    ),
    manager_pressure: managerPressureAstContract(
      read('electron/host-core/agent/execution-worker-manager.cjs'),
    ),
    supervisor: supervisorAstContract(read('electron/host-core/agent/execution-worker-supervisor.cjs'))
      || currentSupervisorAstContract(
        read('electron/host-core/agent/execution-worker-supervisor.cjs'),
        read('electron/host-core/agent/execution-worker-process-lifecycle.cjs'),
      ),
    supervisor_exit: supervisorExitAstContract(
      read('electron/host-core/agent/execution-worker-supervisor.cjs'),
    ),
    supervisor_message: supervisorMessageAstContract(
      read('electron/host-core/agent/execution-worker-supervisor-message.cjs'),
    ),
    termination: terminationAstContract(read('electron/host-core/agent/execution-worker-termination.cjs')),
  };
  return { ...result, passed: Object.values(result).every(Boolean) };
}

export function auditQworkSuccessorContextHelperAstContract(sourceByPath) {
  return contextHelperAstContract(sourceByPath) || currentContextHelperAstContract(sourceByPath);
}
