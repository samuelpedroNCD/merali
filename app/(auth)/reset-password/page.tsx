import Image from "next/image";
import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--cream)] p-10">
      <div className="w-[380px] animate-rise">
        <Image src="/assets/logo-ink.png" alt="Merali Lettings" width={160} height={40} priority className="mb-8 h-[40px] w-auto" />
        <h1 className="font-display text-[34px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Set a new password</h1>
        <p className="mb-[30px] mt-2 text-[15px] text-[var(--ink-2)]">Choose a strong password for your account.</p>
        <ResetForm />
      </div>
    </div>
  );
}
