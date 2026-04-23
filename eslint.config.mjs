import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  // ── Ignore non-source files ──
  {
    ignores: [
      "node_modules/**",
      "lib/**",          // PDF.js vendor builds
      "logs/**",
      "PDF resources/**",
      "sample csv exports/**",
      "*.min.js",
      "*.min.mjs"
    ]
  },

  // ── JS/MJS source files ──
  {
    files: ["js/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        localStorage: "readonly",
        location: "readonly",
        history: "readonly",
        Blob: "readonly",
        URL: "readonly",
        fetch: "readonly",
        FileReader: "readonly",
        TextDecoder: "readonly",
        indexedDB: "readonly",
        crypto: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        DragEvent: "readonly",
        Event: "readonly",
        prompt: "readonly",
        alert: "readonly",
        confirm: "readonly",
        // Vendor globals attached to window by classic <script> tags
        XLSX: "readonly",
        // App globals
        PP: "writable"
      }
    },
    plugins: {
      prettier: prettier
    },
    rules: {
      // ── Prettier integration ──
      "prettier/prettier": "warn",
      ...prettierConfig.rules,

      // ── Code quality ──
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-redeclare": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "warn",
      "no-constant-condition": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "eqeqeq": ["warn", "smart"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",

      // ── Style (ES5 conventions — var, function, no arrow, no const/let) ──
      // These are informational, not enforced — the codebase intentionally uses var
      "no-var": "off",
      "prefer-const": "off",
      "prefer-arrow-callback": "off",
      "prefer-template": "off",
      "no-restricted-syntax": "off"
    }
  },

  // ── HTML-embedded scripts (lighter rules) ──
  {
    files: ["*.html"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script"
    },
    rules: {
      // HTML files have inline onclick handlers etc — skip linting
    }
  }
];
