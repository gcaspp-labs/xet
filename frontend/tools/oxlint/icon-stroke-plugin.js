// Plugin local do oxlint: garante o traço 1,7 dos ícones do lucide-react (docs/architecture.md e design.md).
const STROKE = 1.7

function strokeValue(attribute) {
  const value = attribute.value
  if (!value || value.type !== 'JSXExpressionContainer') return undefined
  const expression = value.expression
  if (expression.type === 'Literal' && typeof expression.value === 'number') return expression.value
  return undefined
}

const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Exige strokeWidth={1.7} nos ícones do lucide-react.' },
    messages: {
      missing: 'O ícone <{{name}}> precisa de strokeWidth={1.7} (design.md, seção de ícones).',
      wrong:
        'O ícone <{{name}}> usa strokeWidth diferente de 1.7; o traço do design é fixo (design.md, seção de ícones).',
    },
    schema: [],
  },
  create(context) {
    const icons = new Set()
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'lucide-react') return
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') icons.add(specifier.local.name)
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !icons.has(node.name.name)) return
        const name = node.name.name
        const attribute = node.attributes.find(
          (item) => item.type === 'JSXAttribute' && item.name.name === 'strokeWidth',
        )
        if (!attribute) {
          context.report({ node, messageId: 'missing', data: { name } })
          return
        }
        if (strokeValue(attribute) !== STROKE)
          context.report({ node: attribute, messageId: 'wrong', data: { name } })
      },
    }
  },
}

export default {
  meta: { name: 'xet' },
  rules: { 'icon-stroke': rule },
}
