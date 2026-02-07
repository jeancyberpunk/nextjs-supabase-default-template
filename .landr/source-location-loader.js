module.exports = function sourceLocationLoader(source) {
  var rp = this.resourcePath.replace(/\\\\/g, '/').replace(/^.*\/project\//, '');
  if (source.indexOf('data-s-f=') !== -1) return source;

  // --- AST-based approach (requires @babel/parser) ---
  try {
    var parser = require('@babel/parser');
    var ast = parser.parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties',
                 'optionalChaining', 'nullishCoalescingOperator'],
      errorRecovery: true,
    });
    var insertions = [];
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) walk(node[i]); return; }

      // Tag JSX opening elements with source location attributes
      if (node.type === 'JSXOpeningElement' && node.name && node.loc) {
        var skip = false;
        if (node.attributes) {
          for (var a = 0; a < node.attributes.length; a++) {
            if (node.attributes[a].name && node.attributes[a].name.name === 'data-s-f') { skip = true; break; }
          }
        }
        if (!skip) {
          insertions.push({ kind: 'attr', offset: node.name.end, line: node.loc.start.line, col: node.loc.start.column });
        }
      }

      // Wrap text children of custom components (uppercase) in <span> with source location
      if (node.type === 'JSXElement' && node.openingElement && node.openingElement.name && node.children) {
        var elName = node.openingElement.name;
        var isCustom = false;
        if (elName.type === 'JSXIdentifier' && /^[A-Z]/.test(elName.name)) {
          isCustom = true;
        } else if (elName.type === 'JSXMemberExpression') {
          // e.g. motion.div — check if the object starts with lowercase (skip) or uppercase
          var obj = elName.object;
          if (obj && obj.type === 'JSXIdentifier' && /^[a-z]/.test(obj.name)) {
            isCustom = false; // motion.div, styled.div etc — treat as native
          } else {
            isCustom = true;
          }
        }
        if (isCustom) {
          var parentLine = node.openingElement.loc ? node.openingElement.loc.start.line : 0;
          var parentCol = node.openingElement.loc ? node.openingElement.loc.start.column : 0;
          for (var c = 0; c < node.children.length; c++) {
            var child = node.children[c];
            if (child.type === 'JSXText' && child.value.trim()) {
              insertions.push({ kind: 'wrap-open', offset: child.start, line: parentLine, col: parentCol });
              insertions.push({ kind: 'wrap-close', offset: child.end });
            }
          }
        }
      }

      var keys = Object.keys(node);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (key === 'loc' || key === 'start' || key === 'end' || key === 'type') continue;
        var child = node[key];
        if (child && typeof child === 'object') walk(child);
      }
    }
    walk(ast.program);
    insertions.sort(function(a, b) { return b.offset - a.offset; });
    for (var j = 0; j < insertions.length; j++) {
      var ins = insertions[j];
      if (ins.kind === 'attr') {
        var attrs = ' data-s-f="' + rp + '" data-s-l="' + ins.line + '" data-s-c="' + ins.col + '"';
        source = source.slice(0, ins.offset) + attrs + source.slice(ins.offset);
      } else if (ins.kind === 'wrap-close') {
        source = source.slice(0, ins.offset) + '</span>' + source.slice(ins.offset);
      } else if (ins.kind === 'wrap-open') {
        var spanOpen = '<span data-s-f="' + rp + '" data-s-l="' + ins.line + '" data-s-c="' + ins.col + '">';
        source = source.slice(0, ins.offset) + spanOpen + source.slice(ins.offset);
      }
    }
    return source;
  } catch (e) { /* fall through to regex */ }

  // --- Regex fallback (improved: uppercase components + generic detection) ---
  var lines = source.split('\n');
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf('data-s-f=') === -1) {
      line = line.replace(/<([A-Za-z][A-Za-z0-9.]*)(\s|>)/g, function(match, tag, after, offset) {
        if (offset > 0) {
          var prev = line.charAt(offset - 1);
          if (/[A-Za-z0-9_$.]/.test(prev)) return match;
        }
        return '<' + tag + ' data-s-f="' + rp + '" data-s-l="' + (i + 1) + '" data-s-c="' + offset + '"' + after;
      });
    }
    result.push(line);
  }
  return result.join('\n');
};
