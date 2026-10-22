import { readFileSync } from 'node:fs';

export const legacyImports = [
  'antd',
  '@ant-design/icons',
  'ag-grid-community',
  'ag-grid-react',
  'echarts',
];

export const prohibitedClasses = [
  'bg-gradient-to',
];

/*
 * Allowlist de primitivas shadcn reestilizadas para la identidad admin
 * (T-FE-12). Toda superficie activa que importe `@/components/ui/<primitiva>`
 * debe usar una primitiva de esta lista; una primitiva nueva o no revisada se
 * marca para forzar su restyle antes de heredar el puente semántico.
 *
 * Auditoría de la lista: ningún archivo de `src/components/ui/**` referencia
 * --institutional-* ni paletas locales; todos consumen el puente semántico
 * (`--primary`, `--ring`, ...), que desde T-FE-12 resuelve a tokens --ui-*.
 * La única excepción son los selectores de recharts con `#ccc`/`#fff` de
 * chart.tsx (compatibilidad de vendor, neutros, sin paleta de identidad).
 */
export const restyledUiPrimitives = new Set([
  'accordion',
  'alert',
  'alert-dialog',
  'avatar',
  'badge',
  'breadcrumb',
  'button',
  'calendar',
  'card',
  'chart',
  'checkbox',
  'collapsible',
  'command',
  'dialog',
  'drawer',
  'dropdown-menu',
  'empty',
  'field',
  'input',
  'input-group',
  'label',
  'pagination',
  'popover',
  'progress',
  'radio-group',
  'scroll-area',
  'select',
  'separator',
  'sheet',
  'sidebar',
  'skeleton',
  'sonner',
  'spinner',
  'switch',
  'table',
  'tabs',
  'textarea',
  'toggle',
  'toggle-group',
  'tooltip',
]);

/*
 * Superficies admin activas (identidad vigente, T-FE-05) y las dependencias
 * compartidas que consumen las rutas de `AppRoutes.tsx` (resumen, cobrar,
 * recibos, caja, reportes, administración). Delimita el modo `strict`; el modo
 * `final` audita todo el runtime y por eso conserva la detección de R2 real.
 *
 * No incluye prefijos de rutas retiradas (dashboard, support, onboarding,
 * reports-view R2, shell institucional R2, layout/components/UserMenu,
 * navigation/appNavigation, keyboard-shortcuts-palette): esos archivos ya no
 * existen en el árbol activo y solo inflaban el alcance obligatorio.
 */
export const strictModulePrefixes = [
  'src/App.tsx',
  'src/components/ui/',
  'src/components/AppErrorBoundary.tsx',
  'src/components/PermissionGate.tsx',
  'src/design-system/components/',
  'src/design-system/admin/',
  'src/design-system/patterns/',
  'src/design-system/providers/',
  'src/hooks/use-mobile.ts',
  'src/hooks/useTheme.ts',
  'src/navigation/adminNavigation.ts',
  'src/shell/admin/',
  // Rutas admin activas.
  'src/features/resumen/',
  'src/features/cobrar/',
  'src/features/recibos/',
  'src/features/caja/',
  'src/features/reportes/',
  'src/features/administracion/',
  // Dependencias compartidas activas de esas rutas.
  'src/features/admin/',
  'src/features/auth/',
  'src/features/backups/',
  'src/features/cash/',
  'src/features/catalog/',
  'src/features/receipts/',
  'src/features/receipt-settings/',
  'src/features/settings/',
  'src/features/invoices/components/',
  'src/features/invoices/history/',
  'src/features/invoices/hooks/',
  'src/features/invoices/state/',
  'src/features/reports/components/',
  'src/modules/accounting/',
  'src/modules/billing/',
];

const semanticNativeTableFiles = new Set([
  'src/features/receipts/ReceiptPreview.tsx',
  'src/features/receipt-settings/components/ReceiptSettingsPreview.tsx',
]);

/*
 * Identidad admin (T-FE-05). El lenguaje "Libro de Caja" consume variables
 * --ui-* a través de utilidades Tailwind arbitrarias, estiliza controles
 * nativos con esos tokens, usa tinta blanca sobre superficies navy y abre
 * portales con ui-root/ui-portal. Esos patrones son válidos y no deben
 * contarse como legacy R2.
 *
 * La detección de R2 real se conserva: tokens de identidad R2
 * (--type-, --institutional-, --sidebar-, --chart-, --shadow-, --brand-),
 * clases de paleta institucional (teal, etc.), gradientes de marketing y
 * superficies PageHeader/Card/Badge/Alert/DataTable siguen marcándose.
 */
