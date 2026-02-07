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
      if (node.type === 'JSXOpeningElement' && node.name && node.loc) {
        var skip = false;
        if (node.attributes) {
          for (var a = 0; a < node.attributes.length; a++) {
            if (node.attributes[a].name && node.attributes[a].name.name === 'data-s-f') { skip = true; break; }
          }
        }
        if (!skip) {
          insertions.push({ offset: node.name.end, line: node.loc.start.line, col: node.loc.start.column });
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
      var attrs = ' data-s-f="' + rp + '" data-s-l="' + ins.line + '" data-s-c="' + ins.col + '"';
      source = source.slice(0, ins.offset) + attrs + source.slice(ins.offset);
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