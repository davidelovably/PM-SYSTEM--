-- Add investment tracking fields to impact_areas table
ALTER TABLE public.impact_areas
ADD COLUMN investment_budget NUMERIC,
ADD COLUMN investment_period TEXT DEFAULT 'Totale';

COMMENT ON COLUMN public.impact_areas.investment_budget IS 'Budget/investimento allocato per questa area operativa';
COMMENT ON COLUMN public.impact_areas.investment_period IS 'Frequenza del budget (Totale, Mensile, Annuale)';