const adminTokenUtility = /var\(--ui-[\w-]*\)/;
const adminSourceMarker = /--ui-[\w-]*|ui-root|ui-portal|ui-menu|data-ui-press/;
const r2IdentityToken = /var\(--(?:type|institutional|sidebar|chart|shadow|brand)-[\w-]*\)/;
const literalColorUtility = /#[\da-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
/*
 * IDENTIDAD_DARK_20261016 (decisión de gate 2026-10-16): un fallback hex en
 * `var(--ui-<token>,<hex>)` es ADMITIDO solo si replica el valor canónico del
 * token declarado en `design-system/admin/tokens.css` (`:root` es la única
 * fuente de verdad del valor; el fallback es CSS defensivo). El gate verifica
 * la equivalencia byte a byte (hex↔rgb con alfa cuantizado); cualquier
 * divergencia del documento de identidad queda marcada en rojo.
 */
const canonicalFallbackPattern = /var\(--ui-([\w-]+)\s*,\s*([^)]+)\)/g;
/*
 * Sintaxis de estado de Tailwind v4 (`data-[state=inactive]:hidden`,
 * `group-data-[side=left]:flex`): selector de atributo, no literal de color ni
 * dimensión fija. Se admite solo si la clase no contiene color literal (ese
 * riesgo queda cubierto por la regla de color literal).
 */
const stateAttributeClassPattern = /^(?:[\w-]+-)*data-\[[^\]=]+=[^\]=]*]$/;

// tokens.css canónico (opcional: sin el archivo, esa verificación queda apagada).
const CANONICAL_TOKENS_PATH = new URL(
  '../src/design-system/admin/tokens.css',
  import.meta.url,
);

function parseAdminTokenFile(url) {
  const source = readFileSync(url, 'utf8');
  const index = source.indexOf(':root');
  if (index < 0) return null;
  const block = source.slice(index);
  const tokens = new Map();
  for (const match of block.matchAll(/--ui-([\w-]+):\s*([^;{]+);/g)) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

let canonicalAdminTokens = null;
try {
  canonicalAdminTokens = parseAdminTokenFile(CANONICAL_TOKENS_PATH);
} catch {
  canonicalAdminTokens = null;
}

function colorValueToBytes(raw) {
  const value = raw.trim();
  const hexMatch = value.match(/^#([\da-fA-F]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    const bytes = hex.length === 3
      ? hex.split('').flatMap((digit) => [digit, digit])
      : hex.match(/.{2}/g);
    const channels = bytes.map((byte) => Number.parseInt(byte, 16));
    return hex.length === 8 ? { rgb: channels.slice(0, 3), a: channels[3] } : { rgb: channels, a: undefined };
  }
  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].trim().split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channels = parts.map((part) => Number.parseFloat(part));
    if (channels.slice(0, 3).some((channel) => Number.isNaN(channel))) return null;
    return {
      rgb: channels.slice(0, 3).map((channel) => Math.round(channel)),
      a: channels[3] === undefined ? undefined : Math.round(channels[3] * 255),
    };
  }
  return null;
}

function isCanonicalAdminFallback(tokenName, fallbackRaw) {
  if (!canonicalAdminTokens) return null;
  const canonical = canonicalAdminTokens.get(tokenName);
  if (canonical === undefined) return null;
  if (canonical.replace(/[\s]+/g, '').toLowerCase() === fallbackRaw.replace(/[\s]+/g, '').toLowerCase()) {
    return true;
  }
  const canonicalBytes = colorValueToBytes(canonical);
  const fallbackBytes = colorValueToBytes(fallbackRaw);
  if (!canonicalBytes || !fallbackBytes) return false;
  if (canonicalBytes.a !== fallbackBytes.a) return false;
  return canonicalBytes.rgb.every((channel, index) => channel === fallbackBytes.rgb[index]);
}
// Superficie paralela solo si el identificador es tipo componente (PascalCase),
// no vocabulario de dominio en minúsculas (p. ej. `onPrintLegacy`, `legacy_reprint_count`).
const compatSurfaceIdentifier = /\b(?:Compat|Legacy|Old|V1)[A-Z]\w*|\b[A-Z]\w*(?:Compat|Legacy|Old|V1)\b/;

