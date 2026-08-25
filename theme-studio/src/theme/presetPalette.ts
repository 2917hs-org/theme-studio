// Real themes don't hand-pick a color for each of the ~200+ scopes VS Code
// recognizes — they define a small palette (a dozen-odd actual hues) and
// reuse it across many related scopes. This file is that indirection: each
// `PresetField` below is one color a preset actually defines (mirrors
// ThemePreset's fields), and ROLE_SCOPES groups the real TextMate scopes
// into ~45 fine-grained roles, each pointing at one field. Expanding a
// preset walks every role, looks up its field's color, and assigns that
// color to every scope the role covers — turning ~20 authored colors into
// ~160 real scope assignments, the same ratio a published theme has.
//
// Every scope string here is a real, single-segment (no space) TextMate
// scope in standard use across grammars — no invented names, and no
// space-joined "ancestor descendant" selectors. The latter are valid in a
// real VS Code tokenColors file, but Monaco's own `IStandaloneThemeData`
// rules (which drive this app's live preview) only match on the
// dot-hierarchy of a single token type, not scope-selector combinators —
// a space-joined key would silently do nothing in the live editor while
// still round-tripping into the exported .vsix, breaking the app's central
// promise that the preview *is* what you export.
export type PresetField =
  | 'text'
  | 'comments'
  | 'strings'
  | 'stringEscape'
  | 'regexp'
  | 'numbers'
  | 'constants'
  | 'keywords'
  | 'storage'
  | 'punctuation'
  | 'functions'
  | 'functionsBuiltin'
  | 'types'
  | 'typesBuiltin'
  | 'variables'
  | 'variablesProperty'
  | 'tags'
  | 'tagsAttribute'
  | 'markup'
  | 'diffInserted'
  | 'diffDeleted'
  | 'diffChanged'
  | 'invalid';

