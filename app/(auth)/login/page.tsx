import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex h-full w-full overflow-hidden font-sans text-[var(--ink)]">
      {/* Left — heritage charcoal panel */}
      <div className="relative hidden flex-[0_0_58%] flex-col overflow-hidden bg-[var(--dark-800)] px-16 py-[54px] md:flex">
        {/* Watermark monogram */}
        <span
          className="font-display pointer-events-none absolute -bottom-[130px] -right-[60px] select-none font-semibold leading-[0.8] tracking-[-0.04em] text-white"
          style={{ fontSize: 520, opacity: 0.035 }}
        >
          ML
        </span>

        <Image
          src="/assets/logo.png"
          alt="Merali Lettings"
          width={184}
          height={46}
          priority
          className="relative h-[46px] w-auto self-start"
        />
      </div>

      {/* Right — cream form */}
      <div className="flex flex-1 items-center justify-center bg-[var(--cream)] p-10">
        <div className="w-[380px] animate-rise">
          {/* Logo on light for small screens (ink variant) */}
          <Image
            src="/assets/logo-ink.png"
            alt="Merali Lettings"
            width={160}
            height={40}
            priority
            className="mb-8 h-[40px] w-auto md:hidden"
          />
          <h1 className="mb-[34px] font-display text-[40px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Welcome back
          </h1>
          <Suspense fallback={<div className="h-[300px]" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
