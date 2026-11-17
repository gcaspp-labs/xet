// Plugin local do oxlint: garante o traço 1,7 dos ícones do lucide-react (docs/architecture.md e design.md).
//
// Um elemento JSX é ícone quando a origem dele leva a um import de lucide-react. A origem é seguida
// pelo binding (escopo), não pelo nome: duas variáveis Icon em funções diferentes são coisas distintas,
// e <content.icon /> só é ícone se o objeto content guarda um ícone na chave icon. Origens seguidas:
// - imports nomeados (<X />) e por namespace (<Icons.X />);
// - variáveis inicializadas com um ícone (const Icon = aberto ? ChevronUp : ChevronDown);
// - variáveis, parâmetros e propriedades com o tipo LucideIcon (inclusive por alias ou interface);
// - objetos e listas de objetos com um ícone na chave (<item.icon /> dentro de lista.map(...)).
// O strokeWidth vale pelo último atributo, como no React: um spread depois dele pode sobrescrevê-lo.
const STROKE = 1.7
const SOURCE = 'lucide-react'
const ARRAY_PASSTHROUGH = new Set(['filter', 'slice', 'concat', 'toSorted', 'toReversed'])
const ARRAY_CALLBACKS = new Set(['map', 'filter', 'forEach', 'find', 'some', 'every', 'flatMap'])

function keyName(key) {
  if (!key) return undefined
  if (key.type === 'Identifier') return key.name
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value
  return undefined
}

function unwrap(node) {
  while (
    node &&
    (node.type === 'TSAsExpression' ||
      node.type === 'TSSatisfiesExpression' ||
      node.type === 'TSNonNullExpression' ||
      node.type === 'ParenthesizedExpression')
  )
    node = node.expression
  return node
}

function strokeValue(attribute) {
  const value = attribute.value
  if (!value || value.type !== 'JSXExpressionContainer') return undefined
  const expression = value.expression
  if (expression.type === 'Literal' && typeof expression.value === 'number') return expression.value
  return undefined
}

function tagText(name) {
  if (name.type === 'JSXIdentifier') return name.name
  if (name.type === 'JSXMemberExpression') return `${tagText(name.object)}.${name.property.name}`
  return '?'
}

