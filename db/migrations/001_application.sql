CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL UNIQUE CHECK (login ~ '^[a-z0-9._-]{3,64}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  role text NOT NULL CHECK (role IN ('gestor', 'operador')),
  active boolean NOT NULL DEFAULT true,
  password_hash text,
  password_reset_required boolean NOT NULL DEFAULT true,
  default_rates jsonb NOT NULL DEFAULT '{"debito":300,"credito":400,"pix":100}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(default_rates) = 'object'),
  CHECK (default_rates ?& ARRAY['debito','credito','pix'] AND default_rates - ARRAY['debito','credito','pix'] = '{}'::jsonb),
  CHECK (default_rates->'debito' = 'null'::jsonb OR (jsonb_typeof(default_rates->'debito') = 'number' AND (default_rates->>'debito')::numeric BETWEEN 0 AND 10000 AND (default_rates->>'debito')::numeric = trunc((default_rates->>'debito')::numeric))),
  CHECK (default_rates->'credito' = 'null'::jsonb OR (jsonb_typeof(default_rates->'credito') = 'number' AND (default_rates->>'credito')::numeric BETWEEN 0 AND 10000 AND (default_rates->>'credito')::numeric = trunc((default_rates->>'credito')::numeric))),
  CHECK (default_rates->'pix' = 'null'::jsonb OR (jsonb_typeof(default_rates->'pix') = 'number' AND (default_rates->>'pix')::numeric BETWEEN 0 AND 10000 AND (default_rates->>'pix')::numeric = trunc((default_rates->>'pix')::numeric))),
  CHECK (password_hash IS NOT NULL OR password_reset_required)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);

CREATE TABLE password_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX password_tokens_user_id ON password_tokens(user_id);

CREATE TABLE auth_failures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  login_key text NOT NULL,
  ip_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_failures_login_created ON auth_failures(login_key, created_at);
CREATE INDEX auth_failures_ip_created ON auth_failures(ip_key, created_at);

CREATE TABLE sales_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  creator_id uuid NOT NULL REFERENCES users(id),
  last_editor_id uuid NOT NULL REFERENCES users(id),
  version integer NOT NULL CHECK (version >= 1),
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales_receipts (
  day_id uuid NOT NULL REFERENCES sales_days(id),
  unit_id text NOT NULL CHECK (unit_id IN ('balcao','buffet','massas','churrasco','marmita','vitrine')),
  method text NOT NULL CHECK (method IN ('debito','credito','dinheiro','pix')),
  amount bigint CHECK (amount BETWEEN 0 AND 9007199254740991),
  PRIMARY KEY (day_id, unit_id, method)
);

CREATE TABLE sales_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES sales_days(id),
  version integer NOT NULL CHECK (version >= 1),
  actor_id uuid NOT NULL REFERENCES users(id),
  request_id uuid NOT NULL UNIQUE,
  request_hash text NOT NULL CHECK (char_length(request_hash) = 64),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day_id, version)
);

CREATE TABLE sales_drafts (
  user_id uuid NOT NULL REFERENCES users(id),
  date date NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  base_version integer CHECK (base_version >= 1),
  draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE historical_cash_records (
  id text PRIMARY KEY,
  date date NOT NULL UNIQUE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  checksum text NOT NULL CHECK (char_length(checksum) = 64),
  imported_at timestamptz NOT NULL DEFAULT now(),
  CHECK (payload->>'id' = id AND payload->>'date' = to_char(date, 'YYYY-MM-DD')),
  CHECK (date >= DATE '2026-07-01' AND date < DATE '2026-08-01')
);

CREATE FUNCTION preserve_historical_cash() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O histórico importado é imutável. Use um procedimento de migração revisado.';
END;
$$;
CREATE TRIGGER historical_cash_immutable BEFORE UPDATE OR DELETE ON historical_cash_records
  FOR EACH ROW EXECUTE FUNCTION preserve_historical_cash();
