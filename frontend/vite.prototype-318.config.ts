// PROTÓTIPO #318 — só para servir o protótipo com o node_modules ligado por
// symlink ao frontend/ da pasta principal, de onde vêm as fontes.
import base from './vite.config.ts'

export default {
  ...base,
  server: {
    ...base.server,
    fs: { allow: ['..', '../../..'] },
  },
}