export const ROLE_SCOPES: Record<string, { field: PresetField; scopes: string[] }> = {
  comment: {
    field: 'comments',
    scopes: [
      'comment',
      'comment.line',
      'comment.line.double-slash',
      'comment.line.number-sign',
      'comment.line.double-dash',
      'comment.block',
      'comment.block.documentation',
      'punctuation.definition.comment',
    ],
  },
  invalid: {
    field: 'invalid',
    scopes: ['invalid', 'invalid.illegal', 'invalid.deprecated'],
  },
  string: {
    field: 'strings',
    scopes: [
      'string',
      'string.quoted',
      'string.quoted.single',
      'string.quoted.double',
      'string.quoted.triple',
      'string.unquoted',
      'string.interpolated',
      'string.other',
      'punctuation.definition.string.begin',
      'punctuation.definition.string.end',
    ],
  },
  stringTemplate: {
    field: 'strings',
    scopes: [
      'string.template',
      'punctuation.definition.template-expression.begin',
      'punctuation.definition.template-expression.end',
      'punctuation.section.embedded.begin',
      'punctuation.section.embedded.end',
    ],
  },
  stringEscape: {
    field: 'stringEscape',
    scopes: ['constant.character.escape'],
  },
  regexp: {
    field: 'regexp',
    scopes: [
      'string.regexp',
      'constant.other.character-class.regexp',
      'punctuation.definition.group.regexp',
      'punctuation.definition.character-class.regexp',
      'keyword.operator.negation.regexp',
    ],
  },
  number: {
    field: 'numbers',
    scopes: [
      'constant.numeric',
      'constant.numeric.decimal',
      'constant.numeric.hex',
      'constant.numeric.integer',
      'constant.numeric.float',
    ],
  },
  constantLanguage: {
    field: 'constants',
    scopes: ['constant.language', 'constant.language.boolean', 'constant.language.null', 'constant.language.undefined'],
  },
  constantOther: {
    field: 'constants',
    scopes: ['constant.other', 'constant.other.symbol', 'constant.other.color', 'constant.other.date'],
  },
  htmlEntity: {
    field: 'constants',
    scopes: ['constant.character.entity'],
  },
  keywordControl: {
    field: 'keywords',
    scopes: [
      'keyword.control',
      'keyword.control.conditional',
      'keyword.control.loop',
      'keyword.control.flow',
      'keyword.control.trycatch',
      'keyword.control.exception',
    ],
  },
  keywordImport: {
    field: 'keywords',
    scopes: ['keyword.control.import', 'keyword.other.import'],
  },
  keywordOperator: {
    field: 'keywords',
    scopes: [
      'keyword.operator',
      'keyword.operator.assignment',
      'keyword.operator.arithmetic',
      'keyword.operator.comparison',
      'keyword.operator.logical',
      'keyword.operator.new',
      'keyword.operator.ternary',
      'keyword.operator.bitwise',
      'keyword.operator.increment',
    ],
  },
  keywordOther: {
    field: 'keywords',
    scopes: ['keyword', 'keyword.other'],
  },
  variableLanguage: {
    field: 'keywords',
    scopes: ['variable.language', 'variable.language.this', 'variable.language.super'],
  },
  sqlKeyword: {
    field: 'keywords',
    scopes: ['keyword.other.DML', 'keyword.other.DDL'],
  },
  storageType: {
    field: 'storage',
    scopes: [
      'storage.type',
      'storage.type.class',
      'storage.type.function',
      'storage.type.interface',
      'storage.type.struct',
      'storage.type.enum',
      'storage.type.primitive',
      'storage.type.namespace',
    ],
  },
  storageModifier: {
    field: 'storage',
    scopes: ['storage.modifier', 'storage.modifier.async', 'storage.modifier.static', 'storage'],
  },
  punctuation: {
    field: 'punctuation',
    scopes: [
      'punctuation',
      'punctuation.separator',
      'punctuation.separator.comma',
      'punctuation.terminator',
      'punctuation.accessor',
      'punctuation.definition.parameters',
    ],
  },
  punctuationBracket: {
    field: 'punctuation',
    scopes: [
      'punctuation.definition.parameters.begin',
      'punctuation.definition.parameters.end',
      'punctuation.section.scope.begin',
      'punctuation.section.scope.end',
      'punctuation.definition.array.begin',
      'punctuation.definition.array.end',
      'punctuation.definition.block.begin',
      'punctuation.definition.block.end',
      'punctuation.section.function.begin',
      'punctuation.section.function.end',
    ],
  },
  functionName: {
    field: 'functions',
    scopes: ['entity.name.function', 'meta.function-call', 'variable.function'],
  },
  functionBuiltin: {
    field: 'functionsBuiltin',
    scopes: ['support.function', 'support.function.builtin', 'support.function.construct'],
  },
  decorator: {
    field: 'functionsBuiltin',
    scopes: ['meta.decorator', 'punctuation.decorator', 'storage.type.annotation'],
  },
  className: {
    field: 'types',
    scopes: ['entity.name.type', 'entity.name.type.class', 'entity.name.class', 'entity.other.inherited-class'],
  },
  classBuiltin: {
    field: 'typesBuiltin',
    scopes: ['support.class', 'support.type', 'support.type.primitive'],
  },
  namespace: {
    field: 'types',
    scopes: ['entity.name.namespace', 'entity.name.package', 'punctuation.separator.namespace', 'support.other.namespace'],
  },
  cssSelector: {
    field: 'types',
    scopes: ['entity.other.attribute-name.class.css', 'entity.name.tag.css', 'entity.other.attribute-name.id.css'],
  },
  variable: {
    field: 'variables',
    scopes: ['variable', 'variable.other', 'variable.other.readwrite', 'variable.other.member'],
  },
  variableParameter: {
    field: 'variables',
    scopes: ['variable.parameter', 'entity.name.variable.parameter'],
  },
  variableProperty: {
    field: 'variablesProperty',
    scopes: ['variable.other.property', 'variable.other.object.property', 'support.variable.property', 'support.type.property-name'],
  },
  variableConstant: {
    field: 'constants',
    scopes: ['variable.other.constant', 'variable.other.readwrite.alias'],
  },
  cssProperty: {
    field: 'variablesProperty',
    scopes: ['support.type.property-name.css', 'meta.property-name.css'],
  },
  jsonKey: {
    field: 'variablesProperty',
    scopes: ['support.type.property-name.json'],
  },
  cssValue: {
    field: 'strings',
    scopes: ['support.constant.property-value.css', 'constant.other.color.rgb-value.css'],
  },
  tagName: {
    field: 'tags',
    scopes: ['entity.name.tag', 'punctuation.definition.tag'],
  },
  tagAttribute: {
    field: 'tagsAttribute',
    scopes: ['entity.other.attribute-name', 'entity.other.attribute-name.id', 'entity.other.attribute-name.class'],
  },
  markupHeading: {
    field: 'markup',
    scopes: ['markup.heading', 'entity.name.section'],
  },
  markupBold: {
    field: 'markup',
    scopes: ['markup.bold'],
  },
  markupItalic: {
    field: 'markup',
    scopes: ['markup.italic'],
  },
  markupLink: {
    field: 'markup',
    scopes: ['markup.underline.link', 'string.other.link.title', 'string.other.link.description'],
  },
  markupList: {
    field: 'markup',
    scopes: ['markup.list', 'beginning.punctuation.definition.list'],
  },
  markupQuote: {
    field: 'comments',
    scopes: ['markup.quote'],
  },
  markupRaw: {
    field: 'strings',
    scopes: ['markup.raw', 'markup.inline.raw', 'markup.fenced_code.block'],
  },
  diffInserted: {
    field: 'diffInserted',
    scopes: ['markup.inserted'],
  },
  diffDeleted: {
    field: 'diffDeleted',
    scopes: ['markup.deleted'],
  },
  diffChanged: {
    field: 'diffChanged',
    scopes: ['markup.changed'],
  },
};
