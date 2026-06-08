import Image from "next/image";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--cream)] p-10">
      <div className="w-[380px] animate-rise">
        <Image src="/assets/logo-ink.png" alt="Merali Lettings" width={160} height={40} priority className="mb-8 h-[40px] w-auto" />
        <h1 className="font-display text-[34px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Reset password</h1>
        <p className="mb-[30px] mt-2 text-[15px] text-[var(--ink-2)]">
          Enter your email and we’ll send a reset link.
        </p>
        <ForgotForm />
        <p className="mt-6 text-center text-[13.5px] text-[var(--ink-2)]">
          <Link href="/login" className="font-semibold text-[var(--gold-deep)] hover:text-[var(--gold)]">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