const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Exige strokeWidth={1.7} nos ícones do lucide-react.' },
    messages: {
      missing: 'O ícone <{{name}}> precisa de strokeWidth={1.7} (design.md, seção de ícones).',
      wrong:
        'O ícone <{{name}}> usa strokeWidth diferente de 1.7; o traço do design é fixo (design.md, seção de ícones).',
      spread:
        'O ícone <{{name}}> tem um spread depois de strokeWidth={1.7}, que pode sobrescrever o traço; ponha strokeWidth={1.7} depois dos spreads.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode
    let importsLucide = false
    const iconTypes = new Set() // nomes locais do tipo LucideIcon importado
    const namespaces = new Set() // import * as Icons from 'lucide-react'
    const types = new Map() // type alias e interface do arquivo, por nome
    const elements = []
    const memo = new Map() // Variable -> boolean (em curso = false, evita ciclo)

    function findVariable(node, name) {
      for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
        const variable = scope.set.get(name)
        if (variable) return variable
      }
      return undefined
    }

    // ---- tipos ----
    function isIconType(type) {
      if (!type || type.type !== 'TSTypeReference') return false
      const name = type.typeName
      if (name.type === 'Identifier') return iconTypes.has(name.name)
      return (
        name.type === 'TSQualifiedName' &&
        name.left.type === 'Identifier' &&
        namespaces.has(name.left.name) &&
        name.right.name === 'LucideIcon'
      )
    }

    function members(type, seen = new Set()) {
      if (!type) return []
      switch (type.type) {
        case 'TSTypeLiteral':
          return type.members
        case 'TSInterfaceBody':
          return type.body
        case 'TSIntersectionType':
        case 'TSUnionType':
          return type.types.flatMap((item) => members(item, seen))
        case 'TSTypeReference': {
          const name = type.typeName.type === 'Identifier' && type.typeName.name
          if (!name || seen.has(name) || !types.has(name)) return []
          seen.add(name)
          return members(types.get(name), seen)
        }
        default:
          return []
      }
    }

    function memberType(type, key) {
      for (const member of members(type)) {
        if (member.type === 'TSPropertySignature' && keyName(member.key) === key)
          return member.typeAnnotation?.typeAnnotation
      }
      return undefined
    }

    function elementType(type) {
      if (!type) return undefined
      if (type.type === 'TSArrayType') return type.elementType
      if (
        type.type === 'TSTypeReference' &&
        type.typeName.type === 'Identifier' &&
        (type.typeName.name === 'Array' || type.typeName.name === 'ReadonlyArray')
      )
        return type.typeArguments?.params?.[0] ?? type.typeParameters?.params?.[0]
      if (type.type === 'TSTypeOperator') return elementType(type.typeAnnotation)
      return undefined
    }

    // Tipo declarado de um binding: anotação no identificador ou, numa desestruturação,
    // o tipo da chave dentro da anotação do padrão ({ items }: { items: NavItem[] }).
    function declaredType(identifier) {
      if (identifier.typeAnnotation) return identifier.typeAnnotation.typeAnnotation
      const property = identifier.parent
      if (property?.type !== 'Property' || property.value !== identifier) return undefined
      const pattern = property.parent
      if (pattern?.type !== 'ObjectPattern' || !pattern.typeAnnotation) return undefined
      return memberType(pattern.typeAnnotation.typeAnnotation, keyName(property.key))
    }

    // ---- valores ----
    function isIconVariable(variable) {
      if (!variable) return false
      if (memo.has(variable)) return memo.get(variable)
      memo.set(variable, false)
      const result = variable.defs.some(isIconDefinition)
      memo.set(variable, result)
      return result
    }

    function isIconDefinition(def) {
      const identifier = def.name
      if (def.type === 'ImportBinding') {
        return (
          def.parent?.source?.value === SOURCE &&
          def.node.type === 'ImportSpecifier' &&
          !iconTypes.has(identifier.name)
        )
      }
      if (isIconType(declaredType(identifier))) return true
      if (def.type === 'Variable') {
        const declarator = def.node
        if (declarator.id === identifier) return isIconExpression(declarator.init)
        const property = identifier.parent
        if (property?.type === 'Property' && property.parent === declarator.id)
          return holdsIcon(declarator.init, keyName(property.key))
        return false
      }
      if (def.type === 'Parameter') {
        const property = identifier.parent
        if (property?.type === 'Property' && property.parent?.type === 'ObjectPattern') {
          const pattern = property.parent
          return (
            pattern.parent === def.node &&
            callbackElementHoldsIcon(def.node, pattern, keyName(property.key))
          )
        }
      }
      return false
    }

    function isIconExpression(node) {
      node = unwrap(node)
      if (!node) return false
      switch (node.type) {
        case 'Identifier':
          return isIconVariable(findVariable(node, node.name))
        case 'MemberExpression':
          if (node.computed) return false
          if (node.object.type === 'Identifier' && namespaces.has(node.object.name)) {
            const variable = findVariable(node.object, node.object.name)
            return variable?.defs.some((def) => def.type === 'ImportBinding') ?? false
          }
          return holdsIcon(node.object, node.property.name)
        case 'ConditionalExpression':
          return isIconExpression(node.consequent) || isIconExpression(node.alternate)
        case 'LogicalExpression':
          return isIconExpression(node.left) || isIconExpression(node.right)
        default:
          return false
      }
    }

    // O valor (objeto) node guarda um ícone na chave key?
    function holdsIcon(node, key) {
      node = unwrap(node)
      if (!node || !key) return false
      switch (node.type) {
        case 'ObjectExpression':
          return node.properties.some(
            (item) =>
              item.type === 'Property' &&
              !item.computed &&
              keyName(item.key) === key &&
              isIconExpression(item.value),
          )
        case 'ConditionalExpression':
          return holdsIcon(node.consequent, key) || holdsIcon(node.alternate, key)
        case 'LogicalExpression':
          return holdsIcon(node.left, key) || holdsIcon(node.right, key)
        case 'Identifier': {
          const variable = findVariable(node, node.name)
          if (!variable) return false
          return variable.defs.some((def) => definitionHoldsIcon(def, key))
        }
        default:
          return false
      }
    }

    function definitionHoldsIcon(def, key) {
      const type = declaredType(def.name)
      if (type) return isIconType(memberType(type, key))
      if (def.type === 'Variable' && def.node.id === def.name) return holdsIcon(def.node.init, key)
      if (def.type === 'Parameter' && def.node.params?.[0] === def.name)
        return callbackElementHoldsIcon(def.node, def.name, key)
      return false
    }

    // Primeiro parâmetro de um callback de lista (lista.map((item) => ...)): o item guarda ícone em key?
    function callbackElementHoldsIcon(fn, param, key) {
      if (fn.params?.[0] !== param) return false
      const call = fn.parent
      if (call?.type !== 'CallExpression' || call.arguments[0] !== fn) return false
      const callee = call.callee
      if (callee.type !== 'MemberExpression' || callee.computed) return false
      if (!ARRAY_CALLBACKS.has(callee.property.name)) return false
      return elementHoldsIcon(callee.object, key)
    }

    // A lista node tem algum item que guarda ícone em key?
    function elementHoldsIcon(node, key) {
      node = unwrap(node)
      if (!node) return false
      switch (node.type) {
        case 'ArrayExpression':
          return node.elements.some(
            (item) => item && item.type !== 'SpreadElement' && holdsIcon(item, key),
          )
        case 'CallExpression': {
          const callee = node.callee
          return (
            callee.type === 'MemberExpression' &&
            !callee.computed &&
            ARRAY_PASSTHROUGH.has(callee.property.name) &&
            elementHoldsIcon(callee.object, key)
          )
        }
        case 'ConditionalExpression':
          return elementHoldsIcon(node.consequent, key) || elementHoldsIcon(node.alternate, key)
        case 'LogicalExpression':
          return elementHoldsIcon(node.left, key) || elementHoldsIcon(node.right, key)
        case 'Identifier': {
          const variable = findVariable(node, node.name)
          if (!variable) return false
          return variable.defs.some((def) => {
            const type = declaredType(def.name)
            if (type) return isIconType(memberType(elementType(type), key))
            return (
              def.type === 'Variable' &&
              def.node.id === def.name &&
              elementHoldsIcon(def.node.init, key)
            )
          })
        }
        default:
          return false
      }
    }

    function isIconTag(name) {
      if (name.type === 'JSXIdentifier') {
        if (!/^[A-Z]/.test(name.name)) return false
        return isIconVariable(findVariable(name, name.name))
      }
      if (name.type !== 'JSXMemberExpression') return false
      const object = name.object
      if (object.type !== 'JSXIdentifier') return false
      if (namespaces.has(object.name)) {
        const variable = findVariable(object, object.name)
        if (variable?.defs.some((def) => def.type === 'ImportBinding')) return true
      }
      const variable = findVariable(object, object.name)
      return variable?.defs.some((def) => definitionHoldsIcon(def, name.property.name)) ?? false
    }

    function check(node) {
      const name = tagText(node.name)
      let stroke
      let strokeIndex = -1
      let spreadIndex = -1
      node.attributes.forEach((item, index) => {
        if (item.type === 'JSXSpreadAttribute') spreadIndex = index
        else if (item.name.type === 'JSXIdentifier' && item.name.name === 'strokeWidth') {
          stroke = item
          strokeIndex = index
        }
      })
      if (!stroke) context.report({ node, messageId: 'missing', data: { name } })
      else if (spreadIndex > strokeIndex)
        context.report({ node: node.attributes[spreadIndex], messageId: 'spread', data: { name } })
      else if (strokeValue(stroke) !== STROKE)
        context.report({ node: stroke, messageId: 'wrong', data: { name } })
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== SOURCE) return
        importsLucide = true
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') namespaces.add(specifier.local.name)
          else if (
            specifier.type === 'ImportSpecifier' &&
            keyName(specifier.imported) === 'LucideIcon'
          )
            iconTypes.add(specifier.local.name)
        }
      },
      TSTypeAliasDeclaration(node) {
        types.set(node.id.name, node.typeAnnotation)
      },
      TSInterfaceDeclaration(node) {
        types.set(node.id.name, node.body)
      },
      JSXOpeningElement(node) {
        elements.push(node)
      },
      'Program:exit'() {
        if (!importsLucide) return
        for (const node of elements) if (isIconTag(node.name)) check(node)
      },
    }
  },
}

export default {
  meta: { name: 'xet' },
  rules: { 'icon-stroke': rule },
}
