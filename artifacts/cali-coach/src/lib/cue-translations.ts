/**
 * cue-translations — pre-translated workout trigger phrases for all 29
 * ElevenLabs Multilingual v2 supported languages.
 *
 * By sending text already in the target language, ElevenLabs can speak it
 * correctly even when the LLM translation step is unavailable.
 */

// ─── Lookup map ───────────────────────────────────────────────────────────────

const CUES: Record<string, Record<string, string>> = {
  // Spoken at 30 seconds remaining
  "30s": {
    en: "30 seconds remaining — keep going, you've got this!",
    es: "¡30 segundos restantes — sigue adelante, tú puedes!",
    fr: "30 secondes restantes — continuez, vous y êtes presque !",
    de: "Noch 30 Sekunden — weiter so, du schaffst das!",
    it: "30 secondi rimanenti — avanti, ce la fai!",
    pt: "30 segundos restantes — continue, você consegue!",
    ja: "残り30秒 — 続けて、できるよ！",
    zh: "还剩30秒 — 继续加油，你能行！",
    ko: "30초 남았습니다 — 계속 해요, 할 수 있어요!",
    hi: "30 सेकंड बाकी — जारी रखो, तुम कर सकते हो!",
    ar: "30 ثانية متبقية — استمر، أنت تستطيع!",
    ru: "Осталось 30 секунд — продолжай, у тебя всё получится!",
    nl: "Nog 30 seconden — ga door, je kunt het!",
    tr: "30 saniye kaldı — devam et, yapabilirsin!",
    el: "Απομένουν 30 δευτερόλεπτα — συνέχισε, τα καταφέρνεις!",
    sv: "30 sekunder kvar — fortsätt, du klarar det!",
    fi: "30 sekuntia jäljellä — jatka, sinä pystyt siihen!",
    da: "30 sekunder tilbage — fortsæt, du klarer det!",
    no: "30 sekunder igjen — fortsett, du klarer det!",
    cs: "Zbývá 30 sekund — pokračuj, zvládneš to!",
    sk: "Zostáva 30 sekúnd — pokračuj, zvládneš to!",
    uk: "Залишилося 30 секунд — продовжуй, ти можеш!",
    ro: "Au mai rămas 30 de secunde — continuă, poți!",
    hu: "Még 30 másodperc — folytasd, meg tudod csinálni!",
    ta: "30 விநாடிகள் மீதமுள்ளன — தொடர், உன்னால் முடியும்!",
    bg: "Остават 30 секунди — продължавай, можеш!",
    hr: "Preostalo je 30 sekundi — nastavi, možeš to!",
    ms: "30 saat lagi — teruskan, kamu boleh!",
    id: "30 detik tersisa — teruskan, kamu bisa!",
  },

  // Spoken when the timer hits 0 (stretch complete)
  complete: {
    en: "Great work — stretch complete!",
    es: "¡Buen trabajo — estiramiento completado!",
    fr: "Excellent travail — étirement terminé !",
    de: "Gute Arbeit — Dehnung abgeschlossen!",
    it: "Ottimo lavoro — stretching completato!",
    pt: "Ótimo trabalho — alongamento concluído!",
    ja: "お疲れ様でした — ストレッチ完了！",
    zh: "干得好 — 拉伸完成！",
    ko: "잘 하셨습니다 — 스트레칭 완료!",
    hi: "शानदार काम — स्ट्रेच पूरा!",
    ar: "عمل رائع — التمرين اكتمل!",
    ru: "Отличная работа — растяжка завершена!",
    nl: "Goed gedaan — rek voltooid!",
    tr: "Harika iş — esnetme tamamlandı!",
    el: "Μπράβο — η άσκηση ολοκληρώθηκε!",
    sv: "Bra jobbat — sträckning klar!",
    fi: "Hyvä työ — venyttely suoritettu!",
    da: "Godt arbejde — strækning fuldført!",
    no: "Bra jobbet — strekk fullført!",
    cs: "Výborně — strečink dokončen!",
    sk: "Výborne — strečing dokončený!",
    uk: "Чудова робота — розтяжка завершена!",
    ro: "Muncă excelentă — stretching finalizat!",
    hu: "Nagyszerű munka — nyújtás kész!",
    ta: "சிறந்த வேலை — நீட்டல் முடிந்தது!",
    bg: "Чудесна работа — разтягането е завършено!",
    hr: "Odličan posao — istezanje završeno!",
    ms: "Kerja bagus — regangan selesai!",
    id: "Kerja bagus — peregangan selesai!",
  },

  // Shop "Test Voice" — lets users hear the voice personality in their language
  test: {
    en: "This is your new coach voice. Let's build something great together.",
    es: "Esta es tu nueva voz de entrenador. Vamos a construir algo grandioso juntos.",
    fr: "Voici ta nouvelle voix d'entraîneur. Construisons quelque chose de grand ensemble.",
    de: "Das ist deine neue Trainer-Stimme. Lass uns gemeinsam etwas Großartiges aufbauen.",
    it: "Questa è la tua nuova voce del coach. Costruiamo insieme qualcosa di grandioso.",
    pt: "Esta é a sua nova voz de treinador. Vamos construir algo grandioso juntos.",
    ja: "これがあなたの新しいコーチの声です。一緒に素晴らしいものを作りましょう。",
    zh: "这是你新的教练声音。让我们一起创造美好的事物。",
    ko: "이것이 당신의 새 코치 목소리입니다. 함께 멋진 것을 만들어 봅시다.",
    hi: "यह आपकी नई कोच आवाज़ है। आइए मिलकर कुछ शानदार बनाएं।",
    ar: "هذا هو صوت مدربك الجديد. دعنا نبني شيئاً رائعاً معاً.",
    ru: "Это твой новый голос тренера. Давай вместе создадим что-то великолепное.",
    nl: "Dit is je nieuwe coachstem. Laten we samen iets geweldigs bouwen.",
    tr: "Bu sizin yeni antrenör sesiniz. Hadi birlikte harika bir şey inşa edelim.",
    el: "Αυτή είναι η νέα φωνή του προπονητή σου. Ας χτίσουμε κάτι υπέροχο μαζί.",
    sv: "Det här är din nya tränares röst. Låt oss bygga något fantastiskt tillsammans.",
    fi: "Tämä on uusi valmentajasi ääni. Rakennetaan jotain hienoa yhdessä.",
    da: "Dette er din nye træners stemme. Lad os bygge noget fantastisk sammen.",
    no: "Dette er din nye trener-stemme. La oss bygge noe fantastisk sammen.",
    cs: "Toto je hlas tvého nového trenéra. Pojďme spolu vybudovat něco skvělého.",
    sk: "Toto je hlas tvojho nového trénera. Poďme spolu vybudovať niečo skvelé.",
    uk: "Це голос твого нового тренера. Давай разом створимо щось чудове.",
    ro: "Aceasta este vocea noului tău antrenor. Hai să construim ceva grozav împreună.",
    hu: "Ez az új edződ hangja. Építsünk együtt valami nagyszerűt.",
    ta: "இது உங்கள் புதிய பயிற்சியாளர் குரல். நாம் இணைந்து அருமையானதை உருவாக்குவோம்.",
    bg: "Това е гласът на твоя нов треньор. Нека заедно изградим нещо велико.",
    hr: "Ovo je glas vašeg novog trenera. Izgradimo zajedno nešto sjajno.",
    ms: "Ini adalah suara jurulatih baru anda. Mari kita bina sesuatu yang hebat bersama.",
    id: "Ini adalah suara pelatih baru Anda. Mari kita bangun sesuatu yang luar biasa bersama.",
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return a pre-translated workout trigger phrase for the given BCP-47 language.
 * Falls back to English if the language is not in the 29 supported set.
 */
export function getWorkoutCue(key: "30s" | "complete", bcp47: string): string {
  const base = (bcp47 ?? "en").split("-")[0]!.toLowerCase();
  return CUES[key]?.[base] ?? CUES[key]!["en"]!;
}

/**
 * Return a pre-translated Shop "Test Voice" phrase for the given BCP-47 language.
 * Falls back to English.
 */
export function getTestPhrase(bcp47: string): string {
  const base = (bcp47 ?? "en").split("-")[0]!.toLowerCase();
  return CUES["test"]?.[base] ?? CUES["test"]!["en"]!;
}
