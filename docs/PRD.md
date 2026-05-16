# TINTA — Product Requirements Document (MVP)
## Tracking Integritas dan Navigasi Tulisan Asli

**Version:** 1.0 — MVP  
**PRD Target:** Engineering, Design, Product  
**Status:** Draft for Development -Zhillan, Claude Sonnet

---

## 1. Product Overview

### 1.1 Vision
TINTA is a web-based academic writing integrity platform built for Indonesian higher education. It does not detect AI — it **documents the learning process**. The core insight driving TINTA is that Indonesian educators no longer need to ask *"did this student use AI?"* — they need to know *"did this student actually learn while writing this?"*

TINTA answers that question through a live-recording writing environment, behavioral signal analysis, and a dosen-facing dashboard that surfaces learning evidence, not verdicts.

### 1.2 Core Users
| Role | Description |
|------|-------------|
| **Mahasiswa** | Writes assignments inside TINTA's editor. Sees their own writing analytics, session history, and integrity profile. |
| **Dosen** | Reviews submissions, watches replays, reviews flagged anomalies, and grades. Has full visibility into every student's writing process. |
| **Admin Institusi** | *(Post-MVP)* Manages class enrollment, dosen accounts, and institutional configuration. |

### 1.3 MVP Scope
MVP covers:
- Writing editor with full session recording (Layer 1)
- Session replay with timeline, heatmaps, and timestamps (Layer 2)
- Reference tagging and source declaration on paste (Layer 5)
- Integrity Signal Model with Learning Evidence Score (Layer 3)
- Behavioral anomaly detection surfaced to dosen (Layer 4)
- Dosen Dashboard with class overview, student detail, flag review, and CSV export
- Student Dashboard with session history, personal analytics, and reference management

MVP does **not** include: institutional SSO, LMS integration, mobile app, Bahasa Indonesia NLP model (uses API-based fallback), micro-check comprehension questions, or keystroke dynamics biometrics (planned for v1.1).

---

## 2. Information Architecture

```
TINTA Web App
├── /auth
│   ├── /login
│   └── /register (invite-only for MVP)
│
├── /mahasiswa  (student-facing)
│   ├── /dashboard          ← Student home: tasks, sessions, score overview
│   ├── /task/:id           ← Open a specific task
│   │   └── /write          ← The writing editor (core experience)
│   ├── /submissions        ← All submitted work
│   │   └── /:submission_id ← Submission detail: timeline, sessions, signals
│   └── /references         ← All declared references across all tasks
│
└── /dosen  (lecturer-facing)
    ├── /dashboard          ← Dosen home: class health overview
    ├── /class/:id          ← Class view: all students, all submissions for one task
    │   ├── /student/:id    ← Student detail: sessions, timeline, signal breakdown
    │   │   └── /replay     ← Full visual replay of writing session
    │   └── /export         ← Export class data as CSV
    └── /settings           ← Task configuration: thresholds, paste rules, session rules
```

---

## 3. Layer 1 — Core Recording Engine

### 3.1 Overview
Every writing session inside the TINTA editor produces a structured **event stream** persisted in real-time. The event stream is the immutable source of truth for all downstream analysis.

### 3.2 Editor Foundation
- **Technology:** React + TipTap (ProseMirror-based extensible rich text editor)
- **Custom TipTap Extension:** `TintaRecorder` — intercepts all editor transactions and emits structured events
- **Recording Indicator:** A persistent, non-dismissable UI element (top-right of editor chrome) shows `● Sesi Rekaman Aktif` in a subtle but always-visible state. Students are never in ambiguity about whether they are being recorded.

### 3.3 Event Schema
Every event is a JSON object with the following base fields:

```json
{
  "event_id": "uuid-v4",
  "event_type": "keystroke | paste | delete | select | undo | redo | focus | blur | idle | scroll | window_hidden | window_visible",
  "timestamp": 1716800000123,
  "session_id": "uuid-v4",
  "user_id": "uuid-v4",
  "task_id": "uuid-v4",
  "cursor_position": 342,
  "doc_length_before": 341,
  "doc_length_after": 342,
  "payload": {}
}
```

**Event-specific payloads:**

