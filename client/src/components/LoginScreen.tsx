import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../store/authStore';
import { Button, Field, Input } from './ui';

export default function LoginScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fio, setFio] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err =
      mode === 'login'
        ? await auth.login(login.trim(), password)
        : await auth.register(fio.trim(), login.trim(), password);
    setBusy(false);
    if (err) toast.error(err);
  }

  const tabCls = (active: boolean) =>
    `flex-1 rounded-md py-1.5 text-[13px] font-medium transition-colors ${
      active ? 'bg-[var(--bg-raised)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'
    }`;

  return (
    <div className="grid h-full place-items-center">
      <form
        onSubmit={submit}
        className="w-[400px] rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-[32px] w-[32px] place-items-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)] font-mono text-sm font-bold text-[var(--accent-fg)]">
            ▣
          </span>
          <div>
            <div className="text-[15px] font-semibold leading-tight">db_man</div>
            <div className="text-[11px] text-[var(--muted)]">браузер баз данных PostgreSQL</div>
          </div>
        </div>

        <div className="mb-5 flex gap-1 rounded-lg bg-[var(--bg-panel)] p-1">
          <button type="button" className={tabCls(mode === 'login')} onClick={() => setMode('login')}>
            Вход
          </button>
          <button type="button" className={tabCls(mode === 'register')} onClick={() => setMode('register')}>
            Регистрация
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {mode === 'register' && (
            <Field label="ФИО">
              <Input
                value={fio}
                onChange={(e) => setFio(e.target.value)}
                placeholder="Иванов Иван Иванович"
                required
                autoFocus
              />
            </Field>
          )}
          <Field label="Логин">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus={mode === 'login'} />
          </Field>
          <Field label="Пароль">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
        </div>

        <Button variant="primary" type="submit" disabled={busy} className="mt-5 w-full justify-center">
          {busy ? '…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </Button>
      </form>
    </div>
  );
}
