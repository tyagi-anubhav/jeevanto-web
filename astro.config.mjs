// jeevanto.com: a static site. Each page is one file (/circle → circle.html), so every fixed address answers 200
// on GitHub Pages without a redirect.
import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://jeevanto.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'never', assets: '_astro' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
