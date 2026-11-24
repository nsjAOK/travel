// Builds artifact/dist/bundle-finder.html: the whole app as one page that runs
// inside Claude. React comes from cdnjs (the only script hosts a Claude page
// may load); everything else is inlined.
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// Map React imports to the globals the cdnjs UMD builds define.
const globals = {
  name: "react-globals",
  setup(b) {
    b.onResolve({ filter: /^react(-dom\/client)?$/ }, (args) => ({ path: args.path, namespace: "global" }));
    b.onLoad({ filter: /.*/, namespace: "global" }, (args) => ({
      contents: `module.exports = window.${args.path === "react" ? "React" : "ReactDOM"};`,
      loader: "js",
    }));
  },
};

const result = await build({
  entryPoints: [path.join(here, "main.tsx")],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  target: "es2020",
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  inject: [path.join(here, "react-shim.js")],
  alias: { "@": root },
  define: {
    "process.env.DUFFEL_ACCESS_TOKEN": '""',
    "process.env.MEMBERSHIP_BROWSER": '""',
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [globals],
  logLevel: "warning",
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = await readFile(path.join(root, "app/globals.css"), "utf8");

const html = `<title>Bundle Finder</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>
${css}
</style>
<div id="root"><p style="padding:32px 24px;font-family:Inter,system-ui,sans-serif">Loading Bundle Finder…</p></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;

await mkdir(path.join(here, "dist"), { recursive: true });
const out = path.join(here, "dist", "bundle-finder.html");
await writeFile(out, html);
console.log(`Wrote ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
