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
    || programHasNestedBinding(program, names)) return false;
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

function protectedReceiverAliasState(functionNode, protectedPaths) {
  const state = { aliases: new Map(), unsafe: false };
  const declarations = [];
  visit(functionNode?.body, (node, parent) => {
    if (node.type === 'VariableDeclarator' && node.init) declarations.push({ node, parent });
  });
  for (let pass = 0; pass <= declarations.length; pass += 1) {
    const before = state.aliases.size;
    for (const { node, parent } of declarations) {
      const source = protectedAliasSource(node.init, state.aliases);
      if (!source) continue;
      bindProtectedAliasPattern(node.id, source.path, protectedPaths, state, {
        dynamic: source.dynamic,
        readonly: parent?.type === 'VariableDeclaration' && parent.kind === 'const',
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
        { dynamic: source.dynamic, readonly: false },
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

function functionHasMemberWrite(functionNode, protectedPaths) {
  const aliasState = protectedReceiverAliasState(functionNode, protectedPaths);
  if (aliasState.unsafe) return true;
  const { aliases } = aliasState;
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
    const callee = staticMemberPath(node.callee).join('.');
    const receiver = staticMemberPathWithAliases(node.arguments[0], aliases);
    if (!receiver.length) return false;
    if (['Object.defineProperty', 'Reflect.set', 'Reflect.deleteProperty'].includes(callee)) {
      const property = literalPropertyName(node.arguments[1]);
      return property ? matchesPath([...receiver, property]) : protectedPaths.some((expected) => (
        receiver.length <= expected.length
        && receiver.every((part, index) => expected[index] === part)
      ));
    }
    if (callee === 'Object.defineProperties') {
      const descriptors = unwrap(node.arguments[1]);
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
      return node.arguments.slice(1).some((source) => {
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
  return assignments.length === 1
    && exactObject(assignments[0].expression.right, expected);
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

function cancellationAstContract(source) {
  const program = parseProgram(source);
  const request = topFunction(program, 'requestExecutionWorkerTurn');
  const settlement = topFunction(program, 'createExecutionWorkerRequestSettlement');
  if (!request || !settlement
    || !stableProgramIdentifiers(program, [
      'Error', 'Math', 'Promise', 'clearTimeout', 'createExecutionWorkerRequestSettlement',
      'requestExecutionWorkerTurn', 'setTimeout',
    ], { globals: ['Error', 'Math', 'Promise', 'clearTimeout', 'setTimeout'] })
    || !exactIdentifierParameters(request, [
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
  if (requestBody.indexOf(pending.statement) >= requestBody.indexOf(addListener[0])
    || requestBody.indexOf(onAbort.statement) >= requestBody.indexOf(addListener[0])
    || requestBody.indexOf(noSignal[0]) >= requestBody.indexOf(addListener[0])
    || requestBody.indexOf(addListener[0]) >= requestBody.indexOf(alreadyAborted[0])
    || requestBody.indexOf(alreadyAborted[0]) >= requestBody.indexOf(guardedWait[0])) return false;

  const settlementParameter = settlement.params.length === 1 ? settlement.params[0] : null;
  const expectedParameters = [
    'cancellationTimeoutMs', 'child', 'deadlineMs', 'onDeadline',
    'operation', 'reject', 'resolve', 'terminateChild',
  ].sort();
  if (!objectPatternBindsExactly(settlementParameter, expectedParameters)
    || functionHasNestedBinding(settlement, [
      ...expectedParameters, 'Error', 'Math', 'clearTimeout', 'setTimeout',
    ])
    || functionHasIdentifierWrite(settlement, [
      ...expectedParameters, 'Error', 'Math', 'clearTimeout', 'setTimeout',
    ])
    || functionHasNestedBinding(settlement, ['cancellationTimer'], {
      allowedDirectBindings: ['cancellationTimer'],
    })) return false;
  const cancellationTimer = directDeclarator(settlement.body, 'cancellationTimer', 'let');
  const clear = directDeclarator(settlement.body, 'clear', 'const');
  const deadline = directDeclarator(settlement.body, 'deadline', 'const');
  if (!cancellationTimer || !literal(cancellationTimer.declaration.init, null)
    || !clear || !deadline) return false;
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
      (value) => identifier(value, 'deadlineMs'),
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
    || !directCallStatement(deadlineBody[2], ['reject'], [(value) => construct(value, 'Error')])
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
      const [guard, assignment] = value.body.body;
      if (value.body.body.length !== 2
        || guard?.type !== 'IfStatement'
        || !identifier(guard.test, 'cancellationTimer')
        || !bareReturn(guard.consequent)) return false;
      const expression = unwrap(assignment?.expression);
      if (assignment?.type !== 'ExpressionStatement'
        || expression?.type !== 'AssignmentExpression'
        || expression.operator !== '='
        || !identifier(expression.left, 'cancellationTimer')) return false;
      const timer = unwrap(expression.right);
      if (timer?.type !== 'CallExpression' || !member(timer.callee, ['setTimeout'])
        || timer.arguments.length !== 2
        || !call(timer.arguments[1], ['Math', 'max'], [
          (entry) => literal(entry, 1),
          (entry) => identifier(entry, 'cancellationTimeoutMs'),
        ])) return false;
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
  return true;
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

function terminationAstContract(source) {
  const program = parseProgram(source);
  const creator = topFunction(program, 'createExecutionWorkerTerminator');
  if (!creator || creator.params.length !== 1
    || !stableProgramIdentifiers(program, [
      'Promise', 'WeakMap', 'createExecutionWorkerTerminator', 'setTimeout',
    ], { globals: ['Promise', 'WeakMap', 'setTimeout'] })) return false;
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
      'cleanupGraceMs', 'processId', 'processTreeKiller', 'Promise', 'setTimeout', 'WeakMap',
    ])
    || functionHasIdentifierWrite(creator, [
      'cleanupGraceMs', 'processId', 'processTreeKiller', 'Promise', 'setTimeout', 'WeakMap',
    ])
    || functionHasMemberWrite(creator, [['flights']])) return false;
  const flights = directDeclarator(creator.body, 'flights', 'const');
  if (!flights || !construct(flights.declaration.init, 'WeakMap', [])) return false;
  const returns = creator.body.body.filter((statement) => statement.type === 'ReturnStatement');
  if (returns.length !== 1) return false;
  const terminator = unwrap(returns[0].argument);
  if (terminator?.type !== 'ArrowFunctionExpression'
    || !exactParameterList(terminator, [
      (value) => identifier(value, 'target'),
      (value) => defaultedIdentifierParameter(
        value, 'reason', (fallback) => literal(fallback, 'terminated'),
      ),
    ])
    || terminator.body?.type !== 'BlockStatement'
    || functionHasNestedBinding(terminator, [
      'cleanupGraceMs', 'flights', 'processId', 'processTreeKiller', 'Promise',
      'reason', 'setTimeout', 'target', 'WeakMap',
    ])
    || functionHasIdentifierWrite(terminator, [
      'cleanupGraceMs', 'flights', 'processId', 'processTreeKiller', 'Promise',
      'reason', 'setTimeout', 'target', 'WeakMap',
    ])) return false;
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
  const targetGuardIndex = body.body.indexOf(targetGuard[0]);
  const existingIndex = body.body.indexOf(existing.statement);
  const existingGuardIndex = body.body.indexOf(existingGuard[0]);
  const pidIndex = body.body.indexOf(pid.statement);
  if (targetGuardIndex < 0 || targetGuardIndex >= existingIndex
    || existingIndex >= existingGuardIndex || existingGuardIndex >= pidIndex) return false;

  const cleanupChain = unwrap(cleanup.declaration.init);
  if (cleanupChain?.type !== 'CallExpression'
    || !methodCall(
      cleanupChain,
      'then',
      (receiver) => call(receiver, ['Promise', 'resolve'], []),
      [(callback) => exactIdentifierParameters(unwrap(callback), [])
        && arrowCallsExactly(callback, ['processTreeKiller'], [
          (value) => identifier(value, 'pid'),
          (value) => exactObject(value, { reason: (entry) => identifier(entry, 'reason') }),
        ])],
    )
    || cleanupChain.arguments.length !== 1
  ) return false;

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
    || !graceTimerPromise(race.arguments[0].elements[1], 'cleanupGraceMs')) return false;
  const afterRace = unwrap(flightChain.arguments[0]);
  if (afterRace?.type !== 'ArrowFunctionExpression'
    || !exactIdentifierParameters(afterRace, [])
    || afterRace.body?.type !== 'BlockStatement'
    || afterRace.body.body.length !== 2
    || !directCallStatement(afterRace.body.body[0], ['target', 'kill'], [])
    || !exactReturn(afterRace.body.body[1], (value) => literal(value, true))) return false;

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
    && body.body.indexOf(sets[0]) < body.body.indexOf(finalizers[0])
    && body.body.indexOf(finalizers[0]) < body.body.indexOf(finalReturns[0]);
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
    && observerEvents.length === 1;
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
  if (!settlement || !call(settlement.declaration.init, ['createExecutionWorkerRequestSettlement'], [
    (value) => exactObject(value, {
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
    })],
  )) return false;
  const pendingSets = executor.body.body.filter((statement) => directCallStatement(
    statement,
    ['pending', 'set'],
    [(value) => identifier(value, 'requestId'), (value) => identifier(value, 'settlement')],
  ));
  if (pendingSets.length !== 1) return false;

  if (stop.body?.type !== 'BlockStatement') return false;
  const stoppedChild = directDeclarator(stop.body, 'stoppedChild', 'const');
  const stopCalls = stop.body.body.filter((statement) => directCallStatement(
    statement,
    ['terminateChild'],
    [(value) => identifier(value, 'stoppedChild'), (value) => literal(value, 'stop')],
    { await_: true },
  ));
  if (!stoppedChild || !identifier(stoppedChild.declaration.init, 'child') || stopCalls.length !== 1) return false;
  const api = returnedObject(creator);
  return Boolean(api && exactObject(api, {
    onExit: (value) => identifier(value, 'onExit'),
    onMessage: (value) => identifier(value, 'onMessage'),
    request: (value) => identifier(value, 'request'),
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
    && onExit.body.body.indexOf(childGuards[0])
      < onExit.body.body.indexOf(terminationCause.statement)
    && typedRejects.length === 1
    && onExit.body.body.indexOf(terminationCause.statement)
      < onExit.body.body.indexOf(typedRejects[0]);
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
  return null;
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
  if (statement.type === 'TryStatement') {
    if (statement.finalizer && blockDefinitelyAbrupt(statement.finalizer)) return true;
    const tryAbrupt = blockDefinitelyAbrupt(statement.block);
    if (!statement.handler) return tryAbrupt;
    return tryAbrupt && blockDefinitelyAbrupt(statement.handler.body);
  }
  if (statement.type !== 'IfStatement') return false;
  const condition = constantBoolean(statement.test);
  if (condition === true) return statementDefinitelyAbrupt(statement.consequent);
  if (condition === false) return statementDefinitelyAbrupt(statement.alternate);
  return Boolean(statement.alternate)
    && statementDefinitelyAbrupt(statement.consequent)
    && statementDefinitelyAbrupt(statement.alternate);
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
    && directStatementReachable(body, failures[0])
    && body.body.indexOf(finishes[0]) < body.body.indexOf(failures[0]);
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
    || (topLevelBindingCount(program, 'Worker') > 0
      && !exactTopLevelRequireBinding(program, 'Worker', 'Worker', 'node:worker_threads'))
    || (topLevelBindingCount(program, 'validateEnvelope') > 0
      && !exactTopLevelRequireBinding(
        program,
        'validateEnvelope',
        'validateEnvelope',
        './execution-worker-protocol.cjs',
      ))
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
    || !directStatementReachable(initialize.body, initializeGuard[0])
    || !directStatementReachable(initialize.body, authorityAssignments[0])
    || initialize.body.body.indexOf(initializeGuard[0])
      >= initialize.body.body.indexOf(authorityAssignments[0])) return false;
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
  if (initialize.body.body.indexOf(authorityAssignments[0])
      >= initialize.body.body.indexOf(initializeOuterStatement)
    || (runnerAssignments[0].wrapper
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
    || host.body.body.indexOf(hostGuard[0]) >= host.body.body.indexOf(hostForwardOuter)
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
  const runnerStatements = runner.body.body;
  return runnerStatements.indexOf(runnerAuthority[0]) < runnerStatements.indexOf(heartbeat[0])
    && runnerStatements.indexOf(heartbeat[0]) < runnerStatements.indexOf(ready[0])
    && runnerStatements.indexOf(ready[0]) < runnerStatements.indexOf(runnerForwards[0]);
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
  const requested = directDeclarator(functionNode?.body, requestedName, 'const');
  const bounded = directDeclarator(functionNode?.body, boundedName, 'const');
  if (!requested || !bounded
    || !directStatementReachable(functionNode.body, requested.statement)
    || !directStatementReachable(functionNode.body, bounded.statement)
    || functionNode.body.body.indexOf(requested.statement)
      >= functionNode.body.body.indexOf(bounded.statement)
    || !call(requested.declaration.init, ['Number'], [
      (value) => identifier(value, sourceName),
    ])) return false;
  const value = unwrap(bounded.declaration.init);
  return value?.type === 'ConditionalExpression'
    && call(value.test, ['Number', 'isFinite'], [
      (entry) => identifier(entry, requestedName),
    ])
    && call(value.consequent, ['Math', 'max'], [
      (entry) => literal(entry, 1),
      (entry) => identifier(entry, requestedName),
    ])
    && literal(value.alternate, fallback)
    && Number.isFinite(fallback)
    && fallback > 0;
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
        'boundedTimeout', 'manager', 'Math', 'Number', 'record', 'requestId',
        'requestedTimeout', 'settlement', 'timeoutMs',
      ], { allowedDirectBindings: ['boundedTimeout', 'requestedTimeout'] })
      || functionHasIdentifierWrite(drainRecord, [
        'boundedTimeout', 'manager', 'Math', 'Number', 'record', 'requestId',
        'requestedTimeout', 'settlement', 'timeoutMs',
      ])) return false;
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
  const supervisorIndex = acquire.body.body.indexOf(supervisor.statement);
  const recordIndex = acquire.body.body.indexOf(record.statement);
  const indexIndex = indexes.length === 1 ? acquire.body.body.indexOf(indexes[0]) : -1;
  const admissionIndex = admissionWaits.length === 1
    ? acquire.body.body.indexOf(admissionWaits[0]) : -1;
  if (supervisorIndex < 0 || recordIndex <= supervisorIndex || indexIndex <= recordIndex
    || !directStatementReachable(acquire.body, supervisor.statement)
    || !directStatementReachable(acquire.body, record.statement)
    || !directStatementReachable(acquire.body, indexes[0])) return false;
  if (directAdmissionCalls.length > 0 && (
    directAdmissionCalls.length !== 1
    || admissionWaits.length !== 1
    || admissionIndex < 0
    || admissionIndex >= supervisorIndex
    || !directStatementReachable(acquire.body, admissionWaits[0])
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
      || releaseFunction.body.body.indexOf(deletes[0])
        >= releaseFunction.body.body.indexOf(stops[0])
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
  if (acquire.body.body.indexOf(indexes[0]) >= acquire.body.body.indexOf(successOuter)) return false;
  const drain = topFunction(program, 'drainExecutionRecord');
  if (drain && (!finitePositiveTimeoutBinding(drain)
    || !genuineTimeoutInFunction(drain, ['boundedTimeout']))) return false;
  return true;
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
    && directStatementReachable(acquire.body, waits[0])
    && directStatementReachable(acquire.body, supervisor.statement)
    && acquire.body.body.indexOf(waits[0]) < acquire.body.body.indexOf(supervisor.statement);
}

function contextHelperAstContract(sourceByPath) {
  const wrapperSource = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage.cjs') || '';
  const implementationSource = sourceByPath.get('electron/host-core/agent/execution-worker-context-usage-lease.cjs') || '';
  if (!implementationSource.trim() || implementationSource.trimStart().startsWith('// observed')) return true;
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
      'setTimeout', 'settlement', 'timeoutMs',
    ])
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
    || !requested || !call(requested.declaration.init, ['Number'], [
      (value) => identifier(value, 'timeoutMs'),
    ]) || !bounded) return false;
  const boundedValue = unwrap(bounded.declaration.init);
  if (boundedValue?.type !== 'ConditionalExpression'
    || !call(boundedValue.test, ['Number', 'isFinite'], [
      (value) => identifier(value, 'requestedTimeout'),
    ])
    || !call(boundedValue.consequent, ['Math', 'max'], [
      (value) => literal(value, 1),
      (value) => identifier(value, 'requestedTimeout'),
    ])
    || !literal(boundedValue.alternate, 1000)) return false;
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

function desktopAstContract(sourceByPath) {
  const source = sourceByPath.get('electron/host-core/agent/desktop-host-context.cjs') || '';
  const program = parseProgram(source);
  const run = topFunction(program, 'runAgentInExecutionWorker');
  const parametersValid = exactIdentifierParameters(run, ['identity', 'signal'])
    || exactIdentifierParameters(run, ['supervisor', 'identity', 'signal'])
    || exactParameterList(run, [
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
  if (directReleases.length === 1) return true;
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
  return delegatedReleases.length === 1 && contextHelperAstContract(sourceByPath);
}

export function auditQworkSuccessorAstContracts(sourceByPath) {
  const read = (path) => sourceByPath.get(path) || '';
  const result = {
    cancellation: cancellationAstContract(read('electron/host-core/agent/execution-worker-cancellation.cjs')),
    controller: controllerAstContract(read('electron/host-core/agent/execution-worker-controller.cjs')),
    desktop: desktopAstContract(sourceByPath),
    manager: managerIsolationAstContract(
      read('electron/host-core/agent/execution-worker-manager.cjs'),
    ),
    manager_pressure: managerPressureAstContract(
      read('electron/host-core/agent/execution-worker-manager.cjs'),
    ),
    supervisor: supervisorAstContract(read('electron/host-core/agent/execution-worker-supervisor.cjs')),
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