/*
 * T-FE-12 — vigilancia del puente de identidad.
 *
 * (a) Import de primitiva shadcn: la detección de imports legacy no cubría
 *     `@/components/ui/*`; una primitiva no allowlistada puede arrastrar la
 *     paleta R2. Se marca toda importación fuera de `restyledUiPrimitives`.
 * (b) El puente semántico no puede volver a resolver a la paleta institucional
 *     (--institutional-primary/ring/accent = teal #0f766e): cualquier
 *     referencia a esos tokens fuera del archivo histórico es fuga de R2.
 * (c) Clases acopladas al puente shadcn (`[var(--primary)]`, `[var(--ring)]`)
 *     fuera de primitivas: deben usar tokens --ui-*.
 */
const uiPrimitiveImportPattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]@\/components\/ui\/([a-z0-9-]+)['"]/g;
const institutionalBridgeRef = /var\(--institutional-(?:primary|primary-foreground|ring|accent|accent-foreground|sidebar-primary|sidebar-ring|chart-1)\b/;
const shadcnBridgeClassPattern = /\b[\w-]+-\[[^\]]*var\(--(?:primary|primary-foreground|ring|accent|accent-foreground)\b[^\]]*\]/g;

/** Archivo histórico R2: define --institutional-* pero ya no alimenta el puente. */
function isInstitutionalArchive(file) {
  return file === 'src/design-system/tokens/institutional-tokens.css';
}

/** Una fuente pertenece al lenguaje admin si referencia tokens --ui-* o marcadores admin. */
export function isAdminSurface(file, source) {
  return adminSourceMarker.test(source)
    || file.startsWith('src/design-system/admin/')
    || file.startsWith('src/shell/admin/');
}

/** Utilidad Tailwind arbitraria que consume un token admin (válida). */
export function isAdminTokenUtility(cssClass) {
  return adminTokenUtility.test(cssClass);
}

/**
 * Un fallback `var(--ui-<token>,<valor>)` es válido solo si el valor replica el
 * token canónico de tokens.css (IDENTIDAD_DARK_20261016). Devuelve `true` solo
 * con verificación estricta; cualquier divergencia sigue en rojo.
 */
function isCanonicalFallbackClass(cssClass) {
  const match = cssClass.match(/var\(--ui-([\w-]+)\s*,\s*([^)]+)\)/);
  if (!match) return false;
  return isCanonicalAdminFallback(match[1], match[2].trim()) === true;
}

/**
 * Retira de la línea los fallbacks `var(--ui-*,valor)` verificados como
 * canónicos (tokens.css), para que el escáner de color-literal no los cuente.
 * Un fallback no verificado permanece íntegro y cae en rojo.
 */
function stripVerifiedFallbacks(line) {
  return line.replace(canonicalFallbackPattern, (whole, tokenName, fallback) =>
    isCanonicalAdminFallback(tokenName, fallback.trim()) === true ? ' ' : whole);
}

