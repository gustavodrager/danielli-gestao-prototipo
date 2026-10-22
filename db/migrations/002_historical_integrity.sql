-- CHECK aceita NULL. Exigir presença e tipos impede que um payload incompleto
-- contorne a correspondência entre o documento preservado e a chave importada.
ALTER TABLE historical_cash_records
  ADD CONSTRAINT historical_cash_payload_identity_required CHECK (
    payload ?& ARRAY['id', 'date']
    AND jsonb_typeof(payload->'id') = 'string'
    AND jsonb_typeof(payload->'date') = 'string'
    AND payload->>'id' = id
    AND payload->>'date' = to_char(date, 'YYYY-MM-DD')
  );

-- TRUNCATE não executa triggers de DELETE. O bloqueio por instrução preserva
-- julho também nessa operação, sem interferir em INSERT/COPY de restauração.
CREATE TRIGGER historical_cash_no_truncate
  BEFORE TRUNCATE ON historical_cash_records
  FOR EACH STATEMENT EXECUTE FUNCTION preserve_historical_cash();
