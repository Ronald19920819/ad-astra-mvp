import TutorSuggestion from "@/components/TutorSuggestion";
import SchoolOverviewCard from "@/components/SchoolOverviewCard";
import MessageBoard from "@/components/MessageBoard";
import MotivationalCard from "@/components/MotivationalCard";
import HeroBanner from "@/components/HeroBanner";
import Link from "next/link";
import { Indie_Flower, Oxanium } from "next/font/google";
import { learner } from "@/data/learners";
const indieFlower = Indie_Flower({
  weight: "400",
  subsets: ["latin"],
});

const oxanium = Oxanium({
  weight: "600",
  subsets: ["latin"],
});

export default function HomeDashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-28">
      <div className="max-w-md mx-auto">
       <HeroBanner />

        <MotivationalCard />

        <MessageBoard />

       <SchoolOverviewCard />

       <TutorSuggestion />
        
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
  <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm font-semibold text-black">
    <Link href="/home">
      <div className="py-4">
        Home
      </div>
    </Link>

    <Link href="/subjects">
      <div className="py-4">
        Subjects
      </div>
    </Link>
    <Link href="/chat">
  <div className="py-4">Chat</div>
</Link>
<Link href="/schedule">
  <div className="py-4">Schedule</div>
</Link>
    <Link href="/profile">
      <div className="py-4">
        Profile
      </div>
    </Link>
  </div>
</nav>
    </main>
  );
}