'use client'

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-[#B9B6AD]/40 bg-[#111111]/5 backdrop-blur-sm transition-colors focus-within:border-[#2D4E71]/70 focus-within:bg-[#AABED6]/10">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial; delay: string }) => (
  <div className={`${delay} flex items-start gap-3 mt-5 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-5 w-full lg:w-[85%] xl:w-[70%]`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={testimonial.avatarSrc} className="h-10 w-10 shrink-0 object-cover rounded-2xl" alt="avatar" />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-medium text-white">{testimonial.name}</p>
      <p className="text-[#AABED6] text-xs opacity-90">{testimonial.handle}</p>
      <p className="mt-2 text-white/80 leading-relaxed">{testimonial.text}</p>
    </div>
  </div>
);

export const SignInPage: React.FC<SignInPageProps> = ({
  title,
  description,
  testimonials = [],
  onSignIn,
  onResetPassword,
  onCreateAccount,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw] font-[DM_Sans]">

      {/* LEFT — Form panel */}
      <section className="flex-1 flex items-center justify-center p-8 md:p-16 bg-white relative overflow-hidden">

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#111111 1px, transparent 1px), linear-gradient(90deg, #111111 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="-mt-8 -ml-8 w-full max-w-md relative z-10">

          {/* TINTA wordmark */}
          <div className="mb-9">
            <img 
              src="icons/logo.png"
              className="w-[50%] mt-2 mb-2"
            />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs tracking-[0.3em] uppercase text-[#B9B6AD] font-medium">Platform Integritas Akademik</span>
            </div>
            {/* <h1
              className="text-5xl text-[#111111] leading-none"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
            >
              TINTA
            </h1> */}
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-3xl text-[#111111] mb-2"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 400 }}
            >
              {title || <>Selamat datang <span className="font-semibold">kembali.</span></>}
            </h2>
            <p className="text-sm text-[#B9B6AD]">
              {description || "Masuk untuk melanjutkan sesi penulisanmu."}
            </p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={onSignIn}>
            <div>
              <label className="text-xs font-medium text-[#B9B6AD] tracking-wide uppercase mb-2 block">
                Email Institusi
              </label>
              <GlassInputWrapper>
                <input
                  name="email"
                  type="email"
                  placeholder="email@universitasmu.ac.id"
                  className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-[#111111] placeholder:text-[#B9B6AD]"
                />
              </GlassInputWrapper>
            </div>

            <div>
              <label className="text-xs font-medium text-[#B9B6AD] tracking-wide uppercase mb-2 block">
                Kata Sandi
              </label>
              <GlassInputWrapper>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-[#111111] placeholder:text-[#B9B6AD]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4 text-[#B9B6AD] hover:text-[#2D4E71] transition-colors" />
                      : <Eye className="w-4 h-4 text-[#B9B6AD] hover:text-[#2D4E71] transition-colors" />
                    }
                  </button>
                </div>
              </GlassInputWrapper>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#111111]/70">
                <input type="checkbox" name="rememberMe" className="rounded" />
                <span>Ingat saya</span>
              </label>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onResetPassword?.(); }}
                className="text-[#2D4E71] hover:underline transition-colors"
              >
                Lupa kata sandi?
              </a>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-[#2D4E71] py-4 text-sm font-medium text-white hover:bg-[#1e3a56] active:scale-[0.99] transition-all mt-2"
            >
              Masuk
            </button>
          </form>

          <p className="text-center text-xs text-[#B9B6AD] mt-8">
            Belum punya akun?{' '}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onCreateAccount?.(); }}
              className="text-[#2D4E71] hover:underline transition-colors"
            >
              Hubungi admin institusimu
            </a>
          </p>

          {/* Test account hint — remove in production */}
          {/* <div className="mt-6 p-3 rounded-xl border border-[#AABED6]/40 bg-[#AABED6]/10">
            <p className="text-xs text-[#2D4E71] text-center">
              <span className="font-semibold">Akun demo:</span> tinta@app · burunghantu123
            </p>
          </div> */}
        </div>
      </section>

      {/* RIGHT — Brand panel */}
      <section className="hidden md:flex flex-1 relative overflow-hidden bg-[#2D4E71]">

        {/* Noise grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px'
          }}
        />

        {/* Ghost TINTA letterform background */}
        <div
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <img
            src="icons/logo-single.png"
            className="ml-8 w-[40%] opacity-25"
          />
          {/* <span
            className="text-[22vw] font-bold text-white/[0.04] leading-none"
          >
            T
          </span> */}
        </div>

        {/* Diagonal ink accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#AABED6]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#111111]/20 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          <div>
            <div className="flex items-center gap-2 mb-12">
              <div className="w-1.5 h-1.5 rounded-full bg-[#AABED6]" />
              <span className="text-[#AABED6] text-xs tracking-[0.3em] uppercase">Tracking Integritas dan Navigasi Tulisan Asli</span>
            </div>

            <div style={{ fontFamily: "'Playfair Display', serif" }}>
              <p className="text-white/50 text-base mb-3 tracking-wide uppercase">Mengapa TINTA?</p>
              <h2 className="text-4xl text-white font-light leading-tight">
                Bukan mendeteksi AI, tetapi<br />
                <span className="font-semibold italic">Membuktikan proses belajar.</span>
              </h2>
            </div>
          </div>

          {/* Testimonials */}
          {testimonials.length > 0 && (
            <div className="flex flex-col gap-3">
              {testimonials.slice(0, 2).map((t, i) => (
                <TestimonialCard key={i} testimonial={t} delay="" />
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-white/30 text-xs">© 2025 TINTA</span>
          </div>
        </div>
      </section>
    </div>
  );
};
