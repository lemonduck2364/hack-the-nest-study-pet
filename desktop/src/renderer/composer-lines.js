'use strict';
(function(root) {
  function visibleLines(value, maximum = 5) {
    // Text length and soft wrapping never enlarge the composer; only real breaks do.
    return Math.max(1, Math.min(maximum, String(value || '').split(/\r\n|\r|\n/).length));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { visibleLines };
  else root.ComposerLines = { visibleLines };
})(globalThis);
