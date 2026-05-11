import { Link } from "wouter";
import { Shield, ArrowLeft, ExternalLink } from "lucide-react";

const LAST_UPDATED = "11 May 2026";

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-10 pb-24 md:pb-12">

        {/* Back link */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Terms &amp; Conditions</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By creating an account or using CaliCoach (the "Service"), you agree to be bound by
              these Terms &amp; Conditions. If you do not agree, please do not use the Service.
              CaliCoach is operated by CaliCoach Ltd ("we", "us", "our").
            </p>
          </section>

          {/* 2 – Physical Activity Readiness */}
          <section className="rounded-xl border border-primary/25 bg-primary/5 p-5">
            <h2 className="text-lg font-bold mb-3 text-primary flex items-center gap-2">
              <Shield className="w-4 h-4" />
              2. Physical Activity Readiness Declaration
            </h2>
            <p className="text-muted-foreground mb-3">
              By using CaliCoach you confirm that, to the best of your knowledge:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>You are physically fit and medically cleared to participate in calisthenics exercise.</li>
              <li>You do not have any condition, injury, or disability that would make vigorous physical
                  activity unsafe without the supervision of a licensed healthcare professional.</li>
              <li>You are 18 years of age or older (or have obtained parental/guardian consent).</li>
              <li>If you are unsure whether exercise is appropriate for you, you agree to consult a
                  qualified physician before using the Service.</li>
            </ul>
          </section>

          {/* 3 – Liability Waiver */}
          <section className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-5">
            <h2 className="text-lg font-bold mb-3 text-rose-400">3. Liability Waiver</h2>
            <p className="text-muted-foreground mb-3">
              <strong className="text-foreground">Exercise carries inherent risk of injury.</strong>{" "}
              By using CaliCoach you voluntarily assume all risks associated with participation in
              calisthenics and physical fitness activities.
            </p>
            <p className="text-muted-foreground mb-3">
              To the fullest extent permitted by law, CaliCoach, its directors, employees, contractors,
              and affiliates shall not be liable for any direct, indirect, incidental, special, or
              consequential damages — including personal injury, bodily injury, or property damage —
              arising from or connected to your use of the Service, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Injuries sustained while following AI coaching cues or ghost-mode demonstrations.</li>
              <li>Injuries resulting from performing exercises beyond your current fitness level.</li>
              <li>Reliance on automated form-score feedback as a substitute for professional coaching.</li>
              <li>Equipment failures, environmental hazards, or accidents during workouts.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Nothing in this clause limits liability for death or personal injury caused by our
              negligence, or for fraudulent misrepresentation, where such limitation is prohibited by law.
            </p>
          </section>

          {/* 4 – AI Ghost Coach */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">4. AI Ghost Coach — Not Medical Advice</h2>
            <p className="text-muted-foreground mb-3">
              The "Ghost Coach" is an automated AI system that uses computer-vision pose estimation to
              provide real-time form feedback, rep counting, and guided movement overlays. It is an
              educational and motivational tool only.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Not a replacement for professional advice.</strong>{" "}
                Ghost Coach feedback does not constitute medical, physiotherapy, or professional athletic
                coaching advice.
              </li>
              <li>
                <strong className="text-foreground">Automated system limitations.</strong>{" "}
                AI pose detection can produce inaccurate results depending on lighting, camera angle,
                clothing, and body type. Always use your own judgement and stop if you feel pain.
              </li>
              <li>
                <strong className="text-foreground">Consult a professional.</strong>{" "}
                If you experience pain, discomfort, or unusual symptoms during a workout, stop
                immediately and seek advice from a qualified healthcare professional.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">5. User Accounts</h2>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your account credentials and
              for all activities that occur under your account. You agree to notify us immediately of
              any unauthorised use. We reserve the right to terminate accounts that violate these Terms.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">6. Subscription &amp; Payments</h2>
            <p className="text-muted-foreground">
              CaliCoach Pro subscriptions are billed in advance on a monthly or annual basis.
              Subscriptions renew automatically unless cancelled before the renewal date. Refunds are
              handled on a case-by-case basis in accordance with applicable consumer law. Promo codes
              are single-use, non-transferable, and have no cash value.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">7. Intellectual Property</h2>
            <p className="text-muted-foreground">
              All content, trademarks, software, and design elements of CaliCoach are the exclusive
              property of CaliCoach Ltd or its licensors. You may not copy, reproduce, or distribute
              any part of the Service without prior written consent.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">8. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms from time to time. We will notify you of significant changes
              via the app or email. Continued use of the Service after changes take effect constitutes
              your acceptance of the revised Terms.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">9. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by and construed in accordance with the laws of England and
              Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of
              England and Wales.
            </p>
          </section>

          {/* Contact */}
          <section className="pt-4 border-t border-border">
            <h2 className="text-lg font-bold mb-3 text-foreground">Contact</h2>
            <p className="text-muted-foreground">
              Questions about these Terms? Contact us at{" "}
              <a
                href="mailto:legal@calicoach.app"
                className="text-primary hover:underline"
              >
                legal@calicoach.app
              </a>.
            </p>
          </section>

          {/* Privacy link */}
          <div className="pt-2">
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Read our Privacy Policy
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
