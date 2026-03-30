const SendingOverlay = ({ hasSigs = false }: { hasSigs?: boolean }) => (
  <div
    className="fixed inset-0 flex flex-col items-center justify-center gap-5 z-20 backdrop-blur-sm bg-black/20  "

  >
    <style>{`
      @keyframes sendEnvelope {
        0%   { transform: translateY(0) scale(1); opacity: 1 }
        40%  { transform: translateY(-18px) scale(1.05); opacity: 1 }
        70%  { transform: translateY(-6px) scale(1); opacity: 1 }
        100% { transform: translateY(0) scale(1); opacity: 1 }
      }
      @keyframes sendFlyUp {
        0%,60%  { opacity: 0; transform: translateY(12px) scale(0.8) }
        80%     { opacity: 1; transform: translateY(-2px) scale(1.02) }
        100%    { opacity: 1; transform: translateY(0) scale(1) }
      }
      @keyframes sendPulseRing {
        0%   { transform: scale(0.85); opacity: 0.5 }
        50%  { transform: scale(1.15); opacity: 0.1 }
        100% { transform: scale(0.85); opacity: 0.5 }
      }
      @keyframes sendProgress {
        0%   { width: 0%  }
        60%  { width: 75% }
        85%  { width: 92% }
        100% { width: 92% }
      }
      @keyframes sendBlink {
        0%,80%,100% { opacity: 0.25 }
        40%         { opacity: 1    }
      }
      @keyframes sendShimmer {
        0%   { transform: translateX(-100%) }
        100% { transform: translateX(400%)  }
      }
      @keyframes sendLinePulse {
        0%,100% { opacity: 0.35 }
        50%     { opacity: 0.9  }
      }
      @keyframes sendCheckPop {
        0%,70%  { opacity: 0; transform: scale(0.5) rotate(-10deg) }
        85%     { opacity: 1; transform: scale(1.15) rotate(0deg) }
        100%    { opacity: 1; transform: scale(1) rotate(0deg) }
      }
    `}</style>

    {/* Document + envelope animation */}
    <div style={{ position: "relative", width: 220, height: 260, flexShrink: 0 }}>

      {/* Pulse rings behind */}
      {[0, 0.4, 0.8].map((delay, i) => (
        <div key={i} style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 200, height: 200,
          marginTop: -100, marginLeft: -100,
          borderRadius: "50%",
          border: "1.5px solid rgba(59,130,246,0.3)",
          animation: `sendPulseRing 2s ${delay}s ease-in-out infinite`,
        }} />
      ))}

      {/* Document card */}
      <div style={{
        position: "absolute",
        top: 20, left: "50%", marginLeft: -90,
        width: 180, height: 220,
        borderRadius: 8,
        background: "rgba(255,255,255,0.85)",
        border: "1px solid rgba(255,255,255,0.2)",
        overflow: "hidden",
        padding: "16px 14px 0",
        animation: "sendEnvelope 2s ease-in-out infinite",
        boxShadow: "0 8px 32px rgba(59,130,246,0.2)",
      }}>
        {/* Fake document lines */}
        {[
          { w: 50, h: 10, mb: 8, isTitle: true, delay: 0 },
          { w: 85, h: 6, mb: 6, isTitle: false, delay: 0.1 },
          { w: 70, h: 6, mb: 6, isTitle: false, delay: 0.2 },
          { w: 55, h: 6, mb: 6, isTitle: false, delay: 0.3 },
          { w: 80, h: 6, mb: 6, isTitle: false, delay: 0.15 },
          { w: 65, h: 6, mb: 6, isTitle: false, delay: 0.25 },
          { w: 45, h: 6, mb: 10, isTitle: false, delay: 0.35 },
          { w: 75, h: 6, mb: 6, isTitle: false, delay: 0.1 },
          { w: 60, h: 6, mb: 6, isTitle: false, delay: 0.2 },
        ].map((line, i) => (
          <div key={i} style={{
            position: "relative",
            height: line.h,
            width: `${line.w}%`,
            background: line.isTitle ? "#cbd5e1" : "#e2e8f0",
            borderRadius: 3,
            marginBottom: line.mb,
            overflow: "hidden",
            animation: `sendLinePulse 2s ${line.delay}s ease-in-out infinite`,
          }}>
            <div style={{
              position: "absolute",
              top: 0, bottom: 0,
              width: "30%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
              animation: `sendShimmer 2s ${line.delay}s ease-in-out infinite`,
            }} />
          </div>
        ))}

        {/* Checkmark / send icon that pops in */}
        <div style={{
          position: "absolute",
          bottom: 16, right: 14,
          width: 40, height: 40,
          borderRadius: "50%",
          background: "rgba(59,130,246,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "sendCheckPop 2s ease-in-out infinite",
        }}>
          {hasSigs ? (
            /* Paper plane icon for "send" */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          ) : (
            /* Check icon for "create" */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17L4 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Floating particles */}
      {[
        { top: 10, left: 30, size: 4, delay: 0 },
        { top: 50, left: 175, size: 3, delay: 0.5 },
        { top: 180, left: 20, size: 3, delay: 1.0 },
        { top: 200, left: 180, size: 4, delay: 0.3 },
      ].map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          top: p.top, left: p.left,
          width: p.size, height: p.size,
          borderRadius: "50%",
          background: "#3b82f6",
          opacity: 0.5,
          animation: `sendFlyUp 2s ${p.delay}s ease-in-out infinite`,
        }} />
      ))}
    </div>

    {/* Label + progress */}
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <p style={{
        color: "white",
        fontSize: 15,
        fontWeight: 600,
        margin: 0,
        letterSpacing: "0.02em",
      }}>
        {hasSigs ? "Sending document" : "Creating document"}
        <span style={{ display: "inline-flex", gap: 2, marginLeft: 2 }}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <span key={i} style={{ animation: `sendBlink 1.2s ${delay}s infinite`, opacity: 0.25 }}>.</span>
          ))}
        </span>
      </p>

      <p style={{
        color: "rgba(255,255,255,0.5)",
        fontSize: 12,
        margin: 0,
        fontWeight: 400,
      }}>
        {hasSigs ? "Uploading files & routing to signatories" : "Uploading files & saving document"}
      </p>

      {/* Progress bar */}
      <div style={{
        width: 240,
        height: 3,
        background: "rgba(255,255,255,0.12)",
        borderRadius: 2,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
          borderRadius: 2,
          animation: "sendProgress 2.2s ease-in-out infinite",
        }} />
      </div>
    </div>
  </div>
);

export default SendingOverlay;
