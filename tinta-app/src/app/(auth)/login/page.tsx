'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SignInPage } from '@/components/ui/sign-in'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const email    = formData.get('email') as string
    const password = formData.get('password') as string

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError('Email atau kata sandi salah. Coba lagi.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'dosen') {
      router.push('/dosen/dashboard')
    } else {
      router.push('/mahasiswa/dashboard')
    }
  }

  const sampleTestimonials = [
    {
      avatarSrc: 'images/rania.png',
      name: 'Rania Aqila',
      handle: 'Mahasiswi Fasilkom UI | Jurusan Sistem Informasi',
      text: 'TINTA dapat membantu saya dalam memberikan bukti yang konkrit bahwa tugas yang saya kerjakan merupakan hasil tangan sendiri, bukan oleh AI.',
    },
    {
      avatarSrc: 'images/zhillan.png',
      name: 'Zhillan Baniaksa',
      handle: 'Mahasiswa Fasilkom UI | Jurusan Ilmu Komputer KKI',
      text: 'melalui fitur yang melimpah yang ditawarkan oleh TINTA, saya dapat mengerjakan tugas saya dengan lebih mudah.',
    },
  ]

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 text-sm px-6 py-3 rounded-2xl shadow-lg animate-fade-in">
          {error}
        </div>
      )}
      <SignInPage
        onSignIn={handleSignIn}
        onResetPassword={() => alert('Hubungi admin institusimu untuk reset kata sandi.')}
        onCreateAccount={() => alert('Daftar melalui undangan dari dosenmu.')}
        testimonials={sampleTestimonials}
      />
    </>
  )
}
