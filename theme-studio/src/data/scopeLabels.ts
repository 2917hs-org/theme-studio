// Curated friendly names for common TextMate scopes, keyed by scope prefix
// (dot-segment based, same specificity model TextMate itself uses). Not
// exhaustive — grammars mint plenty of scopes we don't recognize by name,
// and those still get colored, just labeled with their raw scope string
// instead of a friendly one.
const SCOPE_LABELS: Array<[prefix: string, label: string]> = [
  ['comment.line', 'Line comment'],
  ['comment.block.documentation', 'Doc comment'],
  ['comment.block', 'Block comment'],
  ['comment', 'Comment'],

  ['string.quoted.double', 'Double-quoted string'],
  ['string.quoted.single', 'Single-quoted string'],
  ['string.template', 'Template string'],
  ['string.quoted.triple', 'Triple-quoted string'],
  ['string.regexp', 'Regular expression'],
  ['string', 'String'],

  ['constant.numeric', 'Number'],
  ['constant.language.boolean', 'Boolean literal'],
  ['constant.language', 'Language constant (true / false / null)'],
  ['constant.character.escape', 'Escape sequence'],
  ['constant.character', 'Character literal'],
  ['constant.other', 'Constant'],
  ['constant', 'Constant'],

  ['keyword.control.conditional', 'Conditional keyword (if / else)'],
  ['keyword.control.loop', 'Loop keyword (for / while)'],
  ['keyword.control.flow', 'Flow-control keyword (return / break)'],
  ['keyword.control.import', 'Import / module keyword'],
  ['keyword.control', 'Control-flow keyword'],
  ['keyword.operator.new', 'new keyword'],
  ['keyword.operator.logical', 'Logical operator'],
  ['keyword.operator.comparison', 'Comparison operator'],
  ['keyword.operator.arithmetic', 'Arithmetic operator'],
  ['keyword.operator.assignment', 'Assignment operator'],
  ['keyword.operator', 'Operator'],
  ['keyword.other', 'Keyword'],
  ['keyword', 'Keyword'],

  ['storage.type.class', 'class keyword'],
  ['storage.type.function', 'function keyword'],
  ['storage.type', 'Type keyword (let / var / int)'],
  ['storage.modifier.async', 'async modifier'],
  ['storage.modifier', 'Modifier (public / static / readonly)'],
  ['storage', 'Storage keyword'],

  // Deliberately *not* split into class/interface/enum sub-entries: a
  // grammar tags a type's declaration site ("interface Foo") and its
  // reference sites ("x: Foo", "Foo[]", "Promise<Foo>") with different
  // exact scopes, since it's tokenizing syntax, not resolving symbols. If
  // those were separate buckets here, coloring "Foo" at its declaration
  // would silently leave every reference to "Foo" elsewhere uncolored —
  // exactly the mismatch real themes avoid by using one broad rule for the
  // whole family. Matching that convention keeps a name's color consistent
  // everywhere it appears.
  ['entity.name.type', 'Type name'],
  ['entity.name.function', 'Function / method name'],
  ['entity.name.namespace', 'Namespace name'],
  ['entity.name.tag', 'Tag name'],
  ['entity.name.section', 'Section / heading name'],
  ['entity.name', 'Named entity'],
  ['entity.other.attribute-name', 'Attribute name'],
  ['entity.other.inherited-class', 'Base / inherited class'],
  ['entity.other', 'Entity'],
  ['entity', 'Entity'],

  ['variable.parameter', 'Parameter name'],
  ['variable.language.this', 'this / self'],
  ['variable.language', 'Language variable'],
  ['variable.other.property', 'Property / field name'],
  ['variable.other.constant', 'Constant-like variable'],
  ['variable.other', 'Variable'],
  ['variable.function', 'Called function name'],
  ['variable', 'Variable'],

  ['support.function', 'Built-in function'],
  ['support.class', 'Built-in class'],
  ['support.type.property-name', 'Known property name'],
  ['support.type', 'Built-in type'],
  ['support.constant', 'Built-in constant'],
  ['support.variable', 'Built-in variable'],
  ['support', 'Built-in / library symbol'],

  ['punctuation.definition.string', 'String quote punctuation'],
  ['punctuation.definition.comment', 'Comment punctuation'],
  ['punctuation.separator', 'Separator punctuation'],
  ['punctuation.terminator', 'Statement terminator'],
  ['punctuation.section.embedded', 'Embedded-code delimiter'],
  ['punctuation.definition.tag', 'Tag bracket'],
  ['punctuation.accessor', 'Accessor (. / ->)'],
  ['punctuation', 'Punctuation'],

  ['meta.decorator', 'Decorator / annotation'],
  ['meta.function-call', 'Function call'],
  ['meta.class', 'Class body'],
  ['meta.embedded', 'Embedded code region'],

  ['invalid.illegal', 'Illegal / invalid token'],
  ['invalid', 'Invalid token'],
];

// Sort longest-prefix-first so more specific scopes win when matching.
const SORTED_LABELS = [...SCOPE_LABELS].sort((a, b) => b[0].length - a[0].length);

export interface ScopeResolution {
  /**
   * The scope a color assignment is actually keyed on. For a curated
   * category this is the dictionary prefix (e.g. "entity.name.type"), not
   * the raw per-language leaf — that's what makes a color assigned at a
   * type's declaration also apply everywhere else that type is referenced.
   * Falls back to the raw deepest scope when nothing curated matches.
   */
  scope: string;
  /** Full ancestor chain exactly as TextMate produced it, general -> specific */
  scopeChain: string[];
  /** Human label, or null if this token has no meaningful category to color. */
  label: string | null;
  /** True if `label` came from our curated dictionary rather than a raw-scope fallback. */
  isFriendly: boolean;
  /** True if this token is just plain/root text with nothing TextMate tagged specially. */
  colorable: boolean;
}

/** Curated {prefix, label} for a bare scope string, or null if nothing matches. */
function matchScopeLabel(scope: string): { prefix: string; label: string } | null {
  for (const [prefix, label] of SORTED_LABELS) {
    if (scope === prefix || scope.startsWith(prefix + '.')) {
      return { prefix, label };
    }
  }
  return null;
}

/** Curated label for a bare scope string, or null if nothing matches. */
export function friendlyLabelFor(scope: string): string | null {
  return matchScopeLabel(scope)?.label ?? null;
}

export function resolveScope(scopeChain: string[], rootScopeName: string): ScopeResolution {
  const rawScope = scopeChain[scopeChain.length - 1] ?? rootScopeName;

  // Nothing beyond the grammar's own root scope means TextMate didn't tag
  // this span with anything specific (plain text, bare whitespace, etc.)
  const meaningfulScopes = scopeChain.filter((s) => s !== rootScopeName);
  if (meaningfulScopes.length === 0) {
    return { scope: rawScope, scopeChain, label: null, isFriendly: false, colorable: false };
  }

  const match = matchScopeLabel(rawScope);
  if (match) {
    return { scope: match.prefix, scopeChain, label: match.label, isFriendly: true, colorable: true };
  }

  return { scope: rawScope, scopeChain, label: rawScope, isFriendly: false, colorable: true };
}
