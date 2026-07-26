import Link from "next/link";
import HeroBanner from "@/components/HeroBanner";
import MessageBoard from "@/components/MessageBoard";
import MotivationalCard from "@/components/MotivationalCard";
import SchoolOverviewCard from "@/components/SchoolOverviewCard";
import TutorSuggestion from "@/components/TutorSuggestion";

export default function HomeDashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-28">
      <div className="mx-auto max-w-md">
        <HeroBanner />

        <MotivationalCard />

        <MessageBoard />

        <SchoolOverviewCard />

        <TutorSuggestion />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm font-semibold text-black">
          <Link href="/home"><div className="py-4">Home</div></Link>
          <Link href="/subjects"><div className="py-4">Subjects</div></Link>
          <Link href="/chat"><div className="py-4">Chat</div></Link>
          <Link href="/schedule"><div className="py-4">Schedule</div></Link>
          <Link href="/profile"><div className="py-4">Profile</div></Link>
        </div>
      </nav>
    </main>
  );
}
