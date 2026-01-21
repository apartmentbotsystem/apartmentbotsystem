import { defineConfig, globalIgnores } from "eslint/config";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const nextVitals = require("eslint-config-next/core-web-vitals");
const nextTs = require("eslint-config-next/typescript");

const eslintConfig = defineConfig([
  nextVitals,
  nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    ".vercel/**",
    "next-env.d.ts",
    "tools/**",
    "etc/**",
    "tests/api/**",
    "test-results/**",
    "docs/**",
    "chapter-3-diagrams/**",
    "chapter-3/**",
    "scripts/export/**"
  ]),
  {
    files: ["src/app/admin/chat/page.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='sort']:not(CallExpression[arguments.0.name='sortRoomNumbers'])",
          message: "ห้ามใช้ .sort() กับ roomNumber โดยไม่ผ่าน sortRoomNumbers",
        },
      ],
    },
  },
]);

export default eslintConfig;
