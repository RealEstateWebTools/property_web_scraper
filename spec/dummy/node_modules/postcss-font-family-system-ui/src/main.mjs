import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import { flatMap } from 'lodash'

const fontFamilySystemUIList = [
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Oxygen',
  'Ubuntu',
  'Cantarell',
  'Fira Sans',
  'Droid Sans',
  'Helvetica Neue'
]

const parsedFontFamilySystemUIListTree = valueParser(fontFamilySystemUIList.join(', '))

const transformFontFamilySystemUI = (nodes) => {
  return flatMap(nodes, node => {
    if (node.type === 'word' && node.value === 'system-ui') {
      return parsedFontFamilySystemUIListTree
    }
    return node
  })
}

const transform = () => (decl) => {
  if (decl.type === 'decl') {
    if (decl.prop === 'font-family' || decl.prop === 'font') {
      const tree = valueParser(decl.value)
      tree.nodes = transformFontFamilySystemUI(tree.nodes)
      decl.value = tree.toString()
    }
  }
}

export default postcss.plugin('postcss-font-family-system-ui', () => {
  return (root) => {
    root.walk(transform())
  }
})
