'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, GraduationCap, BookOpen, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/shared/AuthCard'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

// ─── Role Selector Card ───────────────────────────────────────────────────────

function RoleCard({
  role,
  label,
  description,
  icon: Icon,
  selected,
  onSelect,
}: {
  role: UserRole
  label: string
  description: string
  icon: React.ElementType
  selected: boolean
  onSelect: (r: UserRole) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border-2 text-left w-full transition-all duration-150',
        selected
          ? 'border-emerald-500 bg-emerald-50 text-tinta-dark'
          : 'border-tinta-border bg-white text-tinta-dark hover:border-tinta-blue'
      )}
    >
      <div
        className={cn(
          'mt-0.5 p-1.5 rounded-md',
          selected ? 'bg-emerald-500 text-white' : 'bg-tinta-warm/20 text-tinta-main'
        )}
      >
        <Icon size={16} />
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-tinta-warm mt-0.5">{description}</p>
      </div>
    </button>
  )
}

// ─── Register Page ────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [npm, setNpm]             = useState('')
  const [university, setUniversity] = useState('')
  const [role, setRole]           = useState<UserRole>('mahasiswa')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [error, setError]         = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setIsLoading(false)
      return
    }

    if (!data.user) {
      setError('Registrasi gagal. Silakan coba lagi.')
      setIsLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      role,
      full_name: fullName,
      npm: npm || null,
      university: university || null,
      email,
    })

    if (profileError) {
      setError('Gagal menyimpan profil: ' + profileError.message)
      setIsLoading(false)
      return
    }

    router.push('/login?registered=1')
  }

  const inputClass = cn(
    'w-full px-3 py-2.5 border border-tinta-border rounded-md text-sm',
    'placeholder:text-tinta-warm',
    'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500',
    'transition-colors'
  )

  return (
    <AuthCard className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-tinta-dark mb-1.5">
            Nama Lengkap
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Masukkan nama lengkap"
            className={inputClass}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-tinta-dark mb-1.5">
            Email Institusi
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="nama@universitas.ac.id"
            className={inputClass}
          />
        </div>

        {/* NPM / NIP */}
        <div>
          <label className="block text-sm font-medium text-tinta-dark mb-1.5">
            NPM / NIP
          </label>
          <input
            type="text"
            value={npm}
            onChange={(e) => setNpm(e.target.value)}
            placeholder="Nomor pokok mahasiswa atau pegawai"
            className={inputClass}
          />
        </div>

        {/* University */}
        <div>
          <label className="block text-sm font-medium text-tinta-dark mb-1.5">
            Universitas
          </label>
          <input
            type="text"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="Nama universitas"
            className={inputClass}
          />
        </div>

        {/* Role selector */}
        <div>
          <p className="block text-sm font-medium text-tinta-dark mb-2">
            Saya adalah
          </p>
          <div className="grid grid-cols-2 gap-3">
            <RoleCard
              role="mahasiswa"
              label="Mahasiswa"
              description="Menulis dan mengelola tugas akademik"
              icon={GraduationCap}
              selected={role === 'mahasiswa'}
              onSelect={setRole}
            />
            <RoleCard
              role="dosen"
              label="Dosen"
              description="Mengelola kelas dan meninjau submission"
              icon={BookOpen}
              selected={role === 'dosen'}
              onSelect={setRole}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-tinta-dark mb-1.5">
            Kata Sandi
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Minimal 8 karakter"
              className={cn(inputClass, 'pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tinta-warm hover:text-tinta-dark"
              aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-tinta-dark mb-1.5">
            Konfirmasi Kata Sandi
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="Ulangi kata sandi"
            className={inputClass}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-tinta-danger bg-red-50 px-3 py-2.5 rounded-md border border-red-200 animate-fade-in">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            'w-full flex items-center justify-center gap-2',
            'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700',
            'text-white font-medium py-2.5 rounded-md mt-2',
            'transition-colors duration-150',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          Daftar
        </button>
      </form>

      <p className="text-center text-sm text-tinta-warm mt-5">
        Sudah punya akun?{' '}
        <a href="/login" className="text-tinta-main font-medium hover:underline">
          Masuk di sini
        </a>
      </p>
    </AuthCard>
  )
}
