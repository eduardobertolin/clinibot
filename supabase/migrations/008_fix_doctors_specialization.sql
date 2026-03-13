-- =============================================================
-- Migration 008: Renomear doctors.specialty → specialization
--
-- Problema: A migration 001 criou a coluna como "specialty", mas o
-- código TypeScript (types.ts, orchestrator.ts e todas as queries)
-- referencia "specialization". Por causa do mismatch de nome, a
-- coluna sempre retornava NULL para o código da aplicação.
-- =============================================================

ALTER TABLE doctors RENAME COLUMN specialty TO specialization;
