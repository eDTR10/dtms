const SigningOverlay = () => (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-20"
    style={{ background: "rgba(15,23,42,0.70)", backdropFilter: "blur(2px)" }}
  >
    <style>{`
      @keyframes scanBeam {
        0%   { top: 0px }
        50%  { top: calc(100% - 2px) }
        100% { top: 0px }
      }
      @keyframes stampPop {
        0%,55%  { opacity: 0; transform: scale(1.2) }
        70%,90% { opacity: 1; transform: scale(1)   }
        100%    { opacity: 0; transform: scale(1)   }
      }
      @keyframes sigProgress {
        0%   { width: 0%  }
        80%  { width: 88% }
        100% { width: 88% }
      }
      @keyframes blink {
        0%,80%,100% { opacity: 0.25 }
        40%         { opacity: 1    }
      }
      @keyframes shimmer {
        0%   { transform: translateX(-100%) }
        100% { transform: translateX(400%)  }
      }
      @keyframes linePulse {
        0%,100% { opacity: 0.35 }
        50%     { opacity: 0.9  }
      }
    `}</style>

    {/* Document frame */}
    <div className=" bg-white/70 animate-pulse" style={{
      position: "relative",
      width: 260, height: 310,
      borderRadius: 6,
      border: "0.5px solid rgba(255,255,255,0.15)",
      overflow: "hidden",
      padding: "18px 18px 0",
      flexShrink: 0,
    }}>

      {/* Corner brackets */}
      {([
        { top: 6,    left:  6,  borderWidth: "2px 0 0 2px"   },
        { top: 6,    right: 6,  borderWidth: "2px 2px 0 0"   },
        { bottom: 6, left:  6,  borderWidth: "0 0 2px 2px"   },
        { bottom: 6, right: 6,  borderWidth: "0 2px 2px 0"   },
      ] as React.CSSProperties[]).map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          width: 12, height: 12,
          borderStyle: "solid",
          borderColor: "#3b82f6",
          opacity: 0.75,
          ...s,
        }} />
      ))}

      {/* Fake document lines — each has a shimmer sweep + staggered pulse */}
      {[
        { w: 55, h: 12, mb: 10, isTitle: true,  delay: 0    },
        { w: 90, h: 8,  mb: 8,  isTitle: false, delay: 0.1  },
        { w: 75, h: 8,  mb: 8,  isTitle: false, delay: 0.2  },
        { w: 55, h: 8,  mb: 8,  isTitle: false, delay: 0.3  },
        { w: 85, h: 8,  mb: 8,  isTitle: false, delay: 0.15 },
        { w: 68, h: 8,  mb: 8,  isTitle: false, delay: 0.25 },
        { w: 50, h: 8,  mb: 14, isTitle: false, delay: 0.35 },
        { w: 88, h: 8,  mb: 8,  isTitle: false, delay: 0.05 },
        { w: 72, h: 8,  mb: 8,  isTitle: false, delay: 0.2  },
        { w: 60, h: 8,  mb: 8,  isTitle: false, delay: 0.3  },
        { w: 80, h: 8,  mb: 8,  isTitle: false, delay: 0.1  },
      ].map((line, i) => (
        <div key={i} style={{
          position:     "relative",
          height:       line.h,
          width:        `${line.w}%`,
          background:   line.isTitle ? "#e2e8f0" : "#f1f5f9",
          borderRadius: 3,
          marginBottom: line.mb,
          overflow:     "hidden",
          animation:    `linePulse 2s ${line.delay}s ease-in-out infinite`,
        }}>
          {/* shimmer sweep */}
          <div style={{
            position:   "absolute",
            top: 0, bottom: 0,
            width:      "30%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
            animation:  `shimmer 2s ${line.delay}s ease-in-out infinite`,
          }} />
        </div>
      ))}

      {/* Scanner glow (behind beam) */}
      <div style={{
        position:   "absolute",
        left: 0, right: 0,
        height:     50,
        background: "linear-gradient(180deg, rgba(59,130,246,0.14) 0%, transparent 100%)",
        animation:  "scanBeam 1.7s ease-in-out infinite",
      }} />

      {/* Scanner beam */}
      <div style={{
        position:   "absolute",
        left: 0, right: 0,
        height:     2,
        background: "#3b82f6",
        boxShadow:  "0 0 10px 4px rgba(59,130,246,0.45)",
        animation:  "scanBeam 1.7s ease-in-out infinite",
      }} />

      {/* Stamp box that fades in */}
      <div style={{
        position:     "absolute",
        bottom: 24, right: 20,
        width: 60, height: 36,
        border:       "2px solid #3b82f6",
        borderRadius: 3,
        animation:    "stampPop 1.7s ease-in-out infinite",
      }} />

      {/* Checkmark inside stamp */}
      <div style={{
        position:     "absolute",
        bottom: 33, right: 30,
        width: 11, height: 18,
        borderRight:  "2.5px solid #3b82f6",
        borderBottom: "2.5px solid #3b82f6",
        transform:    "rotate(40deg)",
        animation:    "stampPop 1.7s ease-in-out infinite",
      }} />
    </div>

    {/* Label + progress */}
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <p style={{
        color:          "white",
        fontSize:       14,
        fontWeight:     600,
        margin:         0,
        letterSpacing:  "0.02em",
      }}>
        Signing document
        <span style={{ display: "inline-flex", gap: 2, marginLeft: 2 }}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <span key={i} style={{ animation: `blink 1.2s ${delay}s infinite`, opacity: 0.25 }}>.</span>
          ))}
        </span>
      </p>

      {/* Progress bar */}
      <div style={{
        width:        260,
        height:       3,
        background:   "rgba(255,255,255,0.15)",
        borderRadius: 2,
        overflow:     "hidden",
      }}>
        <div style={{
          height:       "100%",
          background:   "#3b82f6",
          borderRadius: 2,
          animation:    "sigProgress 1.7s ease-in-out infinite",
        }} />
      </div>
    </div>
  </div>
);

export default SigningOverlay;