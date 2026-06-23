import { chatJson } from '../llm/openrouter.js';
import { hasLLM } from '../config.js';
import { matchScamPattern } from './lapor.js';

// Deteksi AMBIGU (deterministik): deskripsi modus penipuan + pertanyaan verifikasi ("beneran ga ya?")
// → niat tak jelas (mau dicek atau dilaporkan). Lebih andal daripada menyerahkan ke LLM.
const VERIFY_Q =
  /\b(bener|benar|beneran|asli|valid|hoaks?)\b[\s\S]{0,15}\b(ga|gak|gk|nggak|engga|kah|ya|sih)\b|\bpenipuan\b[\s\S]{0,10}\b(bukan|kah|ga|gak)\b/i;
function looksAmbiguous(text) {
  return Boolean(matchScamPattern(text)) && VERIFY_Q.test(text);
}

// Klasifikasi maksud (Bagian 5.3 PRD + addendum Lapor):
//   info = tanya info, klaim = minta verifikasi, lapor = melaporkan penipuan, lain = lain-lain

const SYSTEM = `Klasifikasikan pesan warga (Bahasa Indonesia) ke salah satu maksud:
- "info"   : warga bertanya tentang bansos (syarat, jadwal, apakah ada bantuan, cara daftar).
- "klaim"  : warga MEMINTA verifikasi sebuah kabar/rumor yang beredar ("ini benar nggak...", "katanya ada bantuan 600rb, asli?").
- "lapor"  : warga MELAPORKAN / memberi tahu adanya PENIPUAN yang terjadi/beredar untuk diteruskan jadi peringatan,
             mis. "aku ditelpon ngaku dinsos minta transfer", "awas modus X lagi marak", "mau lapor penipuan".
- "ambigu" : warga menyebut suatu KEJADIAN/encounter yang mungkin penipuan TAPI niatnya tidak jelas — mau dicek
             kebenarannya ATAU mau dilaporkan? mis. "ada orang ngaku dari pajak, beneran ga ya?", "ini penipuan bukan sih?".
- "lain"   : sapaan, terima kasih, di luar topik.
Bedakan: klaim = NANYA soal kabar/rumor; lapor = MENYAMPAIKAN penipuan untuk diperingatkan; ambigu = nyrita kejadian + niat (cek vs lapor) belum jelas.
Jawab JSON: {"jenis":"info|klaim|lapor|ambigu|lain","alasan":string}`;

const LAPOR_HINTS = [
  'lapor', 'melaporkan', 'ngelaporin', 'ngelapor', 'mau ngadu', 'ketipu', 'kena tipu', 'tertipu',
  'awas', 'hati-hati ada', 'barusan ada yang', 'ngaku dari', 'modus', 'marak',
];
const KLAIM_HINTS = [
  'bener', 'benar', 'beneran', 'asli', 'hoaks', 'hoax', 'penipuan', 'katanya',
  'klik link', 'http', 'transfer', 'dapat bantuan', 'dapet bantuan', 'viral', 'beredar',
];
const INFO_HINTS = ['syarat', 'daftar', 'cara', 'kapan', 'jadwal', 'pkh', 'bpnt', 'bansos', 'pip', 'kis', 'apakah ada', 'ada bantuan'];
const SAPAAN = ['halo', 'hai', 'hi', 'assalamualaikum', 'pagi', 'siang', 'sore', 'malam', 'terima kasih', 'makasih', 'thanks'];

function heuristic(text) {
  const t = text.toLowerCase();
  if (LAPOR_HINTS.some((w) => t.includes(w))) return { jenis: 'lapor', alasan: 'heuristik kata kunci lapor' };
  if (KLAIM_HINTS.some((w) => t.includes(w))) return { jenis: 'klaim', alasan: 'heuristik kata kunci klaim' };
  if (INFO_HINTS.some((w) => t.includes(w))) return { jenis: 'info', alasan: 'heuristik kata kunci info' };
  if (t.trim().split(/\s+/).length <= 3 && SAPAAN.some((w) => t.includes(w)))
    return { jenis: 'lain', alasan: 'heuristik sapaan' };
  return { jenis: 'info', alasan: 'default ke info' };
}

/** Tentukan jenis pesan: info | klaim | lapor | ambigu | lain. Pakai LLM cepat, fallback heuristik. */
export async function classifyIntent(text) {
  // Override deterministik: kejadian mencurigakan + pertanyaan verifikasi → ambigu (niat tak jelas).
  if (looksAmbiguous(text)) return { jenis: 'ambigu', alasan: 'deskripsi modus + pertanyaan verifikasi' };
  if (!hasLLM()) return heuristic(text);
  try {
    const r = await chatJson({
      tier: 'fast',
      temperature: 0,
      maxTokens: 60, // cuma butuh JSON pendek {"jenis":...}
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
    });
    if (r && ['info', 'klaim', 'lapor', 'ambigu', 'lain'].includes(r.jenis)) return r;
    return heuristic(text);
  } catch {
    return heuristic(text);
  }
}