| Event Type | Payload Fields |
|---|---|
| `keystroke` | `key`, `is_delete_key` (bool) |
| `paste` | `pasted_text` (string), `pasted_char_count` (int), `declared_type` (null until declared), `source_url` (null until added) |
| `delete` | `deleted_text` (string), `deleted_char_count` (int), `was_selection` (bool) |
| `select` | `selected_text` (string), `selection_start` (int), `selection_end` (int) |
| `undo` | `chars_restored` (int), `chars_removed` (int) |
| `redo` | `chars_restored` (int), `chars_removed` (int) |
| `idle` | `idle_duration_ms` (int) |
| `window_hidden` | `duration_before_return_ms` (populated when window_visible fires) |

### 3.4 Transport & Persistence
- Events are batched client-side every **3 seconds** and sent via **WebSocket** to the event ingestion service
- On tab close or network loss, the pending batch is flushed via `navigator.sendBeacon` (non-blocking, fire-and-forget)
- Events are appended to an **append-only event log table** (PostgreSQL with JSONB). Events are never mutated post-write.
- Session boundary: a new `session_id` is created when the student opens the editor. A session is considered **closed** when the student has been idle for **≥ 2 hours** — the next time they open the editor for the same task, a new session begins. This mirrors git's commit boundary concept.

### 3.5 Session Metadata
At session open and session close, a `session_summary` record is written:

```json
{
  "session_id": "...",
  "task_id": "...",
  "user_id": "...",
  "started_at": "ISO8601",
  "ended_at": "ISO8601",
  "duration_active_ms": 5400000,
  "chars_typed": 1204,
  "chars_deleted": 287,
  "chars_pasted": 340,
  "paste_event_count": 3,
  "net_chars_added": 917,
  "undo_count": 12,
  "tab_switch_count": 8,
  "idle_periods": 4,
  "final_doc_length": 3840
}
```

This is the per-session summary that powers the **git-style delta view** on both dashboards.

---

## 4. Layer 2 — Replay Engine

### 4.1 Overview
The Replay Engine reconstructs the full document state at any point in time from the raw event log. Replay is **computed on-demand** — it is not stored as video. This keeps storage costs minimal while allowing full scrubbing.

### 4.2 Timeline Graph
**Location:** Student submission detail page + Dosen student detail page  
**What it shows:** A line graph of `document_length` over `time` across all sessions for one task.

