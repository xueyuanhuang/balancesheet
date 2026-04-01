"use client"

import { useEffect } from "react"

export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for updates immediately and every 30 minutes
          reg.update().catch(() => {})
          const interval = setInterval(() => {
            reg.update().catch(() => {})
          }, 30 * 60 * 1000)

          // When a new SW is ready, activate it immediately
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing
            if (!newWorker) return
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                // Reload to use the new version
                window.location.reload()
              }
            })
          })

          return () => clearInterval(interval)
        })
        .catch(() => {})
    }
  }, [])

  return null
}
