-- Phase 1: Add 'client' role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'client';