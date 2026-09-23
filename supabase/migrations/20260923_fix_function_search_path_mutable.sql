-- Security advisor (function_search_path_mutable) flagged these 3
-- functions for having no fixed search_path -- a search-path-hijack
-- vector for functions that resolve unqualified names. Pure hardening,
-- no behavior change for correct callers.

ALTER FUNCTION public._safe_numeric(text) SET search_path = public;
ALTER FUNCTION public._sub_in_month(text, text, text, text) SET search_path = public;
ALTER FUNCTION public._sub_in_month(text, text, timestamp with time zone, text) SET search_path = public;