**Visual encoding:**
- X-axis: wall-clock time from first session to submission
- Y-axis: document character count
- Each **session** is a distinct colored segment on the line
- **Paste events** are marked with a dot on the line (color-coded — see Layer 5)
- **Session gaps** (idle > 2h) are shown as dashed horizontal lines (document didn't change)
- Clicking any point on the graph scrubs the replay to that moment

**Healthy pattern example:** Gradually rising line with small dips (revisions), spread across multiple sessions over several days.  
**Anomaly pattern example:** Flat line for 8 minutes → sudden vertical spike of 3,000 characters → minimal movement after.

### 4.3 Per-Sentence Timestamp & Heatmap
**Location:** Replay view, displayed as an annotated document

**Mechanism:** As the replay engine reconstructs document state, it identifies **sentence boundaries** (period + space heuristic, with Bahasa Indonesia punctuation rules) and assigns each sentence:
- `first_typed_at` — timestamp of the first character of the sentence
- `last_modified_at` — timestamp of the most recent edit within the sentence boundary
- `revision_count` — how many distinct edit events touched this sentence
- `total_chars_modified` — cumulative characters added or removed within this sentence across all events

**Heatmap rendering:** Each sentence in the replay document view has a background color intensity proportional to its `revision_count`. Low revision = cool/transparent. High revision = warm amber. This visually shows *where* the student struggled, rethought, and rewrote — strong evidence of genuine cognitive engagement.

**Timestamp tooltip:** Hovering any sentence shows:
```
Kalimat ini pertama ditulis: [tanggal, jam]
Terakhir diubah: [tanggal, jam]
Direvisi sebanyak: X kali
```

### 4.4 Visual Replay Player
**Location:** `/dosen/class/:id/student/:id/replay`  
**Access:** Dosen only (student sees a read-only version of their own replay)

**UI Components:**
- **Document panel (left 70%):** Reconstructed document that updates character-by-character as replay plays
- **Control bar (bottom):** Play / Pause / Speed (1×, 2×, 5×, 10×, 30×) / Scrub slider
- **Event sidebar (right 30%):** Live-updating list of events as they play (keystroke bursts grouped, paste events highlighted, tab switches flagged)
- **Session selector (top):** Pills for each session — click to jump to the start of that session

**Anomaly markers on scrub bar:** Red markers at points in time where anomaly events occurred (large paste without declaration, long tab switch followed by keystroke burst). Dosen can jump directly to flagged moments.

**Auto-draft for anomaly cases:** When a student's submission has anomaly flags, the system pre-generates a **timestamped anomaly report** that the dosen can view inline:
```
⚠ Anomali terdeteksi pada sesi ini:

[00:03:14] Paste event: 1,847 karakter dalam satu event. Tidak ada deklarasi sumber.
[00:03:15 – 00:05:42] Tab switch terdeteksi (2 menit 27 detik). Tidak ada pengeditan selama periode ini.
[00:05:43] Pengetikan dilanjutkan. 214 karakter diketik dalam 3 menit.

Pola ini terdeteksi berulang 3 kali dalam sesi ini.
```

---

## 5. Layer 3 — Integrity Signal Model

### 5.1 Learning Evidence Score (LES)
The LES is a **0–100 composite score** calculated from multiple weighted signals. It is explicitly framed as a *learning evidence indicator*, not an AI detector. It answers: "how much evidence exists that this student actively engaged in producing this text?"

**Score display:** Shown as a horizontal spectrum bar (not a number alone) with a qualitative label:
- 0–30: `Perlu Perhatian` (red)
- 31–55: `Perlu Tinjauan` (amber)
- 56–75: `Cukup` (yellow-green)
- 76–100: `Baik` (green)

**Component signals and weights:**

| Signal | Weight | Description |
|---|---|---|
| Revision Depth | 25% | `chars_deleted / chars_ever_typed`. 0% is suspicious. 15–40% is healthy. |
| Session Distribution | 20% | Multiple sessions across multiple days = higher score. Single session = lower. |
| Organic Writing Ratio | 20% | `chars_typed_keystroke / total_final_chars`. Higher = more organic. |
| Paste Declaration Rate | 15% | What % of paste events were declared with a source type? |
| Writing Velocity Consistency | 10% | Low variance in writing speed across the session = healthy. Extreme spikes = penalized. |
| Tab Switch Pattern | 10% | Correlated tab switches (away → return → immediate typing burst) reduces score. |

**Important:** No single signal can fail a student. The LES is informational. The dosen makes all decisions.

### 5.2 Git-Style Session Delta (Student & Dosen View)
Each session in the session history is displayed like a git commit:

```
📝 Sesi 3 — Kamis, 15 Mei 2025, 20:14 – 22:01 (1j 47m aktif)
+342 penambahan  −89 penghapusan  3 paste  12 undo

📝 Sesi 2 — Rabu, 14 Mei 2025, 14:30 – 15:12 (42m aktif)
+614 penambahan  −201 penghapusan  1 paste  24 undo

📝 Sesi 1 — Selasa, 13 Mei 2025, 09:05 – 09:58 (53m aktif)
+889 penambahan  −0 penghapusan  0 paste  3 undo
```

Clicking any session expands to show the timeline graph segment and paste audit log for that session.

### 5.3 Student Dashboard — What Students See
The student dashboard is designed to be **transparent and empowering**, not punitive. Students should feel that TINTA is their ally in proving their work is genuine.

**Home page widgets:**
- **Tugas Aktif:** Cards for each active assignment with deadline countdown and current LES progress bar
- **Ringkasan Sesi Terakhir:** Git-style delta from the most recent writing session (e.g., "+342 karakter ditulis, −89 dihapus, 1 kutipan ditambahkan")
- **Referensi Belum Dikonfirmasi:** A call-to-action banner showing "X kalimat belum bereferensi — tambahkan sekarang" with a direct link to the reference tagging interface
- **Riwayat Sesi:** Full session history for each task with expandable git-style deltas

**Submission detail page (student view):**
- Timeline graph of their own writing process (same as dosen sees — full transparency)
- Sentence-level heatmap showing their revision hotspots
- LES breakdown: which signals contributed and how (no black box)
- All paste events and their declared status
- "Bukti Proses" summary card — a human-readable summary of their writing evidence (can be downloaded as PDF for records)

**What students cannot see:**
- Other students' data
- The dosen's flag decisions or internal notes

---

## 6. Layer 4 — Handling "Typing From AI" (Anomaly Detection)

### 6.1 Philosophy
TINTA cannot perfectly detect a student who reads AI output and manually types it. No system can. However, TINTA can **surface behavioral patterns that are statistically unusual** and present them to the dosen with full context. The dosen then exercises academic judgment.

### 6.2 Anomaly Signals

**Signal A: Correlated Tab-Switch Pattern**
Detected when: tab switch away (duration 30s–5min) is followed within 10 seconds of return by a typing burst of ≥ 50 characters, and this pattern repeats ≥ 3 times in a session.

Displayed as: `⚠ Pola baca-ketik berulang terdeteksi (X kali dalam sesi ini)`

**Signal B: Velocity Uniformity (IKI Pattern)**
Detected when: inter-keystroke interval (IKI) variance across the session is below the student's own historical baseline by more than 2 standard deviations. A robot-like uniform typing rhythm is flagged.

Displayed as: `⚠ IKI terlalu merata — pola mengetik tidak seperti biasanya`

Note: Baseline requires ≥ 2 prior tasks in the system. For new students, this signal is disabled until baseline is established.

**Signal C: Session Duration vs Output Ratio**
Detected when: session produced ≥ 2,000 characters in ≤ 10 minutes of active writing time. Raw typing speed of 200+ words/minute sustained is physiologically implausible without copy-paste.

Displayed as: `⚠ Durasi sesi terlalu singkat untuk jumlah output (X kata dalam Y menit)`

**Signal D: Zero Revision in Long Submission**
Detected when: final document is ≥ 500 characters and revision depth is < 3% (almost nothing was ever deleted or rewritten).

Displayed as: `⚠ Revisi sangat minim untuk panjang dokumen ini`

**Signal E: Single-Session Submission**
Informational (not flagged, just noted): entire submission was written in one session with no return visits. Not suspicious alone, but contributes to LES.

### 6.3 AI Likelihood Estimation
For each submission, TINTA runs the pasted content through an AI text likelihood API (GPTZero API or equivalent for MVP). The result is surfaced as:

`Estimasi konten berpotensi AI-generated: ~42%`

**Critical UX rule:** This percentage is labeled clearly as an estimate with low confidence. It is accompanied by: *"Angka ini bukan penilaian final. Harap tinjau konteks penuh sebelum membuat keputusan."* It is presented alongside, not above, all other signals.

### 6.4 Anomaly Display on Dosen Dashboard
On the class overview page:

```
Perlu Perhatian
5
Submission dengan anomali signifikan
```

Clicking reveals the flagged student table (as in the reference image):

| Mahasiswa | HE Score | Source % | Flag |
|---|---|---|---|
| Reza A. | 31 | 22% | ⚠ Score jauh di bawah historis (avg 74) |
| Siti N. | 52 | 15% | ⚠ 68% konten di-paste |
| Budi K. | 28 | 88% | ⚠ Session duration 4 menit untuk 3000 kata |
| Andi P. | 61 | 31% | ⚠ IKI terlalu merata (robotic pattern) |

Each row is clickable → opens the student detail page.

**Flag Review Workflow (Dosen Action Panel):**
After reviewing replay and signals, dosen chooses:
- ✅ **Cleared** — no issue found, flag dismissed, optional note added
- 💬 **Minta Klarifikasi** — sends a notification to the student requesting explanation (student replies through TINTA)
- 🚨 **Eskalasi** — marks submission for institutional academic integrity review

TINTA logs all dosen decisions with timestamps for audit trail.

---

## 7. Layer 5 — Handling Legitimate Copy-Paste

### 7.1 Paste Interception Modal
Triggered immediately after any paste event where pasted content is ≥ 60 characters.

**Modal design:**
```
┌─────────────────────────────────────────────────────┐
│  📋 Kamu baru saja menempel teks                    │
│  ─────────────────────────────────────────────────  │
│  Teks ini adalah:                                   │
│                                                     │
│  ○  Kutipan dari sumber (jurnal, buku, artikel)     │
│  ○  Teks milikku sendiri dari dokumen lain          │
│  ○  Catatan / draft pribadi                         │
│                                                     │
│  [ Tambahkan Sumber ]     [ Lanjutkan tanpa sumber ]│
└─────────────────────────────────────────────────────┘
```

**"Tambahkan Sumber" flow:** Opens an inline source input:
- Title of source (text field)
- Author (text field)
- URL or DOI (text field, optional)
- Year (text field, optional)

On confirm, the paste event is updated with `declared_type` and source metadata. The pasted text in the editor receives a subtle reference badge.

**"Lanjutkan tanpa sumber":** Modal closes. The paste event remains with `declared_type: null`. It will appear as yellow in the timeline and contribute to an "unconfirmed references" count.

**Auto-classification (before modal shows):**
- Paste < 60 characters → modal skipped, classified as `benign`, logged with `auto_classified: true`
- Paste matches URL/DOI regex → auto-classified as `citation`, no modal
- Paste matches bibliography pattern (author, year, title structure) → auto-classified as `citation`, no modal

### 7.2 Reference Tagging on Fact Sentences
Beyond paste events, students can manually tag any sentence in their document as containing a factual claim that needs a reference.

**Trigger:** Hover any sentence → a small `+ Referensi` button appears at the end of the sentence.

**Dashboard callout (Student):** A persistent banner at the top of the editor and on the student dashboard:
```
📎 3 kalimat berisi klaim fakta belum bereferensi
[ Tambahkan Referensi →  ]
```

Clicking highlights the unconfirmed sentences in the document with a pulsing amber underline and opens a side panel for adding sources sentence by sentence.

**Dashboard callout (Dosen):** On the student detail page, the Source Compliance Rate metric:
```
Source Compliance Rate
61%
61% klaim fakta bereferensi valid
```

Clicking this shows the list of unconfirmed fact sentences.

### 7.3 Timeline Color Coding (Dosen Replay View)
In the timeline scrub bar and the event sidebar during replay:

| Color | Meaning |
|---|---|
| 🟢 Green dot | Paste declared as citation with source |
| 🔵 Blue dot | Paste declared as own text / personal notes |
| 🟡 Yellow dot | Paste, no declaration given |
| 🔴 Red dot | Paste, no declaration, high AI likelihood score (>60%) |
| ⚪ White/small dot | Auto-classified as benign (short or citation-pattern) |

In the reconstructed document during replay, pasted segments are highlighted with the corresponding color as they appear.

---

## 8. Dosen Dashboard

### 8.1 Dashboard Home — Class Overview
**Route:** `/dosen/dashboard`

**Top-level metrics (4 stat cards):**
1. **Rata-rata Human Effort Score** — avg LES across all submitted students for the active task, with delta from previous task (e.g., `↑ 8 poin dari tugas sebelumnya`)
2. **Source Compliance Rate** — avg % of fact sentences with valid references
3. **Perlu Perhatian** — count of submissions with ≥ 1 significant anomaly flag
4. **Selesai Diverifikasi** — X/Y submissions reviewed (dosen has opened and made a decision on)

**Distribution chart:** Horizontal histogram of LES distribution across the class (how many students fall in each score band: 0–20, 21–40, 41–60, 61–80, 81–100). Helps dosen see class-wide patterns at a glance.

**Anomaly table** (as shown in reference image):

| Mahasiswa | HE Score | Source % | Flag |
|---|---|---|---|
| [name] | [score] | [%] | [flag description] |

**Full class table** (below the anomaly section): All students, sortable by: Name, LES, Submission Time, Source %, Flag status. Each row links to the student detail page.

### 8.2 Student Detail Page
**Route:** `/dosen/class/:id/student/:id`

**Sections:**
1. **Student header:** Name, task name, submission time, overall LES with color band
2. **Signal breakdown panel:** Each of the 6 LES signals shown individually with their contributing value and a plain-language explanation
3. **AI Likelihood estimate:** Clearly labeled with caveats
4. **Session history:** Git-style delta list for each session (same as student sees)
5. **Timeline graph:** Full writing timeline with paste event markers
6. **Paste audit table:** Every paste event with content preview (first 80 chars), character count, declared type, declared source, AI likelihood
7. **Sentence heatmap preview:** Condensed heatmap of revision hotspots
8. **Flag Review panel:** Dosen action (Clear / Request Clarification / Escalate) with optional note
9. **Grading panel** (see 8.4)

### 8.3 Replay Page
**Route:** `/dosen/class/:id/student/:id/replay`

Full-screen layout:
- Document reconstruction panel (70% width)
- Playback controls bar
- Event log sidebar (30% width)
- Session selector pills at top
- Anomaly markers on scrub bar

### 8.4 Grading Panel (per student)
Located at the bottom of the student detail page:

```
┌──────────────────────────────────────────────────────┐
│  Penilaian Tugas                                     │
│  ──────────────────────────────────────────────────  │
│  Nilai Konten:      [ _____ ] / 100                  │
│  Nilai Proses:      [ _____ ] / 100                  │
│  Catatan Dosen:     [ _________________________ ]    │
│  Status:           ○ Draft   ● Final                 │
│                                                      │
│  [ Simpan Draft ]              [ Finalisasi Nilai ]  │
└──────────────────────────────────────────────────────┘
```

"Nilai Proses" is a dosen-assigned score informed by the LES and replay, but ultimately the dosen's own judgment. TINTA suggests no grade — it only presents evidence.

### 8.5 Export to CSV
**Route:** `/dosen/class/:id/export`

Button: `Ekspor Data Kelas (.csv)`

Exported columns:
```
npm_mahasiswa, nama_mahasiswa, nama_tugas, submission_time,
les_score, les_band, sessions_count, total_active_time_minutes,
chars_typed, chars_deleted, chars_pasted, paste_event_count,
source_compliance_rate, flagged (boolean), flag_descriptions,
ai_likelihood_estimate, dosen_review_status,
nilai_konten, nilai_proses, catatan_dosen
```

This CSV is designed to be importable directly into common grading sheets (Excel, Google Sheets, SIAK NG format if applicable).

---

## 9. Student Dashboard

### 9.1 Dashboard Home
**Route:** `/mahasiswa/dashboard`

**Top section — Active Tasks:**
Cards for each open assignment showing:
- Task name and deadline countdown
- Current LES progress bar (their own score as it stands)
- Last session summary (git-style delta)
- Quick action: `Lanjut Menulis →`

**Middle section — Reference Alert:**
If any task has unconfirmed fact sentences:
```
📎 Kamu memiliki 3 kalimat yang belum bereferensi di [Nama Tugas]
[ Lengkapi Sekarang → ]
```

**Bottom section — Riwayat Sesi:**
Chronological list of all writing sessions across all tasks, git-style.

### 9.2 Writing Editor (`/mahasiswa/task/:id/write`)
Full-page editor. Components:
- **Top bar:** Task name, deadline, session timer (how long current session has been active), `● Rekaman Aktif` indicator, `Simpan & Tutup` button
- **Editor body:** Standard rich text (bold, italic, headings, bullet lists, numbered lists). Character count in bottom bar.
- **Side panel (collapsible):** Reference list for this task — all declared references. `+ Tambah Referensi Manual` for references not tied to a paste event.
- **Reference sentence highlights:** Unconfirmed fact sentences show amber underline in the editor itself so students are nudged to add references inline while writing.

### 9.3 Submission Detail — Student View
**Route:** `/mahasiswa/submissions/:id`

Sections:
1. **Bukti Proses card:** Human-readable summary of writing evidence (intended to replace Turnitin/Quillbot proof submissions)
   ```
   Kamu menulis esai ini dalam 4 sesi selama 3 hari.
   Total waktu menulis aktif: 2j 14m.
   Kamu mengetik 1.847 karakter secara organik dan melakukan 23 revisi signifikan.
   2 kutipan ditambahkan dengan sumber valid.
   ```
2. **Timeline graph** (same as dosen view — full transparency)
3. **Session list** with git-style deltas
4. **Sentence heatmap** (student sees their own revision hotspots)
5. **LES breakdown** — each signal explained in plain Bahasa Indonesia
6. **Reference table** — all declared references for this submission
7. **Download Bukti Proses (PDF)** — exports the summary card + session list + reference list as a PDF the student can submit elsewhere if required

---

## 10. UX Principles & Design Standards

### 10.1 Core UX Principles
1. **Transparency over surveillance.** Students always know what's being recorded and why. They can see everything the system knows about their writing.
2. **Evidence, not verdicts.** TINTA never accuses. Every signal has a plain-language explanation. Every dosen action is a human decision.
3. **Non-blocking.** Paste modals, reference prompts, and alerts never block the student from writing. They are dismissible.
4. **Progressive disclosure.** Summary first, detail on demand. Dosen sees aggregate metrics → clicks to anomaly table → clicks to student detail → clicks to replay.

### 10.2 Accessibility
- All interactive elements keyboard-navigable
- Color coding always paired with icon or text label (not color alone)
- Minimum contrast ratio 4.5:1 for all text

### 10.3 Notification Model
- In-app notifications only for MVP (no email)
- Students receive: `Tugasmu telah diterima`, `Dosenmu meminta klarifikasi: [message]`
- Dosen receives: `Submission baru masuk dari [student]`, `X mahasiswa belum mengumpulkan`

---

## 11. API Endpoints (MVP)

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/logout` | Invalidate session |

### Events
| Method | Endpoint | Description |
|---|---|---|
| WS | `/ws/session/:session_id/events` | Event stream ingestion |
| POST | `/api/events/flush` | Beacon flush on tab close |

### Sessions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sessions` | Create new session |
| PATCH | `/api/sessions/:id/close` | Close session, write summary |
| GET | `/api/sessions/:session_id/events` | Fetch raw events (for replay) |

### Tasks & Submissions
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | List tasks for current user |
| GET | `/api/tasks/:id` | Task detail |
| POST | `/api/submissions` | Submit task |
| GET | `/api/submissions/:id` | Submission detail + LES |

### References
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/references` | Add reference (from paste or manual) |
| PATCH | `/api/references/:id` | Update reference (add source to undeclared paste) |
| GET | `/api/submissions/:id/references` | All references for submission |

### Dosen
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dosen/class/:id/submissions` | All submissions for a task |
| GET | `/api/dosen/submissions/:id` | Full submission detail + signals |
| POST | `/api/dosen/submissions/:id/review` | Log flag review decision |
| PATCH | `/api/dosen/submissions/:id/grade` | Save/finalize grade |
| GET | `/api/dosen/class/:id/export.csv` | Export class data |

---

## 12. Tech Stack (Recommended)

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TipTap editor |
| Styling | Tailwind CSS |
| State | Zustand (client state), React Query (server state) |
| Real-time | Socket.io (event ingestion WebSocket) |
| Backend | Node.js + Express (REST API) |
| Database | PostgreSQL (Supabase for MVP speed) — events in JSONB |
| AI Likelihood | GPTZero API (external, MVP fallback) |
| Auth | Supabase Auth (JWT) |
| Hosting | Vercel (frontend) + Railway (backend) |
| Export | `json2csv` npm package |

---

## 13. Out of Scope for MVP

The following are planned for v1.1+ and explicitly excluded from MVP scope:
- Keystroke dynamics biometric baseline (requires ≥ 2 prior task history to be meaningful)
- Micro-check comprehension questions post-submission
- Bahasa Indonesia fine-tuned AI classifier (MVP uses GPTZero API)
- LMS integration (Moodle, eLearning)
- Mobile app
- Institutional SSO / SAML
- Admin Institusi role and multi-class management
- Bulk task creation and class roster import

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| False positives injure student reputation | LES is informational only. Dosen must take explicit action. All decisions are logged and reversible. |
| Students feel surveilled | Full transparency: students see everything the system sees about them. Recording indicator always visible. Privacy policy explicit about data scope. |
| Students type AI text manually | Tab-switch correlation, IKI variance, velocity ratio surface suspicious patterns. Micro-check (v1.1) adds direct comprehension validation. |
| High event storage cost | Events are JSONB-compressed. Replay is computed, not stored as video. Session summaries pre-aggregate for dashboard queries. |
| Dosen ignore the tool after novelty fades | Grading integration (LES data feeds into grade sheet) creates sustained workflow incentive. CSV export reduces friction for adoption. |

---

*Document prepared for TINTA MVP development. All decisions in this PRD reflect the product's core ethical commitment: TINTA is a tool for documenting learning, not prosecuting students.*
