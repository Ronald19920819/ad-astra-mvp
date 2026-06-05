"use client";

import { useState, useRef } from "react";
import { neueHaas } from "@/app/fonts";

const quotes = [
  {
    quote: "Discipline today, freedom tomorrow.",
    subtext: "Your future is built by what you do today.",
  },
  {
    quote: "Small steps today become giant leaps tomorrow.",
    subtext: "Every mission begins with one brave move.",
  },
  {
    quote: "Focus is your launchpad.",
    subtext: "Stay steady, and the stars will come closer.",
  },
];

export default function MotivationalCard() {
  const [active, setActive] = useState(0);
  const startX = useRef(0);

  const previousQuote = () => {
    setActive((current) => (current === 0 ? quotes.length - 1 : current - 1));
  };

  const nextQuote = () => {
    setActive((current) => (current === quotes.length - 1 ? 0 : current + 1));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const endX = e.clientX;
    const difference = startX.current - endX;

    if (difference > 40) nextQuote();
    if (difference < -40) previousQuote();
  };

  return (
    <div
      className="motivation-card isolate relative mb-5 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-sm"
    
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        minHeight: "130px",
        touchAction: "pan-y",
        background:
          "linear-gradient(120deg, #ffffff 0%, #f8fbff 58%, #eef4ff 100%)",
      }}
    >
      <div
        className="relative z-10 flex items-center"
        style={{
          minHeight: "105px",
          padding: "22px 18px 8px 18px",
        }}
      >
        <button
          type="button"
          onClick={previousQuote}
          className="text-3xl font-light text-blue-700"
          aria-label="Previous quote"
        >
          ‹
        </button>

        <div className="flex flex-1 items-start gap-3 px-4">
          <div
            style={{
              color: "#FEC20C",
              fontSize: "38px",
              lineHeight: 1,
              fontWeight: 700,
              marginTop: "-2px",
            }}
          >
            ❝
          </div>

          <div>
            <p
              className={`${neueHaas.className}`}
              style={{
                color: "#D9A106",
                fontSize: "18px",
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {quotes[active].quote}
            </p>

            <p
              className={`${neueHaas.className}`}
              style={{
                color: "#0f172a",
                fontSize: "12px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              {quotes[active].subtext}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={nextQuote}
          className="text-3xl font-light text-blue-700"
          aria-label="Next quote"
        >
          ›
        </button>
      </div>

      <div className="relative z-10 mb-4 flex justify-center gap-2">
        {quotes.map((_, index) => (
          <button
            type="button"
            key={index}
            onClick={() => setActive(index)}
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: active === index ? "#2563eb" : "#dbeafe",
            }}
            aria-label={`Go to quote ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}