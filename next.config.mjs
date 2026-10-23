/** Static export for GitHub Pages. BASE_PATH is set in CI ("/rochester-cre"). */
const basePath = process.env.BASE_PATH || "";
export default {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};
