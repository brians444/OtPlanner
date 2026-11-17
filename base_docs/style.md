# Guía de estilo / Design System

Documento de referencia para replicar el look & feel de este frontend (Next.js +
shadcn/ui) en otro proyecto. Incluye stack exacto, tokens de diseño, y los
patrones de layout/componentes que se repiten en toda la app.

## 1. Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript 5**
- **Tailwind CSS 3** como sistema de utilidades
- **shadcn/ui** (no es una librería instalada, son componentes copiados a
  `src/components/ui/`) sobre primitivas de **Radix UI**
- **lucide-react** — único set de iconos usado en toda la app
- **@tanstack/react-query** — fetching/cache/mutations (no hay Redux/Zustand)
- **class-variance-authority (cva)** + **tailwind-merge** + **clsx** — para
  variantes de componentes (`cn()` helper)
- **react-hook-form** + **zod** + **@hookform/resolvers** — formularios con
  validación (donde se usa; muchos formularios simples usan `useState` directo)
- **axios** — cliente HTTP
- **recharts** — gráficos (dashboard)
- **date-fns** — fechas
- Fuente: **Inter** (`next/font/google`)

### package.json (dependencias relevantes)

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@tanstack/react-query": "^5.17.19",
    "@tanstack/react-table": "^8.21.3",
    "axios": "^1.21.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "date-fns": "^3.3.1",
    "lucide-react": "^1.72.0",
    "next": "16.4.6",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "react-hook-form": "^7.49.3",
    "recharts": "^3.7.0",
    "tailwind-merge": "^2.2.1",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "autoprefixer": "^10.0.1",
    "eslint": "9.39.5",
    "eslint-config-next": "16.4.6",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "typescript": "^5"
  },
  "overrides": {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0"
  }
}
```

Nota: este proyecto no tiene `components.json` (los componentes de
`src/components/ui/` están copiados a mano, no vía CLI de shadcn), pero las
clases coinciden exactamente con el preset **default** de shadcn/ui (no
"new-york" — se nota en el radius, el alto de los botones `h-10`, etc.). Para
un proyecto nuevo: `npx create-next-app@latest` (App Router, TypeScript,
Tailwind, React 19) y luego `npx shadcn@latest init` eligiendo el estilo
**default**, después `npx shadcn@latest add button input label card table
badge tabs alert progress checkbox dialog switch select`.

Nota sobre ESLint: desde `eslint-config-next` 16 el preset ya exporta **flat
config** nativo (`eslint-config-next/core-web-vitals`), así que
`eslint.config.mjs` lo importa directo — ya no hace falta el shim
`FlatCompat`/`@eslint/eslintrc` que necesitaban las versiones 14/15. La
versión de `eslint-plugin-react-hooks` que trae Next 16 es bastante más
estricta (reglas pensadas para React Compiler, ej.
`react-hooks/set-state-in-effect`) y puede marcar como error el patrón común
de hidratar estado desde `localStorage` en un `useEffect` de montaje —
evaluar si conviene desactivar esa regla puntual si el proyecto usa ese
patrón para evitar mismatches de hidratación SSR.

## 2. Tokens de diseño (colores)

Paleta **default de shadcn/ui, sin modificar** (azul como color primario,
escala de grises neutra). Variables HSL en `src/app/globals.css`, consumidas
por `tailwind.config.js` vía `hsl(var(--token))`.

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

**Dark mode = `darkMode: ["class"]`** (clase `.dark` en `<html>`), no
`prefers-color-scheme`. Se activa agregando/quitando la clase `dark` en
`document.documentElement`.

### tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

Nunca usar colores Tailwind crudos (`bg-blue-500`, `text-gray-700`, etc.) en
páginas — siempre los tokens semánticos (`bg-primary`, `text-muted-foreground`,
`bg-background`, `border`). Eso es lo que hace que el dark mode funcione sin
tocar cada componente.

## 3. Tipografía

```tsx
// app/layout.tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
// <body className={inter.className}>
```

Jerarquía: `CardTitle` = `text-2xl font-semibold`, títulos de página = `text-3xl
font-bold`, texto secundario = `text-sm text-muted-foreground`, labels de
formulario = `text-sm font-medium`.

## 4. Componentes base (`src/components/ui/`)

Son los componentes shadcn/ui **sin modificar** (copiados, no instalados como
paquete): `button`, `input`, `label`, `card`, `table`, `badge`, `tabs`,
`alert`, `progress`, `checkbox`, `dialog`, `switch`, `select`. Todos siguen el
patrón: `React.forwardRef` + `cva` para variantes + `cn()` para merge de
clases + Radix primitive por debajo cuando aplica.

### `lib/utils.ts` (helper `cn`, usado en absolutamente todo)

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Button — variantes y tamaños

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: { default: "h-10 px-4 py-2", sm: "h-9 rounded-md px-3", lg: "h-11 rounded-md px-8", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

Uso típico: `variant="outline"` para acciones secundarias de fila (editar),
`variant="destructive"` para borrar, `variant="ghost"` para links/sidebar,
siempre con un ícono de `lucide-react` de `h-4 w-4` (o `h-3 w-3` en botones de
tabla chicos) + `mr-2` si hay texto al lado.

## 5. Layout de la app

### Shell: Sidebar colapsable **o** Navbar superior (switcheable por el usuario)

El layout de navegación no está fijo: el usuario elige entre sidebar lateral
colapsable o navbar superior clásica, persistido en `localStorage`
(`nav_layout` = `"sidebar" | "top"`, default `"top"`). `AppShell` decide cuál
renderizar:

```tsx
// components/app-shell.tsx (simplificado)
export function AppShell({ children }: { children: React.ReactNode }) {
  const { layout, isLoaded } = useNavLayout();
  useTheme(); // aplica el tema guardado al cargar
  if (!isLoaded) return <>{children}</>;
  if (layout === "sidebar") {
    return (<><Sidebar />
      <div style={{ marginLeft: sidebarCollapsed ? "64px" : "240px" }} className="transition-all duration-200">
        {children}
      </div></>);
  }
  return (<><Navbar />{children}</>);
}
```

- **Sidebar**: `fixed left-0 top-0 h-screen border-r bg-background`, ancho
  `w-60` expandida / `w-16` colapsada (`transition-all duration-200`), logo +
  buscador global arriba, lista de `Button variant="ghost"|"default"` (activo
  = `default`) con ícono `h-4 w-4`, separador `border-t` + label uppercase
  `text-xs text-muted-foreground tracking-wider` antes de la sección admin,
  usuario + logout abajo.
- Toggle de dark mode y de layout (sidebar/navbar) viven en la página de
  Configuración, no en la barra — persisten en `localStorage` y se sincronizan
  entre pestañas vía `CustomEvent` (patrón `useTheme`/`useNavLayout`).

### Página estándar (se repite en ~15 páginas, prácticamente sin variación)

```tsx
export default function SomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Título</h1>
          {/* acción principal a la derecha, ej: <Button><Plus className="mr-2 h-4 w-4"/>Agregar</Button> */}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>...</CardTitle>
            <CardDescription>...</CardDescription>
          </CardHeader>
          <CardContent>{/* tabla o formulario */}</CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### Modal (no se usa `<Dialog>` de Radix para los CRUD modals — es un overlay manual)

