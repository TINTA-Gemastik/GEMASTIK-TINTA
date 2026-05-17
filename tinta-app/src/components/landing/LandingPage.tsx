'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { HandWrittenTitle } from '@/components/ui/hand-writing-text'
import {
  PenLine, Shield, BarChart2, Clock, ArrowRight,
  CheckCircle, BookOpen, Users, FileText
} from 'lucide-react'

const FadeUp = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      {children}
    </motion.div>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── GRAIN TEXTURE OVERLAY ── */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* ── NAV ── */}
      <nav className="relative z-10 flex items-center justify-between px-8 md:px-16 py-6 border-b border-[#2D4E71]/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2D4E71] flex items-center justify-center">
            <PenLine size={14} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#111111]" style={{ fontFamily: "'Playfair Display', serif" }}>
            TINTA
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-[#6b7280]">
          <a href="#fitur"       className="hover:text-[#111111] transition-colors">Fitur</a>
          <a href="#cara-kerja"  className="hover:text-[#111111] transition-colors">Cara Kerja</a>
          <a href="#untuk-siapa" className="hover:text-[#111111] transition-colors">Untuk Siapa</a>
        </div>
        <Link
          href="/login"
          className="text-sm font-semibold text-white bg-[#2D4E71] hover:bg-[#1e3a56] px-5 py-2.5 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(45,78,113,0.3)] active:scale-[0.98]"
        >
          Masuk
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-8 pb-16">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 bg-[#2D4E71]/[0.08] border border-[#2D4E71]/20 rounded-full px-4 py-1.5 mb-6"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#2D4E71] animate-pulse" />
          <span className="text-[13px] font-medium text-[#2D4E71]">
            Platform Integritas Akademik untuk Perguruan Tinggi Indonesia
          </span>
        </motion.div>

        <HandWrittenTitle title="TINTA" subtitle="" />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="text-3xl md:text-4xl font-light tracking-tight text-[#111111] -mt-8 mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Tulis.{' '}
          <span className="italic text-[#2D4E71]">Rekam.</span>{' '}
          Buktikan.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="text-base text-[#6b7280] max-w-lg mb-10 leading-relaxed"
        >
          TINTA merekam proses menulis mahasiswa secara real-time,
          bukan untuk menghakimi, tapi untuk membuktikan bahwa karyamu
          benar-benar milikmu.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.0, duration: 0.7 }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <Link
            href="/login"
            className="flex items-center gap-2 bg-[#2D4E71] text-white font-semibold px-8 py-4 rounded-2xl text-base hover:bg-[#1e3a56] transition-all hover:shadow-[0_0_28px_rgba(45,78,113,0.4)] active:scale-[0.98]"
          >
            Join now
            <ArrowRight size={16} />
          </Link>
          <a
            href="#cara-kerja"
            className="flex items-center gap-2 text-[#2D4E71] font-medium px-6 py-4 rounded-2xl text-base border border-[#2D4E71]/30 hover:bg-[#2D4E71]/5 transition-colors"
          >
            Pelajari lebih lanjut
          </a>
        </motion.div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="relative z-10 border-y border-[#2D4E71]/10 bg-white/60 backdrop-blur-sm py-5 px-8">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-3">
          {['Universitas Indonesia', 'Universitas Gadjah Mada', 'Institut Teknologi Bandung', 'Universitas Airlangga', 'Universitas Diponegoro'].map(uni => (
            <span key={uni} className="text-[13px] text-[#B9B6AD] font-medium tracking-wide">{uni}</span>
          ))}
        </div>
        <p className="text-center text-[11px] text-[#B9B6AD] mt-2">
          Dirancang untuk standar akademik perguruan tinggi Indonesia
        </p>
      </section>

      {/* ── PROBLEM ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 py-24">
        <FadeUp>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px w-8 bg-[#2D4E71]" />
            <span className="text-[12px] font-semibold text-[#2D4E71] uppercase tracking-widest">Masalah</span>
          </div>
          <h2 className="text-3xl md:text-4xl text-[#111111] mb-6 leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Dituduh memakai AI,<br />padahal kamu menulisnya sendiri.
          </h2>
          <p className="text-[#6b7280] text-base leading-relaxed max-w-2xl">
            Turnitin dan detector AI memeriksa <em>hasil akhir</em> tulisanmu — bukan prosesnya.
            Mahasiswa yang menulis dengan jujur bisa salah dituduh, sementara yang menyontek
            dengan AI humanizer lolos begitu saja. TINTA membalik logika ini.
          </p>
        </FadeUp>

        <div className="grid md:grid-cols-2 gap-6 mt-12">
          <FadeUp delay={0.1}>
            <div className="border border-red-200 bg-red-50/50 rounded-2xl p-6">
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest mb-3">Cara lama</p>
              {['Hanya memeriksa output akhir', 'AI humanizer mudah lolos', 'False positive tinggi untuk Bahasa Indonesia', 'Mahasiswa tidak bisa membela diri'].map(item => (
                <div key={item} className="flex items-start gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                  <span className="text-sm text-[#6b7280]">{item}</span>
                </div>
              ))}
            </div>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="border border-[#2D4E71]/30 bg-[#2D4E71]/5 rounded-2xl p-6">
              <p className="text-[11px] font-bold text-[#2D4E71] uppercase tracking-widest mb-3">Cara TINTA</p>
              {['Merekam seluruh proses penulisan', 'Deteksi berbasis perilaku, bukan teks', 'Dirancang untuk Bahasa Indonesia', 'Bukti nyata yang bisa ditunjukkan ke dosen'].map(item => (
                <div key={item} className="flex items-start gap-2 mb-2">
                  <CheckCircle size={14} className="text-[#2D4E71] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-[#111111]">{item}</span>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="fitur" className="relative z-10 bg-white border-y border-[#B9B6AD]/20 py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="h-px w-8 bg-[#2D4E71]" />
                <span className="text-[12px] font-semibold text-[#2D4E71] uppercase tracking-widest">Fitur</span>
                <div className="h-px w-8 bg-[#2D4E71]" />
              </div>
              <h2 className="text-3xl md:text-4xl text-[#111111]" style={{ fontFamily: "'Playfair Display', serif" }}>
                Semua yang kamu butuhkan<br />untuk membuktikan karyamu.
              </h2>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: PenLine,   title: 'Editor Cerdas',           desc: 'Menulis seperti di Google Docs, tapi setiap keystroke, jeda, dan revisi direkam sebagai bukti proses belajar.' },
              { icon: Shield,    title: 'Bukti Proses Otomatis',    desc: 'Setiap sesi menghasilkan "Proof of Work" — dokumen yang bisa kamu tunjukkan ke dosen jika dituduh memakai AI.' },
              { icon: BarChart2, title: 'Analitik Perilaku',        desc: 'Deteksi berbasis pola mengetik, bukan teks. Aman untuk penulis Bahasa Indonesia yang sering salah ditandai AI detector lain.' },
              { icon: Clock,     title: 'Riwayat Sesi',             desc: 'Setiap sesi tersimpan seperti git commit — "+3 kata ditambahkan, 1 kata dihapus" — jelas dan terukur.' },
              { icon: Users,     title: 'Dashboard Dosen',          desc: 'Dosen melihat replay penulisan mahasiswa, bukan sekadar hasil akhir. Keputusan ada di tangan dosen, bukan algoritma.' },
              { icon: FileText,  title: 'Referensi Terkelola',      desc: 'Tandai kutipan, tambahkan sumber, dan deklarasikan paste — semua tercatat dan bisa diverifikasi.' },
            ].map((f, i) => (
              <FadeUp key={f.title} delay={i * 0.08}>
                <div className="group p-6 rounded-2xl border border-[#B9B6AD]/30 hover:border-[#2D4E71]/40 hover:bg-[#2D4E71]/[0.03] transition-all hover:shadow-[0_4px_24px_rgba(45,78,113,0.08)]">
                  <div className="w-10 h-10 rounded-xl bg-[#2D4E71]/10 flex items-center justify-center mb-4 group-hover:bg-[#2D4E71]/20 transition-colors">
                    <f.icon size={18} className="text-[#2D4E71]" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#111111] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{f.title}</h3>
                  <p className="text-sm text-[#6b7280] leading-relaxed">{f.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="cara-kerja" className="relative z-10 max-w-4xl mx-auto px-8 py-24">
        <FadeUp>
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-[#2D4E71]" />
              <span className="text-[12px] font-semibold text-[#2D4E71] uppercase tracking-widest">Cara Kerja</span>
              <div className="h-px w-8 bg-[#2D4E71]" />
            </div>
            <h2 className="text-3xl md:text-4xl text-[#111111]" style={{ fontFamily: "'Playfair Display', serif" }}>
              Sesederhana menulis biasa.
            </h2>
          </div>
        </FadeUp>

        <div className="relative">
          <div className="absolute left-6 top-6 bottom-6 w-px bg-[#2D4E71]/15 hidden md:block" />
          <div className="space-y-8">
            {[
              { step: '01', title: 'Buka tugas di TINTA',     desc: 'Dosen membuat tugas dan mendaftarkan mahasiswa. Kamu membuka editor TINTA — sama seperti Google Docs.' },
              { step: '02', title: 'Tulis seperti biasa',      desc: 'TINTA merekam setiap keystroke, jeda berpikir, revisi, dan paste di latar belakang. Kamu tidak perlu melakukan apapun yang berbeda.' },
              { step: '03', title: 'Simpan dan kumpulkan',     desc: 'Klik Submit. TINTA menghasilkan Proof of Work otomatis — ringkasan proses belajarmu yang bisa ditunjukkan kapan saja.' },
              { step: '04', title: 'Dosen melihat bukti nyata', desc: 'Dosen dapat memutar ulang proses penulisanmu seperti video. Keputusan berdasarkan bukti, bukan asumsi.' },
            ].map((item, i) => (
              <FadeUp key={item.step} delay={i * 0.1}>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#2D4E71] text-white text-sm font-bold flex items-center justify-center">
                      {item.step}
                    </div>
                  </div>
                  <div className="pt-2 pb-4 border-b border-[#B9B6AD]/20 flex-1">
                    <h3 className="text-lg font-semibold text-[#111111] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>{item.title}</h3>
                    <p className="text-sm text-[#6b7280] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR WHOM ── */}
      <section id="untuk-siapa" className="relative z-10 bg-[#2D4E71] py-24 px-8">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-center mb-14">
              <span className="text-[12px] font-semibold text-[#AABED6] uppercase tracking-widest block mb-4">Untuk Siapa</span>
              <h2 className="text-3xl md:text-4xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                Dibangun untuk ekosistem<br />akademik Indonesia.
              </h2>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-6">
            <FadeUp delay={0.1}>
              <div className="bg-white/10 border border-white/20 rounded-2xl p-8">
                <BookOpen size={24} className="text-[#AABED6] mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Untuk Mahasiswa</h3>
                <ul className="space-y-2">
                  {['Terlindungi dari tuduhan AI yang salah', 'Punya bukti nyata kerja keras kamu', 'Menulis dengan tenang tanpa takut dituduh', 'Referensi terkelola dan terverifikasi'].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/80">
                      <CheckCircle size={14} className="text-[#AABED6] mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
            <FadeUp delay={0.2}>
              <div className="bg-white/10 border border-white/20 rounded-2xl p-8">
                <Users size={24} className="text-[#AABED6] mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Untuk Dosen</h3>
                <ul className="space-y-2">
                  {['Lihat proses belajar, bukan sekadar hasil akhir', 'Replay penulisan mahasiswa seperti menonton video', 'Nilai proses dan konten secara terpisah', 'Export data ke spreadsheet penilaianmu'].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/80">
                      <CheckCircle size={14} className="text-[#AABED6] mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-32 px-8 text-center">
        <FadeUp>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-[#2D4E71]/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#2D4E71]/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#2D4E71]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#2D4E71]/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#2D4E71]/30" />
            </div>
            <h2 className="text-4xl md:text-5xl text-[#111111] mb-4 leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Mulai buktikan proses<br />belajarmu hari ini.
            </h2>
            <p className="text-[#6b7280] text-base mb-10 leading-relaxed">
              Gratis untuk digunakan. Tidak perlu kartu kredit. Cukup daftar dan mulai menulis.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#2D4E71] text-white font-semibold px-10 py-4 rounded-2xl text-base hover:bg-[#1e3a56] transition-all hover:shadow-[0_0_32px_rgba(45,78,113,0.35)] active:scale-[0.98]"
            >
              Join now
              <ArrowRight size={16} />
            </Link>
            <p className="text-[12px] text-[#B9B6AD] mt-4">Tracking Integritas dan Navigasi Tulisan Asli</p>
          </div>
        </FadeUp>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-[#B9B6AD]/20 px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#2D4E71] flex items-center justify-center">
              <PenLine size={12} className="text-white" />
            </div>
            <span className="text-sm font-bold text-[#111111]" style={{ fontFamily: "'Playfair Display', serif" }}>TINTA</span>
          </div>
          <p className="text-[12px] text-[#B9B6AD] text-center">© 2025 TINTA. Dibuat untuk mahasiswa dan dosen Indonesia.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-[12px] text-[#B9B6AD] hover:text-[#111111] transition-colors">Masuk</Link>
            <a href="mailto:tinta@app.com" className="text-[12px] text-[#B9B6AD] hover:text-[#111111] transition-colors">Kontak</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
