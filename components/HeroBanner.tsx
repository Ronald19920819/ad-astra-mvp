import { neueHaas } from "@/app/fonts";
import Image from "next/image";
import { Shadows_Into_Light } from "next/font/google";
import { learner } from "@/data/learners";

const  ShadowsIntoLight =  Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
});

export default function HeroBanner() {
  return (
    <div
      className="relative mb-5 w-full overflow-hidden rounded-[2rem] shadow-lg border border-blue-100 bg-black"
      style={{
        height: "260px",
        backgroundImage: "url('/hero-banner.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

      <div className="relative z-10 h-full p-6 flex flex-col pt-3">
        <div className="flex items-center gap-4 mb-4 -mt-4">
          <Image
  src="/ad_astra_logo.png"
  alt="AD Astra Logo"
  width={70}
  height={70}
  unoptimized
  className="bg-transparent"
/>

          <Image
  src="/ad_astra_wordmark.png"
  alt="AD ASTRA"
  width={210}
  height={55}
  priority
  style={{
    width: "210px",
    height: "auto",
  }}
/>
        </div>

       <h1
  className={`${ShadowsIntoLight.className} text-white leading-none`}
  style={{
    fontSize: "30px",
    fontWeight: 400,
  }}
>
  {learner.name}
</h1>

<div
  style={{
    marginTop: "2px",
    marginLeft: "30px",
    width: "120px",
    height: "6px",
     background: "#508db1",
    borderRadius: "50px 15px 50px 15px",
    opacity: 0.40,
  }}
/>

<p
  className={`${neueHaas.className} tracking-[0.15em] uppercase`}
  style={{
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: 500,
    marginTop: "8px",
  }}
>
  Home Dashboard
</p>
        
  
      </div>
    </div>
  );
}