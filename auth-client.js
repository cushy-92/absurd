(async () => {
  const screen = document.getElementById('authScreen');
  const landing = document.getElementById('authLanding');
  const panel = document.getElementById('authPanel');
  const title = document.getElementById('authTitle');
  const landingButtons = [...landing.querySelectorAll('[data-open-auth]')];
  const dashboard = document.querySelector('.app');
  const mobileNav = document.getElementById('mobileNav');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const message = document.getElementById('authMessage');
  const submit = document.getElementById('authSubmit');
  const reset = document.getElementById('authReset');
  const resend = document.getElementById('authResend');
  const checkEmail = document.getElementById('authCheck');
  const tabs = [...document.querySelectorAll('[data-auth-mode]')];
  let mode = 'login';
  let unverifiedUser = null;
  const say = (text, error = false) => { message.textContent = text; message.classList.toggle('error', error); };
  const announceAuthState = (authenticated) => {
    dashboard.inert = mobileNav.inert = !authenticated;
    window.absurdAuthenticated = authenticated;
    window.absurdAuthChecked = true;
    window.dispatchEvent(new Event('absurd:auth-checked'));
  };
  const errors = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован. Войди в аккаунт.',
    'auth/invalid-email': 'Проверь адрес электронной почты.',
    'auth/weak-password': 'Пароль должен содержать не менее 6 символов.',
    'auth/invalid-credential': 'Неверный email или пароль.',
    'auth/user-not-found': 'Аккаунт с таким email не найден.',
    'auth/too-many-requests': 'Слишком много попыток. Подожди и попробуй позже.',
    'auth/network-request-failed': 'Нет соединения. Проверь интернет.',
    'auth/operation-not-allowed': 'В Firebase не включён вход по email и паролю.',
    'auth/unauthorized-domain': 'Домен сайта не добавлен в разрешённые домены Firebase.',
    'auth/configuration-not-found': 'Firebase Authentication ещё не настроен для этого проекта.',
    'auth/app-not-authorized': 'Домен сайта не разрешён в настройках Firebase.',
    'auth/api-key-not-valid': 'Firebase отклонил ключ приложения. Проверь конфигурацию проекта.',
    'auth/invalid-api-key': 'Firebase отклонил ключ приложения. Проверь конфигурацию проекта.',
  };
  const setMode = (next) => {
    mode = next;
    tabs.forEach(button => button.classList.toggle('active', button.dataset.authMode === mode));
    title.textContent = mode === 'signup' ? 'Регистрация' : 'Вход';
    submit.textContent = mode === 'signup' ? 'Создать аккаунт' : 'Войти';
    reset.hidden = mode !== 'login';
    passwordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    say(mode === 'signup' ? 'После регистрации подтверди почту по ссылке из письма.' : '');
  };
  const showAuthPanel = () => {
    landing.hidden = true;
    panel.hidden = false;
    screen.scrollTop = 0;
  };
  landingButtons.forEach(button => button.addEventListener('click', () => {
    setMode(button.dataset.openAuth);
    showAuthPanel();
    if (!form.hidden) emailInput.focus();
  }));
  document.getElementById('authBack').addEventListener('click', () => {
    panel.hidden = true;
    landing.hidden = false;
    passwordInput.value = '';
    screen.scrollTop = 0;
    landingButtons.find(button => button.dataset.openAuth === mode)?.focus();
  });
  tabs.forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));
  setMode('login');

  const offlineIdentity = 'absurd-offline-account';
  const cacheRead = key => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  };
  const cacheWrite = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const cacheRemove = key => {
    try { localStorage.removeItem(key); } catch {}
  };
  const clearOfflineCopy = uid => {
    for (const prefix of ['absurd-cloud-cache:', 'absurd-polytech-link:', 'absurd-polytech-data:']) {
      cacheRemove(prefix + uid);
    }
    cacheRemove('absurd-cloud-cache:' + uid + ':time');
    cacheRemove(offlineIdentity);
  };
  const decodePolytex = snapshot => {
    const rows = JSON.parse(snapshot);
    if (!Array.isArray(rows)) throw new Error('Unexpected PolytexBot snapshot');
    const schedule = rows.find(row => row?.key === '$ruz-schedule' && row.kind === 'ruz-schedule');
    const weeks = Object.values(schedule?.weeks || {});
    return [rows.filter(row => row?.key !== '$ruz-schedule'), weeks.flatMap(week => Array.isArray(week) ? week : [])];
  };
  const centralUid = '9vWAFebDZmQIlMxnR3jcgVRytaU2';
  if (!navigator.onLine) {
    const account = cacheRead(offlineIdentity);
    const key = typeof account?.uid === 'string' && 'absurd-cloud-cache:' + account.uid;
    const state = key && cacheRead(key);
    if (state && typeof state === 'object' && !Array.isArray(state)) {
      window.absurdOfflineSession = true;
      window.absurdState = {
        readCached: () => ({ exists: true, state, cached: true, savedAt: cacheRead(key + ':time') }),
      };
      window.absurdPolytech = {
        centralUid,
        watchLinks(onChange) {
          onChange(cacheRead('absurd-polytech-link:' + account.uid) || '');
          return () => {};
        },
        watchSnapshot(botUid, onChange, onError) {
          const copy = cacheRead('absurd-polytech-data:' + account.uid);
          try {
            if (copy?.botUid === botUid) onChange(...decodePolytex(copy.snapshot), true, copy.savedAt);
            else onChange([], [], false);
          } catch { onError(); }
          return () => {};
        },
      };
      document.getElementById('accountLabel').textContent = account.email || 'Мой аккаунт';
      document.getElementById('accountEmail').textContent = account.email || '';
      screen.hidden = true;
      announceAuthState(true);
      window.addEventListener('online', () => location.reload(), { once: true });
      window.addEventListener('storage', event => {
        if (event.key === offlineIdentity && cacheRead(offlineIdentity)?.uid !== account.uid) location.reload();
      });
      return;
    }
    screen.hidden = false;
    showAuthPanel();
    form.hidden = true;
    document.getElementById('authTabs').hidden = true;
    panel.querySelector('[data-google-signin]').hidden = true;
    say('Нет подключения к интернету. Открой Absurd с интернетом и дождись загрузки данных на этом устройстве.', true);
    announceAuthState(false);
    window.addEventListener('online', () => location.reload(), { once: true });
    return;
  }

  try {
    if (!window.firebase) throw new Error('Firebase SDK не загрузился.');
    // Replace these public web-app values with the Firebase config from the user's project.
// Firebase Web API keys identify the project; authorization is enforced by verified ID tokens.
const firebaseConfig = {
  apiKey: "AIzaSyDDw5f87RqQXO3BazKn6LFn31ZNsCkVpmI",
  authDomain: "absurd-146c4.firebaseapp.com",
  projectId: "absurd-146c4",
  appId: "1:231234026285:web:1ba9d1a779600dc5b4f1a4",
  messagingSenderId: "231234026285",
};

    const config = firebaseConfig;
    if (!config.apiKey || config.apiKey.endsWith('_REQUIRED') || !config.projectId || config.projectId.endsWith('_REQUIRED')) {
      throw new Error('Сервис регистрации ещё не настроен.');
    }
    firebase.initializeApp(config);
    const auth = firebase.auth();
    auth.languageCode = 'ru';
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const CENTRAL_BOT_UID = centralUid;
    const CENTRAL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAtlA1IHiRMfcxXIVhyp3w
r6k6LoPOh6c/YHpTSAAO8BeHQV3dl6va6fjpwLGOz0Y12rGIOpmkLXXbTjGGgGZk
6j7jbxheVcZx7sdZzeKwD/IAzkKhp5taIRztZhT7ImyzpL/p4/8OE+GYG8vskhE8
KRuGIIGQgCcphufp0JnttkQxSTl7Kah3MX4cCh/TRIWpJVv3/Cn7Lur1DGL/E3Gu
ykAyos3ou564kQM02L9l6deYOgebTf2qWAUiOuIt0tCRyaK2f3hJD8WQrAltJkfW
ULYKO4/nQyelfN/2QYVIBn05EmeJUoByJ9P4nRXfgmNFmstWV3WOwLKlA15ol/DK
teNxy3CSrV0q7obBxrvOnLuF4AWL7ovsqDklC8Za8GkE6aBa4Bi/dcbtgigLWE/a
IP2OyDXxJA3+Nt8Scyzjzc5uKaBQGysTisjeZyYoJp0/UB5MKOXlhV42bF4hZmdF
ffs+Jl1W616eyMuQQ3+qfvLYYtanP1HJIveGIdX0fteVAgMBAAE=
-----END PUBLIC KEY-----`;
    const toBase64 = value => {
      const bytes = new Uint8Array(value);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    };
    const publicKeyBytes = () => {
      const binary = atob(CENTRAL_PUBLIC_KEY.replace(/-----[^-]+-----|\s/g, ''));
      return Uint8Array.from(binary, character => character.charCodeAt(0));
    };
    async function encryptPolytechCredentials(username, password) {
      if (!window.crypto?.subtle) throw new Error('Шифрование недоступно в этом браузере.');
      const publicKey = await crypto.subtle.importKey(
        'spki', publicKeyBytes(), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']
      );
      const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(JSON.stringify({ username, password }));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
      const rawKey = await crypto.subtle.exportKey('raw', aesKey);
      const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey);
      return { wrappedKey: toBase64(wrappedKey), iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
    }
    const stateRef = () => {
      const user = auth.currentUser;
      if (!user?.emailVerified) throw new Error('Нужно войти и подтвердить почту.');
      return firebase.firestore().collection('absurdState').doc(user.uid);
    };
    function polytechRef(collection) {
      const user = auth.currentUser;
      if (!user?.emailVerified) throw new Error('Подтверди почту в Absurd.');
      return firebase.firestore().collection(collection).doc(user.uid);
    }
    window.absurdPolytech = {
      centralUid: CENTRAL_BOT_UID,
      ownerUid: () => polytechRef('polytechLinks').id,
      async connectCentral({ username, password, groupName }) {
        const user = auth.currentUser;
        if (!user?.emailVerified) throw new Error('Подтверди почту в Absurd.');
        username = String(username || '').trim();
        password = String(password || '');
        groupName = String(groupName || '').trim();
        if (!username || username.length > 200 || !password || password.length > 500) {
          throw new Error('Проверь логин и пароль СПбПУ.');
        }
        if (!/^[\p{L}\p{N}][\p{L}\p{N}/ ._-]{0,79}$/u.test(groupName)) {
          throw new Error('Проверь номер группы.');
        }
        const encrypted = await encryptPolytechCredentials(username, password);
        if (auth.currentUser !== user) throw new Error('Аккаунт изменился. Подключи СПбПУ ещё раз.');
        const batch = firebase.firestore().batch();
        batch.set(polytechRef('polytechConnections'), { ...encrypted, groupName, active: true });
        batch.set(polytechRef('polytechLinks'), { botUid: CENTRAL_BOT_UID });
        await batch.commit();
      },
      async disconnectCentral() {
        const connection = polytechRef('polytechConnections');
        const links = polytechRef('polytechLinks');
        const deadlines = polytechRef('polytechDeadlines');
        const batch = firebase.firestore().batch();
        batch.delete(connection);
        batch.delete(links);
        batch.delete(deadlines);
        await batch.commit();
      },
      async createBotKey() {
        const user = auth.currentUser;
        if (!user?.emailVerified) throw new Error('Подтверди почту в Absurd.');
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnSecureToken: true }),
        });
        const bot = await response.json().catch(() => ({}));
        if (!response.ok || !bot.localId || !bot.refreshToken || !bot.idToken) {
          const error = new Error('Firebase не создал ключ бота.');
          error.code = bot?.error?.message || `firebase-http-${response.status}`;
          throw error;
        }
        try {
          await this.link(bot.localId);
        } catch (error) {
          fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(config.apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: bot.idToken }),
          }).catch(() => {});
          throw error;
        }
        return { ownerUid: user.uid, botUid: bot.localId, refreshToken: bot.refreshToken };
      },
      async link(botUid) {
        const user = auth.currentUser;
        const ref = polytechRef('polytechLinks');
        try {
          await ref.set({ botUid });
        } catch (error) {
          if (error.code !== 'permission-denied' || auth.currentUser !== user) throw error;
          await user.getIdToken(true);
          if (auth.currentUser !== user) throw error;
          await ref.set({ botUid });
        }
      },
      async unlink() {
        await polytechRef('polytechLinks').delete();
      },
      watchLinks(onChange, onError) {
        const ref = polytechRef('polytechLinks');
        const key = 'absurd-polytech-link:' + ref.id;
        let cached = cacheRead(key);
        if (typeof cached === 'string') onChange(cached);
        return ref.onSnapshot({ includeMetadataChanges: true }, doc => {
          if (!doc.exists && doc.metadata.fromCache && !doc.metadata.hasPendingWrites) return;
          const botUid = doc.data()?.botUid || '';
          if (!doc.metadata.fromCache && !doc.metadata.hasPendingWrites) {
            cacheWrite(key, botUid);
            if (cached && cached !== botUid) cacheRemove('absurd-polytech-data:' + ref.id);
            cached = botUid;
          }
          onChange(botUid);
        }, onError);
      },
      watchSnapshot(botUid, onChange, onError) {
        const ref = polytechRef('polytechDeadlines');
        const key = 'absurd-polytech-data:' + ref.id;
        let lastSnapshot;
        const showSnapshot = (value, fromCache, savedAt) => {
          if (value?.botUid !== botUid) {
            if (!fromCache && lastSnapshot !== null) {
              cacheRemove(key);
              lastSnapshot = null;
              onChange([], [], false);
            }
            return;
          }
          if (typeof value.snapshot === 'string' && value.snapshot === lastSnapshot) return;
          try {
            const decoded = decodePolytex(value.snapshot);
            lastSnapshot = value.snapshot;
            onChange(...decoded, true, savedAt);
          } catch { onError(); }
        };
        const cached = cacheRead(key);
        showSnapshot(cached, true, cached?.savedAt);
        return ref.onSnapshot({ includeMetadataChanges: true }, doc => {
          const value = doc.data();
          const fromCache = doc.metadata.fromCache || doc.metadata.hasPendingWrites;
          const savedAt = Date.now();
          if (!fromCache && value?.botUid === botUid) cacheWrite(key, { ...value, savedAt });
          showSnapshot(value, fromCache, fromCache ? undefined : savedAt);
        }, onError);
      },
    };
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    document.querySelectorAll('[data-google-signin]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await auth.signInWithPopup(googleProvider);
      } catch (error) {
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
          await auth.signInWithRedirect(googleProvider);
          return;
        }
        showAuthPanel();
        say(errors[error.code] || 'Не удалось войти через Google.', true);
      } finally { button.disabled = false; }
    }));
    const cacheKey = () => {
      const user = auth.currentUser;
      if (!user?.emailVerified) throw new Error('Нужно войти и подтвердить почту.');
      return `absurd-cloud-cache:${user.uid}`;
    };
    const readCache = () => {
      try {
        const snapshot = localStorage.getItem(cacheKey());
        return snapshot ? { exists: true, state: JSON.parse(snapshot), cached: true, savedAt: cacheRead(cacheKey() + ':time') } : { exists: false, state: {}, cached: true };
      } catch { return { exists: false, state: {}, cached: true }; }
    };
    window.absurdState = {
      readCached: readCache,
      async read() {
        const key = cacheKey();
        const record = await stateRef().get({ source: 'server' });
        const snapshot = record.exists ? record.data().snapshot : '';
        const state = snapshot ? JSON.parse(snapshot) : {};
        const savedAt = Date.now();
        try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
        cacheWrite(key + ':time', savedAt);
        return { exists: record.exists, state, cached: false, savedAt };
      },
      async write(snapshot) {
        if (new TextEncoder().encode(snapshot).length > 200_000) throw new Error('Слишком большой объём данных.');
        if (!navigator.onLine) throw new Error('Нет подключения к интернету.');
        const key = cacheKey();
        await stateRef().set({ snapshot });
        if (auth.currentUser && key === 'absurd-cloud-cache:' + auth.currentUser.uid) {
          try { localStorage.setItem(key, snapshot); } catch {}
          cacheWrite(key + ':time', Date.now());
          window.dispatchEvent(new Event('absurd:offline-copy-saved'));
        }
      },
    };
    window.absurdAuth = {
      headers: async () => {
        const user = auth.currentUser;
        if (!user || !user.emailVerified) throw new Error('Нужно войти и подтвердить email.');
        return { Authorization: `Bearer ${await user.getIdToken()}` };
      },
      signOut: () => auth.signOut(),
    };
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) logoutButton.addEventListener('click', () => auth.signOut());

    let activeUid = '';
    auth.onAuthStateChanged(async user => {
      if (activeUid && (user?.uid !== activeUid || !user.emailVerified)) {
        clearOfflineCopy(activeUid);
        screen.hidden = false;
        announceAuthState(false);
        location.reload();
        return;
      }
      unverifiedUser = user && !user.emailVerified ? user : null;
      resend.hidden = !unverifiedUser;
      checkEmail.hidden = !unverifiedUser;
      if (user && user.emailVerified) {
        try {
          activeUid = user.uid;
          cacheWrite(offlineIdentity, { uid: user.uid, email: user.email || '' });
          document.getElementById('accountLabel').textContent = user.email || 'Мой аккаунт';
          document.getElementById('accountEmail').textContent = user.email || '';
          screen.hidden = true;
          announceAuthState(true);
          window.dispatchEvent(new Event('absurd:auth-ready'));
        } catch {
          screen.hidden = false;
          announceAuthState(false);
          showAuthPanel();
          say('Не удалось проверить аккаунт. Попробуй войти ещё раз.', true);
        }
      } else {
        const prior = cacheRead(offlineIdentity);
        if (prior?.uid) clearOfflineCopy(prior.uid);
        screen.hidden = false;
        announceAuthState(false);
        if (unverifiedUser) {
          showAuthPanel();
          say('Открой письмо с подтверждением email, затем вернись сюда и войди. Проверь папку «Спам».');
        }
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      submit.disabled = true;
      try {
        if (mode === 'signup') {
          const credential = await auth.createUserWithEmailAndPassword(email, password);
          await credential.user.sendEmailVerification();
          unverifiedUser = credential.user;
          resend.hidden = false;
          say('Письмо отправлено. Подтверди email и затем войди.');
        } else {
          const credential = await auth.signInWithEmailAndPassword(email, password);
          if (!credential.user.emailVerified) {
            unverifiedUser = credential.user;
            resend.hidden = false;
            say('Сначала подтверди адрес по ссылке из письма.', true);
          }
        }
      } catch (error) {
        console.error('Firebase authentication error:', error.code, error.message);
        const details = error.code ? ` (код: ${error.code})` : '';
        say((errors[error.code] || 'Не получилось выполнить действие. Проверь настройки Firebase и попробуй снова.') + details, true);
      } finally { submit.disabled = false; }
    });

    reset.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email) { say('Сначала введи email, затем нажми «Забыли пароль?».', true); emailInput.focus(); return; }
      try { await auth.sendPasswordResetEmail(email); say('Если аккаунт существует, на эту почту придёт ссылка для сброса пароля.'); }
      catch (error) { say(errors[error.code] || 'Не удалось отправить письмо для сброса пароля.', true); }
    });
    checkEmail.addEventListener('click', async () => {
      try { await auth.currentUser?.reload(); if (auth.currentUser?.emailVerified) location.reload(); else say('Подтверждение ещё не найдено. Открой письмо, затем попробуй снова.'); }
      catch { say('Не удалось проверить адрес. Попробуй ещё раз.', true); }
    });
    resend.addEventListener('click', async () => {
      if (!unverifiedUser) return;
      try { await unverifiedUser.sendEmailVerification(); say('Письмо с подтверждением отправлено ещё раз.'); }
      catch (error) { say(errors[error.code] || 'Не удалось отправить письмо. Попробуй позже.', true); }
    });
    submit.disabled = false;
  } catch (error) {
    screen.hidden = false;
    showAuthPanel();
    form.hidden = true;
    document.getElementById('authTabs').hidden = true;
    landingButtons.forEach(button => { button.disabled = true; });
    announceAuthState(false);
    say(error.message || 'Сервис регистрации не настроен.', true);
  }
})();
