// src/lib/seed.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

const dirname = import.meta.dirname;
dotenv.config({ path: path.resolve(dirname, '../../.env.local') })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY!
)

async function seed() {
  console.log('🚀 Memulai Seeding...')

  const dosenEmail = 'dsn@app.com'
  const mhsEmail = 'mhs@app.com'

  // 1. Buat User Dosen
  const { data: dosen, error: dosenErr } = await supabaseAdmin.auth.admin.createUser({
    email: dosenEmail,
    password: 'password123', // PENTING: Supabase minimal mensyaratkan 6 karakter
    email_confirm: true,
    user_metadata: { full_name: 'Prof. Dr. Integritas', role: 'dosen' }
  })
  if (dosenErr) console.log('Info Dosen:', dosenErr.message)

  // 2. Buat User Mahasiswa
  const { data: mhs, error: mhsErr } = await supabaseAdmin.auth.admin.createUser({
    email: mhsEmail,
    password: 'password123',
    email_confirm: true,
    user_metadata: { full_name: 'Budi Mahasiswa', role: 'mahasiswa' }
  })
  if (mhsErr) console.log('Info Mahasiswa:', mhsErr.message)

  // 3. Ambil ID yang Tepat (Pencegahan jika auth sudah ada sebelumnya)
  let dosenId = dosen?.user?.id
  let mhsId = mhs?.user?.id

  if (!dosenId || !mhsId) {
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers()
    if (!dosenId) dosenId = allUsers.users.find(u => u.email === dosenEmail)?.id
    if (!mhsId) mhsId = allUsers.users.find(u => u.email === mhsEmail)?.id
  }

  // 4. === SEEDING EKSPLISIT PROFILES === (Agar tidak bergantung pada Trigger)
  if (dosenId) {
    await supabaseAdmin.from('profiles').upsert({
      id: dosenId,
      email: dosenEmail,
      full_name: 'Prof. Dr. Integritas',
      role: 'dosen'
    })
    console.log('✅ Profil Dosen berhasil diseed!')
  }

  if (mhsId) {
    await supabaseAdmin.from('profiles').upsert({
      id: mhsId,
      email: mhsEmail,
      full_name: 'Budi Mahasiswa',
      role: 'mahasiswa'
    })
    console.log('✅ Profil Mahasiswa berhasil diseed!')
  }

  // 5. Buat Task Dummy
  if (dosenId && mhsId) {
    const { data: task, error: taskErr } = await supabaseAdmin.from('tasks').insert({
      dosen_id: dosenId,
      title: 'Tugas Integritas Akademik Digital',
      description: 'Tuliskan pendapat Anda tentang AI dalam penulisan esai.',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      max_paste_ratio: 0.2
    }).select().single()

    if (taskErr) console.log('Info Task:', taskErr.message)

    if (task) {
      // 6. Enroll Mahasiswa
      await supabaseAdmin.from('task_enrollments').upsert({
        task_id: task.id,
        student_id: mhsId
      }, { onConflict: 'task_id, student_id' })
      console.log('✅ Task Dummy & Enrollment berhasil!')

    //   // 7. Seed Session Dummy
    //   const { data: session } = await supabaseAdmin.from('sessions').insert({
    //     task_id: task.id,
    //     user_id: mhsId,
    //     started_at: new Date(Date.now() + 3600000).toISOString(),
    //     ended_at: new Date().toISOString(),
    //     duration_active_ms: 3000000,
    //     chars_typed: 1500,
    //     chars_deleted: 150,
    //     chars_pasted: 300,
    //     paste_event_count: 2,
    //     net_chars_added: 1650,
    //     final_doc_length: 1650
    //   }).select().single()

    //   if (session) {
    //     console.log('✅ Session berhasil diseed!')

    //     // 8. Seed Events Dummy
    //     await supabaseAdmin.from('events').insert([
    //       {
    //         event_id: crypto.randomUUID(),
    //         event_type: 'keystroke',
    //         timestamp: Date.now() - 3500000,
    //         session_id: session.id,
    //         user_id: mhsId,
    //         task_id: task.id,
    //         doc_length_before: 0,
    //         doc_length_after: 1
    //       },
    //       {
    //         event_id: crypto.randomUUID(),
    //         event_type: 'paste',
    //         timestamp: Date.now() - 3400000,
    //         session_id: session.id,
    //         user_id: mhsId,
    //         task_id: task.id,
    //         doc_length_before: 1,
    //         doc_length_after: 301
    //       }
    //     ])
    //     console.log('✅ Events berhasil diseed!')

    //     // 9. Seed Submission Dummy
    //     const { data: submission } = await supabaseAdmin.from('submissions').insert({
    //       task_id: task.id,
    //       student_id: mhsId,
    //       submitted_at: new Date().toISOString(),
    //       final_doc_text: 'Penggunaan AI dalam penulisan esai memunculkan debat tentang integritas akademik...',
    //       les_score: 65.5,
    //       les_band: 'Cukup',
    //       revision_depth: 0.4,
    //       session_count: 1,
    //       organic_ratio: 0.8,
    //       paste_declaration_rate: 0.5,
    //       velocity_consistency: 0.7,
    //       tab_switch_score: 0.2,
    //       ai_likelihood_estimate: 0.85,
    //       flag_count: 1,
    //       dosen_review_status: 'minta_klarifikasi',
    //       nilai_konten: 80,
    //       nilai_proses: 75,
    //       finalized: true
    //     }).select().single()

    //     if (submission) {
    //       console.log('✅ Submission berhasil diseed!')

    //       // 10. Seed Paste Events Dummy
    //       await supabaseAdmin.from('paste_events').insert({
    //         session_id: session.id,
    //         submission_id: submission.id,
    //         student_id: mhsId,
    //         task_id: task.id,
    //         pasted_text: 'Teks ini didapatkan dari sumber eksternal tanpa sitasi...',
    //         pasted_char_count: 300,
    //         declared_type: 'AI Tool',
    //         ai_likelihood: 0.95,
    //         timestamp: Date.now() - 3400000
    //       })
    //       console.log('✅ Paste Events berhasil diseed!')

    //       // 11. Seed Document References
    //       await supabaseAdmin.from('document_references').insert({
    //         submission_id: submission.id,
    //         student_id: mhsId,
    //         sentence_text: 'Penelitian membuktikan bahwa AI mempengaruhi pola piker akademisi.',
    //         source_title: 'Jurnal Integritas',
    //         source_author: 'Fulan',
    //         source_year: '2025'
    //       })
    //       console.log('✅ References berhasil diseed!')

    //       // 12. Seed Anomaly Flags
    //       await supabaseAdmin.from('anomaly_flags').insert({
    //         submission_id: submission.id,
    //         student_id: mhsId,
    //         flag_type: 'High AI Likelihood',
    //         flag_description: 'Sistem mendeteksi kemungkinan besar teks ini dihasilkan oleh AI (95%).',
    //         severity: 'high'
    //       })
    //       console.log('✅ Anomaly Flags berhasil diseed!')

    //       // 13. Seed Dosen Reviews
    //       await supabaseAdmin.from('dosen_reviews').insert({
    //         submission_id: submission.id,
    //         dosen_id: dosenId,
    //         decision: 'minta_klarifikasi',
    //         note: 'Tolong jelaskan darimana kamu mendapatkan paragraf kedua. Indikasi plagiasi tinggi.'
    //       })
    //       console.log('✅ Dosen Reviews berhasil diseed!')
    //     }
    //   }
    }
  }

  console.log('🏁 Seluruh rangkaian Seeding selesai secara total! Silakan login dengan:')
  console.log('   Dosen: dsn@app.com / password123')
  console.log('   Mhs  : mhs@app.com / password123')
}

seed()