function isLegacyArbitraryClass(cssClass, adminSurface) {
  if (isAdminTokenUtility(cssClass)) return false;
  if (stateAttributeClassPattern.test(cssClass) && !literalColorUtility.test(cssClass)) return false;
  if (r2IdentityToken.test(cssClass)) return true;
  if (literalColorUtility.test(cssClass)) return !isCanonicalFallbackClass(cssClass);
  if (/var\(/.test(cssClass)) return false; // otro token de diseño neutro (p. ej. --dialog-max-h)
  return !adminSurface; // dimensión fija: válida solo dentro del lenguaje admin
}

function isAdminNeutralPalette(cssClass, adminSurface) {
  if (!adminSurface) return false;
  // Tinta blanca sobre superficies navy/action/danger.
  if (/^text-white(?:\/\d+)?$/.test(cssClass)) return true;
  // Negro/blanco con opacidad para scrims y outlines de imagen (better-ui).
  if (/^(?:bg|outline|border|ring|fill|stroke|divide)-(?:black|white)\/\d+$/.test(cssClass)) return true;
  // §4 IDENTIDAD_DARK_20261016: el blanco sobrevive como papel del documento
  // institucional (vista previa de recibo/impresión); `bg-white` exacto en
  // superficies admin encuadra ese caso. Cualquier otro blanco es deuda
  // declarada del dueño del módulo.
  if (/^bg-white$/.test(cssClass)) return true;
  return false;
}

export function classifyModule(file) {
  const feature = file.match(/^src\/features\/([^/]+)\//)?.[1];
  if (feature) return feature;
  if (file.startsWith('src/design-system/')) return 'design-system';
  if (file.startsWith('src/components/ui/')) return 'ui-primitives';
  if (file.startsWith('src/shell/')) return 'shell';
  if (file.startsWith('src/layout/')) return 'layout';
  if (file.startsWith('src/modules/')) return file.split('/')[2] ?? 'modules';
  return 'shared';
}

export function scanSource(file, rawSource) {
  const source = stripBlockComments(rawSource);
  const module = classifyModule(file);
  const violations = [];
  const isUiPrimitive = file.startsWith('src/components/ui/');
  const adminSurface = isAdminSurface(file, source);

  if (/(?:^|\/)[^/]*(?:Compat|Legacy|Old|V1|Adapter|Antd)[^/]*\.(?:ts|tsx)$/.test(file)
    || compatSurfaceIdentifier.test(source)) {
    violations.push(makeViolation({
      file,
      line: findLine(source, compatSurfaceIdentifier),
      kind: 'compat-surface',
      module,
      message: 'superficie de compatibilidad legacy prohibida',
      risk: 'high',
    }));
  }

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    for (const match of isUiPrimitive || adminSurface ? [] : line.matchAll(/<(button|input|select|textarea|dialog|details)\b/g)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'native-interactive-control',
        dependency: match[1],
        module,
        message: `control interactivo HTML "${match[1]}" fuera de los primitivos shadcn`,
        risk: 'high',
      }));
    }

    if (!isUiPrimitive && !adminSurface && !semanticNativeTableFiles.has(file) && /<table\b/.test(line)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'native-application-table',
        dependency: 'table',
        module,
        message: 'tabla visual de aplicacion fuera de shadcn DataTable',
        risk: 'medium',
      }));
    }

    for (const dependency of legacyImports) {
      const dependencyPattern = new RegExp(
        `(?:from\\s+|import\\s*|require\\(\\s*)['"]${escapeRegex(dependency)}(?:/|['"])`,
      );
      if (dependencyPattern.test(line) && !line.trim().startsWith('// Allow legacy')) {
        violations.push(makeViolation({
          file,
          line: lineNumber,
          kind: 'legacy-import',
          dependency,
          module,
          message: `importación legacy prohibida de "${dependency}"`,
          risk: 'high',
        }));
      }
    }

    for (const match of line.matchAll(uiPrimitiveImportPattern)) {
      const primitive = match[1];
      if (restyledUiPrimitives.has(primitive)) continue;
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'unrestyled-ui-primitive',
        dependency: `@/components/ui/${primitive}`,
        module,
        message: `primitiva shadcn fuera de la allowlist reestilizada admin ("@/components/ui/${primitive}")`,
        risk: 'high',
      }));
    }

    if (!isInstitutionalArchive(file) && institutionalBridgeRef.test(line)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'institutional-bridge-leak',
        module,
        message: 'el puente de identidad no debe resolver a --institutional-primary/ring/accent (teal R2); usar tokens --ui-*',
        risk: 'high',
      }));
    }

    if (!isUiPrimitive && !adminSurface) {
      for (const cssClass of line.match(shadcnBridgeClassPattern) ?? []) {
        violations.push(makeViolation({
          file,
          line: lineNumber,
          kind: 'shadcn-bridge-class',
          cssClass,
          module,
          message: `clase acoplada al puente shadcn "${cssClass}"; usar un token --ui-*`,
          risk: 'medium',
        }));
      }
    }

    if (line.includes('motion/react')) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'legacy-motion',
        dependency: 'motion/react',
        module,
        message: 'uso de "motion/react" (usar Ant Design motion/transitions)',
        risk: 'medium',
      }));
    }

    for (const cssClass of isUiPrimitive ? [] : prohibitedClasses) {
      if (new RegExp(`\\b${escapeRegex(cssClass)}\\b`).test(line)) {
        violations.push(makeViolation({
          file,
          line: lineNumber,
          kind: 'prohibited-class',
          cssClass,
          module,
          message: `clase visual prohibida "${cssClass}"`,
          risk: cssClass.startsWith('bg-gradient') ? 'high' : 'medium',
        }));
      }
    }

    const isModuleDeclaration = /^\s*(?:import|export)\b/.test(line);
    const broadVisualClasses = isModuleDeclaration || isUiPrimitive
      ? []
      : line.match(/\b(?:from|via|to)(?:-[\w[\].:/%-]+)+\b|\bbackdrop-blur(?:-[\w[\].:/%-]+)?\b|\bglass\b/g) ?? [];
    for (const cssClass of broadVisualClasses) {
      if (prohibitedClasses.includes(cssClass)) continue;
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'prohibited-class',
        cssClass,
        module,
        message: `clase visual prohibida "${cssClass}"`,
        risk: /^(?:from|via|to|bg-gradient)/.test(cssClass) ? 'high' : 'medium',
      }));
    }

    const arbitraryClasses = isUiPrimitive ? [] : line.match(/\b[\w-]+-\[[^\]\r\n]+\]/g) ?? [];
    for (const cssClass of arbitraryClasses) {
      if (!isLegacyArbitraryClass(cssClass, adminSurface)) continue;
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'arbitrary-tailwind',
        cssClass,
        module,
        message: `valor arbitrario de Tailwind prohibido "${cssClass}"`,
        risk: 'medium',
      }));
    }

    const localPaletteClasses = isModuleDeclaration || isUiPrimitive
      ? []
      : line.match(/\b(?:text|bg|border|fill|stroke|ring|outline|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?\b/g) ?? [];
    for (const cssClass of localPaletteClasses) {
      if (isAdminNeutralPalette(cssClass, adminSurface)) continue;
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'local-palette-class',
        cssClass,
        module,
        message: `clase de paleta local prohibida "${cssClass}"`,
        risk: 'medium',
      }));
    }

    if (!file.startsWith('src/design-system/') && !isUiPrimitive
      && /\b(?:function|const)\s+(?:Button|Alert|Badge|Dialog|Drawer|Sheet|Toast|Chart|Calendar|Command)\b/.test(line)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'manual-visual-wrapper',
        module,
        message: 'wrapper visual manual con API legacy prohibido',
        risk: 'high',
      }));
    }

    if (!isUiPrimitive && /\bstyle\s*=\s*\{\{/.test(line)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'inline-style',
        module,
        message: 'estilo inline visual prohibido',
        risk: 'medium',
      }));
    }

    const isCentralTokenFile = file.startsWith('src/design-system/themes/')
      || file.startsWith('src/design-system/tokens/')
      || file.startsWith('src/design-system/admin/tokens')
      || isUiPrimitive;
    const literalColorLine = isCentralTokenFile ? line : stripVerifiedFallbacks(line);
    if (!isCentralTokenFile && /(?:#[\da-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()/.test(literalColorLine)) {
      violations.push(makeViolation({
        file,
        line: lineNumber,
        kind: 'color-literal',
        module,
        message: 'color literal fuera de tokens institucionales',
        risk: 'medium',
      }));
    }

  });

  return violations;
}

export function filterViolationsForMode(violations, mode) {
  if (mode === 'inventory') return violations;
  if (mode === 'final') return violations.filter((violation) => !/\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(violation.file));
  if (mode === 'strict') {
    const scoped = violations.filter((violation) => strictModulePrefixes.some((prefix) => violation.file.startsWith(prefix))
      && !/\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(violation.file));
    const filesWithLegacyImport = new Set(
      scoped.filter((violation) => violation.kind === 'legacy-import').map((violation) => violation.file),
    );
    return scoped.filter(
      (violation) => !(violation.kind === 'compat-surface' && filesWithLegacyImport.has(violation.file)),
    );
  }
  throw new Error(`Modo desconocido: ${mode}`);
}

function findLine(source, pattern) {
  const index = source.search(pattern);
  return index < 0 ? 1 : source.slice(0, index).split(/\r?\n/).length;
}

function makeViolation(violation) {
  return {
    ...violation,
    consumer: violation.file,
    phaseOwner: violation.module,
    status: 'backlog',
  };
}

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
