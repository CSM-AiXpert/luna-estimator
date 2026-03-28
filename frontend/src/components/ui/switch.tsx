"use client"

import * as React from "react"

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onCheckedChange, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        width: "44px",
        height: "24px",
        borderRadius: "999px",
        background: checked ? "rgba(0,212,255,0.8)" : "rgba(255,255,255,0.15)",
        border: checked ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        padding: 0,
        outline: "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: checked ? "22px" : "2px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  )
}
