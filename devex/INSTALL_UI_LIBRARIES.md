# Instalación de Librerías UI

Ejecutar en `frontend/`.

```bash
npm install @tanstack/react-query @tanstack/react-table react-router-dom react-hook-form zod @hookform/resolvers lucide-react recharts date-fns sonner clsx tailwind-merge @zxing/browser
```

Si se adopta shadcn/ui:

```bash
npx shadcn@latest init
npx shadcn@latest add button card input label select tabs table badge dialog dropdown-menu separator sheet skeleton form calendar popover command toast
```

Después ejecutar:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```
