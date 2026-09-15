import { CalendarCheck, Check, Ruler, Scissors, Truck } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Photo } from "../../components/Bits";
import { Reveal } from "../../components/Reveal";
import { motionMode } from "../../motion";

interface Step {
  eyebrow: string;
  icon: ReactNode;
  title: string;
  body: string;
  check: string;
  photo: string;
  alt: string;
  position: string;
  float: { label: string; value: string; note: string };
}

const STEPS: Step[] = [
  {
    eyebrow: "Step 1 · Choose",
    icon: <Scissors size={14} />,
    title: "Pick your style and the day you need it.",
    body: "Browse kaftans, agbada, suits, uniforms and more, then tell us the occasion. We plan the work back from your date.",
    check: "Starting prices shown upfront",
    photo: "/photos/studio-showroom.webp",
    alt: "Finished outfits on the showroom racks",
    position: "center 40%",
    float: { label: "Needed by", value: "Sat, 26 Sept", note: "Wedding" },
  },
  {
    eyebrow: "Step 2 · Measure",
    icon: <Ruler size={14} />,
    title: "Get measured once. We keep it on file.",
    body: "Visit the studio, reuse your saved measurements, or send your own with our guide if you live outside Kasoa.",
    check: "Every measurement set dated and kept",
    photo: "/photos/studio-cutting.webp",
    alt: "The designer cutting fabric at the studio table",
    position: "center 30%",
    float: { label: "Chest", value: "41″", note: "Measured in studio" },
  },
  {
    eyebrow: "Step 3 · Fit",
    icon: <CalendarCheck size={14} />,
    title: "Try it on before the final stitch.",
    body: "Your fitting is booked into the calendar so the cut is right, not almost right. You follow every stage in the app.",
    check: "Updates on WhatsApp at each stage",
    photo: "/photos/studio-showroom-2.webp",
    alt: "Dressing a suit on a mannequin in the showroom",
    position: "center 35%",
    float: { label: "Progress", value: "Sewing", note: "Ready by Tue, 22 Sept" },
  },
  {
    eyebrow: "Step 4 · Collect",
    icon: <Truck size={14} />,
    title: "Collect in Kasoa or get it delivered.",
    body: "Pay the balance with MoMo, get an official receipt, and pick up at the studio or have it sent anywhere in Ghana.",
    check: "Official receipt for every payment",
    photo: "/photos/wedding-groomsmen.webp",
    alt: "Groomsmen in matching outfits made by the studio",
    position: "center 45%",
    float: { label: "Receipt", value: "GH₵ 980", note: "Paid · MoMo" },
  },
];

/** Pinned feature cards that stack as you scroll, each sliding up over the last. */
export function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="how-head">
        <Reveal as="h2" look="focus" id="how-title" className="t-h2">
          How ordering works
        </Reveal>
        <Reveal as="p" look="focus" delay={0.08} className="muted">
          From the first message to the day you wear it.
        </Reveal>
      </div>
      <div className="stack-list">
        {STEPS.map((step, i) => (
          <StackCard key={step.title} step={step} index={i} />
        ))}
      </div>
    </section>
  );
}

function StackCard({ step, index }: { step: Step; index: number }) {
  const ref = useRef<HTMLElement>(null);
  // Calm keeps the text brightening (opacity) and drops the photo zoom and the floating card's drift.
  const mode = motionMode();
  // Progress as this card rises from the bottom of the screen to its pinned position.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.2"] });
  const textOpacity = useTransform(scrollYProgress, [0.35, 1], [0.32, 1]);
  const floatY = useTransform(scrollYProgress, [0, 1], [70, 0]);
  const floatRotate = useTransform(scrollYProgress, [0, 1], [index % 2 ? -6 : 6, 0]);
  const photoScale = useTransform(scrollYProgress, [0, 1], [1.12, 1]);

  // The CSS pins tall cards lower (see .stack-card), which needs the card's rendered height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => el.style.setProperty("--card-h", `${el.offsetHeight}px`));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <article ref={ref} className={`stack-card ${index % 2 ? "is-flipped" : ""}`} style={{ zIndex: index + 1 }}>
      <motion.div className="stack-text" style={mode === "off" ? undefined : { opacity: textOpacity }}>
        <span className="chip-soft">
          {step.icon}
          {step.eyebrow}
        </span>
        <h3 className="stack-title">{step.title}</h3>
        <p className="muted">{step.body}</p>
        <p className="stack-check">
          <Check size={15} /> {step.check}
        </p>
      </motion.div>
      <div className="stack-media">
        <motion.div className="stack-photo" style={mode === "full" ? { scale: photoScale } : undefined}>
          <Photo tone="mist" src={step.photo} alt={step.alt} position={step.position} sizes="(min-width: 1024px) 600px, 100vw" height="100%" radius={0} />
        </motion.div>
        <motion.div className="float-card" style={mode === "full" ? { y: floatY, rotate: floatRotate } : undefined}>
          <span className="subtle t-cap">{step.float.label}</span>
          <strong>{step.float.value}</strong>
          <span className="t-cap muted">{step.float.note}</span>
        </motion.div>
      </div>
    </article>
  );
}
