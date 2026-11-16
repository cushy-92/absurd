(async () => {
  const screen = document.getElementById('authScreen');
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
    submit.textContent = mode === 'signup' ? 'Создать аккаунт' : 'Войти';
    reset.hidden = mode !== 'login';
    passwordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    say(mode === 'signup' ? 'После регистрации подтверди почту по ссылке из письма.' : 'Войди или создай аккаунт.');
  };
  tabs.forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));

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
    const stateRef = () => {
      const user = auth.currentUser;
      if (!user?.emailVerified) throw new Error('Нужно войти и подтвердить почту.');
      return firebase.firestore().collection('absurdState').doc(user.uid);
    };
    const cacheKey = () => {
      const user = auth.currentUser;
      if (!user?.emailVerified) throw new Error('Нужно войти и подтвердить почту.');
      return `absurd-cloud-cache:${user.uid}`;
    };
    const readCache = () => {
      try {
        const snapshot = localStorage.getItem(cacheKey());
        return snapshot ? { exists: true, state: JSON.parse(snapshot), cached: true } : { exists: false, state: {}, cached: true };
      } catch { return { exists: false, state: {}, cached: true }; }
    };
    window.absurdState = {
      readCached: readCache,
      async read() {
        const record = await stateRef().get({ source: 'server' });
        const snapshot = record.exists ? record.data().snapshot : '';
        if (snapshot) localStorage.setItem(cacheKey(), snapshot);
        return { exists: record.exists, state: snapshot ? JSON.parse(snapshot) : {}, cached: false };
      },
      async write(snapshot) {
        if (new TextEncoder().encode(snapshot).length > 200_000) throw new Error('Слишком большой объём данных.');
        localStorage.setItem(cacheKey(), snapshot);
        return stateRef().set({ snapshot });
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

    auth.onAuthStateChanged(async user => {
      unverifiedUser = user && !user.emailVerified ? user : null;
      resend.hidden = !unverifiedUser;
      checkEmail.hidden = !unverifiedUser;
      if (user && user.emailVerified) {
        try {
          document.getElementById('accountLabel').textContent = user.email || 'Мой аккаунт';
          document.getElementById('accountEmail').textContent = user.email || '';
          screen.hidden = true;
          announceAuthState(true);
          window.dispatchEvent(new Event('absurd:auth-ready'));
        } catch {
          screen.hidden = false;
          announceAuthState(false);
          say('Не удалось проверить аккаунт. Попробуй войти ещё раз.', true);
        }
      } else {
        screen.hidden = false;
        announceAuthState(false);
        if (unverifiedUser) say('Открой письмо с подтверждением email, затем вернись сюда и войди. Проверь папку «Спам».');
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
  } catch (error) {
    screen.hidden = false;
    form.hidden = true;
    document.getElementById('authTabs').hidden = true;
    announceAuthState(false);
    say(error.message || 'Сервис регистрации не настроен.', true);
  }
  setMode('login');
})();
