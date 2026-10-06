// The non-public preview (cc-website-sign-in, decision 229; Cowork's ruling 1): JV_PREVIEW=1 builds the pages that are
// hidden on jeevanto.com in coming-soon mode (Sign in, Create your account), and marks every page noindex. The preview is
// served from Cloudflare Pages behind Cloudflare Access (the founder's email only). jeevanto.com is built without it.
export const PREVIEW = process.env.JV_PREVIEW === '1';
