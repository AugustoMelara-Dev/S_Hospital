"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  // El feedback comparte el tema claro y los tokens del panel.
  return (
    <Sonner
      theme="light"
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
          // Superficie, tinta y borde compartidos con el panel.
          "--normal-bg": "var(--ui-surface)",
          "--normal-text": "var(--ui-ink)",
          "--normal-border": "var(--ui-line)",
          "--border-radius": "var(--ui-radius)",
          colorScheme: "light",
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
