// Plugin local do oxlint: garante o traço 1,7 dos ícones do lucide-react (docs/architecture.md e design.md).
//
// Reconhece como ícone, nos arquivos que importam de lucide-react:
// - imports nomeados (<X />) e por namespace (<Icons.X />);
// - variáveis que recebem um ícone (const Icon = aberto ? ChevronUp : ChevronDown);
// - propriedades que guardam um ícone, pelo tipo LucideIcon ou pelo valor ({ icon: Sun }),
//   usadas como <item.icon /> ou desestruturadas ({ icon: Icon }).
// O strokeWidth vale pelo último atributo, como no React: um spread depois dele pode sobrescrevê-lo.
const STROKE = 1.7
const SOURCE = 'lucide-react'

function keyName(key) {
  if (!key) return undefined
  if (key.type === 'Identifier') return key.name
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value
  return undefined
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
    let importsLucide = false
    const icons = new Set() // nomes locais que são ícones
    const namespaces = new Set() // import * as Icons from 'lucide-react'
    const iconTypes = new Set() // nomes locais do tipo LucideIcon
    const iconProps = new Set() // nomes de propriedades que guardam um ícone
    const declarators = [] // [nome, init]
    const properties = [] // [chave, valor], de objetos e de desestruturações
    const elements = []

    function isIconType(annotation) {
      const type = annotation?.typeAnnotation
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

    function isIconExpression(node) {
      if (!node) return false
      switch (node.type) {
        case 'Identifier':
          return icons.has(node.name)
        case 'MemberExpression':
          if (node.computed) return false
          if (node.object.type === 'Identifier' && namespaces.has(node.object.name)) return true
          return iconProps.has(node.property.name)
        case 'ConditionalExpression':
          return isIconExpression(node.consequent) || isIconExpression(node.alternate)
        case 'LogicalExpression':
          return isIconExpression(node.left) || isIconExpression(node.right)
        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression':
          return isIconExpression(node.expression)
        default:
          return false
      }
    }

    function isIconTag(name) {
      if (name.type === 'JSXIdentifier') return icons.has(name.name)
      if (name.type !== 'JSXMemberExpression') return false
      if (name.object.type === 'JSXIdentifier' && namespaces.has(name.object.name)) return true
      return iconProps.has(name.property.name)
    }

    // Propaga até estabilizar: um ícone pode passar por variável, propriedade e desestruturação.
    function resolve() {
      let changed = true
      while (changed) {
        changed = false
        for (const [name, init] of declarators) {
          if (!icons.has(name) && isIconExpression(init)) {
            icons.add(name)
            changed = true
          }
        }
        for (const [key, value] of properties) {
          if (!iconProps.has(key) && isIconExpression(value)) {
            iconProps.add(key)
            changed = true
          }
          const local = value.type === 'AssignmentPattern' ? value.left : value
          if (iconProps.has(key) && local.type === 'Identifier' && !icons.has(local.name)) {
            icons.add(local.name)
            changed = true
          }
        }
      }
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
          else if (specifier.type === 'ImportSpecifier') {
            if (keyName(specifier.imported) === 'LucideIcon') iconTypes.add(specifier.local.name)
            else icons.add(specifier.local.name)
          }
        }
      },
      Identifier(node) {
        // Variáveis e parâmetros anotados com LucideIcon.
        if (node.typeAnnotation && isIconType(node.typeAnnotation)) icons.add(node.name)
      },
      TSPropertySignature(node) {
        const key = keyName(node.key)
        if (key && isIconType(node.typeAnnotation)) iconProps.add(key)
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && node.init) declarators.push([node.id.name, node.init])
      },
      Property(node) {
        const key = !node.computed && keyName(node.key)
        if (key) properties.push([key, node.value])
      },
      JSXOpeningElement(node) {
        elements.push(node)
      },
      'Program:exit'() {
        if (!importsLucide) return
        resolve()
        for (const node of elements) if (isIconTag(node.name)) check(node)
      },
    }
  },
}

export default {
  meta: { name: 'xet' },
  rules: { 'icon-stroke': rule },
}
