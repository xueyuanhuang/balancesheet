import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        <svg
          width="130"
          height="130"
          viewBox="0 0 360 360"
          fill="none"
        >
          {/* Grid lines */}
          <line x1="60" y1="280" x2="300" y2="280" stroke="#334155" strokeWidth="4" />
          <line x1="60" y1="220" x2="300" y2="220" stroke="#1e293b" strokeWidth="2" strokeDasharray="8 6" />
          <line x1="60" y1="160" x2="300" y2="160" stroke="#1e293b" strokeWidth="2" strokeDasharray="8 6" />
          <line x1="60" y1="100" x2="300" y2="100" stroke="#1e293b" strokeWidth="2" strokeDasharray="8 6" />

          {/* Upward trend line */}
          <polyline
            points="80,240 130,220 170,200 210,170 250,120 280,80"
            stroke="#10b981"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Gradient fill under the line */}
          <defs>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points="80,240 130,220 170,200 210,170 250,120 280,80 280,280 80,280"
            fill="url(#fillGrad)"
          />

          {/* End point dot */}
          <circle cx="280" cy="80" r="16" fill="#10b981" />
          <circle cx="280" cy="80" r="8" fill="#0f172a" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
