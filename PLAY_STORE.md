# Publishing VrveFi on the Google Play Store

VrveFi is a web app, so the path is:
**PWA → host with HTTPS → wrap as an Android app → upload to Play Console.**
The PWA pieces are already built (manifest, service worker, icons). You provide
hosting + a Play account.

> ⚠️ **Read the "Finance app compliance" section at the bottom before you publish.**
> A finance app with market *predictions* gets extra review scrutiny.

---

## Step 1 — Host it online (with HTTPS)

Play requires your PWA to live at a real `https://` URL. The Node backend
(`server.js`) must run somewhere too — it serves the app **and** proxies live
market data + the Claude assistant.

Easiest host (free tier): **Render.com**
1. Push this `VrveFi/` folder to a GitHub repo.
2. Render → New → **Web Service** → connect the repo.
3. Settings:
   - Build command: *(leave blank — no dependencies)*
   - Start command: `node server.js`
4. Add environment variable (optional, for the live AI assistant):
   `ANTHROPIC_API_KEY = sk-ant-...`
5. Deploy. You get a URL like `https://vrvefi.onrender.com`.

(Railway, Fly.io, or any VPS work the same way — the app needs only Node 18+.)

Open the URL on your phone → Chrome menu → **Install app** to confirm the PWA
installs and runs full-screen.

> Your `ANTHROPIC_API_KEY` stays on the server and is **never** shipped in the
> app — keep it that way.

---

## Step 2 — Check the PWA is valid

In Chrome on desktop, open your hosted URL → DevTools (F12) → **Lighthouse** →
run the **PWA** category. You want it installable (manifest + service worker +
HTTPS — all already wired up here).

---

## Step 3 — Package it as an Android app

Two options. **PWABuilder is the recommended one for Windows (no Android SDK needed).**

### Option A — PWABuilder (easiest)
1. Go to **https://www.pwabuilder.com**
2. Paste your hosted URL → **Start**.
3. It scores your PWA, then click **Package for stores → Android → Google Play**.
4. Set:
   - **Package ID**: `com.vrvefi.app` (must match `.well-known/assetlinks.json` — pick your own reverse-domain id and keep it consistent everywhere)
   - **App name**: VrveFi
5. Download the zip. It contains:
   - `app-release-bundle.aab`  ← this is what you upload to Play
   - a signing key + a generated `assetlinks.json`
6. **Copy the SHA-256 fingerprint** PWABuilder gives you into
   `.well-known/assetlinks.json` (replace the placeholder), redeploy, so the app
   runs **without** a browser address bar (verified TWA).

### Option B — Bubblewrap (CLI, needs Java JDK + Android SDK)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-URL/manifest.webmanifest
bubblewrap build      # produces app-release-bundle.aab + signing key
```
Then add the key's SHA-256 to `assetlinks.json` as above.

---

## Step 4 — Google Play Console

1. Create a developer account: **https://play.google.com/console** — **$25 one-time**.
   (Personal accounts opened in 2023+ may need ~14 days of testing with testers
   before production access — start this early.)
2. **Create app** → fill name, language, "App", "Free".
3. **Upload** the `.aab` under a testing track first (Internal testing), then Production.
4. Complete the required sections:
   - **Store listing**: short + full description, screenshots (phone), the
     512×512 icon (`icons/icon-512.png`), a 1024×500 feature graphic.
   - **Privacy policy URL** (required — host a simple page; see note below).
   - **Data safety form**: declare what you collect. VrveFi stores finance data
     **locally on-device** and sends a finance snapshot to the Claude API only if
     you enabled the assistant — declare that honestly.
   - **Content rating** questionnaire.
   - **Target audience**: not children.
   - **App category**: Finance.
5. Submit for review (typically a few days).

---

## Finance app compliance — please read

Google Play has specific rules, and a finance app needs care:

- **Disclaimers**: VrveFi's market signals are model-generated and labeled "not
  financial advice." Keep that prominent in the listing **and** in-app. Do not
  imply guaranteed returns.
- **Privacy policy is mandatory.** State that financial data is stored on-device
  and that (if enabled) a snapshot is sent to Anthropic's API to power the
  assistant.
- **Sample data**: the app currently ships with demo transactions. For a real
  launch, start users from an empty state (or an onboarding import) rather than
  fake data, so the listing isn't misleading.
- **Regulatory angle**: depending on your country, distributing investment
  "predictions" to the public can carry legal weight. If you intend this as a
  real product (not a portfolio demo), get qualified legal advice first. The
  safest launch is to frame it as a **personal expense tracker** with market data
  as informational only.

---

## Quick checklist
- [ ] App hosted at an `https://` URL, installs as a PWA on your phone
- [ ] Lighthouse PWA check passes
- [ ] `.aab` generated via PWABuilder (Package ID `com.vrvefi.app`)
- [ ] SHA-256 added to `.well-known/assetlinks.json` and redeployed
- [ ] Privacy policy page live
- [ ] Play Console account created ($25), Data safety + content rating done
- [ ] Disclaimers visible in listing and app
- [ ] `.aab` uploaded, submitted for review
