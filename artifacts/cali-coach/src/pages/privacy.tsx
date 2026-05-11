import { Link } from "wouter";
import { Lock, ArrowLeft, ExternalLink } from "lucide-react";

const LAST_UPDATED = "11 May 2026";

export function PrivacyPage() {
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
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground">
              CaliCoach Ltd ("we", "us", "our") is committed to protecting your personal information.
              This Privacy Policy explains what data we collect, how we use it, and the choices you have.
              By using CaliCoach (the "Service") you agree to the practices described here.
            </p>
          </section>

          {/* 2 – Camera */}
          <section className="rounded-xl border border-primary/25 bg-primary/5 p-5">
            <h2 className="text-lg font-bold mb-3 text-primary flex items-center gap-2">
              <Lock className="w-4 h-4" />
              2. Camera Access &amp; Pose Detection
            </h2>
            <p className="text-muted-foreground mb-3">
              CaliCoach requests access to your device camera{" "}
              <strong className="text-foreground">solely for real-time AI form analysis</strong>{" "}
              during workout sessions. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">On-device processing.</strong>{" "}
                Pose detection runs entirely on your device using MediaPipe. Raw camera frames are
                never transmitted to our servers.
              </li>
              <li>
                <strong className="text-foreground">No streaming to third parties.</strong>{" "}
                Your live camera feed is not shared with, sold to, or accessible by any third party.
              </li>
              <li>
                <strong className="text-foreground">Body calibration data.</strong>{" "}
                If you complete the optional one-time body calibration (wingspan, height proportions),
                these measurements are stored securely in your account to personalise coaching. You
                may delete them at any time via Settings.
              </li>
            </ul>
          </section>

          {/* 3 – Video clips */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">3. Video Clip Storage</h2>
            <p className="text-muted-foreground mb-3">
              CaliCoach gives you control over where your workout video clips are stored:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-sm mb-2 text-foreground">Local Storage (Default)</h3>
                <p className="text-xs text-muted-foreground">
                  Clips are saved only to your device's browser storage. They never leave your device
                  and are automatically purged after your chosen retention period (3–14 days). Clips
                  stored locally are not accessible to us or any third party.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-sm mb-2 text-foreground">Secure Server Upload (Optional)</h3>
                <p className="text-xs text-muted-foreground">
                  If you choose to share a clip to the Community Feed, it is uploaded to our secure
                  cloud storage (Google Cloud Storage, encrypted at rest and in transit). You can
                  delete shared clips at any time and they are permanently removed within 24 hours.
                </p>
              </div>
            </div>
          </section>

          {/* 4 – Biometric data */}
          <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
            <h2 className="text-lg font-bold mb-3 text-amber-400">4. Biometric Data — We Never Sell It</h2>
            <p className="text-muted-foreground mb-3">
              <strong className="text-foreground">
                We do not sell, rent, trade, or otherwise transfer your biometric data to any third party.
              </strong>{" "}
              This includes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Pose estimation data (joint angles, body landmarks)</li>
              <li>Body calibration measurements (wingspan, height proportions)</li>
              <li>Workout performance metrics (reps, form scores, session duration)</li>
              <li>Video clips stored on our servers</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Aggregated, anonymised analytics (e.g. "most popular exercises this week") may be used
              internally to improve the Service. These aggregations cannot be used to identify you.
            </p>
          </section>

          {/* 5 – Account data */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">5. Account &amp; Profile Data</h2>
            <p className="text-muted-foreground mb-3">
              When you create an account we collect:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Email address, display name, and optional profile photo (via Clerk authentication)</li>
              <li>Country code (auto-detected for national leaderboards; adjustable in Settings)</li>
              <li>Workout history, rep counts, form scores, and skill tree progress</li>
              <li>Social connections (friends list, friend requests)</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Authentication is powered by{" "}
              <a
                href="https://clerk.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Clerk <ExternalLink className="w-3 h-3" />
              </a>{" "}
              — see their Privacy Policy for details on how authentication credentials are handled.
            </p>
          </section>

          {/* 6 – Cookies */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">6. Cookies &amp; Local Storage</h2>
            <p className="text-muted-foreground">
              We use browser local storage to save your preferences (voice settings, camera facing,
              language, rest duration) and temporary session data (video clips, upload queue). We do
              not use advertising cookies or third-party tracking cookies.
            </p>
          </section>

          {/* 7 – Data sharing */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">7. Third-Party Services</h2>
            <p className="text-muted-foreground mb-3">
              We share data with the following sub-processors only as necessary to operate the Service:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                <thead className="bg-secondary/40">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-foreground">Service</th>
                    <th className="text-left px-4 py-2 font-semibold text-foreground">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Clerk", "User authentication & account management"],
                    ["Google Cloud Storage", "Optional video clip hosting (Community Feed)"],
                    ["ElevenLabs", "AI voice coaching audio (text sent, no personal data)"],
                    ["Neon / PostgreSQL", "Secure database hosting for workout data"],
                  ].map(([service, purpose]) => (
                    <tr key={service} className="bg-card">
                      <td className="px-4 py-2 text-muted-foreground font-medium">{service}</td>
                      <td className="px-4 py-2 text-muted-foreground">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 8 – Data retention */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">8. Data Retention &amp; Deletion</h2>
            <p className="text-muted-foreground">
              You may delete your account at any time. Upon deletion, all personal data (workout
              history, profile, uploaded clips) is permanently removed from our servers within 30 days.
              Some anonymised aggregate records may be retained for statistical purposes but cannot
              be linked back to you.
            </p>
          </section>

          {/* 9 – Your rights */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">9. Your Rights</h2>
            <p className="text-muted-foreground mb-2">Under applicable law (including UK GDPR) you have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request erasure ("right to be forgotten")</li>
              <li>Object to processing for direct marketing</li>
              <li>Lodge a complaint with the Information Commissioner's Office (ICO)</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:privacy@calicoach.app" className="text-primary hover:underline">
                privacy@calicoach.app
              </a>.
            </p>
          </section>

          {/* 10 – Changes */}
          <section>
            <h2 className="text-lg font-bold mb-3 text-foreground">10. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of material
              changes via in-app notification or email. The "Last updated" date at the top of this
              page always reflects the most recent version.
            </p>
          </section>

          {/* Terms link */}
          <div className="pt-4 border-t border-border">
            <Link
              href="/terms"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Read our Terms &amp; Conditions
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
