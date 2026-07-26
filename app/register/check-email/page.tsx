import Image from "next/image";
import Link from "next/link";

export default function CheckLearnerEmailPage() {
  return (
    <main className="flex min-h-screen items-center bg-gradient-to-b from-[#EAF5FF] to-[#FFF8E8] px-4 py-8">
      <section className="mx-auto w-full max-w-md rounded-[2.25rem] border border-blue-100 bg-white p-7 text-center shadow-lg">
        <Image
          src="/ad_astra_logo.png"
          alt="AD Astra"
          width={82}
          height={82}
          className="mx-auto"
        />
        <h1 className="mt-4 text-3xl font-bold text-[#102A43]">
          Check Your Email
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          We sent a verification link to your email address. Open the link to
          verify your account and continue your learner profile.
        </p>
        <Link
          href="/login"
          className="mt-6 block rounded-2xl bg-[#102A43] px-4 py-3 font-bold text-white"
        >
          Return to Sign In
        </Link>
      </section>
    </main>
  );
}