Patrón repetido literalmente en cada modal de crear/editar de la app:

```tsx
{showModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Nuevo Registro</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Nombre *</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  </div>
)}
```

- `z-50` para el modal; si hay un modal **dentro** de otro modal (p. ej. un
  "crear rápido" disparado desde un form que ya está en un modal), usar
  `z-[60]` y **renderizarlo con `createPortal(..., document.body)`** — un
  `<form>` nunca puede anidarse dentro de otro `<form>` en HTML, así que el
  modal hijo tiene que salir del árbol del form padre o el submit se
  comporta mal (navegación de página en vez de quedarse en el modal).
- Tamaños de modal: `max-w-md` (formulario simple), `max-w-lg` (formulario +
  lista editable), `max-w-2xl` / `max-w-4xl` (formularios largos o tablas
  dentro del modal).

### Tabla con selector de estilo (feature propia del proyecto, no de shadcn)

Cada página con tabla ofrece 4 variantes visuales elegibles por el usuario
(estándar / alternado / con bordes / compacto), con un selector de iconitos
arriba a la derecha:

```tsx
export type TableStyle = "default" | "striped" | "bordered" | "compact";
export const tableStyles: Record<TableStyle, { tableClass: string; rowClass: string; cellClass: string }> = {
  default:  { tableClass: "", rowClass: "hover:bg-muted/50", cellClass: "py-3" },
  striped:  { tableClass: "", rowClass: "even:bg-muted/30 hover:bg-muted/50", cellClass: "py-3" },
  bordered: { tableClass: "[&_th]:border [&_td]:border", rowClass: "hover:bg-muted/50", cellClass: "py-3" },
  compact:  { tableClass: "text-xs", rowClass: "hover:bg-muted/50", cellClass: "py-1.5 px-2" },
};
```

