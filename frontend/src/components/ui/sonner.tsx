"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  // Identidad dark única: no se hereda `next-themes`. Un toaster claro
  // contradiría la identidad dark de superficie (los --ui-* son dark). `theme`
  // sigue siendo sobrescribible por props explícitas para consumidores aislados.
  return (
    <Sonner
      theme="dark"
      className="toaster group pointer-events-none [&_[data-icon]]:size-4"
      icons={{
        success: (
          <CircleCheckIcon />
        ),
        info: (
          <InfoIcon />
        ),
        warning: (
          <TriangleAlertIcon />
        ),
        error: (
          <OctagonXIcon />
        ),
        loading: (
          <Loader2Icon className="animate-spin" />
        ),
      }}
      style={
        {
          // Superficie/tinta/borde admin directos (no pasan por el puente
          // shadcn): el toast conserva la identidad dark aunque el puente
          // cambie.
          "--normal-bg": "var(--ui-surface)",
          "--normal-text": "var(--ui-ink)",
          "--normal-border": "var(--ui-line)",
          "--border-radius": "var(--ui-radius)",
          colorScheme: "dark",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
