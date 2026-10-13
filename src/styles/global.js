import { SKIN_CSS } from "../skins.js";

/* =========================================================================
   CSS GLOBAL
   ========================================================================= */
export const GLOBAL_CSS = `
${SKIN_CSS}
@keyframes nd-pop { 0% { transform: scale(.85); opacity: 0 } 60% { transform: scale(1.03); opacity: 1 } 100% { transform: scale(1) } }
@keyframes nd-shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-6px) } 40% { transform: translateX(6px) } 60% { transform: translateX(-4px) } 80% { transform: translateX(4px) } }
@keyframes nd-glow { 0% { text-shadow: 0 0 0 rgba(244,114,182,0); transform: scale(1) } 40% { text-shadow: 0 0 24px rgba(244,114,182,.7); transform: scale(1.06) } 100% { text-shadow: 0 0 0 rgba(244,114,182,0); transform: scale(1) } }
@keyframes nd-float { 0% { transform: translateY(0) scale(.8); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(-140px) scale(1.2); opacity: 0 } }
@keyframes nd-hover { 0%,100% { transform: translate(-50%, 0) } 50% { transform: translate(-50%, -6px) } }
@keyframes nd-blink { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes nd-toast { 0% { transform: translateY(-12px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
@keyframes nd-sheet { 0% { transform: translateY(40px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
@keyframes nd-glitch-in {
  0% { filter: invert(1) hue-rotate(90deg); transform: translateX(-8px) skewX(8deg); clip-path: inset(10% 0 60% 0) }
  10% { filter: none; transform: translateX(8px); clip-path: inset(50% 0 20% 0) }
  20% { filter: invert(1); transform: translateX(-4px) skewX(-6deg); clip-path: inset(0 0 80% 0) }
  30% { filter: none; transform: none; clip-path: inset(30% 0 30% 0) }
  45% { clip-path: inset(0 0 0 0); transform: translateX(3px) }
  60%,100% { transform: none; clip-path: inset(0 0 0 0) }
}
@keyframes nd-glitch-text {
  0%,92%,100% { text-shadow: 2px 0 rgba(244,63,94,.7), -2px 0 rgba(56,189,248,.6); transform: none }
  94% { text-shadow: -4px 0 rgba(244,63,94,.9), 4px 0 rgba(56,189,248,.9); transform: translateX(2px) skewX(10deg) }
  96% { text-shadow: 4px 0 rgba(244,63,94,.9), -4px 0 rgba(56,189,248,.9); transform: translateX(-2px) }
}
.nd-pop { animation: nd-pop .45s ease-out both }
.nd-shake { animation: nd-shake .5s ease-in-out }
.nd-glow { animation: nd-glow .9s ease-out }
.nd-float { animation: nd-float 2.2s ease-out infinite }
.nd-hover { animation: nd-hover 3s ease-in-out infinite }
.nd-blink { animation: nd-blink 1.4s ease-in-out infinite }
.nd-toast { animation: nd-toast .35s ease-out both }
.nd-sheet { animation: nd-sheet .3s ease-out both }
.nd-glitch-in { animation: nd-glitch-in 1.1s steps(1, end) both }
.nd-glitch { animation: nd-glitch-text 3s infinite }
.nd-scanlines { background: repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px) }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important } }
`;