Uso: `<Table className={tableStyles[tableStyle].tableClass}>`, cada `<TableRow
className={tableStyles[tableStyle].rowClass}>`, cada celda con
`tableStyles[tableStyle].cellClass`. Acciones de fila a la derecha:
`<TableCell className="text-right">` con `flex gap-2 justify-end` de botones
`size="sm"`.

## 6. Iconos

Solo **lucide-react**. Tamaño estándar `h-4 w-4` (inline con texto), `h-3 w-3`
en botones de tabla, `h-5 w-5` en títulos de card con ícono, `h-8 w-8`/`h-12
w-12` en headers de página o estados vacíos (`text-muted-foreground`).

## 7. Datos: TanStack Query, siempre igual

```tsx
const queryClient = useQueryClient();

const { data, isLoading } = useQuery({
  queryKey: ["devices"],                       // array, nunca string
  queryFn: () => deviceService.getDevices(),
});

const mutation = useMutation({
  mutationFn: (payload) => deviceService.createDevice(payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["devices"] });
    setShowModal(false);
  },
});
```

El cliente API (`lib/api.ts`, axios) centraliza baseURL + refresh de token
automático en 401; los "services" (`lib/services.ts`) son funciones async
puras por entidad (`deviceService.getDevices()`, `.createDevice()`, etc.) que
devuelven `response.data` — las páginas nunca llaman a axios directo.

## 8. Formularios

Para forms simples (la mayoría de los CRUD): `useState` con el shape del
payload + inputs controlados directo, sin react-hook-form. React-hook-form +
zod se reserva para formularios más grandes o con validación compleja.
Selects en cascada (ej. Ubicación → Locación → Instalación) resetean los
campos dependientes en el `onValueChange` del padre y usan `disabled` +
placeholder condicional mientras no haya padre elegido.

## 9. Internacionalización

`src/i18n/es.json` / `en.json` (claves anidadas por sección, ej.
`importExport.entities.devices`) + `I18nProvider` + hook `useTranslation()` →
`const { t } = useTranslation(); t("nav.dashboard")`. Selector de idioma vive
en la sidebar/navbar (`LanguageSelector`), persistido en `localStorage`.

## 10. Checklist para bootstrapear un proyecto nuevo con este mismo estilo

1. `npx create-next-app@latest` — TypeScript, Tailwind, App Router, `src/` (React 19 por defecto).
2. Copiar `tailwind.config.js` y las variables de `globals.css` de la sección 2.
3. `npx shadcn@latest init` (preset default, no "new-york"; radius `0.5rem`).
4. `npx shadcn@latest add button input label card table badge tabs alert progress checkbox dialog switch select`.
5. Instalar `@tanstack/react-query axios class-variance-authority clsx tailwind-merge lucide-react date-fns`.
6. Copiar `lib/utils.ts` (`cn`), el hook `use-theme.ts` (toggle dark/light con
   `localStorage` + `CustomEvent`), y opcionalmente `use-nav-layout.ts` +
   `table-style-selector.tsx` si se quiere el mismo nivel de personalización.
7. Montar `QueryProvider` (`QueryClientProvider` de TanStack) en el root
   `layout.tsx`, envolviendo `AppShell`.
8. Replicar el patrón de página (sección 5) y el patrón de modal (sección 5)
   para cada entidad CRUD nueva.
