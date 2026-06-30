/* ============================================================
   VrveFi — Auth (device-local accounts)
   Email/password and Google sign-in that gate the app and keep each
   account's data separate (stored locally per account). This is
   on-device auth — no server verification or cross-device sync yet.
   ============================================================ */
const Auth = (() => {
  const ACCTS = 'vrvefi_accounts';
  const SESSION = 'vrvefi_session';

  function accounts() { try { return JSON.parse(localStorage.getItem(ACCTS)) || {}; } catch { return {}; } }
  function saveAccounts(a) { localStorage.setItem(ACCTS, JSON.stringify(a)); }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vrvefi:' + text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  function setSession(id) { localStorage.setItem(SESSION, id); }

  function current() {
    const id = localStorage.getItem(SESSION);
    if (!id) return null;
    return accounts()[id] || null;
  }

  async function signUp(email, name, password) {
    email = (email || '').trim().toLowerCase();
    if (!validEmail(email)) throw new Error('Enter a valid email address.');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');
    const a = accounts();
    if (a[email]) throw new Error('An account with that email already exists — sign in instead.');
    a[email] = { id: email, email, name: (name || '').trim(), pass: await sha256(password), provider: 'email', created: Date.now() };
    saveAccounts(a);
    setSession(email);
    return a[email];
  }

  async function signIn(email, password) {
    email = (email || '').trim().toLowerCase();
    if (!validEmail(email)) throw new Error('Enter a valid email address.');
    const a = accounts();
    const acc = a[email];
    if (!acc) throw new Error('No account found for that email — create one below.');
    if (acc.provider === 'email' && acc.pass !== await sha256(password)) throw new Error('Incorrect password.');
    setSession(email);
    return acc;
  }

  // Google Identity Services: decode the ID-token JWT (client-side) for email+name.
  function decodeJwt(token) {
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(payload))));
    } catch { return null; }
  }
  function signInWithGoogle(credential) {
    const p = decodeJwt(credential);
    if (!p || !p.email) throw new Error('Google sign-in failed.');
    const email = p.email.toLowerCase();
    const a = accounts();
    a[email] = Object.assign({ id: email, email, provider: 'google', created: Date.now() }, a[email], { name: p.name || (a[email] && a[email].name) || '' });
    saveAccounts(a);
    setSession(email);
    return a[email];
  }

  function updateName(name) {
    const acc = current(); if (!acc) return;
    const a = accounts(); a[acc.id].name = name; saveAccounts(a);
  }

  function signOut() { localStorage.removeItem(SESSION); }

  return { current, signUp, signIn, signInWithGoogle, updateName, signOut, validEmail };
})();
