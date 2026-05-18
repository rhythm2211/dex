"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

/**
 * ContainerScroll
 *
 * Aceternity-style 3D tilt-on-scroll wrapper. As the user scrolls the
 * container into view, the inner "Card" rotates from a perspective tilt
 * to flat (rotateX 20° → 0°) and scales slightly. The title above translates
 * upward at the same time.
 *
 * Adapted from the snippet shared in the integration spec; ported to the
 * existing DEX codebase conventions (already using framer-motion + tailwind).
 *
 * Usage:
 *   <ContainerScroll titleComponent={<h1>…</h1>}>
 *     <video … />
 *   </ContainerScroll>
 */

export interface ContainerScrollProps {
  titleComponent: React.ReactNode;
  children: React.ReactNode;
  /** Optional extra classes for the outer scroll container. */
  className?: string;
}

export const ContainerScroll: React.FC<ContainerScrollProps> = ({
  titleComponent,
  children,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scaleDimensions = (): [number, number] =>
    isMobile ? [0.7, 0.9] : [1.05, 1];

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      ref={containerRef}
      className={`h-[60rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20 ${className ?? ""}`}
    >
      <div
        className="py-10 md:py-40 w-full relative"
        style={{ perspective: "1000px" }}
      >
        <Header translate={translate}>{titleComponent}</Header>
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

interface HeaderProps {
  translate: MotionValue<number>;
  children: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ translate, children }) => (
  <motion.div
    style={{ translateY: translate }}
    className="max-w-5xl mx-auto text-center"
  >
    {children}
  </motion.div>
);

interface CardProps {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ rotate, scale, children }) => (
  <motion.div
    style={{
      rotateX: rotate,
      scale,
      boxShadow:
        "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
    }}
    className="max-w-5xl -mt-12 mx-auto h-[30rem] md:h-[40rem] w-full border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-[30px] shadow-2xl"
  >
    <div className="h-full w-full overflow-hidden rounded-2xl bg-zinc-900 md:rounded-2xl md:p-4">
      {children}
    </div>
  </motion.div>
);

export default ContainerScroll;
