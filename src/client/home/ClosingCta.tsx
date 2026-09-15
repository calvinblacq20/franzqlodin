import { Check, Clock } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogoMark } from "../../components/Brand";
import { Photo } from "../../components/Bits";
import { Cta } from "../../components/Button";
import { Reveal } from "../../components/Reveal";
import { isCalm } from "../../motion";

/** Dark closing section; the preview card rises and un-tilts into place as you scroll (Makro CTA). */
export function ClosingCta() {
  const navigate = useNavigate();
  const previewRef = useRef<HTMLDivElement>(null);
  // The preview's rise, zoom and tilt are scroll-coupled motion: left out in calm mode.
  const calm = isCalm();
  const { scrollYProgress } = useScroll({ target: previewRef, offset: ["start end", "start 0.35"] });
  const y = useTransform(scrollYProgress, [0, 1], [120, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);

  return (
    <section className="closing" data-nav-theme="dark" aria-labelledby="closing-title">
      <Reveal as="span" look="focus" className="closing-mark">
        <LogoMark size={40} />
      </Reveal>
      <Reveal as="h2" look="focus" delay={0.05} id="closing-title" className="closing-title">
        Ready for your next outfit?
      </Reveal>
      <Reveal as="p" look="focus" delay={0.1} className="closing-sub">
        Tell us the occasion and the date. We'll handle the cut, the fitting and the finish.
      </Reveal>
      <Reveal look="focus" delay={0.15}>
        <Cta tone="lime" onClick={() => navigate("/order/new")}>
          Order now
        </Cta>
      </Reveal>

      <div className="closing-stage">
        <motion.div ref={previewRef} className="closing-preview" style={calm ? undefined : { y, scale, rotateX, transformPerspective: 1400 }}>
          <Photo tone="mist" src="/photos/studio-showroom.webp" alt="Finished orders waiting in the Franz Qlodin showroom" position="center 40%" sizes="(min-width: 1024px) 960px, 100vw" height="100%" radius={0} />
          <div className="closing-overlay">
            <div className="closing-chip">
              <span className="badge is-lime" style={{ paddingRight: 12 }}>
                <span className="badge-well">
                  <Check size={13} />
                </span>
                Ready for pickup
              </span>
              <span className="t-cap">Embroidered kaftan · FQ-1036</span>
            </div>
            <div className="closing-chip is-right">
              <span className="inline t-cap" style={{ gap: 6 }}>
                <Clock size={13} /> Fitting tomorrow at 10:00
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
